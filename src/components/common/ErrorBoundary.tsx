import React, { Component, ReactNode } from 'react';
import {
    DEFAULT_LANGUAGE,
    LANGUAGE_STORAGE_KEY,
    type ResolvedLanguage,
    localizeUserFacingText,
    normalizeLanguage,
    pickByResolvedLanguage,
} from '../../utils/localeText';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

const getBoundaryLanguage = (): ResolvedLanguage => {
    if (typeof window === 'undefined') {
        return DEFAULT_LANGUAGE;
    }

    let language: ResolvedLanguage = DEFAULT_LANGUAGE as ResolvedLanguage;

    try {
        language = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    } catch {
        language = DEFAULT_LANGUAGE as ResolvedLanguage;
    }

    if (typeof document !== 'undefined') {
        document.documentElement.lang = language;
        document.documentElement.dataset.language = language;
    }

    return language;
};

const pickBoundaryText = <T,>(language: ResolvedLanguage, zh: T, en: T): T =>
    pickByResolvedLanguage(language, zh, en);

const localizeBoundaryErrorText = (_language: ResolvedLanguage, value?: string | null): string | undefined => {
    if (value == null) {
        return value ?? undefined;
    }

    return localizeUserFacingText(value) || value;
};

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            const language = getBoundaryLanguage();

            return (
                <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
                    <div
                        className="border border-red-500/20 rounded-2xl p-8 max-w-md"
                        style={{
                            background: 'var(--frost-card-framework-bg)',
                            boxShadow: 'var(--frost-card-framework-shadow)',
                            backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                            WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                        }}
                    >
                        <h2 className="text-xl font-bold text-red-500 mb-4">
                            {pickBoundaryText(language, '应用错误', 'Application Error')}
                        </h2>
                        <p className="mb-4 text-[var(--text-secondary)]">
                            {pickBoundaryText(language, '页面发生异常，请刷新后重试。', 'Something went wrong. Please refresh the page.')}
                        </p>
                        <pre className="text-xs text-[var(--text-tertiary)] bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] p-3 rounded overflow-auto max-h-40">
                            {localizeBoundaryErrorText(language, this.state.error?.message)}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 w-full bg-[var(--accent-coral)] hover:opacity-90 text-white py-2 rounded-lg transition"
                        >
                            {pickBoundaryText(language, '刷新页面', 'Reload Page')}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

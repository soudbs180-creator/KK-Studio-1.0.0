import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { pickByDocumentLanguage } from '../utils/localeText';

export type AppLanguage = 'zh-CN' | 'en-US';

type LocaleContextValue = {
  language: AppLanguage;
  locale: string;
  isChinese: boolean;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  pick: <T,>(zh: T, en: T) => T;
};

const DEFAULT_LANGUAGE: AppLanguage = 'zh-CN';
const STORAGE_KEY = 'kk_language';

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const normalizeLanguage = (value?: string | null): AppLanguage => {
  if (!value) return DEFAULT_LANGUAGE;
  return value.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
};

const getStoredLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
};

const applyDocumentLanguage = (language: AppLanguage) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
};

export const pickByLanguage = <T,>(language: AppLanguage, zh: T, en: T): T =>
  language === 'zh-CN' ? zh : en;

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(getStoredLanguage);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, language);
    applyDocumentLanguage(language);
  }, [language]);

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      language,
      locale: language,
      isChinese: language === 'zh-CN',
      setLanguage: setLanguageState,
      toggleLanguage: () => setLanguageState((current) => (current === 'zh-CN' ? 'en-US' : 'zh-CN')),
      pick: <T,>(zh: T, en: T) => pickByLanguage(language, zh, en),
    }),
    [language]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error(pickByDocumentLanguage('useLocale 必须在 LocaleProvider 内使用。', 'useLocale must be used within a LocaleProvider'));
  }
  return context;
};

const WORKSPACE_DATA_DIRS = new Set([
    'picture',
    'video',
    'refs',
    'settings',
    'tags',
    'originals',
    'thumbnails',
    'cache',
    'images',
]);

const SOURCE_CODE_SEGMENTS = new Set([
    'config',
    'migrations',
    'packages',
    'scripts',
    'server',
    'src',
    'tests',
]);

const ALWAYS_IGNORE_SEGMENTS = new Set([
    '.agents',
    '.git',
    '.kk-local',
    '.tmp-playwright',
    '.vite',
    '.vscode',
    'dist',
    'node_modules',
]);

const ALWAYS_IGNORE_FILENAMES = [
    /^tmp-.*\.(out|err|log)$/i,
];

export function shouldIgnoreWatchPath(targetPath: string): boolean {
    const normalized = targetPath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    const filename = segments[segments.length - 1]?.toLowerCase() || '';

    if (ALWAYS_IGNORE_FILENAMES.some((pattern) => pattern.test(filename))) {
        return true;
    }

    if (
        segments.some((segment) =>
            ALWAYS_IGNORE_SEGMENTS.has(segment)
            || segment.startsWith('recovery_')
            || segment.startsWith('backup_')
        )
    ) {
        return true;
    }

    if (normalized.endsWith('/project.json') || normalized.includes('/docs/')) {
        return true;
    }

    const isSourceCodePath = segments.some((segment) => SOURCE_CODE_SEGMENTS.has(segment));
    return !isSourceCodePath && segments.some((segment) => WORKSPACE_DATA_DIRS.has(segment));
}

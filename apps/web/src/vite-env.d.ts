/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_AUTH_REDIRECT_ORIGIN?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

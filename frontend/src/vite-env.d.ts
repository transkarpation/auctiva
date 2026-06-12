/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_API_URL?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_BASE_SEPOLIA_HTTP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

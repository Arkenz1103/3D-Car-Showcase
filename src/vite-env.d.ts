/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MULTIPLAYER_WS_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** Preferred Supabase public API key; safe for client-side Vite use. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Backwards-compatible alias for legacy Supabase anon keys. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

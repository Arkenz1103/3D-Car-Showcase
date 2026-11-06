/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MULTIPLAYER_WS_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

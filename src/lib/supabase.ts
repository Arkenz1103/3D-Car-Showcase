import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  || "";

const isSupportedPublicKey = (key: string) =>
  /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
  || /^[A-Za-z0-9_-]+={0,2}\.[A-Za-z0-9_-]+={0,2}\.[A-Za-z0-9_-]+={0,2}$/.test(key);

const clientConfiguration = (() => {
  if (!supabaseUrl) {
    return { client: null, error: "Set VITE_SUPABASE_URL in the Vercel environment." };
  }
  if (!supabasePublicKey) {
    return {
      client: null,
      error: "Set VITE_SUPABASE_PUBLISHABLE_KEY (or the legacy VITE_SUPABASE_ANON_KEY) in the Vercel environment.",
    };
  }
  if (!isSupportedPublicKey(supabasePublicKey)) {
    return {
      client: null,
      error: "The Supabase key must be a publishable key or a legacy anon JWT. Never use a service-role key in the browser.",
    };
  }
  try {
    const parsedUrl = new URL(supabaseUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return { client: null, error: "VITE_SUPABASE_URL must be a valid HTTP(S) Supabase project URL." };
    }
  } catch {
    return { client: null, error: "VITE_SUPABASE_URL must be a valid HTTP(S) Supabase project URL." };
  }

  try {
    return {
      client: createClient(supabaseUrl, supabasePublicKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }),
      error: "",
    };
  } catch {
    return { client: null, error: "Check that the Supabase project URL and public key are valid." };
  }
})();

export const supabase = clientConfiguration.client;
export const supabaseConfigurationError = clientConfiguration.error;
export const supabaseConfigured = Boolean(supabase);

export type SupabaseCredentialCheck =
  | { valid: true }
  | { valid: false; reason: "unconfigured" | "rejected" | "unreachable"; message: string };

let credentialCheckPromise: Promise<SupabaseCredentialCheck> | undefined;

/** Verify the browser-safe API key against Supabase Auth without involving a user session. */
export async function verifySupabaseCredentials(): Promise<SupabaseCredentialCheck> {
  if (!supabaseConfigured || !supabase) {
    return {
      valid: false,
      reason: "unconfigured",
      message: supabaseConfigurationError || "Supabase is not configured.",
    };
  }
  if (credentialCheckPromise) return credentialCheckPromise;

  credentialCheckPromise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/settings`, {
        method: "GET",
        headers: { apikey: supabasePublicKey, accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok) return { valid: true } as const;
      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          reason: "rejected",
          message: "Supabase rejected the configured public key. Check the Vite environment values and redeploy.",
        } as const;
      }
      return {
        valid: false,
        reason: "unreachable",
        message: `Supabase credential verification failed with HTTP ${response.status}.`,
      } as const;
    } catch {
      return {
        valid: false,
        reason: "unreachable",
        message: "Could not reach Supabase to verify the configured credentials. Check the network and try again.",
      } as const;
    } finally {
      clearTimeout(timeout);
    }
  })();

  const result = await credentialCheckPromise;
  if (!result.valid) credentialCheckPromise = undefined;
  return result;
}

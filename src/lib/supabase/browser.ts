import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client — used for Auth SDK calls (sign up, sign
 * in, sign out, session refresh) directly from the UI. Antigravity's
 * login/onboarding screens talk to Supabase Auth through this, not
 * through a custom endpoint in API.md.
 */
export function createSupabaseBrowserClient() {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
  }
  return createBrowserClient(url, anonKey);
}

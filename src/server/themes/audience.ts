import type { SupabaseClient } from "@supabase/supabase-js";

/** Ready-made looks (templates) are for Masters' Union students only. Everyone else builds a custom page. */
export const TEMPLATE_EMAIL_DOMAIN = "mastersunion.org";

export interface AuthIdentity {
  email?: string | null | undefined;
  /** Supabase's email_confirmed_at: set once the address is verified (Google sign-in or a clicked link). */
  email_confirmed_at?: string | null | undefined;
}

/**
 * True for a verified @mastersunion.org address (exact domain, no sub-domains or look-alikes), or an admin.
 * An unverified address never counts: anyone can type one into a sign-up form.
 */
export function canUseTemplates(identity: AuthIdentity | null | undefined, isAdmin = false): boolean {
  if (isAdmin) return true;
  const email = identity?.email?.trim().toLowerCase();
  if (!email || !identity?.email_confirmed_at) return false;
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1) === TEMPLATE_EMAIL_DOMAIN;
}

/** Same check for code that only has a user id (the connector). Fails closed on any error. */
export async function canUseTemplatesById(admin: SupabaseClient, userId: string, isAdmin = false): Promise<boolean> {
  if (isAdmin) return true;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return canUseTemplates(data?.user, false);
  } catch {
    return false;
  }
}

/** Read inside request-scoped code only — see the module-scope-env warning in lib/supabase/env.ts. */
export function getWaitlistWebhookUrl(): string {
  const url = process.env["WAITLIST_WEBHOOK_URL"];
  if (!url) throw new Error("WAITLIST_WEBHOOK_URL must be set (Google Apps Script Web App URL)");
  return url;
}

export function getWaitlistWebhookSecret(): string {
  const secret = process.env["WAITLIST_WEBHOOK_SECRET"];
  if (!secret) throw new Error("WAITLIST_WEBHOOK_SECRET must be set");
  return secret;
}

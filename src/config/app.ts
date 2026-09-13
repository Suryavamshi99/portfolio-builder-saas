/** Read inside request-scoped code only — see the module-scope-env warning in lib/supabase/env.ts. */
export function getAppOrigin(): string {
  const origin = process.env["APP_ORIGIN"];
  if (!origin) throw new Error("APP_ORIGIN must be set (e.g. https://your-app.vercel.app)");
  return origin;
}

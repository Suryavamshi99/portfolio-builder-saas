import { describe, expect, it, vi } from "vitest";
import { Route as userRoute } from "../routes/api/admin/users.$id";
import { Route as revokeRoute } from "../routes/api/admin/users.$id.revoke-mcp";
import { Route as unpublishRoute } from "../routes/api/admin/sites.$slug.unpublish";
import { Route as domainRoute } from "../routes/api/admin/domains.remove";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { plan: "free", is_admin: false, user_id: "u1", slug: "s", hostname: "x.com" } }) }),
      }),
    }),
  }),
}));

type H = (args: unknown) => Promise<Response>;
const body = JSON.stringify({ reason: "testing", confirmEmail: "a@b.c", plan: "pro", hostname: "x.com" });
const req = () => new Request("http://localhost/x", { method: "POST", body, headers: { "content-type": "application/json" } });
const noStepUp = { adminSession: { iat: 1, exp: 9e15, seen: 1, epoch: 1, stepUpUntil: null } };

describe("destructive admin routes demand a fresh step-up", () => {
  const cases: [string, H, Record<string, string>][] = [
    ["DELETE user", (userRoute.options.server!.handlers as { DELETE: H }).DELETE, { id: "u1" }],
    ["PATCH user plan", (userRoute.options.server!.handlers as { PATCH: H }).PATCH, { id: "u1" }],
    ["revoke-mcp", (revokeRoute.options.server!.handlers as { POST: H }).POST, { id: "u1" }],
    ["unpublish", (unpublishRoute.options.server!.handlers as { POST: H }).POST, { slug: "s" }],
    ["remove domain", (domainRoute.options.server!.handlers as { POST: H }).POST, {}],
  ];
  for (const [name, handler, params] of cases) {
    it(`${name} -> 403 step_up_required`, async () => {
      const res = await handler({ request: req(), params, context: noStepUp });
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("step_up_required");
    });
  }
});

import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { contentSchema, emptyContent } from "@/data/content";
import { projectErrors } from "@/routes/-studio/model";

export const Route = createFileRoute("/api/content")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const { data, error } = await supabase
          .from("portfolios")
          .upsert(
            { user_id: user.id, content: emptyContent },
            { onConflict: "user_id", ignoreDuplicates: true },
          )
          .select("content, updated_at")
          .single();

        if (error || !data) {
          // ignoreDuplicates means upsert returns nothing when a row already
          // exists — fall back to a plain select for the existing-row case.
          const existing = await supabase
            .from("portfolios")
            .select("content, updated_at")
            .eq("user_id", user.id)
            .single();
          if (existing.error || !existing.data) {
            return Response.json(
              { error: { code: "internal_error", message: "Could not load content" } },
              { status: 500 },
            );
          }
          return Response.json({ content: existing.data.content, updatedAt: existing.data.updated_at });
        }

        return Response.json({ content: data.content, updatedAt: data.updated_at });
      },

      PUT: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: { code: "invalid_json", message: "Body must be valid JSON" } },
            { status: 400 },
          );
        }

        const content = (body as { content?: unknown } | null)?.content;
        const parsed = contentSchema.safeParse(content);

        const issues: { path: string; message: string }[] = parsed.success
          ? []
          : parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            }));

        if (parsed.success) {
          const projectIssues = projectErrors(parsed.data.projects);
          for (const [index, message] of projectIssues) {
            issues.push({ path: `projects.${index}`, message });
          }
        }

        if (issues.length > 0) {
          return Response.json(
            {
              error: { code: "content_invalid", message: `${issues.length} problem(s) found` },
              issues,
            },
            { status: 422 },
          );
        }

        const updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from("portfolios")
          .upsert({ user_id: user.id, content: parsed.data, updated_at: updatedAt }, { onConflict: "user_id" });

        if (error) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not save content" } },
            { status: 500 },
          );
        }

        return Response.json({ ok: true, updatedAt });
      },
    },
  },
});

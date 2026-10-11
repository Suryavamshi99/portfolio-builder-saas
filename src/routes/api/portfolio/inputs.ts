import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { loadPortfolioInputs, savePortfolioInputs } from "@/server/portfolio-inputs";

export const Route = createFileRoute("/api/portfolio/inputs")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;
        const inputs = await loadPortfolioInputs(supabase, user.id);
        return Response.json(inputs);
      },
      PUT: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        let body: {
          links?: unknown;
          specifics?: unknown;
          designIntensity?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: { code: "invalid_json", message: "Body must be valid JSON" } },
            { status: 400 },
          );
        }

        if (
          body.designIntensity !== undefined &&
          body.designIntensity !== "minimal" &&
          body.designIntensity !== "bold"
        ) {
          return Response.json(
            { error: { code: "invalid_request", message: "designIntensity must be 'minimal' or 'bold'" } },
            { status: 400 },
          );
        }

        try {
          const saved = await savePortfolioInputs(supabase, user.id, {
            links: body.links,
            specifics: body.specifics,
            designIntensity: body.designIntensity,
          });
          return Response.json(saved);
        } catch {
          return Response.json(
            { error: { code: "internal_error", message: "Could not save portfolio inputs" } },
            { status: 500 },
          );
        }
      },
    },
  },
});

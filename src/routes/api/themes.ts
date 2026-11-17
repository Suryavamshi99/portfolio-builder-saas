import { createFileRoute } from "@tanstack/react-router";

import { listThemeCatalog } from "@/server/themes/catalog";

/** The theme gallery: ready themes only, with profession, feel, tier, questions and look options. Public. */
export const Route = createFileRoute("/api/themes")({
  server: {
    handlers: {
      GET: async () => Response.json({ themes: listThemeCatalog() }),
    },
  },
});

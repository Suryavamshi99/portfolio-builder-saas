import { createFileRoute } from "@tanstack/react-router";

import { templatesEnabled } from "@/config/templates";
import { listThemeCatalog } from "@/server/themes/catalog";

/** The theme gallery: ready themes only, with profession, feel, tier, questions and look options. Public. Empty while TEMPLATES_ENABLED is off. */
export const Route = createFileRoute("/api/themes")({
  server: {
    handlers: {
      GET: async () => Response.json({ themes: templatesEnabled() ? listThemeCatalog() : [] }),
    },
  },
});

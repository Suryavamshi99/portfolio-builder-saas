import { finalizeHtml, type FinalizeHtmlInput } from "@/server/finalize-html";
import { buildContent, type ModelCall } from "./content";
import { checkContent } from "./fact";
import { interpretPreferences } from "./options";
import { renderTheme } from "./render";
import type { ThemeManifest, ThemeRequest } from "./types";

export type ThemedBuildResult =
  | { ok: true; html: string; warnings: string[]; declined: string[]; dropped: string[]; usedModel: boolean }
  | { ok: false; code: "generation_unsupported_claims" | "generation_invalid_output"; details: string[] };

/**
 * Builds a themed page: facts from the resume (one bounded model call, or plain code when none is given), a fact
 * check on the content strings, typed preferences turned into validated options, then the theme template filled in.
 * The saved page passes the same finalizeHtml step as a bespoke page.
 */
export async function runThemedBuild(opts: {
  manifest: ThemeManifest;
  template: string;
  request: ThemeRequest;
  resumeText: string;
  /** Resume text plus links and the user's typed answers: the only facts the page may state. */
  referenceText: string;
  finalize: Omit<FinalizeHtmlInput, "rawText">;
  model?: ModelCall | undefined;
}): Promise<ThemedBuildResult> {
  const built = await buildContent({
    resumeText: opts.resumeText,
    manifest: opts.manifest,
    answers: opts.request.answers,
    model: opts.model,
  });
  const checked = checkContent(built.content, opts.referenceText);
  if (!checked.ok) return { ok: false, code: "generation_unsupported_claims", details: checked.unsupported };

  const prefs = await interpretPreferences(opts.manifest, opts.request.preferences, opts.model);
  const html = renderTheme({ manifest: opts.manifest, template: opts.template, content: checked.content, options: prefs.options });
  const done = finalizeHtml({ ...opts.finalize, rawText: html });
  if (!done.ok) return { ok: false, code: "generation_invalid_output", details: done.errors };
  return {
    ok: true,
    html: done.html,
    warnings: done.warnings,
    declined: prefs.declined,
    dropped: checked.dropped,
    usedModel: built.usedModel,
  };
}

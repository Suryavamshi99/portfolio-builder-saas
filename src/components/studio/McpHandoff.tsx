import * as React from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { announceBuildReady } from "@/lib/build-notify";
import { chatgptUrl, claudeUrl, mcpEditPrompt } from "@/lib/regen-method";

/**
 * For a page built (or edited) in Claude or ChatGPT: those run in the user's own chat, not on our servers, so the
 * Studio hands the edit over with a ready-made prompt, then watches for the saved page and refreshes when it lands.
 */
export function McpHandoff({
  instructions,
  currentHtml,
  onUpdated,
}: {
  instructions: string;
  currentHtml: string;
  onUpdated: (html: string) => void;
}) {
  const prompt = mcpEditPrompt(instructions);
  const [copied, setCopied] = React.useState(false);
  const baseline = React.useRef(currentHtml);
  baseline.current = currentHtml;

  // While this panel is open, notice when the chat saves a new version.
  React.useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch("/api/content");
        if (!res.ok) return;
        const { html } = (await res.json()) as { html?: string };
        if (html && html !== baseline.current) {
          baseline.current = html;
          onUpdated(html);
          announceBuildReady(`mcp-edit-${Date.now()}`, { title: "Your portfolio was updated", body: "Your chat saved the changes. They are open in the Studio.", to: null, ctaLabel: "View it" });
        }
      } catch {
        // try again on the next tick
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [onUpdated]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // the prompt is shown below, so it can still be selected by hand
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs">
      <p className="text-muted-foreground leading-relaxed">
        This page is edited in your Claude or ChatGPT chat. Open it with the prompt below (your changes are already in it). When your chat saves the
        page, it appears here by itself.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
          <a href={claudeUrl(prompt)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> Open Claude
          </a>
        </Button>
        <Button asChild size="sm" variant="secondary" className="gap-1.5">
          <a href={chatgptUrl(prompt)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> Open ChatGPT
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void copy()}>
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy prompt"}
        </Button>
      </div>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-2 text-[11px] text-muted-foreground">{prompt}</pre>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin text-accent" /> Waiting for your chat to save the page…
      </p>
      <p className="text-[11px] text-muted-foreground">
        Not connected yet? Add the Shipfolio connector in <a className="underline" href="/settings">Settings</a>.
      </p>
    </div>
  );
}

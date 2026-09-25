import * as React from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, Sparkles } from "lucide-react";

interface LivePreviewProps {
  html: string;
}

type ViewportMode = "desktop" | "tablet" | "mobile";

export function LivePreview({ html }: LivePreviewProps) {
  const [mode, setMode] = React.useState<ViewportMode>("desktop");
  const isEmpty = !html.trim();

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      {/* Viewport controls bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="size-3.5 text-accent" />
          <span>Client Live Preview</span>
        </div>
        <div className="flex items-center gap-1 bg-background/80 rounded-md p-0.5 border border-border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("desktop")}
            className={`size-6 rounded ${mode === "desktop" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Desktop preview width"
          >
            <Monitor className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("tablet")}
            className={`size-6 rounded ${mode === "tablet" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Tablet preview width"
          >
            <Tablet className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("mobile")}
            className={`size-6 rounded ${mode === "mobile" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Mobile preview width (375px)"
          >
            <Smartphone className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Responsive Preview Canvas */}
      <div className="flex-1 overflow-y-auto bg-muted/20 p-2 sm:p-4 flex justify-center">
        <div
          className={`h-full w-full transition-all duration-200 bg-background text-foreground border border-border shadow-md rounded-lg overflow-hidden ${
            mode === "mobile" ? "max-w-[375px]" : mode === "tablet" ? "max-w-[768px]" : "max-w-full"
          }`}
        >
          {isEmpty ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="text-sm font-medium">Portfolio content is empty.</p>
              <p className="text-xs mt-1">Use the Onboarding Wizard to generate one.</p>
            </div>
          ) : (
            <iframe
              title="Portfolio live preview"
              srcDoc={html}
              sandbox="allow-same-origin"
              className="h-full w-full border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

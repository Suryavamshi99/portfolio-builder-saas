import * as React from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, Sparkles } from "lucide-react";

interface LivePreviewProps {
  html: string;
}

type ViewportMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<ViewportMode, number> = { desktop: 1280, tablet: 820, mobile: 390 };

export function LivePreview({ html }: LivePreviewProps) {
  const [mode, setMode] = React.useState<ViewportMode>("desktop");
  const isEmpty = !html.trim();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      setSize({ width: Math.max(0, el.clientWidth - padX), height: Math.max(0, el.clientHeight - padY) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const deviceWidth = DEVICE_WIDTH[mode];
  const scale = size.width > 0 ? Math.min(1, size.width / deviceWidth) : 1;

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
            aria-label="Mobile preview width (390px)"
          >
            <Smartphone className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* The page is rendered at the real device width and scaled down to fit, so its own
          responsive layout (media queries) matches what a visitor on that device sees. */}
      <div ref={canvasRef} className="relative flex-1 overflow-hidden bg-muted/20 p-2 sm:p-4">
        {isEmpty ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm font-medium">Portfolio content is empty.</p>
            <p className="text-xs mt-1">Use the Onboarding Wizard to generate one.</p>
          </div>
        ) : (
          size.width > 0 && (
            <div
              className="mx-auto overflow-hidden rounded-lg border border-border bg-white shadow-md"
              style={{ width: deviceWidth * scale, height: size.height }}
            >
              <iframe
                title="Portfolio live preview"
                srcDoc={html}
                sandbox="allow-scripts"
                className="block border-0 bg-white"
                style={{
                  width: deviceWidth,
                  height: size.height / scale,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

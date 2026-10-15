import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BUILD_READY_EVENT, primeAudio, type BuildReadyDetail } from "@/lib/build-notify";

/**
 * Mounted once at the root: shows the "your portfolio is ready" popup whichever page the user is on, and unlocks
 * the chime on the first click or key press (browsers only allow sound after a user gesture).
 */
export function BuildReadyPopup() {
  const navigate = useNavigate();
  const [detail, setDetail] = React.useState<BuildReadyDetail | null>(null);

  React.useEffect(() => {
    const unlock = () => primeAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    const onReady = (e: Event) => setDetail((e as CustomEvent<BuildReadyDetail>).detail);
    window.addEventListener(BUILD_READY_EVENT, onReady);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener(BUILD_READY_EVENT, onReady);
    };
  }, []);

  const close = () => setDetail(null);

  return (
    <Dialog open={detail !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" />
            {detail?.title}
          </DialogTitle>
          <DialogDescription>{detail?.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Stay here
          </Button>
          <Button
            type="button"
            className="bg-accent font-semibold text-accent-foreground hover:bg-accent/90"
            onClick={() => {
              const to = detail?.to ?? null;
              close();
              if (to) void navigate({ to });
            }}
          >
            {detail?.ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

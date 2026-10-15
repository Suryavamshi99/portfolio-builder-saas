import * as React from "react";
import { Bell, BellOff } from "lucide-react";

import {
  notifyEnabled,
  playDing,
  primeAudio,
  requestSystemNotifications,
  setNotifyEnabled,
  systemNotificationsSupported,
} from "@/lib/build-notify";

/** "Alert me when it's ready": a chime, a tab alert and (if allowed) a desktop notification. On by default. */
export function NotifyToggle() {
  const [on, setOn] = React.useState(true);
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">("unsupported");

  React.useEffect(() => {
    setOn(notifyEnabled());
    setPermission(systemNotificationsSupported() ? Notification.permission : "unsupported");
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    setNotifyEnabled(next);
    if (next) {
      primeAudio();
      playDing(); // a click is a user gesture, so this is also the preview of what they will hear
    }
  };

  const allowDesktop = async () => {
    primeAudio();
    setPermission(await requestSystemNotifications());
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 transition-colors hover:text-foreground"
      >
        {on ? <Bell className="size-3.5 text-accent" /> : <BellOff className="size-3.5" />}
        {on ? "We'll ding when it's ready" : "Alerts off"}
      </button>
      {on && permission === "default" && (
        <button type="button" onClick={() => void allowDesktop()} className="underline underline-offset-2 hover:text-foreground">
          Also alert me on my desktop
        </button>
      )}
    </div>
  );
}

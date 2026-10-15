/**
 * "Your portfolio is ready" alerts for a finished build: a popup, a chime, a tab alert (blinking title and a dot on the
 * tab icon while the tab is in the background) and, if the user allowed it, a system notification.
 *
 * Everything is best effort: a browser that blocks sound or notifications just skips that part.
 * Browser-only (guarded for server rendering); the pieces that decide things are small pure functions so they can be tested.
 */

const PREF_KEY = "shipfolio:notify";
const NOTIFIED_PREFIX = "shipfolio:notified:";
export const BUILD_READY_EVENT = "shipfolio:build-ready";

export interface BuildReadyDetail {
  title: string;
  body: string;
  /** Where the popup's button goes ("/studio" by default); null means the button only closes the popup. */
  to: string | null;
  ctaLabel: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(kind: "local" | "session"): StorageLike | null {
  try {
    return kind === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null; // blocked (private window, strict settings)
  }
}

/** Alerts are on unless the user switched them off. */
export function notifyEnabled(store: StorageLike | null = storage("local")): boolean {
  try {
    return store?.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotifyEnabled(on: boolean, store: StorageLike | null = storage("local")): void {
  try {
    store?.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // ignore: the choice just isn't remembered
  }
}

/** True the first time a build id is announced in this browser session, so a repeating poll can't ding twice. */
export function claimAnnouncement(jobId: string, store: StorageLike | null = storage("session")): boolean {
  const key = `${NOTIFIED_PREFIX}${jobId}`;
  try {
    if (store?.getItem(key)) return false;
    store?.setItem(key, "1");
  } catch {
    // no storage: fall through and announce
  }
  return true;
}

// ---------- sound ----------

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  return audio;
}

/** Browsers only allow sound after a user gesture; call this from one (the app does it on the first click) so a later chime can play. */
export function primeAudio(): void {
  try {
    void context()?.resume();
  } catch {
    // ignore
  }
}

/** A short two-note chime made with the Web Audio API (no sound file to load). */
export function playDing(): void {
  try {
    const ctx = context();
    if (!ctx) return;
    void ctx.resume();
    const start = ctx.currentTime + 0.02;
    for (const [freq, offset] of [
      [784, 0],
      [1175, 0.13],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.95);
    }
  } catch {
    // ignore: no sound is better than an error
  }
}

// ---------- tab alert ----------

let restoreTab: (() => void) | null = null;

/** Blinks the tab title and puts a green dot on the tab icon until the user comes back to the tab. */
function alertTab(message: string): void {
  if (typeof document === "undefined" || restoreTab) return;
  const original = document.title;
  const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  const originalHref = iconLink?.href;
  let showMessage = true;
  document.title = message;
  const timer = window.setInterval(() => {
    showMessage = !showMessage;
    document.title = showMessage ? message : original;
  }, 1000);

  if (iconLink && originalHref) {
    void fetch(originalHref)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("icon"))))
      .then((svg) => {
        const dot = '<circle cx="206" cy="50" r="46" fill="#34D399" stroke="#0B0D12" stroke-width="12"/>';
        iconLink.href = `data:image/svg+xml,${encodeURIComponent(svg.replace("</svg>", `${dot}</svg>`))}`;
      })
      .catch(() => {});
  }

  restoreTab = () => {
    window.clearInterval(timer);
    document.title = original;
    if (iconLink && originalHref) iconLink.href = originalHref;
    document.removeEventListener("visibilitychange", onShow);
    window.removeEventListener("focus", onShow);
    restoreTab = null;
  };
  const onShow = () => {
    if (!document.hidden) restoreTab?.();
  };
  document.addEventListener("visibilitychange", onShow);
  window.addEventListener("focus", onShow);
}

// ---------- system notification ----------

export function systemNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Must be called from a click. Resolves to the permission state. */
export async function requestSystemNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (!systemNotificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function showSystemNotification(detail: BuildReadyDetail): void {
  if (!systemNotificationsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(detail.title, { body: detail.body, icon: "/icon-192.png", tag: "shipfolio-build-ready" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // some mobile browsers only allow notifications through a service worker
  }
}

// ---------- the announcement ----------

/**
 * Call when a build has finished. Shows the popup (always), and, unless the user turned alerts off: plays the chime,
 * and while the tab is in the background alerts the tab and sends a system notification.
 * `jobId` makes it fire once per build even if the caller runs again.
 */
export function announceBuildReady(jobId: string, detail?: Partial<BuildReadyDetail>): void {
  if (typeof window === "undefined" || !claimAnnouncement(jobId)) return;
  const full: BuildReadyDetail = {
    title: detail?.title ?? "Your portfolio is ready",
    body: detail?.body ?? "Open Shipfolio to see it.",
    to: detail && "to" in detail ? (detail.to ?? null) : "/studio",
    ctaLabel: detail?.ctaLabel ?? "Open my portfolio",
  };
  if (notifyEnabled()) {
    playDing();
    if (document.hidden) {
      alertTab(`✅ ${full.title}`);
      showSystemNotification(full);
    }
  }
  window.dispatchEvent(new CustomEvent<BuildReadyDetail>(BUILD_READY_EVENT, { detail: full }));
}

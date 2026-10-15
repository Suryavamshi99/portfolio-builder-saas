import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUILD_READY_EVENT, announceBuildReady, claimAnnouncement, notifyEnabled, setNotifyEnabled, type BuildReadyDetail } from "./build-notify";

function fakeStore(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("alert preference", () => {
  it("is on unless the user turned it off, and remembers the choice", () => {
    const store = fakeStore();
    expect(notifyEnabled(store)).toBe(true);
    setNotifyEnabled(false, store);
    expect(notifyEnabled(store)).toBe(false);
    setNotifyEnabled(true, store);
    expect(notifyEnabled(store)).toBe(true);
  });

  it("stays on when storage is unavailable", () => {
    expect(notifyEnabled(null)).toBe(true);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(notifyEnabled(broken)).toBe(true);
    expect(() => setNotifyEnabled(false, broken)).not.toThrow();
  });
});

describe("claimAnnouncement", () => {
  it("lets a build be announced once, however often the poll calls", () => {
    const store = fakeStore();
    expect(claimAnnouncement("job-1", store)).toBe(true);
    expect(claimAnnouncement("job-1", store)).toBe(false);
    expect(claimAnnouncement("job-2", store)).toBe(true);
  });

  it("announces when storage is unavailable rather than staying silent", () => {
    expect(claimAnnouncement("job-1", null)).toBe(true);
  });
});

describe("announceBuildReady", () => {
  let target: EventTarget;
  const events: BuildReadyDetail[] = [];
  let session: ReturnType<typeof fakeStore>;
  let local: ReturnType<typeof fakeStore>;

  beforeEach(() => {
    events.length = 0;
    target = new EventTarget();
    session = fakeStore();
    local = fakeStore();
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("window", Object.assign(target, { setInterval: vi.fn(() => 1), clearInterval: vi.fn(), focus: vi.fn() }));
    vi.stubGlobal("document", { hidden: false, title: "Shipfolio", querySelector: () => null, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    target.addEventListener(BUILD_READY_EVENT, (e) => events.push((e as CustomEvent<BuildReadyDetail>).detail));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the popup with the defaults, once per build", () => {
    announceBuildReady("job-1");
    announceBuildReady("job-1");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ title: "Your portfolio is ready", body: "Open Shipfolio to see it.", to: "/studio", ctaLabel: "Open my portfolio" });
  });

  it("lets the caller change the text and send the button nowhere", () => {
    announceBuildReady("job-2", { title: "Your new version is ready", to: null, ctaLabel: "View it" });
    expect(events[0]).toMatchObject({ title: "Your new version is ready", to: null, ctaLabel: "View it" });
  });

  it("alerts the tab (blinking title) only while the tab is in the background", () => {
    announceBuildReady("job-3"); // visible tab: no title change
    expect(document.title).toBe("Shipfolio");
    (document as { hidden: boolean }).hidden = true;
    announceBuildReady("job-4");
    expect(document.title).toBe("✅ Your portfolio is ready");
    expect(window.setInterval).toHaveBeenCalled();
  });

  it("still shows the popup but stays quiet when the user switched alerts off", () => {
    setNotifyEnabled(false, local);
    (document as { hidden: boolean }).hidden = true;
    announceBuildReady("job-5");
    expect(events).toHaveLength(1);
    expect(document.title).toBe("Shipfolio");
  });
});

import { describe, expect, it } from "vitest";
import { interpretPreferences } from "./options";
import type { ThemeManifest } from "./types";

const manifest: ThemeManifest = {
  id: "t",
  name: "T",
  tagline: "",
  profession: "Product",
  feel: "Editorial",
  tier: "free",
  ready: true,
  sections: [
    { id: "about", label: "About" },
    { id: "projects", label: "Projects" },
  ],
  questions: [],
  cssVars: [{ name: "--accent", label: "Accent" }],
  fonts: ["Inter Tight"],
  fontVars: { display: "--font-display" },
  radiusVar: "--radius",
};

const reply = (o: unknown) => async () => JSON.stringify(o);

describe("interpretPreferences", () => {
  it("applies colour, corners and hidden sections the theme allows", async () => {
    const r = await interpretPreferences(
      manifest,
      "warm orange accent, rounded corners, hide projects",
      reply({ colors: { "--accent": "#ff6600" }, radius: "round", hidden: ["projects"] }),
    );
    expect(r.options).toEqual({ colors: { "--accent": "#ff6600" }, radius: "round", hidden: ["projects"] });
    expect(r.declined).toEqual([]);
  });

  it("declines a layout change and keeps the allowed part (AE2)", async () => {
    const r = await interpretPreferences(
      manifest,
      "make it a one-column timeline, blue accent",
      reply({ colors: { "--accent": "#0000ff" }, declined: ["one-column timeline layout"] }),
    );
    expect(r.options.colors).toEqual({ "--accent": "#0000ff" });
    expect(r.declined).toEqual(["one-column timeline layout"]);
  });

  it("drops colours and fonts the theme does not declare, and non-hex values", async () => {
    const r = await interpretPreferences(
      manifest,
      "x",
      reply({ colors: { "--other": "#000000", "--accent": "red" }, fontDisplay: "Comic Sans", hidden: ["nope"] }),
    );
    expect(r.options).toEqual({});
    expect(r.declined.length).toBeGreaterThan(0);
  });

  it("declines everything when there is no model", async () => {
    const r = await interpretPreferences(manifest, "make it red", undefined);
    expect(r.options).toEqual({});
    expect(r.declined).toEqual(["make it red"]);
  });

  it("declines everything when the model returns garbage", async () => {
    const r = await interpretPreferences(manifest, "make it red", async () => "I cannot do that");
    expect(r).toEqual({ options: {}, declined: ["make it red"] });
  });

  it("does nothing for an empty request", async () => {
    expect(await interpretPreferences(manifest, "   ", undefined)).toEqual({ options: {}, declined: [] });
  });
});

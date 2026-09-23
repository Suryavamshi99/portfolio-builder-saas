# Cinematic hero brief — Background & Engineering Philosophy

_Generated 2026-09-23T06:52:36.710Z by gemini-cinematic-web. Edit `.cinematic/direction.json` or `.cinematic/prompt.txt` directly, then regenerate._

## What the product is (evidence)
- README: Hosted product: students turn a resume into a live portfolio site either by prompting a recruiter-grade AI (their own API key) or editing structured fields directly, then publish it to their own Vercel account.

## Visual identity
- Framework: vite-react 8.1.5; styling: tailwind@4, shadcn/ui, motion
- Background: not detected; dark by default: unknown
- Accent colours: #192b40 deep azure, #30445a dark azure
- Fonts: not detected
- Hero: src/components/hero/HeroOrbIntro.tsx — strength **weak** (styled-background, animation); text aligned center

## Creative direction
- Concept (design): scattered shards of translucent glass drifting slowly through a vast dark void, gradually converging, aligning and fusing into a single smooth, faceted sphere that holds a warm inner light at its core
- World: a vast, quiet dark studio void, weightless, no floor or horizon visible
- Palette: deep azure and near-black glass, with a single warm muted-amber glow held inside the forming sphere
- Mood: precise and assured, quietly ambitious — the calm of raw, scattered material resolving into one finished, premium form
- Intensity: subtle
- Text-safe zone: Keep the central area of the frame calm, softly lit and low in detail so a centred headline stays legible; let the richest detail and motion live toward the edges and the lower third.

## Alternative concepts (`prompt --variant N`)
1. **design** — slow-motion ribbons of pigment unfurling through clear liquid, blooming into silky gradients that fold and layer like paper
2. **devtools** — precise architectural structures of light — thin luminous lines assembling into modular, interlocking geometric blocks that stack and align with calm, engineered precision
3. **ai** — a vast field of suspended, softly glowing filaments that slowly self-organise into layered, neuron-like lattices, pulses of light travelling along them like thoughts forming
4. **commerce** — sculptural abstract objects on stone plinths slowly revolving under sweeping studio light, fabric-like surfaces catching soft highlights

## Agent checklist before generating
- [ ] Does the concept express the product's *value proposition*, not just its category?
- [ ] Palette matches the real UI (compare with the hero's actual background and accent classes).
- [ ] Safe zone matches where the hero text actually sits.
- [ ] Nothing literal that will look like stock AI footage (no glowing brains, no robots, no people typing).

## Active prompt
```
A single continuous, unbroken cinematic shot for the background of a premium website hero.
Subject: scattered shards of translucent glass drifting slowly through a vast dark void, gradually converging, aligning and fusing into a single smooth, faceted sphere that holds a warm inner light at its core, set in a vast, quiet dark studio void, weightless, no floor or horizon visible.
Camera: an almost imperceptibly slow forward dolly; locked-off smoothness, no shake, no cuts, no zooms that reset; extremely slow, meditative motion.
Lighting and colour: deep azure and near-black glass, with a single warm muted-amber glow held inside the forming sphere. Soft, low-contrast grading with gentle highlights and softened blacks; soft volumetric haze, gentle bloom on highlights, subtle film grain.
Lens: large-format cinema camera, 35mm lens, shallow depth of field with smooth bokeh.
Mood: precise and assured, quietly ambitious — the calm of raw, scattered material resolving into one finished, premium form; calm and restrained.
Composition: Keep the central area of the frame calm, softly lit and low in detail so a centred headline stays legible; let the richest detail and motion live toward the edges and the lower third.
Motion is continuous and cyclical so the ending closely resembles the opening composition, suitable for a seamless loop.
Purely abstract and atmospheric: no people, no faces, no hands, no text, no letters, no logos, no user interface, no screens, no watermarks.
Audio: near-silent soft ambient room tone, no music, no dialogue.
```

## direction.json overrides
```json
{
  "concept": "scattered shards of translucent glass drifting slowly through a vast dark void, gradually converging, aligning and fusing into a single smooth, faceted sphere that holds a warm inner light at its core",
  "world": "a vast, quiet dark studio void, weightless, no floor or horizon visible",
  "palette": "deep azure and near-black glass, with a single warm muted-amber glow held inside the forming sphere",
  "mood": "precise and assured, quietly ambitious — the calm of raw, scattered material resolving into one finished, premium form",
  "textAlign": "center",
  "intensity": "subtle",
  "dark": true,
  "_help": "Set any field to override the auto-derived creative direction, then run `prompt --force`."
}
```

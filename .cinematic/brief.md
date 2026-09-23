# Cinematic hero brief — Background & Engineering Philosophy

_Generated 2026-09-23T11:37:20.600Z by gemini-cinematic-web. Edit `.cinematic/direction.json` or `.cinematic/prompt.txt` directly, then regenerate._

## What the product is (evidence)
- README: Hosted product: students turn a resume into a live portfolio site either by prompting a recruiter-grade AI (their own API key) or editing structured fields directly, then publish it to their own Vercel account.

## Visual identity
- Framework: vite-react 8.1.5; styling: tailwind@4, shadcn/ui, motion
- Background: not detected; dark by default: unknown
- Accent colours: #192b40 deep azure, #30445a dark azure
- Fonts: not detected
- Hero: src/components/hero/HeroOrbIntro.tsx — strength **weak** (styled-background, animation); text aligned center

## Creative direction
- Concept (design): a scattered field of thin rectangular glass and light tiles of varying sizes drifting slowly through a dark void, sliding into place one by one and aligning edge to edge until they lock into a clean, structured grid — reading, from a distance, as the organised layout of a finished portfolio site taking shape, built from light and glass rather than any literal screen
- World: a vast dark studio void, the camera slowly settling to a calm, front-on view as the tiles lock into their final grid, like looking at a wall of softly lit panels
- Palette: deep azure and near-black glass, with a single warm muted-amber glow held inside one featured tile near the center
- Mood: precise and orderly — scattered pieces resolving, tile by tile, into one clean, deliberate structure; the quiet satisfaction of a portfolio finally taking shape
- Intensity: cinematic
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

## How to generate this video
This skill never calls a billed video API. Generate the clip yourself, using your own Gemini subscription's included Veo allowance:
1. Open `gemini.google.com` (or the Gemini app) signed in with your paid plan.
2. Pick a Veo model from the model/tools picker.
3. Paste the prompt below and generate.
4. Download the resulting mp4, then run `import --file path/to/downloaded.mp4` followed by `optimize` and `install`.

## Active prompt
```
A single continuous, unbroken cinematic shot for the background of a premium website hero.
Subject: a scattered field of thin rectangular glass and light tiles of varying sizes drifting slowly through a dark void, sliding into place one by one and aligning edge to edge until they lock into a clean, structured grid — reading, from a distance, as the organised layout of a finished portfolio site taking shape, built from light and glass rather than any literal screen, set in a vast dark studio void, the camera slowly settling to a calm, front-on view as the tiles lock into their final grid, like looking at a wall of softly lit panels.
Camera: a slow, continuous dolly with a gentle parallax arc; locked-off smoothness, no shake, no cuts, no zooms that reset; slow, deliberate, luxurious motion.
Lighting and colour: deep azure and near-black glass, with a single warm muted-amber glow held inside one featured tile near the center. Rich cinematic contrast with deep, clean blacks and controlled highlights; soft volumetric haze, gentle bloom on highlights, subtle film grain.
Lens: large-format cinema camera, 35mm lens, shallow depth of field with smooth bokeh.
Mood: precise and orderly — scattered pieces resolving, tile by tile, into one clean, deliberate structure; the quiet satisfaction of a portfolio finally taking shape; confident and premium.
Composition: Keep the central area of the frame calm, softly lit and low in detail so a centred headline stays legible; let the richest detail and motion live toward the edges and the lower third.
Motion is continuous and cyclical so the ending closely resembles the opening composition, suitable for a seamless loop.
Purely abstract and atmospheric: no people, no faces, no hands, no text, no letters, no logos, no user interface, no screens, no watermarks.
Audio: near-silent soft ambient room tone, no music, no dialogue.
```

## direction.json overrides
```json
{
  "concept": "a scattered field of thin rectangular glass and light tiles of varying sizes drifting slowly through a dark void, sliding into place one by one and aligning edge to edge until they lock into a clean, structured grid — reading, from a distance, as the organised layout of a finished portfolio site taking shape, built from light and glass rather than any literal screen",
  "world": "a vast dark studio void, the camera slowly settling to a calm, front-on view as the tiles lock into their final grid, like looking at a wall of softly lit panels",
  "palette": "deep azure and near-black glass, with a single warm muted-amber glow held inside one featured tile near the center",
  "mood": "precise and orderly — scattered pieces resolving, tile by tile, into one clean, deliberate structure; the quiet satisfaction of a portfolio finally taking shape",
  "textAlign": "center",
  "intensity": "cinematic",
  "dark": true,
  "_help": "Set any field to override the auto-derived creative direction, then run `prompt --force`."
}
```

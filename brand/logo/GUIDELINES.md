# Shipfolio — Logo Guidelines

## 1. The logo
- **Idea:** a leaf (a *folio*, a leaf of paper) with an upward chevron. A page, launched. The mark says the product name: folio + ship.
- **Versions:** horizontal lockup (primary) · stacked lockup · symbol only · wordmark only.
- **Colour:** the *Aurora* gradient (blue → cyan → mint). Flat one-colour versions exist for every place a gradient does not work.
- **Files:** `svg/` for everything on screens and in print masters · `png/` for slides, docs and chat · `web/` for the site (favicon, app icons, social image).

## 2. Clear space
Keep a clear zone of **1 × x** on every side, where **x = the height of the chevron's cut-out apex area ≈ ¼ of the symbol height**. In the 256-unit artwork that is 44 units. The zone scales with the logo; never use a fixed distance.

## 3. Minimum size
| Version | Screen | Print |
|---|---|---|
| Horizontal lockup | 96 px wide | 25 mm wide |
| Stacked lockup | 64 px wide | 18 mm wide |
| Symbol | 24 px (use `symbol-color-small.svg` below 32 px; `favicon.svg` for the browser tab) | 6 mm |

## 4. Colour
| Name | HEX | RGB | CMYK (approx.) |
|---|---|---|---|
| Aurora Blue (brand) | `#3457E8` | 52 · 87 · 232 | 78 · 63 · 0 · 9 |
| Aurora Cyan | `#06B6D4` | 6 · 182 · 212 | 97 · 14 · 0 · 17 |
| Aurora Mint | `#34D399` | 52 · 211 · 153 | 75 · 0 · 27 · 17 |
| Graphite | `#0B0D12` | 11 · 13 · 18 | 39 · 28 · 0 · 93 |
| Ink | `#14161C` | 20 · 22 · 28 | 29 · 21 · 0 · 89 |
| Mist | `#F6F6F3` | 246 · 246 · 243 | 0 · 0 · 1 · 4 |

CMYK values are simple screen-to-print conversions. For print, have the printer proof the Aurora gradient, or use the flat blue, black or white version. Pantone references are not given because they have not been matched to a swatch book.

**Gradient:** always top-left → bottom-right, in the order blue → cyan → mint. Do not reorder, reverse or add stops.

**Approved pairs**
| Background | Use |
|---|---|
| White or Mist | `lockup-horizontal-color` (dark "ship", gradient "folio") |
| Graphite or any dark | `lockup-horizontal-color-reversed` (white "ship", gradient "folio") |
| One-colour print, stamps, embroidery | `lockup-horizontal-black` / `-white` / `-blue` |
| Photos | white or black version on a calm area, or place the symbol on a Graphite tile |

**Contrast:** the gradient "folio" fades to mint, which is light on white. The logo is exempt from text-contrast rules, but never set body text in the gradient. For small text on light backgrounds use Ink or Aurora Blue.

## 5. Typography
- **Wordmark:** Inter Bold, tracked −2.2 %, drawn as outlines in the lockup files (do not retype it). Inter is licensed under the SIL Open Font License 1.1, which allows use in logos.
- **Product UI and documents:** Inter. Web fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`.

## 6. Don'ts
Don't stretch, squash or rotate · don't recolour outside the palette · don't change the gradient direction or colours · don't add shadows, outlines or glows · don't separate or resize parts of a lockup · don't put the colour logo on a busy photo or on a mid-tone background that fights the gradient (use the white version) · don't retype the wordmark · don't use the small-size cut above 64 px, or the standard cut below 24 px.

## 7. Using the files
| Need | File |
|---|---|
| Site header (light / dark) | `svg/lockup-horizontal-color.svg` / `-color-reversed.svg` |
| Favicon | `web/favicon.svg` (modern browsers), `web/favicon.ico`, `web/favicon-32.png` |
| iOS home screen | `web/apple-touch-icon.png` |
| Android / PWA | `web/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` |
| Social share image | `web/og-image.png` (1200 × 630) |
| Payment page / app store | `png/app-icon-dark-1024.png` or `app-icon-gradient-1024.png` |
| One-colour use | `svg/symbol-black.svg`, `symbol-white.svg`, `symbol-blue.svg` |

## 8. Honest limits
- Not trademark-searched. Run a search before filing or printing in volume.
- The wordmark is a standard font (Inter Bold), not custom lettering. Custom letterforms (for example a bespoke "f" and "i" dots) would make it more ownable and are a sensible later step.
- The gradient is deliberate; flat masters are provided for print and one-colour needs.

# Shipfolio pricing recommendation (2026-10-15)

Status: owner-decided prices are $9 one-time + $7.99/yr hosting (India ₹499 + ₹449/yr). This document checks them and lists what to validate. Competitor figures below are from memory and **unverified**; check them before quoting anywhere public.

## Value delivered

- Core value: a bespoke, model-written portfolio page from a resume in minutes, which the user owns outright (clean HTML, zip, GitHub push, own Vercel).
- Customer alternatives: free site builders (GitHub Pages, Vercel/Netlify free tiers, Notion/Read.cv-style pages) cost nothing but take hours, or a template tool (Carrd-style, roughly $20/yr) or Framer/Webflow (monthly plans) that cost more and need design effort.
- Willingness to pay: students and early-career developers, price-sensitive, often in India. They pay for time saved and a polished result, not for ongoing service.
- Our marginal cost: near zero. Free-model generation is not billed to us. Costs are Dodo fees and storage/bandwidth for hosted sites.

## Model

Recommended model: **freemium (watermarked preview) + one-time unlock + optional annual add-on.**
Value metric: ownership of the output (one-time), then hosting of the site (annual). We do not charge per generation, which keeps the cost promise simple.

| Tier | Price (USD / India) | Target | Includes | Positioning |
|---|---|---|---|---|
| Free | $0 | Tire-kickers | Generate, watermarked Studio preview | Try before paying |
| Pro (one-time) | $9 / ₹499 | Anyone who wants to keep the site | Clean HTML, zip, GitHub push, deploy to own Vercel | "Own it forever" |
| Hosting (yearly, needs Pro) | $7.99/yr / ₹449/yr | People who don't want to host themselves | Site at shipfolio.xyz/s/name, custom domain | Convenience add-on |

Year-one total: $16.99 (₹948). Year two onward: $7.99 (₹449).

## Assessment

- **$9 one-time is well placed.** It is impulse-buy territory and below a yearly template-tool plan. A one-time price also fits a product with near-zero running cost.
- **The hosting fee is the weakest part.** A Pro user can push to GitHub Pages or their own Vercel for free, so hosting competes with free. It sells on convenience and custom domains only. Expect a low attach rate.
- **India pricing is sensible** (about 33% under a straight conversion). Fixed INR prices also make UPI possible, since UPI is INR-only.
- **Margin is fine but not unlimited.** Dodo takes a percentage plus a fixed fee per transaction (check the current rate on your Dodo dashboard). Adaptive Currency adds about 4% on non-USD charges. At ₹499 the fixed fee takes a larger share than at $9.
- **Annual hosting is a small number to recover** if the card fails or the buyer forgets. The 14-day grace period before unpublishing is the right call.

## Key assumptions and how to test

| Assumption | How to test |
|---|---|
| Buyers see $9 as cheap enough to buy on impulse | Watch free-to-paid conversion for 4 weeks; try $7 and $12 for a week each if conversion is under 2% or over 8% |
| At least 20% of Pro buyers also take hosting | Track the hosting attach rate; if under 10%, bundle year one of hosting into Pro and charge only at renewal |
| ₹499 converts for Indian buyers better than ~₹750 would | Compare India free-to-paid against the rest of the world, and A/B ₹499 vs ₹649 |
| UPI is available for the one-time payment and the yearly renewal | Dodo test-mode purchase; if recurring UPI is not supported, Indian buyers renew by card |
| Free users hit the paywall at the right moment (publish, export) | Track where upgrade clicks come from |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hosting add-on attach rate is low | Bundle year-one hosting into Pro ($9 includes 12 months), charge $7.99 only from year two |
| Refund and dispute abuse (take the HTML, ask for the money back) | 14-day refund window; refund or lost dispute drops the user to free and unpublishes |
| Regional price arbitrage with a VPN | Accept it; the gap is small. Billing country at checkout decides the price |
| Rupee moves and ₹ prices drift | Review INR prices every quarter |
| Annual renewal fails silently | Email before renewal and at grace start (an email service is still to be chosen) |

## Experiments

1. Hosting bundled vs. sold separately: ship separately first, switch only if the attach rate is under 10% after 50 Pro buyers.
2. Price points for Pro at $9 vs $12, split by new visitors.
3. India ₹499 vs ₹649.
4. Upgrade prompt placement: at publish vs. at export vs. on the first watermarked preview.

# Payments go-live record (Dodo Payments, live mode)

**Date:** 2026-10-15. Dodo approved the live account the same day.
**Status at the end of this document's last update:** live mode configured on production, `PAYMENTS_ENABLED=true`, first real India test purchase and refund pending.

This is the runbook of what was done, why, and what is still open. For the offer and design, see README *Payments & Billing*; for the security model, `ARCHITECTURE.md` section 9; for history, `version2memory.md`.

## 1. The offer in production

| | Outside India | India |
|---|---|---|
| Pay today | $9, then yearly $7.99 | ₹499, **one time** |
| Includes | Pro + 1 year hosting, own domain | Pro + 1 year hosting, own domain |
| Year 2 onwards | Hosting **renews automatically** at $7.99/yr, cancel anytime | Hosting is **renewed by the user** for ₹449/yr when it ends. Nothing is charged automatically |
| Dodo product type | Recurring subscription with a 365-day **paid** trial ($9) | **One-time** payment |
| Hosting term kept by | Dodo subscription events (`subscription.*`) | Our own code (`applyOneTimeHosting`, 365 days per payment) |

All prices tax-inclusive, SaaS tax category.

## 2. Live Dodo products (created 2026-10-15 through the Dodo MCP, live mode)

| Env var | Product id | What it is |
|---|---|---|
| `DODO_PRODUCT_ID_PRO` | `pdt_0NpnAd5SAtPVFudslD3Gk` | Pro + 1 year hosting, USD. $7.99/yr recurring, 365-day paid trial at $9, 2-year term, `trial_apply_discounts=true` |
| `DODO_PRODUCT_ID_PRO_IN` | `pdt_0NpnHVHR1UzIiOHkAMk2J` | Pro + 1 year hosting, INR, **one-time ₹499** |
| `DODO_PRODUCT_ID_HOSTING` | `pdt_0NpnAd7gQG7EBJWb6ZxTt` | Hosting renewal, USD. $7.99/yr recurring, no trial, 1-year term |
| `DODO_PRODUCT_ID_HOSTING_IN` | `pdt_0NpnHVKTsFtI0aVgouydi` | Hosting renewal, INR, **one-time ₹449** |

Archived (do not use): `pdt_0NpnAd6XOaIg9xd20eCJR` (INR Pro subscription) and `pdt_0NpnAd8qvaPwwZ2xMjsjg` (INR hosting subscription). They were replaced by the one-time INR products, see section 4.

The earlier test-mode products (`pdt_0Npl…`, `pdt_0Npm…`) belong to the test environment only. Test and live are separate; ids do not carry over.

## 3. What was set on Vercel (project `portfolio-builder-saas`, team `surya-team2`)

`DODO_ENVIRONMENT=live_mode`, `DODO_PAYMENTS_API_KEY` (live key), `DODO_WEBHOOK_SECRET` (live endpoint secret), the four `DODO_PRODUCT_ID_*` above, and finally `PAYMENTS_ENABLED=true`. Webhook endpoint registered in Dodo live mode: `https://www.shipfolio.xyz/api/webhooks/dodo`.

How to set values: `npx vercel@63.1.2 env update NAME production --scope surya-team2 --yes < <(pbpaste)` for secrets (copy the value first; Claude cannot write secrets), `printf '%s' VALUE | npx vercel@63.1.2 env update NAME …` for plain values. The `vercel` CLI is not installed globally, so use `npx vercel@63.1.2`.

**Known side effect:** `env update` applied several of these to **Production and Preview**, so preview deployments also carry the live Dodo key. Tighten in the Vercel dashboard (Environment Variables, untick Preview) if previews are ever shared.

## 4. Why India became a one-time payment

India first used the same subscription as everyone else. In the live test, the UPI app showed an authorization limit of **₹15,000** and a mandate valid until **2050**, which looks alarming for a ₹499 purchase.

Findings:
- The ceiling is Dodo's default UPI AutoPay mandate floor (₹15,000 for any charge below it). The configurable floor (`mandate_min_amount_inr_paise`) applies to **Indian cards only**; Dodo's docs say UPI subscriptions follow their own AutoPay flow and are unaffected.
- The mandate end date is set by Dodo's UPI flow. Shortening the product term (we set 2 years on the USD Pro product, 1 year on renewals) did change Dodo's subscription record but **did not change the 2050 mandate date**. No API field for it was found.
- So there is no setting on our side that removes the red flag for UPI subscriptions.

Decision (owner, 2026-10-15): India pays **once** (no mandate at all). Trade-off: India buyers do not auto-renew. Renewal is manual (the existing "renew hosting" button after a lapse), so the planned renewal reminder emails matter more.

Side benefits: a one-time payment has a far lower Dodo minimum than a subscription ($0.50 vs $1.00), and UPI behaves like a normal payment.

## 5. Code changes (commit `ee9d35c`)

- `src/routes/api/webhooks/dodo.ts`: a `payment.succeeded` event **without** a `subscription_id` calls `applyOneTimeHosting` after recording the purchase. Runs on every delivery, idempotent per payment (a retry cannot add a second year).
- `src/server/billing.ts`:
  - `applyOneTimeHosting(admin, userId, paymentId)`: sets `hosting_subscriptions` to `active`, `current_period_end` = max(now, existing end) + 365 days, `grace_until` = end + 14 days. The payment id is stored in `dodo_subscription_id` (no migration needed; the column is free text). An early renewal stacks the year on the remaining time.
  - `cancelDodoSubscription` returns early for ids that do not start with `sub_`, so a refund of a one-time payment never calls Dodo's cancel endpoint.
- `src/config/pricing.ts`: new `autoRenews` and `renewalPhrase`. India copy says "then renew for ₹449/year when it ends"; the US copy is unchanged ("then $7.99/year, cancel anytime").
- Copy updated to match: `StudioToolbar`, `PublishToolbar`, `OfferSummary`, `PricingSection`, Settings plan card, `/terms` (India: one time, nothing renews automatically).
- Tests: 3 new in `src/server/billing.test.ts` (first one-time purchase, redelivery, early renewal then refund). Full suite 521 passing; typecheck clean.
- No database migration was needed or applied.

## 6. Dodo behaviours learned (useful next time)

- **Minimum charge:** subscriptions $1.00 (including tax), one-time $0.50. Non-USD subscriptions are also checked in USD, so a ₹75 subscription (about $0.85) fails with `TOTAL_PAYMENT_AMOUNT_BELOW_MINIMUM_AMOUNT`.
- **Discounts and paid trials:** `trial_apply_discounts` defaults to `false`, so a code does not reduce a paid-trial charge. It is now `true` on the live USD Pro product (the INR Pro subscription that also had it is archived).
- **Checkout page quirk:** on the hosted checkout the order summary showed the discounted ₹124.75 while the pay button still read ₹499, but the payment Dodo created was correct (₹124.75). Our button text comes from `customization.theme_config.pay_button_text` in `src/server/dodo/checkout.ts`, which is a fixed string, so it does not follow discounts. Worth shipping that text without a price, or reporting to Dodo.
- **Fees (Dodo pricing page, as read 2026-10-15):** 4% + 40¢ US domestic; +1.5% international; +0.5% subscriptions; India domestic 4% + 15¢; refund $1 (not returned); dispute $30; payout fee $5 under $1,000.
- **Webhook:** unsigned request returns 400, bad signature 401 (verified on production after the live switch).
- **Dodo MCP OAuth:** the remote MCP follows the account you signed in to. After `/mcp` re-auth it moved from test mode to live mode (a list of products returned an empty live account). Every live write was confirmed with the owner first.

## 7. Test discount code (live)

`SHIPTEST99` (`dsc_0NpnDxNG3Vc1IFXdYUJJl`): the name is historical, it is now **75% off**, limited to 2 uses, expires 2026-10-22, restricted to the USD Pro product and the one-time INR Pro product (the archived INR subscription is also on its list). Expected totals: about ₹125 in India, $2.25 in the US. Delete or let it expire once the live test is done. Promo codes for real customers should be limited to one cycle on subscription products.

## 8. Open items

1. **Real test purchase (India, UPI) and refund**, then check: purchase row, `users.plan`, `hosting_subscriptions` end date about one year out, and that the `refund.succeeded` webhook revokes Pro. The refund webhook has never been seen from Dodo in either mode. Delete the test user afterwards (database write: explain to the owner first).
2. US live test purchase (card) the same way, if the owner wants it.
3. Report to Dodo (owner sends): pay-button label ignores discounts for paid trials; ask whether the UPI AutoPay ceiling and end date can be capped (only matters if India subscriptions are ever reintroduced).
4. Renewal reminder emails (no email service yet; promised in `/terms`: 30-day price-change notice). India is manual renewal, so these matter.
5. Early renewal for India: checkout refuses a second purchase while hosting is active (`409 already_subscribed`), so a user can only renew after the term ends (14-day grace). Consider allowing renewal in the last 30 days.
6. Docs: `API.md` still describes the older flow.
7. Supabase advisor items from earlier (`upload_deletion_warnings` RLS, anon-callable retention functions) still wait on owner OK.
8. Tighten Preview env scope for the Dodo variables (section 3).
9. Consider UPI note near the Upgrade button is no longer needed for India (no mandate).

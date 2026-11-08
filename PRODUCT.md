# Product

<!-- impeccable:product-schema 1 -->

> Written by `impeccable init` from repository evidence only. The owner declined the interview round,
> so every line marked **(inferred)** is a hypothesis from code and copy, not a confirmed answer.
> Confirm or correct those lines before treating them as product truth.

## Platform

web

## Users

- **(inferred)** Indonesian online shoppers buying on Shopee and Tokopedia, mostly on a phone, who are about to pay an unfamiliar seller and want a quick second opinion first. Evidence: all UI copy is Bahasa Indonesia (`lang="id"`), prices are in Rupiah, and the only supported marketplaces are Shopee and Tokopedia.
- Admin operator (confirmed by code): one internal role that logs in at `/admin` to view stats and manage users and premium status.

## Product Purpose

SafeBeli ("Cek Keamanan Sebelum Belanja") lets a shopper paste a seller or product link and get, within seconds, an AI safety verdict before they buy:

- a score from 0 to 100,
- a status of `AMAN` (safe), `HATI-HATI` (be careful) or `BAHAYA` (danger),
- a 1–2 sentence summary and three detail points, in Bahasa Indonesia.

Results can be shared (WhatsApp, Telegram, Twitter/X, copy). Success, **(inferred)**: the shopper avoids a scam purchase, and free users convert to Premium.

## Positioning

- **(inferred)** A single-purpose, paste-a-link safety check specific to Indonesian marketplaces, in the shopper's own language, faster than reading a seller's reviews by hand.
- Open decision: no differentiating mechanism versus marketplace-native ratings or other checkers has been confirmed. Do not claim one in copy until the owner states it.

## Operating Context

- Flow: paste link → "Analisis Sekarang" → loading state → score/status/summary/details → share or "Cek Link Lain".
- Guests can analyse without an account (shown as "3x/hari gratis"). Logged-in users get saved history (last 20 entries via `/api/history`).
- Share-to-chat is part of the flow: results go to WhatsApp, Telegram and X.
- The page includes static "Tips Belanja Aman" content: check seller rating (>4.5, >6 months), real product photos, too-cheap prices.

## Capabilities and Constraints

- Stack (existing, confirmed by code): static `public/index.html` (inline CSS/JS, no framework, no build step) plus Vercel serverless functions in `api/` (`register`, `login`, `analyze`, `history`, `admin`, `admin-page`), routed by `vercel.json`. Data is in Supabase (`users`, `analysis_history`), and analysis uses the Anthropic Messages API.
- Plans, as stated in the UI:
  - Gratis: Rp 0, 3 analyses per day, history.
  - Premium: Rp 65.000/bulan, unlimited analyses, 30-day history, AI queue priority, priority support.
- Daily limit enforced server-side for logged-in non-premium users: 3 per day, then HTTP 429.
- **Known limitation (confirmed by code, owner's intent unconfirmed):** `api/analyze.js` sends only the link URL text to the model. It does not fetch the seller page, ratings, reviews or seller age. The score is therefore a model judgement of the URL alone. Future copy must not claim the tool inspects seller data, reviews or transaction history until that exists.
- Open decisions:
  - Whether the guest limit is enforced server-side; the visible enforcement is for logged-in users.
  - How Premium is paid for; no payment integration is visible.
  - The "AI queue priority" claim has no matching mechanism in code.

## Brand Commitments

- Name: **SafeBeli**, set as "Safe" + "Beli" in two parts in the logo text. The shield (🛡️) is used as the mark.
- Voice, **(inferred)**: casual Bahasa Indonesia using "kamu", short and reassuring, with emoji used as icons.
- No logo file, brand palette or typography commitment exists as an asset. The current colours and fonts are incumbent implementation, not a confirmed brand commitment.

## Evidence on Hand

- None in the repository: no testimonials, usage statistics, press, partner logos or case studies.
- Future work must not invent user counts, accuracy rates, "trusted by" claims or reviews.
- The only real proof available is a live demo of the analysis itself.

## Product Principles

1. **(inferred)** Answer before the purchase: one paste, one clear verdict, in seconds, on a phone.
2. **(inferred)** Verdict first, reasons second: the status and score read at a glance, and the explanation supports them.
3. Claim only what the analysis actually does. Trust is the product, so overstatement destroys it.
4. **(inferred)** Make the verdict shareable, because warning friends and family is part of the job.

## Accessibility & Inclusion

- No product-specific requirement established. Status is currently signalled by colour plus a text label (`AMAN` / `HATI-HATI` / `BAHAYA`), and the text label should stay.

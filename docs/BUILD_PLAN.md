# Portal landing page — build plan (sections 4, 3, 8 of PLAN.md)

## Section 8 — Stack and file layout

Plain HTML/CSS/JS, no framework, no build step. Deploys to Vercel as-is (static files + one `api/` folder of Node functions).

```
(repo root)/
  index.html          landing page (both pricing variants in the markup, one shown)
  welcome.html        target of the welcome-email link, fires event 8
  privacy.html        privacy policy, fires privacy_policy_viewed
  config.js           public PostHog key + host (the only thing to edit before deploy)
  css/styles.css
  js/analytics.js     PostHog init, UTM capture, variant resolution, event helpers
  js/main.js          scroll observer, CTA, form start/submit, feedback
  api/signup.js       POST: validate → Apps Script (Sheet + Gmail) → server event 6
  api/open.js         GET: 1x1 GIF tracking pixel → server event 7
  vercel.json         clean URLs (/welcome, /privacy), no-cache on config
  README.md           deploy steps + env vars
```

Server env vars (Vercel → Settings → Environment Variables):
`POSTHOG_KEY`, `POSTHOG_HOST` (default `https://us.i.posthog.com`), `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`.

Signup path: form → `/api/signup` → Google Apps Script web app, which appends the row to a Sheet, sends the welcome email from Gmail, and sends follow-ups on day 3 and day 7 via a daily trigger. Jose chose this over Apollo on 2026-10-07. If `APPS_SCRIPT_URL` isn't set, the signup is accepted but only logged (`delivered: false`).

## Section 3 — A/B test wiring

- Flag `pricing-model-test`, variants `control` / `per-shift`, 50/50, set up in PostHog UI as an Experiment with primary metric `signup_form_submitted`.
- Both pricing blocks are in the HTML; the page hides the pricing section until the flag resolves, then shows the matching block. Headline and CTA are identical in both, per the plan.
- If PostHog is blocked or slow (>1.5 s), the visitor sees `control` and events carry `pricing_variant: control_fallback` so those visitors can be filtered out of the readout.
- QA override: `?variant=per-shift` or `?variant=control` forces a variant for QA; those events carry `variant_source: qa_override` so they can be filtered out. Use `utm_source=referral` test links for friends' traffic too.
- Every custom event carries `pricing_variant` as a property, in addition to PostHog's automatic `$feature/pricing-model-test`.

## Section 4 — Funnel events

| # | Event | Where it fires | Properties |
|---|---|---|---|
| 1 | `landing_page_viewed` | page load, after flag resolves | utm_source, utm_medium, utm_campaign, pricing_variant |
| 2 | `pricing_section_viewed` | IntersectionObserver, ≥50% visible, once | pricing_variant |
| 3 | `signup_cta_clicked` | any `[data-cta]` button (hero, pricing, nav) | cta_location, pricing_variant |
| 4 | `signup_form_started` | first focus on any form field, once | pricing_variant |
| 5 | `signup_form_submitted` | after `/api/signup` returns OK | job_title_bucket, bed_band, pricing_variant |
| 6 | `welcome_email_sent` | server, after Apps Script confirms the row is stored and the welcome email sent | channel: apps_script |
| 7 | `welcome_email_opened` | server, `/api/open?e={{email}}` pixel in each email Apps Script sends | — |
| 8 | `welcome_email_link_clicked` | `/welcome` page load | utm_* |

Supporting: `privacy_policy_viewed` (privacy page), `feedback_submitted` (optional one-line note shown after signup), `survey sent` (PostHog built-in survey, set up in UI).

Identity: on successful submit the browser calls `posthog.identify(email)`, and the server uses the same email as `distinct_id` for events 6 and 7, so stages 1–8 join into one person. Email is the join key because the Apps Script puts it into the pixel and link. `/welcome` strips the `e` param from the URL before any capture.

Replay: on, `maskAllInputs: true`. UTMs are also registered as super-properties so every later event in the session carries them.

## Honesty rules applied to copy

No logos, testimonials, customer counts or "live" language. Copy says "in early design with a Florida hospital operations team" and the CTA is the founding-facility list.

## What I need from you to go live (not needed to build)

1. PostHog project key (open item #2) → `config.js` and `POSTHOG_KEY`.
2. Apps Script deployed as a web app from a Google Sheet (steps in `fallback/apps-script.gs`).
3. A GitHub repo to push to, and the Vercel project linked to it.

# Portal landing page

Plain HTML/CSS/JS + two Vercel functions. No build step. Plan: `docs/BUILD_PLAN.md`.

## Preview both variants
- `/?variant=control` — flat $500/month
- `/?variant=per-shift` — $40 per filled shift

Without `?variant=`, PostHog's `pricing-model-test` flag decides; if PostHog is missing or slow (1.5 s) the visitor sees control and events carry `variant_source: fallback`.

## Deploy (Vercel)
1. Push this folder to a GitHub repo and import it in Vercel (framework preset: Other, no build command).
2. Put the PostHog project key in `config.js` (`posthogKey`).
3. In Vercel → Settings → Environment Variables:
   - `POSTHOG_KEY` (same key), `POSTHOG_HOST` (optional, default `https://us.i.posthog.com`)
   - `APPS_SCRIPT_URL` + `APPS_SCRIPT_SECRET` (set up `fallback/apps-script.gs` first; steps are at the top of that file)
   - Without `APPS_SCRIPT_URL`, signups return `delivered: false` and are only written to the Vercel function log.

## PostHog setup (UI)
1. Feature flag `pricing-model-test`, multivariate `control` / `per-shift`, 50/50.
2. Experiment on that flag, primary metric `signup_form_submitted`.
3. Session replay on (the page already sets `maskAllInputs: true`).
4. Surveys: feedback widget + 1-question survey (both fire PostHog's built-in `survey sent`).
5. Funnel insight: steps 1–8 from `docs/BUILD_PLAN.md`, breakdown by `pricing_variant` or `utm_source`. Filter out `variant_source = qa_override`.

## Welcome email links (already built into apps-script.gs)
- Link: `https://YOUR-SITE.vercel.app/welcome?utm_source=email&utm_medium=email&utm_campaign=welcome_sequence&e=<email>`
- Open pixel: `<img src="https://YOUR-SITE.vercel.app/api/open?s=welcome&e=<email>" width="1" height="1" alt="">`

Open tracking is approximate: Apple Mail Privacy Protection pre-loads images (inflates opens) and some clients block images (deflates). Treat stage 7 as directional.

## Placeholders to fill
- `config.js` → PostHog key
- Privacy policy contact line points to "reply to any Portal email"; swap in a contact address if you want one.
- Brand name "Portal" is the working name throughout.

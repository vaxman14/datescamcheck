# DateScamCheck.com

A free, no-sign-up web tool that reverse-image-searches a dating profile photo
and returns a simple verdict: ✅ Likely Real / ⚠️ Suspicious / 🚨 Likely Fake.

Static HTML/CSS/JS + one Netlify serverless function that proxies the
**SerpApi Google Reverse Image** API. The SerpApi key lives only in a Netlify
environment variable — it is never shipped to the browser.

## Files

```
index.html               Home — tool + site description + FAQ
how-it-works.html         Explainer
about.html                Romance / pig-butchering scam background + contact
privacy.html              Privacy Policy (required for AdSense)
terms.html                Terms of Service (required for AdSense)
css/style.css             All styling (mobile-first)
js/app.js                 Front-end logic, calls the function
js/consent.js             Cookie consent banner + gated AdSense loading
netlify/functions/
  reverse-image.js        SerpApi proxy + verdict heuristic
netlify.toml              Netlify build + headers config
robots.txt, sitemap.xml   SEO
```

## Deploy to Netlify

1. Push this folder to a GitHub repo (or drag-and-drop it in the Netlify UI).
2. In Netlify, **Add new site → Import** the repo. No build command is
   needed; publish directory is `.` and functions are auto-detected from
   `netlify/functions` (already set in `netlify.toml`).
3. Get a free SerpApi key at <https://serpapi.com/> (free tier: 100
   searches/month).
4. In Netlify: **Site settings → Environment variables → Add a variable**
   - Key: `SERPAPI_KEY`
   - Value: your SerpApi key
5. **Redeploy** the site so the function picks up the variable.
6. Point the `datescamcheck.com` domain at the site under
   **Domain management**.

Without `SERPAPI_KEY` the site still works — the checker simply falls back to
a manual Google Lens link instead of an automated verdict.

## Google AdSense

Replace the placeholder IDs with your real ones:

- `ca-pub-XXXXXXXXXXXXXXXX` → your AdSense publisher ID. It appears in
  **`js/consent.js`** (the `ADSENSE_CLIENT` constant) **and** in the
  `data-ad-client` attribute of every `<ins>` tag in the `.html` files.
- `data-ad-slot="0000000000"` … `5555555555` → real ad-unit slot IDs.

Ads only render once your AdSense account and the `datescamcheck.com` domain
are approved by Google.

### How ad loading + cookie consent work

The AdSense script is **not** hard-coded in the pages. `js/consent.js` shows a
cookie banner on the first visit and loads AdSense only after the visitor
chooses:

- **Accept** → AdSense loads with personalised ads.
- **Reject** → AdSense loads in non-personalised mode (`requestNonPersonalizedAds`),
  so advertising-profile cookies are not used.

The choice is stored in `localStorage` and can be changed via the "Cookie
Preferences" link in the footer.

> **EEA / UK note:** Google requires a Google-certified Consent Management
> Platform (CMP) for traffic from the EEA, UK, and Switzerland. The built-in
> banner is a solid baseline and is fine for many regions, but if you expect
> significant European traffic, enable a certified CMP (Google offers one free
> inside the AdSense dashboard under *Privacy & messaging*) and remove the
> custom banner to avoid showing two.

## AdSense approval checklist

This build is set up to satisfy Google's common approval requirements:

- ✅ Privacy Policy page (`privacy.html`) — linked in every footer.
- ✅ Terms of Service page (`terms.html`) — linked in every footer.
- ✅ About page with a contact email.
- ✅ Cookie consent banner that gates ad cookies.
- ✅ Substantial original text on every page (description, FAQ, explainers).
- ✅ Clear site description of what the service does (Home + About).
- ✅ Professional, consistent design; no misleading claims; no adult content.

Before submitting for review: set up the `hello@` and `privacy@` mailboxes for
`datescamcheck.com` (or change the addresses in the footers and policy pages),
and make sure the site is live on the real domain.

## Local development

```
npm install -g netlify-cli
netlify dev          # serves the site + functions at http://localhost:8888
```

Set `SERPAPI_KEY` locally with a `.env` file (do **not** commit it):

```
SERPAPI_KEY=your_key_here
```

## How the verdict is decided

`netlify/functions/reverse-image.js` scores SerpApi results:

- Photo found on a **stock-photo** site or 2+ **modelling/acting** pages → 🚨
- **0** matches → ✅ (typical for a private person; not a guarantee)
- **10+** matches → 🚨 (widely circulated = likely stolen)
- **4–9** matches → ⚠️
- **1–3** matches → ⚠️ (check whether they're the same person)

Verdicts are guidance, not proof. The UI says so, and so should you.

## Notes

- No backend server, no database. The one Netlify function is stateless and
  stores nothing.
- Uploaded files can't be auto-searched (SerpApi needs a public image URL), so
  uploads fall back to a Google Lens manual search.

# Docs assets

Visual aids for MoneyMap documentation are **not** stored as external PNG/JPG files here.

## Where the mockups live

Phone-frame previews (Dashboard, Entry, History empty state, Settings / Smart Tips) are **inline SVG** inside the root GitHub Pages site:

- [`../index.html`](../../index.html) — canonical Pages entry at  
  https://secretlyspy.github.io/TIP_MoneyMap-Finance-Tracker-App/

## Why inline SVG

- GitHub Pages serves a single self-contained HTML file with no broken image paths.
- Brand colors (`#0F6E5C` primary, `#3DBF9A` accent) stay in source control with the page.
- No separate asset pipeline or CDN dependency for onboarding screenshots.

## Adding new visuals

1. Prefer inline SVG (or inline data-URI) in `index.html`.
2. If a binary asset is unavoidable, place it in this folder and link with a **repo-relative** path that works on Pages (test the live URL after deploy).
3. Keep alt text / `<title>` + `<desc>` on decorative mockups for accessibility.

Do not commit large unoptimized screenshots; compress or redraw as SVG when possible.

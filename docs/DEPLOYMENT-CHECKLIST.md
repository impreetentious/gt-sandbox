# Deployment checklist

The repository is a static Next.js export. Deployment is intentionally an owner action; this file keeps the release steps short and reproducible.

## Before connecting Vercel

1. Review the local commit series.
2. Run `CI=true pnpm verify:full` on Node 24 with pnpm 10 in an environment that permits the local exported-site server.
3. Confirm `out/` serves through `pnpm serve:export` and that a direct `/play/pd/` request plus `/play/unknown/` behave correctly.
4. Complete the manual matrix in [ACCESSIBILITY-AUDIT.md](ACCESSIBILITY-AUDIT.md).
5. Capture the final README screenshots/GIF from the reviewed production candidate and run Lighthouse; record scores of at least 95 in every category.
6. Choose the release version and update every active version surface only in the owner-authorized commit.

## Vercel project

- Import `ItsMonarch04/gt-sandbox` with the Next.js framework preset.
- Build command: `pnpm build`.
- Output is detected from the static export (`out/`).
- Node major: 24.
- Keep Vercel Analytics, Speed Insights, functions, and other runtime additions disabled.
- `VERCEL_PROJECT_PRODUCTION_URL` is used automatically for metadata when available. Set `NEXT_PUBLIC_SITE_URL=https://your-final-domain.example` if a custom canonical origin should override it.
- `vercel.json` supplies the CSP, no-referrer policy, and content-type protection. Do not replace those headers with a permissive dashboard rule.

## Production smoke

After the owner’s launch push:

1. Visit `/`, all six `/play/*/` routes, `/evolve/`, `/build/`, `/methods/`, `/repeat/`, one `/hot-seat/*/` route, one `/auctions/*/` route, `/classroom/`, one direct deep link, and `/play/unknown/`.
2. Confirm the footer version matches the release tag and route titles/OG image resolve at the production origin.
3. In browser developer tools, verify the CSP is present, there are no CSP errors, and a full browse makes no off-origin requests.
4. Complete one PD round, one Evolution preset, one Build edit, one hot-seat handover, one auction bid, and one classroom JSON→CSV ingest.
5. Open a copied Build URL in a clean private window and confirm its labels, payoffs, structure, and exact equilibria reproduce.
6. Serve the same `out/` directory from a second root-mounted static server as the portability spot-check.

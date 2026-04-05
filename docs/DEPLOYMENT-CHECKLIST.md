# Deployment guide

Game Theory Sandbox builds to a static `out/` directory. It requires Node 24.10.0 and pnpm 10.32.1, as pinned in `.nvmrc`, `package.json`, and CI.

## Verify the production candidate

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm audit --audit-level high
CI=true pnpm verify:full
```

The full suite builds the export, enforces the per-route JavaScript budget, discovers every exported route, and checks direct navigation, CSP headers, same-origin requests, keyboard behavior, and axe results. Complete the recommended assistive-technology checks in [ACCESSIBILITY-AUDIT.md](ACCESSIBILITY-AUDIT.md) separately.

## Vercel

- Import `ItsMonarch04/gt-sandbox` with the Next.js framework preset.
- Use `pnpm build` as the build command and `out/` as the output directory.
- Select Node 24 and keep runtime functions, Analytics, and Speed Insights disabled; the application is intentionally static and telemetry-free.
- Keep the response headers from `vercel.json`. Do not replace them with a permissive dashboard rule.
- Vercel supplies `VERCEL_PROJECT_PRODUCTION_URL` for canonical metadata. Set `NEXT_PUBLIC_SITE_URL=https://your-domain.example` when a custom production origin should override it.

## Other static hosts

Serve the contents of `out/` at the origin root and reproduce the headers documented in [STATIC-HOST-HEADERS.md](STATIC-HOST-HEADERS.md). A host without path-specific headers can serve the application, but it cannot safely support the `/embed/*` framing exception.

## Production smoke test

After deployment:

1. Open the home page, one dynamic game path, one embed path, and an invalid game path directly rather than through client navigation.
2. Confirm the footer version, route titles, manifest, icons, and social image resolve from the production origin.
3. Verify that the CSP is present, the console has no CSP errors, and a representative browse makes no off-origin requests.
4. Complete one game round, one Evolution preset, one Build edit, one hot-seat handover, one auction bid, and one classroom JSON-to-CSV ingest.
5. Open a copied Build URL in a clean private window and confirm that labels, payoffs, structure, and exact equilibria reproduce.
6. Test offline fallback after loading the application once, and confirm a new release replaces the old service-worker cache.

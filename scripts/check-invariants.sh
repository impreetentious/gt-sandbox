#!/usr/bin/env bash

set -euo pipefail

failed=0

report_violation() {
  local description="$1"
  shift

  if "$@"; then
    echo "Invariant violation: ${description}" >&2
    failed=1
  fi
}

has_matches() {
  local pattern="$1"
  shift
  rg --quiet --glob '*.{ts,tsx,js,jsx,mjs,cjs}' "$pattern" "$@"
}

if [[ -d src/engine ]]; then
  report_violation \
    'src/engine must not import React or Next.' \
    has_matches "from[[:space:]]+['\"](react|next)(/[^'\"]*)?['\"]" src/engine

  report_violation \
    'Math.random is permitted only in src/engine/rng.ts.' \
    rg --quiet --glob '*.{ts,tsx}' --glob '!rng.ts' 'Math\.random\(' src/engine
fi

report_violation \
  'Date.now() and zero-argument new Date() are allowed only in src/state/seed.ts.' \
  rg --quiet --glob '*.{ts,tsx}' --glob '!state/seed.ts' 'Date\.now\(\)|new[[:space:]]+Date\(\)' src

report_violation \
  'runtime API requests are forbidden under src/.' \
  has_matches 'fetch\(|XMLHttpRequest|sendBeacon' src

report_violation \
  'off-origin script sources are forbidden under src/.' \
  has_matches '<script[^>]+src=["'\'']https?://' src

report_violation \
  'Next server actions are forbidden.' \
  has_matches "['\"]use server['\"]" src

if [[ -e middleware.ts || -e middleware.js || -e middleware.mjs ]]; then
  echo 'Invariant violation: Next middleware is forbidden.' >&2
  failed=1
fi

if [[ -d src/app/api ]]; then
  echo 'Invariant violation: src/app/api is forbidden.' >&2
  failed=1
fi

if find src/app -type f \( -name 'route.ts' -o -name 'route.tsx' \) | grep -q .; then
  echo 'Invariant violation: App Router route handlers are forbidden.' >&2
  failed=1
fi

report_violation \
  'next/headers and next/server imports are forbidden.' \
  has_matches "from[[:space:]]+['\"]next/(headers|server)['\"]" src

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo 'Invariant checks passed.'

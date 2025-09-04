#!/usr/bin/env bash

set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo 'Invariant checks require ripgrep (rg) on PATH.' >&2
  exit 1
fi

failed=0

report_violation() {
  local description="$1"
  shift
  local status=0

  "$@" || status=$?

  if [[ "$status" -eq 0 ]]; then
    echo "Invariant violation: ${description}" >&2
    failed=1
  elif [[ "$status" -ne 1 ]]; then
    echo "Invariant tooling error (exit ${status}): ${description}" >&2
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
fi

report_violation \
  'Math.random is permitted only in src/engine/rng.ts.' \
  rg --quiet --glob '*.{ts,tsx}' --glob '!rng.ts' 'Math\.random\(' src

report_violation \
  'Date.now() and zero-argument new Date() are forbidden under src/.' \
  rg --quiet --glob '*.{ts,tsx}' 'Date\.now\(\)|new[[:space:]]+Date\(\)' src

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

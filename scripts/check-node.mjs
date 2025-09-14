#!/usr/bin/env node
// Preinstall Node guard.
//
// pnpm only *warns* on an `engines.node` mismatch — even with
// `engine-strict=true` in .npmrc it prints "[WARN] Unsupported engine" and
// installs anyway (unlike npm, which errors EBADENGINE). That let a build run
// on the wrong major silently. This guard makes the wrong major fail the
// install loudly, giving pnpm the same guarantee npm's engine-strict gives the
// sibling repos. The bound is read from package.json so it can never drift from
// `engines` / `.nvmrc` / CI.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, "..", "package.json"), "utf8"));
const range = pkg.engines?.node ?? "";
const major = Number(process.versions.node.split(".")[0]);
const min = Number((range.match(/>=\s*(\d+)/) || [])[1] ?? NaN);
const maxExclusive = Number((range.match(/<\s*(\d+)/) || [])[1] ?? Infinity);

if (Number.isFinite(min) && (major < min || major >= maxExclusive)) {
  console.error(
    `\n✖ Node ${process.versions.node} does not satisfy engines.node "${range}".\n` +
      `  This repo pins Node ${min} (see .nvmrc). Run \`nvm use\` (or install Node ${min}).\n` +
      `  Refusing to continue on the wrong major so install/build cannot run against it.\n`,
  );
  process.exit(1);
}

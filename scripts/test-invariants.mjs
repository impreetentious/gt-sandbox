import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const fixture = resolve("src/engine/__p0-invariant-violation.ts");

try {
  mkdirSync(dirname(fixture), { recursive: true });
  writeFileSync(
    fixture,
    "import React from 'react';\nexport const seeded = React;\n",
  );

  let failedAsExpected = false;
  try {
    execFileSync("bash", ["scripts/check-invariants.sh"], { stdio: "pipe" });
  } catch {
    failedAsExpected = true;
  }

  if (!failedAsExpected) {
    throw new Error(
      "The seeded engine React import did not fail invariant checks.",
    );
  }
} finally {
  rmSync(fixture, { force: true });
}

// Keep the engine directory in the intended shape even before P1 adds its files.
const engineDirectory = dirname(fixture);
try {
  execFileSync("rmdir", [engineDirectory], { stdio: "ignore" });
} catch {
  // P1 may already have added engine files when this check is run in the future.
}

execFileSync("bash", ["scripts/check-invariants.sh"], { stdio: "inherit" });
console.log("Seeded invariant violation was rejected and removed.");

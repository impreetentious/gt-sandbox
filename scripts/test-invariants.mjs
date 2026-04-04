import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const engineFixture = resolve("src/engine/__invariant-violation.ts");
const decoyFixture = resolve("src/state/__rng-invariant-violation.ts");

function expectInvariantFailure(fixture, contents, message) {
  mkdirSync(dirname(fixture), { recursive: true });
  writeFileSync(fixture, contents);

  try {
    execFileSync("bash", ["scripts/check-invariants.sh"], { stdio: "pipe" });
  } catch {
    return;
  } finally {
    rmSync(fixture, { force: true });
  }

  throw new Error(message);
}

try {
  expectInvariantFailure(
    engineFixture,
    "import React from 'react';\nexport const seeded = React;\n",
    "The seeded engine React import did not fail invariant checks.",
  );
  expectInvariantFailure(
    decoyFixture,
    "export const seeded = Math.random();\n",
    "A Math.random call in a non-engine rng.ts path did not fail invariant checks.",
  );
} finally {
  rmSync(engineFixture, { force: true });
  rmSync(decoyFixture, { force: true });
}

execFileSync("bash", ["scripts/check-invariants.sh"], { stdio: "inherit" });
console.log("Seeded invariant violations were rejected and removed.");

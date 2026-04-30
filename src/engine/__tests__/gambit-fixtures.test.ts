import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createNormalFormGame } from "@/engine/game";
import { formatRational } from "@/engine/rational";
import { isDegenerate, mixedNashEquilibria } from "@/engine/solve/mixed";

interface FixtureEquilibrium {
  readonly row: readonly string[];
  readonly column: readonly string[];
}

interface FixtureCase {
  readonly id: string;
  readonly title: string;
  readonly rowActions: readonly string[];
  readonly columnActions: readonly string[];
  readonly payoffs: readonly (readonly (readonly [string, string])[])[];
  readonly expectation: "equilibrium-set" | "witness-only";
  readonly equilibria: readonly FixtureEquilibrium[];
}

interface FixtureCorpus {
  readonly provenance: {
    readonly solver: string;
    readonly command: string;
    readonly gambitVersion: string;
    readonly containerImage: string;
    readonly containerImageId: string;
    readonly sourceSeed: string;
    readonly network: string;
    readonly hostMounts: string;
  };
  readonly cases: readonly FixtureCase[];
}

interface FixtureManifest {
  readonly caseCount: number;
  readonly fixture: string;
  readonly gambitVersion: string;
  readonly sha256: string;
  readonly sourceSeed: string;
}

const fixturePath = resolve(process.cwd(), "fixtures/gambit-16.6.0.json");
const manifestPath = resolve(process.cwd(), "fixtures/manifest.json");
const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString()) as FixtureCorpus;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FixtureManifest;

function canonicalEquilibrium(equilibrium: FixtureEquilibrium): string {
  return `${equilibrium.row.join(",")};${equilibrium.column.join(",")}`;
}

function engineEquilibria(caseFixture: FixtureCase): string[] {
  const game = createNormalFormGame({
    id: caseFixture.id,
    title: caseFixture.title,
    rowActions: caseFixture.rowActions,
    columnActions: caseFixture.columnActions,
    payoffs: caseFixture.payoffs,
  });

  return mixedNashEquilibria(game)
    .map((equilibrium) =>
      canonicalEquilibrium({
        row: equilibrium.row.probabilities.map(formatRational),
        column: equilibrium.column.probabilities.map(formatRational),
      }),
    )
    .sort();
}

describe("Gambit 16.6.0 external fixture corpus", () => {
  it("has an intact, pinned, no-network provenance manifest", () => {
    expect(manifest.fixture).toBe("gambit-16.6.0.json");
    expect(manifest.caseCount).toBe(39);
    expect(manifest.gambitVersion).toBe("16.6.0");
    expect(manifest.sourceSeed).toBe("gt-sandbox-p3-gambit-fixtures-v1");
    expect(createHash("sha256").update(fixtureBytes).digest("hex")).toBe(manifest.sha256);
    expect(fixture.provenance).toMatchObject({
      solver: "gambit-enummixed",
      command: "gambit-enummixed -q",
      gambitVersion: manifest.gambitVersion,
      sourceSeed: manifest.sourceSeed,
      network: "none",
      hostMounts: "none",
    });
    expect(fixture.provenance.containerImageId).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("matches Gambit's complete equilibrium set for every nondegenerate fixture", () => {
    const fullSetFixtures = fixture.cases.filter(
      (caseFixture) => caseFixture.expectation === "equilibrium-set",
    );

    for (const caseFixture of fullSetFixtures) {
      const game = createNormalFormGame({
        id: caseFixture.id,
        title: caseFixture.title,
        rowActions: caseFixture.rowActions,
        columnActions: caseFixture.columnActions,
        payoffs: caseFixture.payoffs,
      });

      expect(isDegenerate(game), caseFixture.id).toBe(false);
      expect(engineEquilibria(caseFixture), caseFixture.id).toEqual(
        caseFixture.equilibria.map(canonicalEquilibrium).sort(),
      );
    }
  });

  it("keeps degenerate fixtures as witnesses rather than claiming completeness", () => {
    const witnessFixtures = fixture.cases.filter(
      (caseFixture) => caseFixture.expectation === "witness-only",
    );

    expect(witnessFixtures).toHaveLength(3);

    for (const caseFixture of witnessFixtures) {
      const game = createNormalFormGame({
        id: caseFixture.id,
        title: caseFixture.title,
        rowActions: caseFixture.rowActions,
        columnActions: caseFixture.columnActions,
        payoffs: caseFixture.payoffs,
      });

      expect(isDegenerate(game), caseFixture.id).toBe(true);
      expect(caseFixture.equilibria.length, caseFixture.id).toBeGreaterThan(0);
    }
  });
});

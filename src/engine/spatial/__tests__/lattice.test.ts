import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  cellIndex,
  cellPosition,
  cooperatorShare,
  createSpatialConfig,
  neighborsOf,
  runSpatial,
  scoreGrid,
  seededGrid,
  singleDefectorGrid,
  stepGrid,
  type Boundary,
  type Neighborhood,
  type SpatialConfig,
  type SpatialGrid,
  type SpatialStrategy,
} from "@/engine/spatial";
import { equals, formatRational, rational } from "@/engine/rational";

function payoffs(a: number, b: number, c: number, d: number) {
  return {
    a: rational(BigInt(a)),
    b: rational(BigInt(b)),
    c: rational(BigInt(c)),
    d: rational(BigInt(d)),
  };
}

function config(overrides: Partial<SpatialConfig> = {}): SpatialConfig {
  return createSpatialConfig({
    width: 9,
    height: 9,
    payoffs: payoffs(3, 0, 5, 1),
    neighborhood: "moore",
    boundary: "torus",
    selfInteraction: false,
    ...overrides,
  });
}

/**
 * Nowak & May's weak Prisoner's Dilemma: R = 1, P = S = 0, T = b > 1. The
 * degeneracy (P = S) is the point — it is what lets cooperator clusters hold a
 * boundary at all, and it is why b sits so close to 1 in their figures.
 */
function weakPd(b: [bigint, bigint]) {
  return {
    a: rational(1n),
    b: rational(0n),
    c: rational(b[0], b[1]),
    d: rational(0n),
  };
}

function homogeneous(size: number, strategy: SpatialStrategy): SpatialGrid {
  return Array.from({ length: size }, () => strategy);
}

/** One row per string, C for cooperator and D for defector. */
function render(grid: SpatialGrid, width: number): readonly string[] {
  const rows: string[] = [];
  for (let y = 0; y < grid.length / width; y += 1) {
    rows.push(
      grid
        .slice(y * width, (y + 1) * width)
        .map((cell) => (cell === 0 ? "C" : "D"))
        .join(""),
    );
  }
  return rows;
}

describe("lattice geometry", () => {
  it("gives every torus cell a full neighbourhood", () => {
    const moore = config({ neighborhood: "moore" });
    const vonNeumann = config({ neighborhood: "von-neumann" });

    for (let index = 0; index < 81; index += 1) {
      expect(neighborsOf(moore, index)).toHaveLength(8);
      expect(neighborsOf(vonNeumann, index)).toHaveLength(4);
    }
  });

  it("truncates the neighbourhood at a fixed boundary", () => {
    const moore = config({ boundary: "fixed", neighborhood: "moore" });
    const vonNeumann = config({
      boundary: "fixed",
      neighborhood: "von-neumann",
    });

    // Corner, edge, interior.
    expect(neighborsOf(moore, cellIndex(moore, 0, 0))).toHaveLength(3);
    expect(neighborsOf(moore, cellIndex(moore, 4, 0))).toHaveLength(5);
    expect(neighborsOf(moore, cellIndex(moore, 4, 4))).toHaveLength(8);

    expect(neighborsOf(vonNeumann, cellIndex(vonNeumann, 0, 0))).toHaveLength(2);
    expect(neighborsOf(vonNeumann, cellIndex(vonNeumann, 4, 0))).toHaveLength(3);
    expect(neighborsOf(vonNeumann, cellIndex(vonNeumann, 4, 4))).toHaveLength(4);
  });

  it("wraps the torus across both axes", () => {
    const torus = config({ neighborhood: "von-neumann" });
    const corner = cellIndex(torus, 0, 0);

    expect(new Set(neighborsOf(torus, corner))).toEqual(
      new Set([
        cellIndex(torus, 0, 8), // up wraps to the bottom row
        cellIndex(torus, 8, 0), // left wraps to the last column
        cellIndex(torus, 1, 0),
        cellIndex(torus, 0, 1),
      ]),
    );
  });

  it("round-trips index and position", () => {
    const grid = config({ width: 7, height: 5 });

    for (let index = 0; index < 35; index += 1) {
      const { x, y } = cellPosition(grid, index);
      expect(cellIndex(grid, x, y)).toBe(index);
    }
  });

  it("never lists a cell as its own neighbour", () => {
    for (const neighborhood of ["moore", "von-neumann"] as Neighborhood[]) {
      for (const boundary of ["torus", "fixed"] as Boundary[]) {
        const grid = config({ neighborhood, boundary });
        for (let index = 0; index < 81; index += 1) {
          expect(neighborsOf(grid, index)).not.toContain(index);
        }
      }
    }
  });

  it("rejects a lattice smaller than 2×2 and a mis-sized grid", () => {
    expect(() => createSpatialConfig({ ...config(), width: 1 })).toThrow(RangeError);
    expect(() => createSpatialConfig({ ...config(), height: 0 })).toThrow(RangeError);
    expect(() => scoreGrid(config(), homogeneous(80, 0))).toThrow(RangeError);
    expect(() => runSpatial(config(), homogeneous(81, 0), -1)).toThrow(RangeError);
  });
});

describe("scoring", () => {
  it("accumulates the stage game against every neighbour", () => {
    const grid = config({ width: 3, height: 3, neighborhood: "moore" });
    // All cooperators on a 3×3 torus: 8 neighbours × R = 3.
    const scores = scoreGrid(grid, homogeneous(9, 0));

    for (const score of scores) {
      expect(formatRational(score)).toBe("24");
    }
  });

  it("adds exactly one self-game when self-interaction is on", () => {
    const off = config({ width: 3, height: 3, selfInteraction: false });
    const on = config({ width: 3, height: 3, selfInteraction: true });
    const grid = homogeneous(9, 1);

    // Defectors: 8 neighbours × P = 1 → 8, plus one self-game → 9.
    expect(formatRational(scoreGrid(off, grid)[0])).toBe("8");
    expect(formatRational(scoreGrid(on, grid)[0])).toBe("9");
  });

  it("leaves edge cells poorer under a fixed boundary", () => {
    const grid = config({ width: 5, height: 5, boundary: "fixed" });
    const scores = scoreGrid(grid, homogeneous(25, 0));

    expect(formatRational(scores[cellIndex(grid, 0, 0)])).toBe("9"); // 3 × R
    expect(formatRational(scores[cellIndex(grid, 2, 2)])).toBe("24"); // 8 × R
  });

  it("keeps fractional payoffs exact rather than rounding", () => {
    const grid = config({
      width: 3,
      height: 3,
      payoffs: payoffs(0, 0, 0, 0),
      neighborhood: "von-neumann",
    });
    const thirds = createSpatialConfig({
      ...grid,
      payoffs: {
        a: rational(1n, 3n),
        b: rational(0n),
        c: rational(0n),
        d: rational(0n),
      },
    });

    // 4 neighbours × 1/3 = 4/3 — a value no float represents.
    expect(formatRational(scoreGrid(thirds, homogeneous(9, 0))[0])).toBe("4/3");
  });
});

describe("synchronous update", () => {
  it("holds a homogeneous lattice fixed", () => {
    for (const strategy of [0, 1] as SpatialStrategy[]) {
      const grid = homogeneous(81, strategy);
      expect(stepGrid(config(), grid)).toEqual(grid);
    }
  });

  it("does not blink when every cell ties", () => {
    // A homogeneous lattice ties everywhere. Preferring the incumbent is what
    // stops this from oscillating; a naive "copy the best neighbour" rule with
    // a lowest-index tie-break would still be stable here, but a rule that
    // preferred a neighbour on ties would flip cells forever.
    const run = runSpatial(config(), homogeneous(81, 0), 10);

    expect(run.termination).toEqual({ kind: "fixed-point", generation: 1 });
    expect(run.generations).toHaveLength(2);
  });

  it("scores from the old grid, so an update is order-independent", () => {
    // Two cells that would each copy the other under a sequential sweep must
    // both change, not one. A row of C D on a 2-wide von Neumann torus makes
    // each cell see only the other twice over.
    const grid = config({
      width: 2,
      height: 2,
      neighborhood: "von-neumann",
      payoffs: payoffs(1, 0, 2, 0),
    });
    const start: SpatialGrid = [0, 1, 1, 0];
    const next = stepGrid(grid, start);

    // Recomputing from `next` must give the same answer as recomputing from a
    // freshly built copy — i.e. `stepGrid` read nothing it had already written.
    expect(stepGrid(grid, [...start])).toEqual(next);
  });

  it("lets a lone defector invade a cooperator field in the weak PD", () => {
    const grid = config({ payoffs: weakPd([9n, 5n]) }); // b = 1.8
    const run = runSpatial(grid, singleDefectorGrid(grid), 4);

    const shares = run.generations.map((generation) => formatRational(generation.cooperatorShare));

    expect(shares[0]).toBe("80/81");
    // The defector spreads, but the lattice does not go all-defect: that
    // survival is the whole Nowak–May result.
    expect(shares[1]).not.toBe("80/81");
    expect(
      run.generations.some((generation) => !equals(generation.cooperatorShare, rational(0n))),
    ).toBe(true);
  });

  it("wipes out cooperators when the temptation is large enough", () => {
    const grid = config({ payoffs: weakPd([5n, 1n]) }); // b = 5
    const run = runSpatial(grid, singleDefectorGrid(grid), 12);
    const final = run.generations[run.generations.length - 1];

    expect(formatRational(final.cooperatorShare)).toBe("0");
  });
});

describe("run bookkeeping", () => {
  it("reports an exact cooperator share", () => {
    const grid: SpatialGrid = [0, 0, 1, 0, 1, 1, 0, 1, 0];
    expect(formatRational(cooperatorShare(grid))).toBe("5/9");
  });

  it("stops at a fixed point instead of drawing identical frames", () => {
    const grid = config({ payoffs: weakPd([5n, 1n]) });
    const run = runSpatial(grid, singleDefectorGrid(grid), 50);

    expect(run.termination.kind).toBe("fixed-point");
    // It stopped early rather than running all 50 generations.
    expect(run.generations.length).toBeLessThan(51);
  });

  it("detects a periodic lattice and reports its period", () => {
    // Nowak & May's lattices are famously periodic rather than convergent.
    const grid = config({
      width: 20,
      height: 20,
      payoffs: weakPd([8n, 5n]), // b = 1.6
      selfInteraction: true,
    });
    const run = runSpatial(grid, singleDefectorGrid(grid), 60);

    expect(["cycle", "fixed-point"]).toContain(run.termination.kind);
    if (run.termination.kind === "cycle") {
      expect(run.termination.period).toBeGreaterThan(1);
    }
  });

  it("records generation 0 even when asked for no generations", () => {
    const run = runSpatial(config(), homogeneous(81, 0), 0);

    expect(run.generations).toHaveLength(1);
    expect(run.termination).toEqual({ kind: "generations-exhausted" });
  });
});

describe("seeded openings", () => {
  it("is reproducible for a given seed and varies across seeds", () => {
    const grid = config();
    const share = rational(1n, 2n);

    expect(seededGrid(grid, 42, share)).toEqual(seededGrid(grid, 42, share));
    expect(seededGrid(grid, 42, share)).not.toEqual(seededGrid(grid, 43, share));
  });

  it("honours the extreme shares exactly", () => {
    const grid = config();

    expect(seededGrid(grid, 7, rational(1n))).toEqual(homogeneous(81, 0));
    expect(seededGrid(grid, 7, rational(0n))).toEqual(homogeneous(81, 1));
  });

  it("rejects a share outside [0, 1]", () => {
    expect(() => seededGrid(config(), 1, rational(3n, 2n))).toThrow(RangeError);
    expect(() => seededGrid(config(), 1, rational(-1n))).toThrow(RangeError);
  });

  it("places a single defector at the centre", () => {
    const grid = config({ width: 5, height: 5 });
    const start = singleDefectorGrid(grid);

    expect(start.filter((cell) => cell === 1)).toHaveLength(1);
    expect(start[cellIndex(grid, 2, 2)]).toBe(1);
  });
});

describe("frozen canonical runs", () => {
  const CANONICAL = { width: 21, height: 21 } as const;

  /**
   * Nowak & May's headline result: from one defector in a full cooperator
   * field at b = 1.6, the lattice never settles. Cooperators fall from 440/441
   * to roughly 60% and keep churning — neither strategy wins, and the run is
   * still moving at generation 20.
   *
   * This is the strongest regression fixture in the module. Twenty generations
   * of a chaotic lattice amplify any change to the neighbourhood order, the
   * tie-break, or the two-phase update into a visibly different grid, and every
   * one of those choices is invisible in an aggregate like the cooperator share
   * alone — hence pinning the cells and not just the statistics.
   */
  it("reproduces the canonical coexistence lattice cell for cell", () => {
    const grid = config({
      ...CANONICAL,
      payoffs: weakPd([8n, 5n]), // b = 1.6
      neighborhood: "moore",
      boundary: "torus",
      selfInteraction: false,
    });
    const run = runSpatial(grid, singleDefectorGrid(grid), 20);

    expect(run.termination).toEqual({ kind: "generations-exhausted" });
    expect(run.generations.map((generation) => formatRational(generation.cooperatorShare))).toEqual(
      [
        "440/441",
        "48/49",
        "61/63",
        "419/441",
        "419/441",
        "410/441",
        "137/147",
        "397/441",
        "380/441",
        "379/441",
        "377/441",
        "362/441",
        "355/441",
        "314/441",
        "304/441",
        "271/441",
        "269/441",
        "74/147",
        "236/441",
        "29/49",
        "260/441",
      ],
    );

    expect(render(run.generations[20].grid, 21)).toEqual([
      "DDCCDDDCCCCCCDDCCCCCC",
      "CDDCCCCCCCCCDDDDCCCCC",
      "CDDCCCCCCCCCDDDDDCCCC",
      "DDDDCCCCCCCDDDDDDDDCC",
      "DDDDCCDCCCDDCCCCCCCCC",
      "CDDDCDDDDDDDCCCCCCCCC",
      "CCCCCDDDDDDDCCCCCCCCC",
      "CCCCCDDDDDDCCCCCCCCCC",
      "CCCCCDDDDDDDCCCCCCCCC",
      "CCCCCDDDDDDDCCCCCCCCC",
      "CCCCCCCCDDDDCCCCCDCCC",
      "CCDDCCCCCCDDCCCCDDDCC",
      "DDDDDCCCCCDDDDCCDDDCC",
      "DCDDCCCCCCDDDDDDDDDDD",
      "DCDDDCCCCCDDDDDDDDDDD",
      "DCCCCCCCCCDDDDDDCCCCD",
      "DCCCCCCCCDDDDDDCCCCCD",
      "DDCCCCCCCDDDDDCCCCCCC",
      "DDDDDDCCCDDDDDCCCCCCC",
      "DDDDDDDCCCCCDDCCCCCCD",
      "DDDCDDCCCCCCDDDCCCCCC",
    ]);
  });

  /**
   * The complementary case, and the more surprising one: from a seeded 50/50
   * scatter at b = 1.2, cooperation first collapses to 4/21 — under a
   * quarter of the lattice — and then recovers to a stable 410/441.
   *
   * A well-mixed model cannot produce this. The dip is defectors eating the
   * isolated cooperators; the recovery is the surviving cooperator clusters
   * growing from their protected interiors. Freezing the whole trajectory
   * rather than the endpoint is deliberate — the dip is the part that would
   * silently disappear if clustering broke.
   */
  it("reproduces the canonical seeded takeover trajectory", () => {
    const grid = config({
      ...CANONICAL,
      payoffs: weakPd([6n, 5n]), // b = 1.2
      neighborhood: "moore",
      boundary: "torus",
      selfInteraction: true,
    });
    const run = runSpatial(grid, seededGrid(grid, 681568, rational(1n, 2n)), 40);

    expect(run.termination).toEqual({ kind: "fixed-point", generation: 10 });
    expect(run.generations.map((generation) => formatRational(generation.cooperatorShare))).toEqual(
      [
        "229/441",
        "4/21",
        "19/63",
        "214/441",
        "41/63",
        "346/441",
        "388/441",
        "134/147",
        "407/441",
        "410/441",
        "410/441",
      ],
    );

    // The survivors are clusters and lattice-spanning lines, not scattered
    // singletons — the structural claim the whole module exists to make.
    expect(render(run.generations[10].grid, 21)).toEqual([
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCDDDDDDDCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCDDDDDDDCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCDDDDDD",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCDCCCCCCCCCCCCCDCC",
      "CCCCCDCCCCCCCCCCCCCDC",
      "CCCCCCCCCCCCCCCCCCCCC",
      "CCCCCCDCCCCCCCCCCCCCD",
      "DCCCCCDCCCCCCCCCCCCCC",
      "CCDDDCCCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCCCCCCCC",
    ]);
  });

  /**
   * Above the threshold the spatial protection fails outright. Pinning the
   * extinction generation, not merely "cooperators reach zero", keeps the
   * threshold itself under test: a rule change that slowed the collapse would
   * still end at zero and would still pass a weaker assertion.
   */
  it("reproduces the canonical extinction generation", () => {
    const grid = config({
      ...CANONICAL,
      payoffs: weakPd([19n, 10n]), // b = 1.9
      selfInteraction: true,
    });
    const run = runSpatial(grid, singleDefectorGrid(grid), 40);

    expect(run.termination).toEqual({ kind: "fixed-point", generation: 26 });

    const extinction = run.generations.findIndex((generation) =>
      equals(generation.cooperatorShare, rational(0n)),
    );
    expect(extinction).toBe(25);
    // Cooperators were still holding a third of the lattice ten generations
    // earlier; the collapse is abrupt, not a slow bleed.
    expect(formatRational(run.generations[15].cooperatorShare)).toBe("116/441");
  });
});

describe("properties", () => {
  it("preserves lattice size and the strategy alphabet on every step", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 2, max: 6 }),
        fc.constantFrom<Neighborhood>("moore", "von-neumann"),
        fc.constantFrom<Boundary>("torus", "fixed"),
        fc.boolean(),
        fc.integer({ min: 0, max: 1_000_000 }),
        (width, height, neighborhood, boundary, selfInteraction, seed) => {
          const grid = config({
            width,
            height,
            neighborhood,
            boundary,
            selfInteraction,
          });
          const next = stepGrid(grid, seededGrid(grid, seed, rational(1n, 2n)));

          expect(next).toHaveLength(width * height);
          expect(next.every((cell) => cell === 0 || cell === 1)).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("cannot resurrect an extinct strategy", () => {
    // Imitation only copies strategies already present, so a lattice that has
    // lost one is absorbing — the lattice analogue of Moran's absorbing states.
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.constantFrom<Neighborhood>("moore", "von-neumann"),
        fc.constantFrom<Boundary>("torus", "fixed"),
        (size, neighborhood, boundary) => {
          const grid = config({
            width: size,
            height: size,
            neighborhood,
            boundary,
          });

          for (const strategy of [0, 1] as SpatialStrategy[]) {
            const uniform = homogeneous(size * size, strategy);
            expect(stepGrid(grid, uniform)).toEqual(uniform);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

import { createRng } from "@/engine/rng";
import type { SymmetricPayoffs } from "@/engine/moran";
import {
  add,
  compare,
  rational,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * Spatial evolutionary dynamics on a 2D lattice — the Nowak–May counterpart to
 * the well-mixed models already here (`repeated/replicator.ts` for infinite
 * populations, `moran/` for finite ones).
 *
 * The point of the lattice is that it removes the well-mixed assumption and
 * nothing else. Cooperators survive in a Prisoner's Dilemma here not because
 * the payoffs changed but because a cluster of cooperators shields its own
 * interior: the boundary cells lose to defectors, the interior cells do not.
 * That is a structural result, so the model must be exactly reproducible or it
 * proves nothing — every quantity below is either an integer index or an exact
 * rational, and the only randomness is the seeded `createRng` (I2).
 *
 * Update rule (Nowak & May 1992): synchronously, every cell plays the stage
 * game against each neighbour, sums the payoffs, and then adopts the strategy
 * of the highest-scoring cell in its neighbourhood including itself. Note the
 * two-phase structure — every score is computed from the *old* grid before any
 * cell changes. A sequential update would produce a different, order-dependent
 * lattice, which is exactly the reproducibility failure this module exists to
 * avoid.
 */

/** Moore = the 8 surrounding cells; von Neumann = the 4 orthogonal ones. */
export type Neighborhood = "moore" | "von-neumann";

/**
 * `torus` wraps both axes, so every cell has a full neighbourhood and the
 * lattice has no privileged position. `fixed` truncates at the edge, which
 * gives corner cells fewer opponents and therefore lower accumulated scores —
 * an edge effect that is a real modelling choice, not a bug, and one that
 * visibly changes which clusters survive.
 */
export type Boundary = "torus" | "fixed";

/** 0 = strategy A (drawn as the cooperator), 1 = strategy B (the defector). */
export type SpatialStrategy = 0 | 1;

export type SpatialGrid = readonly SpatialStrategy[];

export interface SpatialConfig {
  readonly width: number;
  readonly height: number;
  readonly payoffs: SymmetricPayoffs;
  readonly neighborhood: Neighborhood;
  readonly boundary: Boundary;
  /**
   * Nowak & May scored a cell against its neighbours *and* itself. The variant
   * matters: self-interaction adds a constant E(s,s) to every cell playing s,
   * which is not constant across strategies and so shifts the invasion
   * threshold. Exposed rather than hard-coded because the two variants produce
   * visibly different lattices from the same seed.
   */
  readonly selfInteraction: boolean;
}

const MOORE_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const VON_NEUMANN_OFFSETS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];

export function createSpatialConfig(config: SpatialConfig): SpatialConfig {
  if (!Number.isSafeInteger(config.width) || config.width < 2) {
    throw new RangeError("width must be an integer ≥ 2.");
  }
  if (!Number.isSafeInteger(config.height) || config.height < 2) {
    throw new RangeError("height must be an integer ≥ 2.");
  }
  return config;
}

function assertGrid(config: SpatialConfig, grid: SpatialGrid): void {
  if (grid.length !== config.width * config.height) {
    throw new RangeError(
      `grid must hold exactly width × height = ${config.width * config.height} cells, received ${grid.length}.`,
    );
  }
}

export function cellIndex(config: SpatialConfig, x: number, y: number): number {
  return y * config.width + x;
}

export function cellPosition(
  config: SpatialConfig,
  index: number,
): { readonly x: number; readonly y: number } {
  return { x: index % config.width, y: Math.floor(index / config.width) };
}

/**
 * Neighbour indices of one cell, in a fixed order. The order is load-bearing:
 * it is the tie-break used when two neighbours share the top score, so it must
 * not depend on iteration order elsewhere.
 */
export function neighborsOf(
  config: SpatialConfig,
  index: number,
): readonly number[] {
  const offsets =
    config.neighborhood === "moore" ? MOORE_OFFSETS : VON_NEUMANN_OFFSETS;
  const { x, y } = cellPosition(config, index);
  const neighbors: number[] = [];

  for (const [dx, dy] of offsets) {
    let nx = x + dx;
    let ny = y + dy;

    if (config.boundary === "torus") {
      nx = (nx + config.width) % config.width;
      ny = (ny + config.height) % config.height;
    } else if (nx < 0 || nx >= config.width || ny < 0 || ny >= config.height) {
      continue;
    }

    neighbors.push(cellIndex(config, nx, ny));
  }

  return neighbors;
}

function payoffBetween(
  payoffs: SymmetricPayoffs,
  self: SpatialStrategy,
  other: SpatialStrategy,
): Rational {
  if (self === 0) {
    return other === 0 ? payoffs.a : payoffs.b;
  }
  return other === 0 ? payoffs.c : payoffs.d;
}

/**
 * Accumulated payoff of every cell against its neighbourhood, from one grid.
 * Accumulated, not averaged: under `fixed` boundaries an edge cell genuinely
 * has fewer games to earn from, and averaging would erase the edge effect the
 * boundary setting exists to expose.
 */
export function scoreGrid(
  config: SpatialConfig,
  grid: SpatialGrid,
): readonly Rational[] {
  assertGrid(config, grid);

  return grid.map((strategy, index) => {
    let total = config.selfInteraction
      ? payoffBetween(config.payoffs, strategy, strategy)
      : ZERO;

    for (const neighbor of neighborsOf(config, index)) {
      total = add(
        total,
        payoffBetween(config.payoffs, strategy, grid[neighbor]),
      );
    }

    return total;
  });
}

/**
 * One synchronous generation: each cell copies the strategy of the best-scoring
 * cell in its closed neighbourhood.
 *
 * Ties are resolved deterministically and in this order — the incumbent keeps
 * its own strategy when it is among the winners, otherwise the lowest neighbour
 * index wins. Preferring the incumbent is the substantive half: without it a
 * cell tied with its neighbours would flip on every step, and the lattice would
 * blink forever instead of settling, turning a fixed point into a period-2
 * artefact of the tie-break.
 */
export function stepGrid(
  config: SpatialConfig,
  grid: SpatialGrid,
): SpatialGrid {
  const scores = scoreGrid(config, grid);

  return grid.map((strategy, index) => {
    let bestScore = scores[index];
    let bestStrategy = strategy;

    for (const neighbor of neighborsOf(config, index)) {
      const comparison = compare(scores[neighbor], bestScore);

      if (comparison === 1) {
        bestScore = scores[neighbor];
        bestStrategy = grid[neighbor];
      }
      // comparison === 0 is deliberately ignored: the incumbent already holds
      // the slot, and among equal-scoring neighbours the first one encountered
      // (lowest offset order) has already been taken.
    }

    return bestStrategy;
  });
}

export interface SpatialGeneration {
  readonly generation: number;
  readonly grid: SpatialGrid;
  /** Exact share of the lattice playing strategy A. */
  readonly cooperatorShare: Rational;
}

export type SpatialTermination =
  | { readonly kind: "generations-exhausted" }
  /** The grid stopped changing; every later generation is identical. */
  | { readonly kind: "fixed-point"; readonly generation: number }
  /** The grid returned to an earlier state; the run is periodic from there. */
  | {
      readonly kind: "cycle";
      readonly generation: number;
      readonly period: number;
    };

export interface SpatialRun {
  readonly config: SpatialConfig;
  readonly generations: readonly SpatialGeneration[];
  readonly termination: SpatialTermination;
}

export function cooperatorShare(grid: SpatialGrid): Rational {
  const cooperators = grid.reduce<number>(
    (total, strategy) => total + (strategy === 0 ? 1 : 0),
    0,
  );
  return rational(BigInt(cooperators), BigInt(grid.length));
}

/** Compact key for cycle detection — one character per cell. */
function gridKey(grid: SpatialGrid): string {
  return grid.join("");
}

/**
 * Runs the lattice forward, stopping early at a fixed point or a repeat.
 *
 * Cycle detection is worth the memory here because synchronous lattice updates
 * are notoriously periodic — Nowak & May's canonical runs settle into blinkers
 * and gliders rather than converging — and a surface that keeps drawing
 * identical frames is lying about what the model does.
 */
export function runSpatial(
  config: SpatialConfig,
  initial: SpatialGrid,
  generations: number,
): SpatialRun {
  createSpatialConfig(config);
  assertGrid(config, initial);

  if (!Number.isSafeInteger(generations) || generations < 0) {
    throw new RangeError("generations must be a non-negative integer.");
  }

  const seen = new Map<string, number>();
  const history: SpatialGeneration[] = [
    { generation: 0, grid: initial, cooperatorShare: cooperatorShare(initial) },
  ];
  seen.set(gridKey(initial), 0);

  let current = initial;

  for (let generation = 1; generation <= generations; generation += 1) {
    const next = stepGrid(config, current);
    const key = gridKey(next);
    const previous = seen.get(key);

    history.push({
      generation,
      grid: next,
      cooperatorShare: cooperatorShare(next),
    });

    if (previous !== undefined) {
      const period = generation - previous;
      return {
        config,
        generations: history,
        termination:
          period === 1
            ? { kind: "fixed-point", generation }
            : { kind: "cycle", generation, period },
      };
    }

    seen.set(key, generation);
    current = next;
  }

  return {
    config,
    generations: history,
    termination: { kind: "generations-exhausted" },
  };
}

/**
 * Nowak & May's canonical opening: a lattice of cooperators with a single
 * defector at the centre. Deterministic, no seed involved — the fractal growth
 * it produces is the clearest demonstration that spatial structure alone, and
 * not chance, is doing the work.
 */
export function singleDefectorGrid(config: SpatialConfig): SpatialGrid {
  createSpatialConfig(config);
  const grid: SpatialStrategy[] = Array.from(
    { length: config.width * config.height },
    () => 0,
  );
  const center = cellIndex(
    config,
    Math.floor(config.width / 2),
    Math.floor(config.height / 2),
  );
  grid[center] = 1;
  return grid;
}

/**
 * Seeded random opening at a given cooperator share.
 *
 * `share` is a rational so the caller's "40% cooperators" survives into the
 * comparison exactly; the draw itself compares against the RNG's float, which
 * is the one place a float is admissible because it selects a cell rather than
 * computing a payoff (I2's simulation boundary).
 */
export function seededGrid(
  config: SpatialConfig,
  seed: number,
  share: Rational,
): SpatialGrid {
  createSpatialConfig(config);

  if (compare(share, ZERO) === -1 || compare(share, ONE) === 1) {
    throw new RangeError("share must lie in [0, 1].");
  }

  const rng = createRng(seed);
  const threshold = Number(share.numerator) / Number(share.denominator);

  return Array.from({ length: config.width * config.height }, () =>
    rng.next() < threshold ? 0 : 1,
  );
}

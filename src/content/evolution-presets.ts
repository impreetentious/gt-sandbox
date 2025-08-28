import presetFixture from "../../fixtures/evolution-presets.json";
import type { IpdEvolutionConfig } from "@/engine/repeated/replicator";
import {
  ipdStrategyById,
  type IpdStrategyId,
} from "@/engine/repeated/strategies";

export type EvolutionPresetId =
  | "exploitation"
  | "lone-invasion"
  | "reciprocity"
  | "noise"
  | "shadow-of-the-future";

interface FrozenMetricPredicate {
  readonly strategy: IpdStrategyId;
  readonly comparison: ">" | "<";
  readonly threshold: number;
}

export interface EvolutionPreset {
  readonly id: EvolutionPresetId;
  readonly label: string;
  readonly description: string;
  readonly config: IpdEvolutionConfig;
  readonly payoffMatrix: readonly (readonly number[])[];
  readonly finalShares: readonly number[];
  readonly metricPredicate: FrozenMetricPredicate;
}

const authoredCopy: Readonly<
  Record<EvolutionPresetId, Pick<EvolutionPreset, "label" | "description">>
> = {
  exploitation: {
    label: "Exploitation",
    description:
      "With equal populations of unconditional cooperation and defection, defection takes the whole population in this fixed environment.",
  },
  "lone-invasion": {
    label: "Lone invasion",
    description:
      "A 1% Tit for Tat entrant does not invade this mostly-defecting population. Reciprocity needs enough of a foothold to meet itself.",
  },
  reciprocity: {
    label: "Reciprocity",
    description:
      "Against this balanced four-strategy field, unconditional defection disappears while conditional strategies retain most of the population.",
  },
  noise: {
    label: "Noise",
    description:
      "With a 3% action-flip rate, Pavlov leads this selected field. That is this model's output, not a universal ranking of strategies.",
  },
  "shadow-of-the-future": {
    label: "Short shadow",
    description:
      "When continuation is only 0.50, the immediate gain from defection takes over this equal AllD–TFT population.",
  },
};

function isStrategyId(value: string): value is IpdStrategyId {
  return value in ipdStrategyById;
}

function readPreset(
  source: (typeof presetFixture.presets)[number],
): EvolutionPreset {
  if (
    !isStrategyId(source.metricPredicate.strategy) ||
    (source.metricPredicate.comparison !== ">" &&
      source.metricPredicate.comparison !== "<") ||
    !(source.id in authoredCopy) ||
    source.config.strategies.some((strategy) => !isStrategyId(strategy))
  ) {
    throw new TypeError("Evolution preset fixture is invalid.");
  }

  const id = source.id as EvolutionPresetId;

  return {
    id,
    ...authoredCopy[id],
    config: {
      ...source.config,
      strategies: source.config.strategies,
      initialShares: source.config.initialShares,
    } as IpdEvolutionConfig,
    payoffMatrix: source.payoffMatrix,
    finalShares: source.finalShares,
    metricPredicate: {
      strategy: source.metricPredicate.strategy as IpdStrategyId,
      comparison: source.metricPredicate.comparison as ">" | "<",
      threshold: source.metricPredicate.threshold,
    },
  };
}

/**
 * P8's calibration records. The JSON is the reviewed source of numerical
 * truth; copy is intentionally authored only after those results were frozen.
 */
export const evolutionPresets: readonly EvolutionPreset[] =
  presetFixture.presets.map(readPreset);

export const defaultEvolutionPreset = evolutionPresets[0] as EvolutionPreset;

export function evolutionPresetById(id: EvolutionPresetId): EvolutionPreset {
  const preset = evolutionPresets.find((entry) => entry.id === id);

  if (!preset) {
    throw new RangeError(`Unknown evolution preset: ${id}`);
  }

  return preset;
}

export function predicateHolds(
  shares: readonly number[],
  strategies: readonly IpdStrategyId[],
  predicate: FrozenMetricPredicate,
): boolean {
  const index = strategies.indexOf(predicate.strategy);
  const value = index === -1 ? undefined : shares[index];

  return (
    value !== undefined &&
    (predicate.comparison === ">"
      ? value > predicate.threshold
      : value < predicate.threshold)
  );
}

import { defaultEvolutionPreset } from "@/content/evolution-presets";
import type { IpdEvolutionConfig } from "@/engine/repeated/replicator";
import {
  ipdStrategyById,
  type IpdStrategyId,
} from "@/engine/repeated/strategies";

export const EVOLUTION_URL_VERSION = "1";
export const EVOLUTION_URL_MAX_LENGTH = 8 * 1024;

export interface EvolutionUrlState {
  readonly config: IpdEvolutionConfig;
  readonly notice?: string;
}

const expectedKeys = ["ev", "s", "x", "d", "n", "r", "seed", "cap", "g"];
const numberLiteral = /^(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i;

function fallback(notice?: string): EvolutionUrlState {
  return { config: defaultEvolutionPreset.config, notice };
}

function parseNumber(source: string | null, label: string): number {
  if (source === null || !numberLiteral.test(source)) {
    throw new TypeError(`${label} is missing or invalid.`);
  }

  const value = Number(source);

  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite.`);
  }

  return value;
}

function parseInteger(source: string | null, label: string): number {
  const value = parseNumber(source, label);

  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer.`);
  }

  return value;
}

function inRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (value < minimum || value > maximum) {
    throw new RangeError(`${label} must be from ${minimum} to ${maximum}.`);
  }

  return value;
}

function parseStrategies(source: string | null): readonly IpdStrategyId[] {
  if (source === null) {
    throw new TypeError("Strategies are missing.");
  }

  const strategies = source.split(",");

  if (
    strategies.length < 2 ||
    strategies.length > 8 ||
    new Set(strategies).size !== strategies.length ||
    strategies.some((strategy) => !(strategy in ipdStrategyById))
  ) {
    throw new RangeError(
      "Strategies must be a unique two-to-eight strategy roster.",
    );
  }

  return strategies as readonly IpdStrategyId[];
}

function parseShares(source: string | null, length: number): readonly number[] {
  if (source === null) {
    throw new TypeError("Population shares are missing.");
  }

  const shares = source
    .split(",")
    .map((entry) => parseNumber(entry, "A share"));

  if (
    shares.length !== length ||
    shares.some((share) => share < 0 || share > 1) ||
    shares.reduce((total, share) => total + share, 0) <= 0
  ) {
    throw new RangeError(
      "Population shares must be nonnegative values from 0 to 1.",
    );
  }

  return shares;
}

function compactNumber(value: number): string {
  return value.toString();
}

/** Serialises every evolution input; the fixed tournament environment is explicit. */
export function encodeEvolutionConfig(
  config: Required<IpdEvolutionConfig>,
): string {
  const params = new URLSearchParams({
    ev: EVOLUTION_URL_VERSION,
    s: config.strategies.join(","),
    x: config.initialShares.map(compactNumber).join(","),
    d: compactNumber(config.continuationProbability),
    n: compactNumber(config.noise),
    r: String(config.repetitions),
    seed: String(config.masterSeed),
    cap: String(config.roundCap),
    g: String(config.generations),
  });

  return `?${params.toString()}`;
}

/**
 * Decodes a bounded P8 configuration without partially accepting malformed
 * input. A bad link always returns the documented default and a plain notice.
 */
export function decodeEvolutionSearch(search: string): EvolutionUrlState {
  if (search === "") {
    return fallback();
  }

  if (search.length > EVOLUTION_URL_MAX_LENGTH) {
    return fallback(
      "This evolution link is too long, so the default run is shown.",
    );
  }

  try {
    const params = new URLSearchParams(search);

    if (
      params.get("ev") !== EVOLUTION_URL_VERSION ||
      [...params.keys()].some((key) => !expectedKeys.includes(key)) ||
      expectedKeys.some((key) => params.getAll(key).length !== 1)
    ) {
      throw new TypeError("This evolution link has an unsupported format.");
    }

    const strategies = parseStrategies(params.get("s"));
    const continuationProbability = inRange(
      parseNumber(params.get("d"), "Continuation probability"),
      0.5,
      0.995,
      "Continuation probability",
    );
    const noise = inRange(
      parseNumber(params.get("n"), "Noise"),
      0,
      0.1,
      "Noise",
    );
    const repetitions = inRange(
      parseInteger(params.get("r"), "Repetitions"),
      1,
      20,
      "Repetitions",
    );
    const roundCap = inRange(
      parseInteger(params.get("cap"), "Round cap"),
      1,
      1000,
      "Round cap",
    );
    const generations = inRange(
      parseInteger(params.get("g"), "Generations"),
      1,
      500,
      "Generations",
    );

    return {
      config: {
        strategies,
        initialShares: parseShares(params.get("x"), strategies.length),
        masterSeed: parseInteger(params.get("seed"), "Seed"),
        continuationProbability,
        noise,
        repetitions,
        roundCap,
        generations,
      },
    };
  } catch {
    return fallback(
      "This evolution link is invalid, so the default run is shown.",
    );
  }
}

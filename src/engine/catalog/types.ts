import type { Profile } from "@/engine/game";
import type { StrategicStructure } from "@/engine/solve/classify";
import type { NormalFormGame } from "@/engine/game";

export type GameSlug = "pd" | "stag" | "bos" | "chicken" | "pennies" | "ipd";

export interface DominatedActionOracle {
  readonly row: readonly number[];
  readonly column: readonly number[];
}

export type SelectionOracle =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "tie" }
  | { readonly kind: "equilibrium"; readonly profile: Profile };

/** Hand-derived pure-analysis facts. */
export interface PureGameOracle {
  readonly pureNash: readonly Profile[];
  readonly strictlyDominated: DominatedActionOracle;
  readonly paretoEfficient: readonly Profile[];
  readonly zeroSum: boolean;
  readonly classification: StrategicStructure;
  readonly riskDominance: SelectionOracle;
  readonly payoffDominance: SelectionOracle;
}

export interface CatalogGame {
  readonly slug: GameSlug;
  readonly concept: string;
  readonly game: NormalFormGame;
  readonly oracle: PureGameOracle;
}

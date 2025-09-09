import type { RationalInput } from "@/engine/game";
import type { ExtensiveGame } from "@/engine/extensive";

export type ExtensiveSlug = "entry-deterrence" | "ultimatum" | "centipede";

export interface StrategyOracle {
  readonly label: string;
  /** For each named decision node, the action index the player chooses. */
  readonly strategy: ReadonlyMap<string, number>;
  /** Expected on-path payoffs, one per player, in player-order. */
  readonly payoffs: readonly RationalInput[];
}

export interface ExtensiveOracle {
  /** The unique (or lowest-index) SPNE this game admits. */
  readonly spne: StrategyOracle;
  /**
   * Named non-subgame-perfect Nash equilibria — the reveal talks about these.
   * May be empty for games (e.g. Centipede) where every Nash is subgame-perfect.
   */
  readonly nonSubgamePerfectNash: readonly StrategyOracle[];
}

export interface ExtensiveCatalogGame {
  readonly slug: ExtensiveSlug;
  readonly concept: string;
  readonly game: ExtensiveGame;
  readonly oracle: ExtensiveOracle;
}

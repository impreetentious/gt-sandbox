import { compare, multiply, subtract, type Rational } from "@/engine/rational";
import { payoffFor, type NormalFormGame, type Profile } from "@/engine/game";
import { pureNashEquilibria } from "@/engine/solve/pure";
import { paretoDominates } from "@/engine/solve/pareto";

export type SelectionVerdict =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "tie" }
  | { readonly kind: "equilibrium"; readonly profile: Profile };

export interface EquilibriumSelection {
  readonly equilibria: readonly Profile[];
  readonly riskDominance: SelectionVerdict;
  readonly payoffDominance: SelectionVerdict;
  readonly riskProducts: readonly Rational[];
}

function deviationLossProduct(
  game: NormalFormGame,
  profile: Profile,
): Rational {
  const rowLoss = subtract(
    payoffFor(game, profile, "row"),
    payoffFor(game, { row: 1 - profile.row, column: profile.column }, "row"),
  );
  const columnLoss = subtract(
    payoffFor(game, profile, "column"),
    payoffFor(game, { row: profile.row, column: 1 - profile.column }, "column"),
  );

  return multiply(rowLoss, columnLoss);
}

export function analyzeEquilibriumSelection(
  game: NormalFormGame,
): EquilibriumSelection {
  const equilibria = pureNashEquilibria(game);

  if (
    game.rowActions.length !== 2 ||
    game.columnActions.length !== 2 ||
    equilibria.length !== 2
  ) {
    return {
      equilibria,
      riskDominance: { kind: "not-applicable" },
      payoffDominance: { kind: "not-applicable" },
      riskProducts: [],
    };
  }

  const [first, second] = equilibria;
  const firstProduct = deviationLossProduct(game, first);
  const secondProduct = deviationLossProduct(game, second);
  const riskComparison = compare(firstProduct, secondProduct);
  const riskDominance: SelectionVerdict =
    riskComparison === 0
      ? { kind: "tie" }
      : {
          kind: "equilibrium",
          profile: riskComparison === 1 ? first : second,
        };

  const payoffDominance: SelectionVerdict = paretoDominates(game, first, second)
    ? { kind: "equilibrium", profile: second }
    : paretoDominates(game, second, first)
      ? { kind: "equilibrium", profile: first }
      : { kind: "tie" };

  return {
    equilibria,
    riskDominance,
    payoffDominance,
    riskProducts: [firstProduct, secondProduct],
  };
}

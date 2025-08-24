import {
  add,
  compare,
  divide,
  isZero,
  multiply,
  ONE,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";
import { payoffFor, type NormalFormGame, type Player } from "@/engine/game";

export interface MixedStrategy {
  readonly probabilities: readonly Rational[];
  readonly support: readonly number[];
}

export interface MixedNashEquilibrium {
  readonly row: MixedStrategy;
  readonly column: MixedStrategy;
  readonly rowPayoff: Rational;
  readonly columnPayoff: Rational;
}

/**
 * A formal degeneracy witness: player mixes positively on S while every action
 * in B is a best response for the opponent, with |B| = |S| + 1.
 */
export interface DegeneracyWitness {
  readonly player: Player;
  readonly S: readonly number[];
  readonly B: readonly number[];
  readonly x: readonly Rational[];
}

export interface MixedEquilibriumAnalysis {
  readonly equilibria: readonly MixedNashEquilibrium[];
  readonly degeneracyWitness: DegeneracyWitness | null;
}

interface SupportCandidate {
  readonly strategy: MixedStrategy;
  readonly opponentPayoff: Rational;
}

interface LinearConstraint {
  readonly coefficients: readonly Rational[];
  readonly constant: Rational;
}

const MAX_ACTIONS_PER_PLAYER = 4;

function otherPlayer(player: Player): Player {
  return player === "row" ? "column" : "row";
}

function actionCount(game: NormalFormGame, player: Player): number {
  return player === "row" ? game.rowActions.length : game.columnActions.length;
}

function assertSolverBounds(game: NormalFormGame): void {
  if (
    game.rowActions.length > MAX_ACTIONS_PER_PLAYER ||
    game.columnActions.length > MAX_ACTIONS_PER_PLAYER
  ) {
    throw new RangeError(
      `Mixed-equilibrium support enumeration is limited to ${MAX_ACTIONS_PER_PLAYER}×${MAX_ACTIONS_PER_PLAYER} games.`,
    );
  }
}

function actionPayoffAgainstOpponentMix(
  game: NormalFormGame,
  player: Player,
  action: number,
  opponentProbabilities: readonly Rational[],
): Rational {
  let total = ZERO;

  for (
    let opponentAction = 0;
    opponentAction < opponentProbabilities.length;
    opponentAction += 1
  ) {
    const profile =
      player === "row"
        ? { row: action, column: opponentAction }
        : { row: opponentAction, column: action };
    total = add(
      total,
      multiply(
        payoffFor(game, profile, player),
        opponentProbabilities[opponentAction],
      ),
    );
  }

  return total;
}

function payoffCoefficient(
  game: NormalFormGame,
  player: Player,
  playerAction: number,
  opponentAction: number,
): Rational {
  const opponent = otherPlayer(player);
  const profile =
    player === "row"
      ? { row: playerAction, column: opponentAction }
      : { row: opponentAction, column: playerAction };

  return payoffFor(game, profile, opponent);
}

function combinations(length: number, size: number): number[][] {
  const result: number[][] = [];
  const current: number[] = [];

  function visit(next: number): void {
    if (current.length === size) {
      result.push([...current]);
      return;
    }

    for (
      let value = next;
      value <= length - (size - current.length);
      value += 1
    ) {
      current.push(value);
      visit(value + 1);
      current.pop();
    }
  }

  if (size >= 0 && size <= length) {
    visit(0);
  }

  return result;
}

/** Solves a full-rank square rational system with Gauss–Jordan elimination. */
function solveSquareSystem(
  coefficients: readonly (readonly Rational[])[],
  constants: readonly Rational[],
): Rational[] | null {
  const size = coefficients.length;
  const matrix = coefficients.map((row, index) => [...row, constants[index]]);

  for (let column = 0; column < size; column += 1) {
    const pivotRow = matrix.findIndex(
      (row, rowIndex) => rowIndex >= column && !isZero(row[column]),
    );

    if (pivotRow === -1) {
      return null;
    }

    [matrix[column], matrix[pivotRow]] = [matrix[pivotRow], matrix[column]];
    const pivot = matrix[column][column];
    matrix[column] = matrix[column].map((value) => divide(value, pivot));

    for (let row = 0; row < size; row += 1) {
      if (row === column || isZero(matrix[row][column])) {
        continue;
      }

      const factor = matrix[row][column];
      matrix[row] = matrix[row].map((value, index) =>
        subtract(value, multiply(factor, matrix[column][index])),
      );
    }
  }

  return matrix.map((row) => row[size]);
}

function dot(
  coefficients: readonly Rational[],
  values: readonly Rational[],
): Rational {
  return coefficients.reduce(
    (total, coefficient, index) =>
      add(total, multiply(coefficient, values[index])),
    ZERO,
  );
}

function satisfiesEqualities(
  solution: readonly Rational[],
  constraints: readonly LinearConstraint[],
): boolean {
  return constraints.every(
    (constraint) =>
      compare(dot(constraint.coefficients, solution), constraint.constant) ===
      0,
  );
}

function satisfiesInequalities(
  solution: readonly Rational[],
  constraints: readonly LinearConstraint[],
): boolean {
  return constraints.every(
    (constraint) =>
      compare(dot(constraint.coefficients, solution), constraint.constant) !==
      1,
  );
}

/**
 * Finds a point satisfying equalities and weak inequalities with a positive
 * final coordinate. The final coordinate is a lower bound on every support
 * probability, which turns strict positivity into an exact closed-polytope
 * search. A bounded polytope has a vertex, so exhaustive basis enumeration is
 * sufficient at the v1 4×4 limit.
 */
function solveStrictFeasibility(
  equalities: readonly LinearConstraint[],
  inequalities: readonly LinearConstraint[],
  variableCount: number,
): Rational[] | null {
  const constraints = [...equalities, ...inequalities];

  for (const basis of combinations(constraints.length, variableCount)) {
    const solution = solveSquareSystem(
      basis.map((index) => constraints[index].coefficients),
      basis.map((index) => constraints[index].constant),
    );

    if (
      solution &&
      compare(solution[variableCount - 1], ZERO) === 1 &&
      satisfiesEqualities(solution, equalities) &&
      satisfiesInequalities(solution, inequalities)
    ) {
      return solution;
    }
  }

  return null;
}

function strategyFromSupport(
  totalActions: number,
  support: readonly number[],
  probabilities: readonly Rational[],
): MixedStrategy {
  const fullProbabilities = Array.from({ length: totalActions }, () => ZERO);

  support.forEach((action, index) => {
    fullProbabilities[action] = probabilities[index];
  });

  return { probabilities: fullProbabilities, support: [...support] };
}

function solveStrategyForSupport(
  game: NormalFormGame,
  player: Player,
  support: readonly number[],
  opponentSupport: readonly number[],
): SupportCandidate | null {
  const opponent = otherPlayer(player);
  const size = support.length;
  const equations: Rational[][] = opponentSupport.map((opponentAction) => [
    ...support.map((playerAction) =>
      payoffCoefficient(game, player, playerAction, opponentAction),
    ),
    subtract(ZERO, ONE),
  ]);
  const constants = opponentSupport.map(() => ZERO);

  equations.push([...support.map(() => ONE), ZERO]);
  constants.push(ONE);

  const solution = solveSquareSystem(equations, constants);

  if (!solution) {
    return null;
  }

  const probabilities = solution.slice(0, size);

  if (probabilities.some((probability) => compare(probability, ZERO) !== 1)) {
    return null;
  }

  const opponentPayoff = solution[size];
  const strategy = strategyFromSupport(
    actionCount(game, player),
    support,
    probabilities,
  );

  for (let action = 0; action < actionCount(game, opponent); action += 1) {
    const payoff = actionPayoffAgainstOpponentMix(
      game,
      opponent,
      action,
      strategy.probabilities,
    );

    if (compare(payoff, opponentPayoff) === 1) {
      return null;
    }
  }

  return { strategy, opponentPayoff };
}

/**
 * Enumerates every equal-size support pair and returns exact Nash equilibria.
 * This is complete for nondegenerate games up to the 4×4 product bound.
 */
export function mixedNashEquilibria(
  game: NormalFormGame,
): MixedNashEquilibrium[] {
  assertSolverBounds(game);
  const equilibria: MixedNashEquilibrium[] = [];
  const maximumSupport = Math.min(
    game.rowActions.length,
    game.columnActions.length,
  );

  for (let size = 1; size <= maximumSupport; size += 1) {
    for (const rowSupport of combinations(game.rowActions.length, size)) {
      for (const columnSupport of combinations(
        game.columnActions.length,
        size,
      )) {
        const rowCandidate = solveStrategyForSupport(
          game,
          "row",
          rowSupport,
          columnSupport,
        );
        const columnCandidate = solveStrategyForSupport(
          game,
          "column",
          columnSupport,
          rowSupport,
        );

        if (rowCandidate && columnCandidate) {
          equilibria.push({
            row: rowCandidate.strategy,
            column: columnCandidate.strategy,
            rowPayoff: columnCandidate.opponentPayoff,
            columnPayoff: rowCandidate.opponentPayoff,
          });
        }
      }
    }
  }

  return equilibria;
}

function mixedPayoffCoefficients(
  game: NormalFormGame,
  player: Player,
  support: readonly number[],
  opponentAction: number,
): Rational[] {
  return support.map((playerAction) =>
    payoffCoefficient(game, player, playerAction, opponentAction),
  );
}

function findDegeneracyWitnessForPlayer(
  game: NormalFormGame,
  player: Player,
): DegeneracyWitness | null {
  const playerActions = actionCount(game, player);
  const opponentActions = actionCount(game, otherPlayer(player));

  for (let supportSize = 1; supportSize < opponentActions; supportSize += 1) {
    for (const support of combinations(playerActions, supportSize)) {
      for (const bestResponses of combinations(
        opponentActions,
        supportSize + 1,
      )) {
        const reference = mixedPayoffCoefficients(
          game,
          player,
          support,
          bestResponses[0],
        );
        const variableCount = supportSize + 1;
        const equalities: LinearConstraint[] = [
          {
            coefficients: [...support.map(() => ONE), ZERO],
            constant: ONE,
          },
          ...bestResponses.slice(1).map((action) => ({
            coefficients: [
              ...mixedPayoffCoefficients(game, player, support, action).map(
                (value, index) => subtract(value, reference[index]),
              ),
              ZERO,
            ],
            constant: ZERO,
          })),
        ];
        const inequalities: LinearConstraint[] = [
          ...support.map((_, index) => ({
            coefficients: Array.from(
              { length: variableCount },
              (_, variable) => {
                if (variable === index) {
                  return subtract(ZERO, ONE);
                }

                return variable === variableCount - 1 ? ONE : ZERO;
              },
            ),
            constant: ZERO,
          })),
          {
            coefficients: [...support.map(() => ZERO), subtract(ZERO, ONE)],
            constant: ZERO,
          },
          ...Array.from({ length: opponentActions }, (_, action) => action)
            .filter((action) => !bestResponses.includes(action))
            .map((action) => ({
              coefficients: [
                ...mixedPayoffCoefficients(game, player, support, action).map(
                  (value, index) => subtract(value, reference[index]),
                ),
                ZERO,
              ],
              constant: ZERO,
            })),
        ];
        const solution = solveStrictFeasibility(
          equalities,
          inequalities,
          variableCount,
        );

        if (solution) {
          const x = Array.from({ length: playerActions }, () => ZERO);
          support.forEach((action, index) => {
            x[action] = solution[index];
          });

          return { player, S: support, B: bestResponses, x };
        }
      }
    }
  }

  return null;
}

/** Returns a formal support-size/best-response-count degeneracy witness. */
export function degeneracyWitness(
  game: NormalFormGame,
): DegeneracyWitness | null {
  assertSolverBounds(game);
  return (
    findDegeneracyWitnessForPlayer(game, "row") ??
    findDegeneracyWitnessForPlayer(game, "column")
  );
}

export function isDegenerate(game: NormalFormGame): boolean {
  return degeneracyWitness(game) !== null;
}

export function analyzeMixedEquilibria(
  game: NormalFormGame,
): MixedEquilibriumAnalysis {
  return {
    equilibria: mixedNashEquilibria(game),
    degeneracyWitness: degeneracyWitness(game),
  };
}

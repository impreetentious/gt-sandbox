import { payoffFor, type NormalFormGame } from "@/engine/game";
import { createRng } from "@/engine/rng";
import { add, compare, rational, type Rational, ZERO } from "@/engine/rational";
import { bestResponses } from "@/engine/solve/pure";

/** The binary action indexes used by the shipped two-action policies. */
export type BinaryAction = 0 | 1;

export type PdOpponentPolicy = "always:C" | "always:D" | "tft";

export type OneShotOpponentPolicy =
  | "always:0"
  | "always:1"
  | "fictitious"
  | "markov2"
  | "fsm:cautious"
  | "fsm:trusting"
  | "random:1/2"
  | "random:1/3"
  | "random:9/10";

export interface OneShotPolicyDecision {
  readonly action: BinaryAction;
  /** Present only when the policy makes a prediction that the UI can audit. */
  readonly predictedPlayerAction?: BinaryAction;
}

export interface OneShotPolicyInput {
  readonly policy: OneShotOpponentPolicy;
  readonly game: NormalFormGame;
  readonly playerActions: readonly BinaryAction[];
  readonly seed: number;
  /** Zero-indexed round number, used only to make seeded choices addressable. */
  readonly round: number;
}

function assertTwoByTwo(game: NormalFormGame): void {
  if (game.rowActions.length !== 2 || game.columnActions.length !== 2) {
    throw new RangeError("One-shot policies require a two-action game.");
  }
}

function eventSeed(seed: number, round: number, channel: number): number {
  return (
    ((seed >>> 0) ^
      Math.imul((round + 1) >>> 0, 0x9e37_79b9) ^
      Math.imul((channel + 1) >>> 0, 0x85eb_ca6b)) >>>
    0
  );
}

function seededBinaryAction(
  seed: number,
  round: number,
  channel: number,
): BinaryAction {
  return createRng(eventSeed(seed, round, channel)).integer(
    0,
    2,
  ) as BinaryAction;
}

function randomAction(
  policy: Extract<OneShotOpponentPolicy, `random:${string}`>,
  seed: number,
  round: number,
): BinaryAction {
  const probability =
    policy === "random:1/3" ? 1 / 3 : policy === "random:9/10" ? 9 / 10 : 1 / 2;

  return createRng(eventSeed(seed, round, 1)).next() < probability ? 0 : 1;
}

function bestResponseToPointBelief(
  game: NormalFormGame,
  predictedPlayerAction: BinaryAction,
): BinaryAction {
  return bestResponses(
    game,
    "column",
    predictedPlayerAction,
  )[0] as BinaryAction;
}

function fictitiousAction(
  game: NormalFormGame,
  playerActions: readonly BinaryAction[],
): BinaryAction {
  const weights: readonly Rational[] = [
    rational(BigInt(playerActions.filter((action) => action === 0).length + 1)),
    rational(BigInt(playerActions.filter((action) => action === 1).length + 1)),
  ];
  let bestAction: BinaryAction = 0;
  let bestPayoff: Rational | undefined;

  for (const action of [0, 1] as const) {
    let expectedNumerator = ZERO;

    for (const playerAction of [0, 1] as const) {
      expectedNumerator = add(expectedNumerator, {
        numerator:
          payoffFor(game, { row: playerAction, column: action }, "column")
            .numerator * weights[playerAction].numerator,
        denominator:
          payoffFor(game, { row: playerAction, column: action }, "column")
            .denominator * weights[playerAction].denominator,
      });
    }

    if (!bestPayoff || compare(expectedNumerator, bestPayoff) === 1) {
      bestAction = action;
      bestPayoff = expectedNumerator;
    }
  }

  return bestAction;
}

/**
 * The Markov-2 predictor uses add-one counts for the current two-move context.
 * A fresh or tied context chooses its prediction from a separately seeded draw.
 */
export function predictMarkov2PlayerAction(
  playerActions: readonly BinaryAction[],
  seed: number,
  round: number,
): BinaryAction {
  if (playerActions.length < 2) {
    return seededBinaryAction(seed, round, 2);
  }

  const previous = playerActions.slice(-2);
  const counts: [number, number] = [1, 1];

  for (let index = 2; index < playerActions.length; index += 1) {
    if (
      playerActions[index - 2] === previous[0] &&
      playerActions[index - 1] === previous[1]
    ) {
      counts[playerActions[index]] += 1;
    }
  }

  if (counts[0] === counts[1]) {
    return seededBinaryAction(seed, round, 2);
  }

  return counts[0] > counts[1] ? 0 : 1;
}

/**
 * Decides a reusable one-shot-game persona from completed player history.
 * All random choices are event-addressed by the supplied seed and round.
 */
export function decideOneShotOpponentAction(
  input: OneShotPolicyInput,
): OneShotPolicyDecision {
  const { game, playerActions, policy, round, seed } = input;
  assertTwoByTwo(game);

  switch (policy) {
    case "always:0":
      return { action: 0 };
    case "always:1":
      return { action: 1 };
    case "fictitious":
      return { action: fictitiousAction(game, playerActions) };
    case "fsm:trusting":
      return { action: playerActions.at(-1) ?? 0 };
    case "fsm:cautious": {
      const hasSeenTrust = playerActions.some(
        (action, index) =>
          index > 0 && action === 0 && playerActions[index - 1] === 0,
      );

      return { action: hasSeenTrust ? (playerActions.at(-1) ?? 1) : 1 };
    }
    case "markov2": {
      const predictedPlayerAction = predictMarkov2PlayerAction(
        playerActions,
        seed,
        round,
      );

      return {
        action: bestResponseToPointBelief(game, predictedPlayerAction),
        predictedPlayerAction,
      };
    }
    case "random:1/2":
    case "random:1/3":
    case "random:9/10":
      return { action: randomAction(policy, seed, round) };
  }
}

/**
 * Chooses the column player's next PD action from the player's completed
 * history. This is deliberately free of UI state, I/O, and randomness.
 */
export function decidePdOpponentAction(
  policy: PdOpponentPolicy,
  playerActions: readonly BinaryAction[],
): BinaryAction {
  switch (policy) {
    case "always:C":
      return 0;
    case "always:D":
      return 1;
    case "tft":
      return playerActions.at(-1) ?? 0;
  }
}

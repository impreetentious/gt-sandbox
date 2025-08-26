import { equals, rational, type Rational } from "@/engine/rational";
import type { BinaryAction } from "@/engine/repeated/policies";

export type IpdStrategyId =
  "allc" | "alld" | "tft" | "grim" | "pavlov" | "gtft" | "joss" | "random";

export interface StrategyDiagram {
  readonly states: readonly string[];
  readonly transitions: readonly string[];
}

export interface StrategyContext {
  readonly ownActions: readonly BinaryAction[];
  readonly opponentActions: readonly BinaryAction[];
  readonly ownPayoffs: readonly Rational[];
  /** One independently addressed draw for this strategy at this round. */
  readonly policyDraw: number;
}

export interface IpdStrategy {
  readonly id: IpdStrategyId;
  readonly name: string;
  readonly shortDescription: string;
  readonly diagram: StrategyDiagram;
  readonly decide: (context: StrategyContext) => BinaryAction;
}

const COOPERATE: BinaryAction = 0;
const DEFECT: BinaryAction = 1;
const REWARD = rational(3n);
const TEMPTATION = rational(5n);

function titForTat(context: StrategyContext): BinaryAction {
  return context.opponentActions.at(-1) ?? COOPERATE;
}

function flip(action: BinaryAction): BinaryAction {
  return action === COOPERATE ? DEFECT : COOPERATE;
}

export const ipdStrategies: readonly IpdStrategy[] = [
  {
    id: "allc",
    name: "Always Cooperate",
    shortDescription: "Cooperates in every round.",
    diagram: {
      states: ["Cooperate"],
      transitions: ["Start and every outcome → Cooperate"],
    },
    decide: () => COOPERATE,
  },
  {
    id: "alld",
    name: "Always Defect",
    shortDescription: "Defects in every round.",
    diagram: {
      states: ["Defect"],
      transitions: ["Start and every outcome → Defect"],
    },
    decide: () => DEFECT,
  },
  {
    id: "tft",
    name: "Tit for Tat",
    shortDescription: "Cooperates first, then copies the rival’s last move.",
    diagram: {
      states: ["Start: Cooperate", "Mirror"],
      transitions: ["After round 1 → rival’s last realized move"],
    },
    decide: titForTat,
  },
  {
    id: "grim",
    name: "Grim Trigger",
    shortDescription: "Cooperates until one defection, then defects forever.",
    diagram: {
      states: ["Cooperate", "Triggered: Defect"],
      transitions: ["Rival defects → Triggered", "Triggered → Triggered"],
    },
    decide: (context) =>
      context.opponentActions.includes(DEFECT) ? DEFECT : COOPERATE,
  },
  {
    id: "pavlov",
    name: "Pavlov",
    shortDescription: "Repeats after reward or temptation; otherwise switches.",
    diagram: {
      states: ["Cooperate", "Defect"],
      transitions: ["R or T → repeat", "P or S → switch"],
    },
    decide: (context) => {
      const previousAction = context.ownActions.at(-1);
      const previousPayoff = context.ownPayoffs.at(-1);

      if (previousAction === undefined || previousPayoff === undefined) {
        return COOPERATE;
      }

      return equals(previousPayoff, REWARD) ||
        equals(previousPayoff, TEMPTATION)
        ? previousAction
        : flip(previousAction);
    },
  },
  {
    id: "gtft",
    name: "Generous TFT",
    shortDescription:
      "Tit for Tat, but forgives a defection with probability 1/3.",
    diagram: {
      states: ["Cooperate", "Mirror", "Forgive"],
      transitions: ["Rival defects → mirror D, except 1/3 → Forgive C"],
    },
    decide: (context) =>
      context.opponentActions.at(-1) === DEFECT && context.policyDraw < 1 / 3
        ? COOPERATE
        : titForTat(context),
  },
  {
    id: "joss",
    name: "Joss",
    shortDescription: "Tit for Tat, with a 1/10 chance to sneak a defection.",
    diagram: {
      states: ["Mirror", "Sneak defect"],
      transitions: ["Each round: 1/10 → D; otherwise mirror rival’s last move"],
    },
    decide: (context) =>
      context.policyDraw < 1 / 10 ? DEFECT : titForTat(context),
  },
  {
    id: "random",
    name: "Random",
    shortDescription: "Cooperates and defects with equal seeded probability.",
    diagram: {
      states: ["Sample"],
      transitions: ["Each round: 1/2 → C; 1/2 → D"],
    },
    decide: (context) => (context.policyDraw < 1 / 2 ? COOPERATE : DEFECT),
  },
];

export const ipdStrategyById: Readonly<Record<IpdStrategyId, IpdStrategy>> =
  Object.fromEntries(
    ipdStrategies.map((strategy) => [strategy.id, strategy]),
  ) as Readonly<Record<IpdStrategyId, IpdStrategy>>;

export function decideIpdStrategy(
  strategy: IpdStrategyId,
  context: StrategyContext,
): BinaryAction {
  return ipdStrategyById[strategy].decide(context);
}

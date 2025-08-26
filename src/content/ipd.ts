import { ipdStrategies } from "@/engine/repeated/strategies";
import type { IpdOpponentChoice } from "@/state/ipd-session";

export interface IpdOpponentOption {
  readonly id: IpdOpponentChoice;
  readonly label: string;
  readonly description: string;
}

export const ipdOpponentOptions: readonly IpdOpponentOption[] = [
  ...ipdStrategies.map((strategy) => ({
    id: strategy.id,
    label: strategy.name,
    description: strategy.shortDescription,
  })),
  {
    id: "mystery",
    label: "Mystery rival",
    description:
      "A seeded strategy whose identity remains hidden until the match ends.",
  },
];

export const ipdActionCopy = [
  { label: "Cooperate", pastTense: "cooperated", shortcut: "1" },
  { label: "Defect", pastTense: "defected", shortcut: "2" },
] as const;

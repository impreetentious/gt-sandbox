import type { PdPersonaId } from "@/state/pd-session";

export interface PdPersonaContent {
  readonly id: PdPersonaId;
  readonly name: string;
  readonly description: string;
}

export const pdPersonas: readonly PdPersonaContent[] = [
  {
    id: "tft",
    name: "Copycat",
    description: "Starts by holding price, then mirrors your last move.",
  },
  {
    id: "always:C",
    name: "Saint",
    description: "Always holds price.",
  },
  {
    id: "always:D",
    name: "Cynic",
    description: "Always undercuts.",
  },
];

export const pdActionCopy = [
  { label: "Hold price", pastTense: "held price", shortcut: "1" },
  { label: "Undercut", pastTense: "undercut", shortcut: "2" },
] as const;

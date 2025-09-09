import { centipede } from "@/engine/catalog/extensive/centipede";
import { entryDeterrence } from "@/engine/catalog/extensive/entry-deterrence";
import { ultimatum } from "@/engine/catalog/extensive/ultimatum";
import type {
  ExtensiveCatalogGame,
  ExtensiveSlug,
} from "@/engine/catalog/extensive/types";

export const extensiveCatalog: readonly ExtensiveCatalogGame[] = [
  entryDeterrence,
  ultimatum,
  centipede,
];

export const extensiveCatalogBySlug: Readonly<
  Record<ExtensiveSlug, ExtensiveCatalogGame>
> = Object.freeze({
  "entry-deterrence": entryDeterrence,
  ultimatum,
  centipede,
});

export type {
  ExtensiveCatalogGame,
  ExtensiveSlug,
  ExtensiveOracle,
  StrategyOracle,
} from "@/engine/catalog/extensive/types";
export { centipede, entryDeterrence, ultimatum };

import { entryDeterrence } from "@/engine/catalog/extensive/entry-deterrence";
import { ultimatum } from "@/engine/catalog/extensive/ultimatum";
import type {
  ExtensiveCatalogGame,
  ExtensiveSlug,
} from "@/engine/catalog/extensive/types";

export const extensiveCatalog: readonly ExtensiveCatalogGame[] = [
  entryDeterrence,
  ultimatum,
];

export const extensiveCatalogBySlug: Readonly<
  Record<ExtensiveSlug, ExtensiveCatalogGame>
> = Object.freeze({
  "entry-deterrence": entryDeterrence,
  ultimatum,
});

export type {
  ExtensiveCatalogGame,
  ExtensiveSlug,
  ExtensiveOracle,
  StrategyOracle,
} from "@/engine/catalog/extensive/types";
export { entryDeterrence, ultimatum };

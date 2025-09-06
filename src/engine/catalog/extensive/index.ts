import { entryDeterrence } from "@/engine/catalog/extensive/entry-deterrence";
import type {
  ExtensiveCatalogGame,
  ExtensiveSlug,
} from "@/engine/catalog/extensive/types";

export const extensiveCatalog: readonly ExtensiveCatalogGame[] = [
  entryDeterrence,
];

export const extensiveCatalogBySlug: Readonly<
  Record<ExtensiveSlug, ExtensiveCatalogGame>
> = Object.freeze({
  "entry-deterrence": entryDeterrence,
});

export type {
  ExtensiveCatalogGame,
  ExtensiveSlug,
  ExtensiveOracle,
  StrategyOracle,
} from "@/engine/catalog/extensive/types";
export { entryDeterrence };

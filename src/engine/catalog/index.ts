import { bos } from "@/engine/catalog/bos";
import { chicken } from "@/engine/catalog/chicken";
import { ipd } from "@/engine/catalog/ipd";
import { pd } from "@/engine/catalog/pd";
import { pennies } from "@/engine/catalog/pennies";
import { stag } from "@/engine/catalog/stag";
import type { CatalogGame, GameSlug } from "@/engine/catalog/types";

export type {
  CatalogGame,
  GameSlug,
  PureGameOracle,
} from "@/engine/catalog/types";

export const catalog: readonly CatalogGame[] = [
  pd,
  stag,
  bos,
  chicken,
  pennies,
  ipd,
];

export const catalogBySlug: Readonly<Record<GameSlug, CatalogGame>> = {
  pd,
  stag,
  bos,
  chicken,
  pennies,
  ipd,
};

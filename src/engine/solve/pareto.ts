import { compare } from "@/engine/rational";
import {
  allProfiles,
  payoffAt,
  sameProfile,
  type NormalFormGame,
  type Profile,
} from "@/engine/game";

/**
 * Returns true when `alternative` weakly Pareto-dominates `candidate`
 * (note the argument order: the SECOND profile is the dominator).
 */
export function paretoDominates(
  game: NormalFormGame,
  candidate: Profile,
  alternative: Profile,
): boolean {
  const [candidateRow, candidateColumn] = payoffAt(game, candidate);
  const [alternativeRow, alternativeColumn] = payoffAt(game, alternative);

  return (
    compare(alternativeRow, candidateRow) >= 0 &&
    compare(alternativeColumn, candidateColumn) >= 0 &&
    (compare(alternativeRow, candidateRow) === 1 ||
      compare(alternativeColumn, candidateColumn) === 1)
  );
}

/**
 * Returns true when `alternative` strictly Pareto-dominates `candidate`
 * (note the argument order: the SECOND profile is the dominator).
 */
export function strictlyParetoDominates(
  game: NormalFormGame,
  candidate: Profile,
  alternative: Profile,
): boolean {
  const [candidateRow, candidateColumn] = payoffAt(game, candidate);
  const [alternativeRow, alternativeColumn] = payoffAt(game, alternative);

  return (
    compare(alternativeRow, candidateRow) === 1 &&
    compare(alternativeColumn, candidateColumn) === 1
  );
}

export function paretoEfficientProfiles(game: NormalFormGame): Profile[] {
  const profiles = allProfiles(game);

  return profiles.filter(
    (candidate) =>
      !profiles.some(
        (alternative) =>
          !sameProfile(candidate, alternative) &&
          paretoDominates(game, candidate, alternative),
      ),
  );
}

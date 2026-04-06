export {
  satisfiesProgram,
  solveLinearProgram,
  type LinearConstraint,
  type LinearProgram,
  type LpResult,
} from "@/engine/lp/simplex";
export {
  strictlyDominatedByMixture,
  weaklyDominatedByMixture,
  type MixtureVerdict,
  type PayoffTable,
} from "@/engine/lp/mixture-dominance";

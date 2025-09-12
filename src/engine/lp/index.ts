export {
  satisfiesProgram,
  solveLinearProgram,
  type ConstraintRelation,
  type LinearConstraint,
  type LinearProgram,
  type LpResult,
} from "@/engine/lp/simplex";
export {
  strictlyDominatedByMixture,
  weaklyDominatedByMixture,
  type MixtureCertificate,
  type MixtureVerdict,
  type PayoffTable,
} from "@/engine/lp/mixture-dominance";

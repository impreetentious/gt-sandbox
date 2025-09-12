export const zdContent = {
  framing:
    "In 2012 Press and Dyson showed something about the Iterated Prisoner's Dilemma that had gone unnoticed for thirty years: a player who remembers only the last round can unilaterally impose a linear equation relating the two players' long-run average scores. Not a bound on their own payoff — a constraint on the pair, which the opponent cannot escape however clever or long-memoried they are.",
  titForTat:
    "Tit for Tat is the fair member of the family — the one that enforces sX = sY, taking no surplus and conceding none. It is not a separate idea that happens to work well; it is the χ = 1 point where extortion and generosity meet.",
  allDefect:
    "Always Defect is often described as extortion taken to its limit. It is not, and the engine says so with an exact witness rather than a hedge: its p̃ = (−1, −1, 0, 0) cannot be written as any combination of the two payoff vectors and the constant vector, so it lies outside the family entirely. Pushing χ upward does not converge on it either — at the canonical payoffs the limit is (1/2, 0, 1/4, 0), which still cooperates half the time after mutual cooperation.",
  exactness:
    "The admissible range for the scale factor φ is an intersection of four inequalities that routinely meet at their endpoints, and χ = 1 recovers Tit for Tat only as an exact equality. Both are decisions floating point would make by rounding, so every quantity here is a normalized fraction.",
} as const;

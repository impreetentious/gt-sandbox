import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ONE,
  ZERO,
  add,
  compare,
  divide,
  equals,
  formatRational,
  isRational,
  isZero,
  multiply,
  negate,
  parseRational,
  rational,
  subtract,
  type Rational,
} from "@/engine/rational";

const fractionArbitrary = fc
  .tuple(
    fc.bigInt({ min: -10000n, max: 10000n }),
    fc.bigInt({ min: 1n, max: 10000n }),
  )
  .map(([numerator, denominator]) => rational(numerator, denominator));

describe("exact rational arithmetic", () => {
  it("normalizes signs and common factors", () => {
    expect(rational(-6n, -8n)).toEqual({ numerator: 3n, denominator: 4n });
    expect(rational(0n, -11n)).toEqual(ZERO);
    expect(formatRational(rational(-6n, 4n))).toBe("-3/2");
    expect(formatRational(ONE)).toBe("1");
  });

  it("parses fractions and finite decimals without float conversion", () => {
    expect(parseRational(" 6 / -8 ")).toEqual(rational(-3n, 4n));
    expect(parseRational("-12.50")).toEqual(rational(-25n, 2n));
    expect(parseRational("0.125")).toEqual(rational(1n, 8n));
    expect(() => parseRational("1e-3")).toThrow(SyntaxError);
    expect(() => rational(1n, 0n)).toThrow(RangeError);
    expect(() => divide(ONE, ZERO)).toThrow(RangeError);
  });

  it("identifies rational values and zero", () => {
    expect(isRational(rational(1n))).toBe(true);
    expect(isRational({ numerator: 1, denominator: 2 })).toBe(false);
    expect(isRational(null)).toBe(false);
    expect(isZero(ZERO)).toBe(true);
    expect(isZero(ONE)).toBe(false);
  });

  it("satisfies the field axioms over bounded exact fractions", () => {
    fc.assert(
      fc.property(
        fractionArbitrary,
        fractionArbitrary,
        fractionArbitrary,
        (left, middle, right) => {
          expect(equals(add(left, middle), add(middle, left))).toBe(true);
          expect(equals(multiply(left, middle), multiply(middle, left))).toBe(
            true,
          );
          expect(
            equals(
              add(add(left, middle), right),
              add(left, add(middle, right)),
            ),
          ).toBe(true);
          expect(
            equals(
              multiply(multiply(left, middle), right),
              multiply(left, multiply(middle, right)),
            ),
          ).toBe(true);
          expect(equals(add(left, negate(left)), ZERO)).toBe(true);
          expect(
            equals(subtract(left, middle), add(left, negate(middle))),
          ).toBe(true);
          const reverseComparison = compare(middle, left);
          expect(compare(left, middle)).toBe(
            reverseComparison === 0 ? 0 : -reverseComparison,
          );
        },
      ),
    );
  });

  it("round-trips reduced fractions through the exact formatter", () => {
    fc.assert(
      fc.property(fractionArbitrary, (value: Rational) => {
        expect(parseRational(formatRational(value))).toEqual(value);

        if (!isZero(value)) {
          expect(equals(divide(multiply(value, value), value), value)).toBe(
            true,
          );
        }
      }),
    );
  });
});

export interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export const ZERO = rational(0n);
export const ONE = rational(1n);

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);

  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a;
}

/** Creates a reduced exact fraction with a positive denominator. */
export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) {
    throw new RangeError("A rational denominator cannot be zero.");
  }

  if (numerator === 0n) {
    return { numerator: 0n, denominator: 1n };
  }

  const sign = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(numerator, denominator);

  return {
    numerator: (sign * numerator) / divisor,
    denominator: absolute(denominator) / divisor,
  };
}

export function isRational(value: unknown): value is Rational {
  return (
    typeof value === "object" &&
    value !== null &&
    "numerator" in value &&
    "denominator" in value &&
    typeof value.numerator === "bigint" &&
    typeof value.denominator === "bigint"
  );
}

export function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function subtract(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function multiply(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}

export function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) {
    throw new RangeError("Cannot divide by zero.");
  }

  return rational(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  );
}

export function negate(value: Rational): Rational {
  return rational(-value.numerator, value.denominator);
}

export function compare(left: Rational, right: Rational): -1 | 0 | 1 {
  const difference =
    left.numerator * right.denominator - right.numerator * left.denominator;

  if (difference < 0n) {
    return -1;
  }

  if (difference > 0n) {
    return 1;
  }

  return 0;
}

export function equals(left: Rational, right: Rational): boolean {
  return compare(left, right) === 0;
}

export function isZero(value: Rational): boolean {
  return value.numerator === 0n;
}

export function formatRational(value: Rational): string {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator.toString()}/${value.denominator.toString()}`;
}

/** Parses signed integers, reduced fractions, and finite decimals exactly. */
export function parseRational(source: string): Rational {
  const value = source.trim();
  const fraction = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(value);

  if (fraction) {
    return rational(BigInt(fraction[1]), BigInt(fraction[2]));
  }

  const decimal = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);

  if (!decimal) {
    throw new SyntaxError(`Invalid rational literal: ${source}`);
  }

  const sign = decimal[1] === "-" ? -1n : 1n;
  const whole = BigInt(decimal[2]);
  const fractionDigits = decimal[3] ?? "";
  const scale = 10n ** BigInt(fractionDigits.length);
  const fractional = fractionDigits === "" ? 0n : BigInt(fractionDigits);

  return rational(sign * (whole * scale + fractional), scale);
}

export type Fraction = { readonly n: bigint; readonly d: bigint };

const abs = (x: bigint) => (x < 0n ? -x : x);

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

export const fraction = (n: number | bigint, d: number | bigint = 1) => {
  const sign = BigInt(d) < 0n ? -1n : 1n;
  const top = BigInt(n) * sign;
  const bottom = BigInt(d) * sign;
  const divisor = gcd(abs(top), bottom) || 1n;
  return { n: top / divisor, d: bottom / divisor };
};

export const ZERO = fraction(0);
export const ONE = fraction(1);

const plus = (a: Fraction, b: Fraction) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);

export const minus = (a: Fraction, b: Fraction) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);

export const times = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);

export const over = (a: Fraction, b: Fraction) => fraction(a.n * b.d, a.d * b.n);

export const compare = (a: Fraction, b: Fraction) => {
  const gap = a.n * b.d - b.n * a.d;
  if (gap === 0n) return 0;
  return gap < 0n ? -1 : 1;
};

export const isPositive = (a: Fraction) => a.n > 0n;

export const smaller = (a: Fraction, b: Fraction) => (compare(a, b) < 0 ? a : b);

export const total = (list: readonly Fraction[]) => list.reduce(plus, ZERO);

export const toNumber = (a: Fraction) => Number(a.n) / Number(a.d);

export const toText = (a: Fraction) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

const lcm = (a: bigint, b: bigint) => (a * b) / gcd(a, b);

export const commonDenominator = (list: readonly Fraction[]) =>
  Number(list.reduce((acc, f) => lcm(acc, f.d), 1n));

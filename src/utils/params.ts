export function getNumericParam(val: string | string[] | undefined): number {
  if (!val) return NaN;
  const raw = Array.isArray(val) ? val[0] : val;
  return parseInt(raw, 10);
}

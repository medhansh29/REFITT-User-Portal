export function getZScoreColor(zscore?: number | null, maxZ: number = 2) {
  if (zscore === undefined || zscore === null) return undefined;

  // Use a baseline of slate-300 so that 'normal' values have good contrast against dark backgrounds
  const baseGray = [226, 232, 240]; 
  const red = [239, 68, 68];
  const green = [34, 197, 94];

  // We want to emphasize small deviations a bit more (t^0.6)
  let t = Math.min(Math.abs(zscore) / maxZ, 1);
  t = Math.pow(t, 0.6);

  const target = zscore > 0 ? green : red;
  const rgb = baseGray.map((start, i) => Math.round(start + (target[i] - start) * t));
  return `rgb(${rgb.join(",")})`;
}

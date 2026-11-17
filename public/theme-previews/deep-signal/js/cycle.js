// The sampling cycle shared by the cloud, the hero copy and the notebook charts.
/* ---------- sampling cycle: Sample 5 · Fit 5 · Reset 8 (from Stillwater's 4-7-8 breath) ---------- */
export const CYC = { a: 5, b: 5, c: 8 };
const TOTAL = CYC.a + CYC.b + CYC.c;
const ease = (f) => 0.5 - 0.5 * Math.cos(Math.PI * f);
export function cycleAt(t, o) {
  const s = ((t % TOTAL) + TOTAL) % TOTAL;
  if (s < CYC.a) { o.phase = 0; o.f = s / CYC.a; o.v = ease(o.f); o.left = Math.ceil(CYC.a - s); }
  else if (s < CYC.a + CYC.b) { o.phase = 1; o.f = (s - CYC.a) / CYC.b; o.v = 1; o.left = Math.ceil(CYC.a + CYC.b - s); }
  else { o.phase = 2; o.f = (s - CYC.a - CYC.b) / CYC.c; o.v = 1 - ease(o.f); o.left = Math.ceil(TOTAL - s); }
  if (o.left < 1) o.left = 1;
  return o;
}
export const newCycle = () => ({ v: 0, phase: 0, f: 0, left: CYC.a });

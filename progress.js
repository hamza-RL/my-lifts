// Automatic progressive overload (double progression): reach the top of the rep range on every set, then add weight.
export const parseRange = t => {
  const m = String(t || '').match(/(\d+)\s*[–-]\s*(\d+)/);
  if (m) return [+m[1], +m[2]];
  const n = parseInt(t); return n > 0 ? [n, n] : null;
};
const round2 = n => Math.round(n * 100) / 100;

export function suggest(id, ws, cfg, range) {
  const work = w => w.exercises.filter(e => e.exerciseId === id).flatMap(e => e.sets)
    .filter(s => s.type !== 'warmup' && s.type !== 'drop' && s.weight > 0 && s.reps > 0);
  const sess = ws.filter(w => w.exercises.some(e => e.exerciseId === id)).sort((a, b) => b.startTs - a.startTs)
    .map(w => work(w)).filter(s => s.length);
  if (!sess.length) return null;
  const last = sess[0], top = Math.max(...last.map(s => s.weight)), at = last.filter(s => s.weight === top);
  const [lo, hi] = range || [8, 12], minR = Math.min(...at.map(s => s.reps));
  const step = cfg.weightUnit === 'lb' ? 5 : (cfg.rounding || 2.5);
  const prevAt = sess[1]?.filter(s => s.weight === top), prevMiss = prevAt?.length && Math.min(...prevAt.map(s => s.reps)) < lo;
  const stuck = sess.length >= 3 && sess.slice(0, 3).every(s => Math.max(...s.map(q => q.weight)) === top);
  const out = { sets: last.length, last: last.map(s => `${s.weight}×${s.reps}`).join(', ') };
  if (minR >= hi) return { ...out, kind: 'up', weight: round2(top + step), reps: lo, why: `Every set reached ${hi} reps: add weight` };
  if (minR < lo) {
    if (prevMiss) return { ...out, kind: 'deload', weight: Math.max(step, Math.round(top * 0.9 / step) * step), reps: hi, why: `Under ${lo} reps twice in a row: lighter weight, rebuild` };
    return { ...out, kind: 'hold', weight: top, reps: lo, why: `Under ${lo} reps: same weight, reach ${lo}` };
  }
  return { ...out, kind: 'build', weight: top, reps: Math.min(hi, minR + 1), why: `Same weight, add a rep per set up to ${hi}${stuck ? ' (same weight 3 sessions, push the reps)' : ''}` };
}
export const suggestText = (s, cfg) => `${s.weight} ${cfg.weightUnit} × ${s.reps}${s.kind === 'build' ? '+' : ''} reps, ${s.sets} sets`;

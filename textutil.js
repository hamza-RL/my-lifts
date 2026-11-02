import { exName, sheet, esc, toast } from './views.js';

const TZ = 'Africa/Casablanca';
export const dayKey = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });
const dfmt = ts => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
const LAB = { warmup: 'Warm-up', drop: 'Drop set', failure: 'Failure' };

export function setText(s, cfg) {
  const p = [];
  if (s.weight != null) p.push(`${s.weight} ${cfg.weightUnit}`);
  if (s.reps != null) p.push(s.weight != null ? `× ${s.reps}` : `${s.reps} reps`);
  if (s.distance != null) p.push(`${s.distance} ${cfg.distUnit}`);
  if (s.duration != null) p.push(`${s.duration} s`);
  if (s.rpe != null) p.push(`(RPE ${s.rpe})`);
  return p.join(' ') || '–';
}

// One workout as plain text: exercise names, every set with weight and reps. Meant to be pasted to an AI.
export function workoutText(w, cfg, bodyWeight) {
  const mins = Math.round((w.endTs - w.startTs) / 6e4);
  let sets = 0, vol = 0;
  w.exercises.forEach(x => x.sets.forEach(s => { sets++; if (s.type !== 'warmup' || cfg.warmupInStats) vol += (s.weight || 0) * (s.reps || 0); }));
  const L = [`${w.title} | ${dfmt(w.startTs)} | ${mins} min | ${sets} sets | volume ${Math.round(vol)} ${cfg.weightUnit}`];
  if (bodyWeight) L.push(`Body weight that day: ${bodyWeight} ${cfg.weightUnit}`);
  if (w.notes) L.push(`Workout notes: ${w.notes}`);
  L.push('');
  w.exercises.forEach((x, i) => {
    L.push(`${i + 1}. ${exName(x.exerciseId)}`);
    if (x.notes) L.push(`   Note: ${x.notes}`);
    let n = 0;
    x.sets.forEach(s => L.push(`   ${!s.type || s.type === 'normal' ? 'Set ' + (++n) : LAB[s.type] || s.type}: ${setText(s, cfg)}`));
    L.push('');
  });
  return L.join('\n').trim();
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* fall through */ }
  const a = document.createElement('textarea');
  a.value = t; a.style.cssText = 'position:fixed;opacity:0;top:0';
  (document.querySelector('dialog[open]') || document.body).append(a); a.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
  a.remove(); return ok;
}
// Copies, and if the browser blocks it, shows the text in a box so you can copy it by hand.
export async function copyOrShow(t) {
  if (await copyText(t)) return toast('Copied. Paste it to your AI.');
  const d = sheet(`<h3>Copy this text</h3><textarea readonly rows="14" style="width:100%">${esc(t)}</textarea>`);
  d.querySelector('textarea').select();
}

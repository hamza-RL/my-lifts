import * as S from './store.js';
import { slug } from './data.js';
import { exerciseDetail } from './stats.js';
import { exById, pickExercise, sheet, esc, toast, exName } from './views.js';

const $ = (s, r = document) => r.querySelector(s);
const COLS = { wr: ['weight', 'reps'], br: ['reps'], wb: ['weight', 'reps'], ab: ['weight', 'reps'], ro: ['reps'], du: ['duration'], dd: ['distance', 'duration'] };
const HEAD = { weight: 'Weight', reps: 'Reps', duration: 'Seconds', distance: 'Distance' };
let W = null, cfg = null, ST = {}, timers = [], lock = null, saveT;

const flush = () => { clearTimeout(saveT); if (W) S.set('activeWorkout/current', W); };
// Demo mode saves almost instantly; cloud mode batches (15 s) to save writes, and always flushes when the tab hides.
const save = () => { clearTimeout(saveT); saveT = setTimeout(flush, S.cloudConfigured ? 15000 : 400); };
addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => document.hidden && flush());
const stats = async id => ST[id] ||= (await S.get('exerciseStats/' + id)) || { lastSets: [], lastRoutineSets: {}, records: {}, history: [] };
const e1rm = (w, r) => (w && r ? Math.round(w * (1 + r / 30) * 10) / 10 : 0);
const counts = s => s.done && (s.type !== 'warmup' || cfg.warmupInStats);
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// After saving or discarding, stay on the Workout tab (re-render it even if the hash is already #/workout).
const goWorkout = () => (location.hash === '#/workout' ? dispatchEvent(new Event('hashchange')) : (location.hash = '#/workout'));
export function nextRoutine(rs, ws, plan) { // the routine after the last one you finished; stays until you finish one
  if (!rs.length) return null;
  const set = plan?.nextId && rs.find(r => r.id === plan.nextId); if (set) return set;
  const last = [...ws].filter(w => w.routineId && rs.some(r => r.id === w.routineId)).sort((a, b) => b.startTs - a.startTs)[0];
  return last ? rs[(rs.findIndex(r => r.id === last.routineId) + 1) % rs.length] : rs[0];
}
export const hasActive = async () => !!(W || (await S.get('activeWorkout/current')));

export async function startWorkout(routine) {
  cfg = await S.getSettings();
  const exercises = [];
  for (const e of routine?.exercises || []) {
    await stats(e.exerciseId);
    exercises.push({ exerciseId: e.exerciseId, notes: e.notes || '', restSec: e.restSec || cfg.restSmall,
      sets: e.sets.map(s => ({ type: s.type || 'normal', weight: s.weight ?? null, reps: null, duration: null, distance: null, done: false,
        target: s.repsMin ? (s.repsMin === s.repsMax ? `${s.repsMin}` : `${s.repsMin}–${s.repsMax}`) : '' })) });
  }
  W = { id: 'w_' + Date.now().toString(36), title: routine?.title || 'Workout', startTs: Date.now(), routineId: routine?.id || null, notes: '', exercises };
  await S.set('activeWorkout/current', W);
}
export const startFrom = w => startWorkout({ id: w.routineId, title: w.title, exercises: w.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ type: s.type, weight: s.weight, repsMin: s.reps, repsMax: s.reps })) })) });

const prevOf = (x, j) => {
  const st = ST[x.exerciseId]; if (!st) return null;
  const from = cfg.previousFrom === 'routine' && W.routineId && st.lastRoutineSets?.[W.routineId] || st.lastSets;
  return from?.[j] || from?.[from.length - 1] || null;
};
const prevTxt = (p, type) => !p ? '–' : (COLS[type] || COLS.wr).map(f => p[f] != null ? p[f] : '').filter(x => x !== '').join(' × ') || '–';

function beep() {
  const g = { off: 0, low: .1, normal: .3, high: .8 }[cfg.timerVolume];
  if (cfg.timerSound !== 'none' && g) try {
    const c = new AudioContext(), o = c.createOscillator(), a = c.createGain();
    o.frequency.value = cfg.timerSound === 'chime' ? 880 : 660; a.gain.value = g; o.connect(a); a.connect(c.destination); o.start(); o.stop(c.currentTime + .4);
  } catch { /* audio blocked */ }
  if (g) navigator.vibrate?.(300);
}
function tick() {
  const dur = $('#dur'), rest = $('#rest');
  if (!dur) { timers.forEach(clearInterval); timers = []; return; }
  let vol = 0, n = 0;
  W.exercises.forEach(x => x.sets.forEach(s => { if (counts(s)) { n++; if (s.type !== 'warmup' || cfg.warmupInStats) vol += (s.weight || 0) * (s.reps || 0); } }));
  dur.textContent = `${fmtT((Date.now() - W.startTs) / 1000)} · ${Math.round(vol)} ${cfg.weightUnit} · ${n} sets`;
  if (W.rest) {
    const left = Math.ceil((W.rest.end - Date.now()) / 1000);
    if (left <= 0) { W.rest = null; beep(); save(); }
    else { rest.hidden = false; $('#rt', rest).textContent = fmtT(left); return; }
  }
  rest.hidden = true;
}

function row(x, i, s, j, type) {
  const cols = COLS[type] || COLS.wr, n = x.sets.slice(0, j).filter(t => t.type === 'normal').length + 1;
  const lab = { normal: n, warmup: 'W', drop: 'D', failure: 'F' }[s.type];
  const unit = f => f === 'weight' ? cfg.weightUnit : f === 'distance' ? cfg.distUnit : '';
  return `<div class="sr${s.done ? ' ok' : ''}" data-i="${i}" data-j="${j}" style="--n:${cols.length}">
    <button class="stp t-${s.type}" data-l="st" aria-label="Set type">${lab}</button>
    <button class="pv" data-l="pv" aria-label="Copy previous">${esc(prevTxt(prevOf(x, j), type))}</button>
    ${cols.map(f => `<input inputmode="decimal" aria-label="${HEAD[f]} ${unit(f)}" data-f="${f}" value="${s[f] ?? ''}" placeholder="${f === 'reps' && s.target || unit(f) || ''}">`).join('')}
    <button class="chk" data-l="ck" aria-label="Complete set">✓</button></div>`;
}
function draw(v) {
  v.innerHTML = `<header class="top live"><div><input id="wt" class="ttl" maxlength="60" aria-label="Workout title" value="${esc(W.title)}"><small id="dur" class="muted"></small></div>
    <button class="btn fin" data-l="fin">Finish</button></header>
    ${W.exercises.map((x, i) => { const e = exById(x.exerciseId), t = e?.type || 'wr'; return `<section class="card ex" data-i="${i}">
      <div class="rh"><button class="link" data-l="info">${esc(e?.name || x.exerciseId)}</button><button class="icon" data-l="exm" aria-label="Exercise menu">⋯</button></div>
      <textarea data-k="notes" rows="1" placeholder="Notes" aria-label="Notes">${esc(x.notes)}</textarea>
      <div class="sr hd" style="--n:${(COLS[t] || COLS.wr).length}"><span>Set</span><span>Previous</span>${(COLS[t] || COLS.wr).map(f => `<span>${HEAD[f]}</span>`).join('')}<span></span></div>
      ${x.sets.map((s, j) => row(x, i, s, j, t)).join('')}
      <button class="btn2" data-l="add">+ Add set</button></section>`; }).join('')}
    <button class="btn2 big" data-l="addex">+ Add exercise</button><button class="btn2 danger" data-l="disc">Discard workout</button>
    <div id="rest" hidden><b id="rt"></b><button data-l="r-15">−15</button><button data-l="r+15">+15</button><button data-l="rskip">Skip</button></div>`;
  tick();
}

export async function liveView(v) {
  cfg = await S.getSettings();
  W ||= await S.get('activeWorkout/current');
  for (const x of W.exercises) await stats(x.exerciseId);
  draw(v);
  timers.forEach(clearInterval); timers = [setInterval(tick, 500)];
  const wl = async () => { try { if (cfg.keepAwake && !document.hidden) lock = await navigator.wakeLock?.request('screen'); } catch { /* unsupported */ } };
  wl(); document.addEventListener('visibilitychange', wl);
  const at = el => { const r = el.closest('[data-i]'); return [W.exercises[r?.dataset.i], +r?.dataset.i, +el.closest('[data-j]')?.dataset.j]; };
  v.oninput = e => {
    const el = e.target;
    if (el.id === 'wt') W.title = el.value.trim().slice(0, 60) || 'Workout';
    else if (el.dataset.k) at(el)[0].notes = el.value.slice(0, 500);
    else if (el.dataset.f) { const [x, , j] = at(el); x.sets[j][el.dataset.f] = el.value === '' ? null : parseFloat(el.value.replace(',', '.')) || 0; }
    save();
  };
  v.onclick = async e => {
    const b = e.target.closest('[data-l]'); if (!b) return;
    const l = b.dataset.l, [x, i, j] = at(b), t = x && (exById(x.exerciseId)?.type || 'wr');
    if (l === 'info') return exerciseDetail(exById(x.exerciseId), 'cha');
    if (l === 'ck') {
      const s = x.sets[j]; s.done = !s.done;
      if (s.done) {
        const p = prevOf(x, j);
        (COLS[t] || COLS.wr).forEach(f => { if (s[f] == null && p?.[f] != null) s[f] = p[f]; });
        const rec = ST[x.exerciseId].records || {}, w = s.weight || 0;
        if (s.type !== 'warmup' && s.reps && ((w && w > (rec.heaviest || 0) && rec.heaviest) || (e1rm(w, s.reps) > (rec.best1RM || 0) && rec.best1RM))) {
          toast(w > (rec.heaviest || 0) ? 'New PR: heaviest weight' : 'New PR: best estimated 1RM'); if (cfg.prVolume !== 'off') navigator.vibrate?.([80, 60, 80]);
        }
        if (cfg.restOn && x.sets[j + 1]?.type !== 'drop' && s.type !== 'drop') W.rest = { end: Date.now() + x.restSec * 1000 };
      }
      save(); draw(v);
    } else if (l === 'pv') { const p = prevOf(x, j); if (p) (COLS[t] || COLS.wr).forEach(f => { if (p[f] != null) x.sets[j][f] = p[f]; }); save(); draw(v); }
    else if (l === 'add') { const last = x.sets[x.sets.length - 1] || {}; x.sets.push({ type: 'normal', weight: last.weight ?? null, reps: last.reps ?? null, duration: last.duration ?? null, distance: last.distance ?? null, done: false, target: last.target || '' }); save(); draw(v); }
    else if (l === 'st') {
      const d = sheet(`<h3>Set type</h3>${[['normal', 'Normal'], ['warmup', 'Warm-up (W)'], ['drop', 'Drop set (D)'], ['failure', 'Failure (F)']].map(([k, n]) => `<button class="btn2" data-t="${k}">${n}</button>`).join('')}<button class="btn2 danger" data-t="del">Delete set</button>`);
      d.onclick = ev => { const k = ev.target.dataset.t; if (!k) return; if (k === 'del') x.sets.splice(j, 1); else x.sets[j].type = k; d.close(); save(); draw(v); };
    } else if (l === 'exm') {
      const d = sheet(`<h3>${esc(exName(x.exerciseId))}</h3><label>Rest timer (seconds)<input id="rs" inputmode="numeric" value="${x.restSec}"></label>
        <button class="btn2" data-t="warm">Add warm-up sets</button><button class="btn2" data-t="up">Move up</button><button class="btn2" data-t="down">Move down</button><button class="btn2" data-t="rep">Replace exercise</button><button class="btn2 danger" data-t="rm">Remove exercise</button>`);
      d.onclick = async ev => {
        const k = ev.target.dataset.t; if (!k) return;
        x.restSec = parseInt($('#rs', d).value) || x.restSec; d.close();
        if (k === 'warm') {
          const top = Math.max(0, ...x.sets.map(s => s.weight || 0)), r = cfg.rounding || 2.5;
          if (!top) toast('Enter a working weight first.'); else x.sets.unshift(...cfg.warmupSteps.map(({ p, r: n }) => ({ type: 'warmup', weight: Math.round(top * p / 100 / r) * r, reps: n, done: false, duration: null, distance: null, target: '' })));
        } else if (k === 'up' && i > 0) W.exercises.splice(i - 1, 0, ...W.exercises.splice(i, 1));
        else if (k === 'down' && i < W.exercises.length - 1) W.exercises.splice(i + 1, 0, ...W.exercises.splice(i, 1));
        else if (k === 'rep') { const id = await pickExercise(); if (id) { await stats(id); x.exerciseId = id; } }
        else if (k === 'rm') W.exercises.splice(i, 1);
        save(); draw(v);
      };
    } else if (l === 'addex') {
      const id = await pickExercise(); if (!id) return; await stats(id);
      W.exercises.push({ exerciseId: id, notes: '', restSec: cfg.restSmall, sets: [{ type: 'normal', weight: null, reps: null, duration: null, distance: null, done: false, target: '' }] });
      save(); draw(v);
    } else if (l === 'r-15' || l === 'r+15') { if (W.rest) W.rest.end += (l === 'r+15' ? 15000 : -15000); tick(); save(); }
    else if (l === 'rskip') { W.rest = null; tick(); save(); }
    else if (l === 'disc') { if (confirm('Discard this workout? This cannot be undone.')) { W = null; await S.del('activeWorkout/current'); goWorkout(); } }
    else if (l === 'fin') finish(v);
  };
}

async function finish(v) {
  const done = W.exercises.map(x => ({ ...x, sets: x.sets.filter(s => s.done).map(({ target, ...s }) => s) })).filter(x => x.sets.length);
  if (!done.length) return toast('Complete at least one set first.');
  const routine = W.routineId ? await S.get('routines/' + W.routineId) : null;
  const d = sheet(`<h3>Finish workout</h3><label>Title<input name="t" value="${esc(W.title)}" maxlength="60"></label><label>Notes<textarea name="n" maxlength="500"></textarea></label>
    ${routine ? '<label class="chk"><span>Update routine with the weights and reps I used</span><input type="checkbox" id="ur"></label>' : '<label class="chk"><span>Save as a new routine</span><input type="checkbox" id="sr"></label>'}
    <div class="row"><button value="x">Back</button><button class="btn" data-s="1">Save workout</button></div>`);
  d.onclick = async e => {
    if (!e.target.dataset.s) return;
    const w = { id: W.id, title: $('[name=t]', d).value.trim() || W.title, notes: $('[name=n]', d).value.trim(), startTs: W.startTs, endTs: Date.now(), routineId: W.routineId, exercises: done };
    const prs = [], { id, ...doc } = w;
    for (const x of done) {
      const st = await stats(x.exerciseId), r = st.records = st.records || {}, cs = x.sets.filter(s => s.type !== 'warmup' || cfg.warmupInStats);
      const top = Math.max(0, ...cs.map(s => s.weight || 0)), best = Math.max(0, ...cs.map(s => e1rm(s.weight, s.reps)));
      const vol = cs.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0), mr = Math.max(0, ...cs.map(s => s.reps || 0));
      if (top > (r.heaviest || 0)) { if (r.heaviest) prs.push(exName(x.exerciseId) + ' heaviest'); r.heaviest = top; }
      r.best1RM = Math.max(r.best1RM || 0, best); r.bestSetVolume = Math.max(r.bestSetVolume || 0, ...cs.map(s => (s.weight || 0) * (s.reps || 0)));
      r.bestSessionVolume = Math.max(r.bestSessionVolume || 0, vol); r.maxReps = Math.max(r.maxReps || 0, mr);
      const keep = x.sets.map(({ weight = null, reps = null, duration = null, distance = null }) => ({ weight, reps, duration, distance }));
      st.lastSets = keep; if (w.routineId) (st.lastRoutineSets ||= {})[w.routineId] = keep;
      st.history = [...(st.history || []), { workoutId: id, date: w.startTs, topWeight: top, e1RM: best, volume: vol, reps: cs.reduce((a, s) => a + (s.reps || 0), 0) }].slice(-300);
      S.set('exerciseStats/' + x.exerciseId, st);
    }
    S.set('workouts/' + id, doc);
    if (routine && $('#ur', d)?.checked) {
      const { id: rid, ...rd } = routine;
      rd.exercises = rd.exercises.map(re => { const m = done.find(x => x.exerciseId === re.exerciseId); return m ? { ...re, sets: m.sets.map((s, k) => ({ type: s.type, weight: s.weight, repsMin: re.sets[k]?.repsMin ?? s.reps, repsMax: re.sets[k]?.repsMax ?? s.reps })) } : re; });
      S.set('routines/' + rid, { ...rd, updatedAt: Date.now() });
    } else if (!routine && $('#sr', d)?.checked) {
      S.set('routines/r_' + Date.now().toString(36), { title: w.title, order: 99, folderId: null, updatedAt: Date.now(), exercises: done.map(x => ({ exerciseId: x.exerciseId, restSec: x.restSec, notes: '', supersetId: null, sets: x.sets.map(s => ({ type: s.type, weight: s.weight, repsMin: s.reps, repsMax: s.reps })) })) });
    }
    if (w.routineId) { const rs = (await S.list('routines')).sort((a, b) => a.order - b.order), i = rs.findIndex(r => r.id === w.routineId); if (i >= 0) S.set('meta/plan', { nextId: rs[(i + 1) % rs.length].id, updatedAt: Date.now() }); }
    W = null; ST = {}; await S.del('activeWorkout/current'); d.close();
    toast(prs.length ? 'Saved. New PR: ' + prs.slice(0, 2).join(', ') : 'Workout saved.'); goWorkout();
  };
}

export async function historyHtml() {
  const ws = (await S.list('workouts')).sort((a, b) => b.startTs - a.startTs).slice(0, 10);
  return ws.length ? `<h2>Recent workouts</h2>${ws.map(w => `<button class="item hist" data-h="${esc(w.id)}"><span><b>${esc(w.title)}</b><small>${new Date(w.startTs).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Casablanca' })} · ${Math.round((w.endTs - w.startTs) / 60000)} min · ${w.exercises.reduce((n, x) => n + x.sets.length, 0)} sets</small></span></button>`).join('')}` : '';
}
export async function showWorkout(id, done) {
  const w = await S.get('workouts/' + id); if (!w) return;
  const d = sheet(`<h3>${esc(w.title)}</h3>${w.exercises.map(x => `<p><b>${esc(exName(x.exerciseId))}</b><br>${x.sets.map(s => `${s.type === 'normal' ? '' : s.type[0].toUpperCase() + ' '}${esc(prevTxt(s, exById(x.exerciseId)?.type || 'wr'))}`).join(' · ')}</p>`).join('')}
    ${w.notes ? `<p class="muted">${esc(w.notes)}</p>` : ''}<button class="btn2" data-a="rep">Repeat this workout</button><button class="btn2 danger" data-a="del">Delete</button>`);
  d.onclick = async e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'del') { if (!confirm('Delete this workout? Records are not recalculated yet.')) return; await S.del('workouts/' + id); d.close(); done(); }
    else { if (await hasActive()) return toast('Finish or discard your current workout first.'); d.close(); await startFrom(w); location.hash = '#/workout'; }
  };
}

const START = { '30-incline-dumbbell-press': [[12.5]], 'overhead-cable-triceps-extension': [[16, 8], [16, 8]], 'lat-pulldown': [[35, 7]], 'hip-abductor-machine': [[45, 1], [39]],
  'leg-press': [[50, 10]], 'seated-leg-curl': [[39]], 'leg-extensions': [[39], [39], [45, 8]] };
export async function importStart() {
  let n = 0;
  for (const [id, sets] of Object.entries(START)) {
    if (await S.get('exerciseStats/' + id)) continue;
    await S.set('exerciseStats/' + id, { approx: true, records: {}, history: [], lastRoutineSets: {}, lastSets: sets.map(([weight, reps]) => ({ weight, reps: reps ?? null, duration: null, distance: null })) }); n++;
  }
  return n;
}

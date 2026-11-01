import * as S from './store.js';
import { SEED, SEED_ROUTINES, slug } from './data.js';
import { BUILTIN, macros } from './foods.js';

// Every demo document carries demo:true, and the remover only deletes documents with that flag.
const DAY = 864e5, COLS = ['workouts', 'exerciseStats', 'foodLogs', 'measurements'];
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const iso = ms => new Date(ms).toISOString().slice(0, 10);

export async function loadDemo() {
  let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const n = new Date(), start = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 364 * DAY, a = iso(start), b = iso(start + 364 * DAY);
  const [food0, meas0, stats0] = await Promise.all([S.listRange('foodLogs', a, b), S.listRange('measurements', a, b), S.list('exerciseStats')]);
  const haveFood = new Set(food0.map(x => x.id)), haveMeas = new Set(meas0.map(x => x.id)), haveStats = new Set(stats0.filter(x => !x.demo).map(x => x.id));
  const type = id => SEED.find(e => e.id === id)?.type || 'wr', hist = {}, last = {}, rec = {}, trainDays = new Set(), SCHED = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
  let nw = 0, nf = 0, nm = 0;
  for (let i = 0; i < 365; i++) {
    const t = start + i * DAY, r = SCHED[new Date(t).getUTCDay()]; if (r == null || rnd() < .1) continue;
    const [title, list] = SEED_ROUTINES[r], wk = Math.floor(i / 7), ts = t + 17 * 36e5; trainDays.add(iso(t));
    const exercises = list.map(([name, sets, lo, hi], ei) => {
      const id = slug(name), ty = type(id), w = ['br', 'ro', 'du'].includes(ty) ? null : Math.round((20 + hash(name) % 60 + wk * .35) / 2.5) * 2.5;
      const ss = Array.from({ length: sets }, (_, k) => ({ type: 'normal', weight: w, reps: Math.max(lo, lo + Math.floor(rnd() * (hi - lo + 1)) - (k === sets - 1 ? 1 : 0)), duration: null, distance: null, done: true }));
      if (ei === 0 && w) ss.unshift({ type: 'warmup', weight: Math.round(w * .5 / 2.5) * 2.5, reps: 10, duration: null, distance: null, done: true });
      return { exerciseId: id, notes: '', restSec: 90, sets: ss };
    });
    const wid = 'demo_' + iso(t);
    await S.set('workouts/' + wid, { title, startTs: ts, endTs: ts + (55 + Math.floor(rnd() * 25)) * 6e4, routineId: slug(title), notes: '', exercises, demo: true }); nw++;
    exercises.forEach(x => {
      const cs = x.sets.filter(s => s.type !== 'warmup'), top = Math.max(0, ...cs.map(s => s.weight || 0)), e1 = Math.max(0, ...cs.map(s => (s.weight || 0) * (1 + s.reps / 30))), vol = cs.reduce((q, s) => q + (s.weight || 0) * s.reps, 0);
      (hist[x.exerciseId] ||= []).push({ workoutId: wid, date: ts, topWeight: top, e1RM: Math.round(e1 * 10) / 10, volume: vol, reps: cs.reduce((q, s) => q + s.reps, 0) });
      last[x.exerciseId] = x.sets.map(({ weight, reps, duration, distance }) => ({ weight, reps, duration, distance }));
      const o = rec[x.exerciseId] ||= {}; o.heaviest = Math.max(o.heaviest || 0, top); o.best1RM = Math.max(o.best1RM || 0, Math.round(e1 * 10) / 10); o.bestSessionVolume = Math.max(o.bestSessionVolume || 0, vol); o.maxReps = Math.max(o.maxReps || 0, ...cs.map(s => s.reps)); o.bestSetVolume = Math.max(o.bestSetVolume || 0, ...cs.map(s => (s.weight || 0) * s.reps));
    });
  }
  for (const id of Object.keys(hist)) if (!haveStats.has(id)) await S.set('exerciseStats/' + id, { demo: true, records: rec[id], lastSets: last[id], lastRoutineSets: {}, history: hist[id].slice(-300) });
  const F = id => BUILTIN.find(f => f.id === id), pick = [['oats-dry', 80], ['egg-boiled-large', 150], ['banana', 118], ['whey-protein-powder', 30], ['rice-white-cooked', 250], ['chicken-breast-cooked', 200], ['greek-yogurt-0-fat', 150], ['khobz-moroccan-bread', 100], ['tagine-chicken-with-vegetables', 300], ['olive-oil', 14], ['dates-medjool', 48], ['peanut-butter', 32], ['milk-semi-skimmed', 257], ['msemen-plain', 90], ['almonds', 30]];
  const it = (id, g) => { const f = F(id), m = macros(f, g); return { fid: id, n: f.name, g: Math.round(g), label: Math.round(g) + ' g', ...m }; };
  for (let i = 0; i < 365; i++) {
    const d = iso(start + i * DAY); if (haveFood.has(d) || rnd() < .06) continue;
    const tr = trainDays.has(d), names = tr ? ['Meal 1', 'Post-Gym', 'Meal 3', 'Late Snack'] : ['Meal 1', 'Meal 2', 'Snack'], slots = names.map(name => ({ id: 's' + name.length + Math.floor(rnd() * 1e4), name, items: [] }));
    const target = tr ? 2800 : 2400; let total = 0, g = 0;
    while (total < target * (.9 + rnd() * .2) && g++ < 14) { const [id, grams] = pick[Math.floor(rnd() * pick.length)], x = it(id, grams * (.8 + rnd() * .4)); slots[g % slots.length].items.push(x); total += x.k; }
    await S.set('foodLogs/' + d, { slots: slots.filter(s => s.items.length), updatedAt: Date.now(), demo: true }); nf++;
  }
  for (let i = 0; i < 365; i++) {
    const d = iso(start + i * DAY); if (haveMeas.has(d) || rnd() < .15) continue;
    await S.set('measurements/' + d, { date: d, fields: { weight: Math.round((97 - 6 * i / 364 + (rnd() - .5) * 1.6) * 10) / 10 }, demo: true }); nm++;
  }
  return { workouts: nw, foodDays: nf, weighIns: nm };
}

export async function removeDemo() {
  const out = {};
  for (const c of COLS) { let n = 0; for (const d of await S.list(c)) if (d.demo === true) { await S.del(`${c}/${d.id}`); n++; } out[c] = n; }
  return out;
}

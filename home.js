import * as S from './store.js';
import { esc, toast } from './views.js';
import { hasActive, nextRoutine, showWorkout } from './workout.js';
import { line } from './stats.js';

const TZ = 'Africa/Casablanca', DAY = 864e5, r1 = n => Math.round(n * 10) / 10;
const dk = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });
const shift = (k, n) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const ring = (v, t) => { const R = 52, C = 2 * Math.PI * R, p = t ? Math.min(1, v / t) : 0;
  return `<svg viewBox="0 0 120 120" class="ring" role="img" aria-label="Calories eaten today"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--s2)" stroke-width="12"/>
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="${t && v > t ? 'var(--warn)' : 'var(--acc)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * p} ${C}" transform="rotate(-90 60 60)"/>
    <text x="60" y="60" text-anchor="middle" class="rn">${Math.round(v)}</text><text x="60" y="78" text-anchor="middle" class="rl">${t ? 'of ' + t + ' kcal' : 'kcal eaten'}</text></svg>`; };
const mbar = (l, v, t) => `<div class="mb2"><span>${l}</span><div class="pb${t && v > t ? ' over' : ''}"><i style="--w:${t ? Math.min(100, v / t * 100) : 0}%"></i></div><b>${Math.round(v)}${t ? ' / ' + t : ''} g</b></div>`;

export async function homeView(v) {
  const cfg = await S.getSettings(), t = dk(Date.now());
  const [ws0, rs0, log, ms0, plan, active] = await Promise.all([S.list('workouts'), S.list('routines'), S.get('foodLogs/' + t), S.listRange('measurements', shift(t, -30), t), S.get('meta/plan'), hasActive()]);
  const ws = [...ws0].sort((a, b) => b.startTs - a.startTs), rs = rs0.sort((a, b) => a.order - b.order), next = nextRoutine(rs, ws0, plan);
  const T = ws.some(w => dk(w.startTs) === t) ? { k: cfg.kcalTrain, p: cfg.proteinTrain, c: cfg.carbsTrain, f: cfg.fatTrain } : { k: cfg.kcalRest, p: cfg.proteinRest, c: cfg.carbsRest, f: cfg.fatRest };
  const e = (log?.slots || []).flatMap(s => s.items).reduce((a, i) => ({ k: a.k + i.k, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { k: 0, p: 0, c: 0, f: 0 });
  const min = w => (w.endTs - w.startTs) / 6e4, last30 = ws.filter(w => w.startTs >= Date.now() - 30 * DAY);
  const avg = last30.length ? Math.round(last30.reduce((a, w) => a + min(w), 0) / last30.length) : 0;
  const mon = k => shift(k, -(cfg.weekStart === 'mon' ? (new Date(k + 'T00:00:00Z').getUTCDay() + 6) % 7 : new Date(k + 'T00:00:00Z').getUTCDay()));
  const wk0 = mon(t), thisWeek = ws.filter(w => dk(w.startTs) >= wk0), weeks = new Set(ws.map(w => mon(dk(w.startTs))));
  let streak = 0, c = weeks.has(wk0) ? wk0 : shift(wk0, -7); while (weeks.has(c)) { streak++; c = shift(c, -7); }
  const vol = thisWeek.reduce((a, w) => a + w.exercises.reduce((b, x) => b + x.sets.filter(s => s.type !== 'warmup' || cfg.warmupInStats).reduce((q, s) => q + (s.weight || 0) * (s.reps || 0), 0), 0), 0);
  const ms = ms0.filter(m => m.fields?.weight).sort((a, b) => (a.id < b.id ? -1 : 1)), wl = ms[ms.length - 1], wp = ms.filter(m => m.id <= shift(t, -7)).pop();
  const tm = ms0.find(m => m.id === t), needW = !tm?.fields?.weight, needM = !(tm && Object.keys(tm.fields || {}).some(k => k !== 'weight' && tm.fields[k] != null));
  const hr = +new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: TZ }), dmy = x => new Date(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
  const left = T.k ? Math.round(T.k - e.k) : null, lw = ws[0];
  v.innerHTML = `<h1>My Lifts</h1><p class="muted">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })}</p>
    ${active ? '<a class="card resume" href="#/workout"><b>Workout in progress</b><br><span class="muted">Tap to resume</span></a>' : ''}
    ${Date.now() - S.lastBackup() > 6048e5 ? '<div class="card warn"><b>Back up your data</b><p class="muted">No backup in the last 7 days.</p><button class="btn" data-a="share">Send backup to Drive or another app</button></div>' : ''}
    ${needW || needM ? `<div class="card warn"><b>${hr < 12 ? 'Morning check-in' : 'Daily check-in'}</b>
      ${needW ? `<p class="muted">Weigh yourself (best in the morning, before eating).</p><div class="row"><input id="hw" inputmode="decimal" placeholder="Weight (${cfg.weightUnit})" aria-label="Weight"><button class="btn" data-hw style="width:auto">Save</button></div>` : '<p>Weight logged today.</p>'}
      ${needM ? '<p class="muted">Take your body measurements.</p><a class="btn tgl" href="#/body">Open measurements</a>' : '<p>Measurements logged today.</p>'}</div>` : ''}
    ${!S.cloudConfigured ? '<div class="card warn"><b>Demo mode</b><p>Your data stays on this device. Add your Firebase config to sync.</p></div>' : (await S.localCount()) ? '<div class="card warn"><b>Data found on this device</b><p>Upload your demo data to your account?</p><button class="btn" data-a="upload">Upload my local data</button></div>' : ''}
    ${next && !active ? `<a class="card next" href="#/workout"><small class="muted">Up next</small><b>${esc(next.title)}</b><span class="muted">${next.exercises.length} exercises · tap to start</span></a>` : ''}
    <div class="card"><div class="rh"><b>Calories today</b><a href="#/food">Open diary</a></div>
      <div class="ringrow">${ring(e.k, T.k)}<div class="rside">${left === null ? '<b>No target yet</b><p class="muted">Set your daily calories and protein.</p><a class="btn tgl" href="#/food">Set targets</a>' : `<b>${Math.abs(left)}</b><span class="muted"> kcal ${left >= 0 ? 'left' : 'over'}</span>`}</div></div>
      ${mbar('Protein', e.p, T.p)}${mbar('Carbs', e.c, T.c)}${mbar('Fat', e.f, T.f)}</div>
    <div class="grid2"><div class="stat"><b>${avg ? avg + ' min' : '–'}</b><small>Average session (30 days)</small></div><div class="stat"><b>${thisWeek.length}</b><small>Workouts this week</small></div>
      <div class="stat"><b>${Math.round(thisWeek.reduce((a, w) => a + min(w), 0))} min</b><small>Gym time this week</small></div><div class="stat"><b>${streak}</b><small>Week streak</small></div></div>
    <div class="card"><div class="rh"><b>Weight</b><span class="muted">${wl ? r1(wl.fields.weight) + ' ' + cfg.weightUnit : 'no weigh-ins yet'}</span></div>
      ${wl && wp ? `<p class="muted">${wl.fields.weight - wp.fields.weight >= 0 ? '+' : ''}${r1(wl.fields.weight - wp.fields.weight)} ${cfg.weightUnit} vs a week ago</p>` : '<p class="muted">Log your weight in the check-in above.</p>'}${ms.length > 1 ? line(ms.map(m => ({ x: new Date(m.id).getTime(), y: m.fields.weight })), r1, dmy) : ''}</div>
    <div class="card"><b>This week's volume</b><p class="big2">${Math.round(vol).toLocaleString('en-GB')} ${cfg.weightUnit}</p></div>
    ${lw ? `<button class="item hist" data-h="${esc(lw.id)}"><span><b>Last: ${esc(lw.title)}</b><small>${new Date(lw.startTs).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })} · ${Math.round(min(lw))} min · ${lw.exercises.reduce((n, x) => n + x.sets.length, 0)} sets</small></span></button>` : ''}`;
  v.onclick = async ev => {
    if (ev.target.closest('[data-hw]')) {
      const w = parseFloat(v.querySelector('#hw').value.replace(',', '.')); if (!(w > 0)) return toast('Enter your weight.');
      const { demo, ...o } = (await S.get('measurements/' + t)) || {};
      await S.set('measurements/' + t, { ...o, date: t, fields: { ...(o.fields || {}), weight: w }, updatedAt: Date.now() });
      toast('Weight saved.'); return homeView(v);
    }
    const b = ev.target.closest('[data-h]'); if (b) showWorkout(b.dataset.h, () => homeView(v));
  };
}

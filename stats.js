import * as S from './store.js';
import { bodyMap } from './body.js';
import { sheet, esc, exById, exName, loadCustom, pickExercise } from './views.js';
import { showWorkout } from './workout.js';

const $ = (s, r = document) => r.querySelector(s), DAY = 864e5, TZ = 'Africa/Casablanca';
const dkey = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });
const r1 = n => Math.round(n * 10) / 10;
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

// ---------- Charts and body map (own SVG, no libraries) ----------
export function line(pts, fmt = r1) {
  if (pts.length < 2) return '<p class="muted">Not enough data yet. Log this a couple more times.</p>';
  const W = 320, H = 150, p = 26, xs = pts.map(q => q.x), mn = Math.min(...xs), mx = Math.max(...xs), ys = pts.map(q => q.y), lo = Math.min(...ys), hi = Math.max(...ys);
  const X = t => p + (mx === mn ? 0 : (t - mn) / (mx - mn)) * (W - 2 * p), Y = y => H - p - (hi === lo ? .5 : (y - lo) / (hi - lo)) * (H - 2 * p);
  return `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="Line chart"><polyline fill="none" stroke="var(--acc)" stroke-width="2.5" points="${pts.map(q => X(q.x) + ',' + Y(q.y)).join(' ')}"/>
    ${pts.map(q => `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="7" fill="var(--acc)" data-w="${esc(q.id || '')}"><title>${fmt(q.y)}</title></circle>`).join('')}
    <text x="4" y="12" class="ct">${fmt(hi)}</text><text x="4" y="${H - 6}" class="ct">${fmt(lo)}</text></svg>`;
}
const bars = vals => { const m = Math.max(1, ...vals); return `<div class="bars">${vals.map(n => `<i style="height:${Math.max(4, n / m * 100)}%"><b>${n || ''}</b></i>`).join('')}</div><small class="muted">Last 12 weeks, oldest first</small>`; };

// ---------- Statistics tab ----------
export async function statsView(v) {
  await loadCustom();
  const cfg = await S.getSettings(), ws = (await S.list('workouts')).sort((a, b) => a.startTs - b.startTs);
  let days = 30, mo = 0;
  const ok = s => s.type !== 'warmup' || cfg.warmupInStats; // warm-ups are excluded unless the setting is on
  const wkKey = ts => { const [y, m, d] = dkey(ts).split('-').map(Number), u = Date.UTC(y, m - 1, d) / DAY, dow = new Date(u * DAY).getUTCDay(); return u - (cfg.weekStart === 'mon' ? (dow + 6) % 7 : dow); };
  const agg = list => {
    const a = { n: list.length, dur: 0, vol: 0, sets: 0, mu: {}, ex: {} };
    list.forEach(w => { a.dur += (w.endTs - w.startTs) / 6e4; w.exercises.forEach(x => {
      const e = exById(x.exerciseId), ss = x.sets.filter(ok); a.sets += ss.length; a.ex[x.exerciseId] = (a.ex[x.exerciseId] || 0) + 1;
      ss.forEach(s => a.vol += (s.weight || 0) * (s.reps || 0));
      if (e) { a.mu[e.primary] = (a.mu[e.primary] || 0) + ss.length; e.secondary.forEach(m => a.mu[m] = (a.mu[m] || 0) + ss.length * .5); }
    }); });
    return a;
  };
  const byDay = {}, wk = {};
  ws.forEach(w => { (byDay[dkey(w.startTs)] ||= []).push(w); const k = wkKey(w.startTs), o = wk[k] ||= { n: 0, vol: 0 }; o.n++;
    w.exercises.forEach(x => x.sets.filter(ok).forEach(s => o.vol += (s.weight || 0) * (s.reps || 0))); });
  const draw = () => {
    const a = agg(ws.filter(w => w.startTs >= Date.now() - days * DAY)), w7 = agg(ws.filter(w => w.startTs >= Date.now() - 7 * DAY)), mx7 = Math.max(1, ...Object.values(w7.mu));
    const int = Object.fromEntries(Object.entries(w7.mu).map(([m, n]) => [m, Math.min(1, n / mx7)]));
    const mus = Object.entries(a.mu).filter(([m]) => m !== 'cardio').sort((p, q) => q[1] - p[1]), top = mus[0]?.[1] || 1;
    const cur = wkKey(Date.now()), last = Array.from({ length: 12 }, (_, i) => cur - 7 * (11 - i));
    let streak = 0, c = wk[cur] ? cur : cur - 7; while (wk[c]) { streak++; c -= 7; }
    const [ty, tm] = dkey(Date.now()).split('-').map(Number), first = new Date(Date.UTC(ty, tm - 1 + mo, 1)), y = first.getUTCFullYear(), m = first.getUTCMonth();
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), lead = (first.getUTCDay() + (cfg.weekStart === 'mon' ? 6 : 0)) % 7, pre = `${y}-${String(m + 1).padStart(2, '0')}`;
    const ma = agg(ws.filter(w => dkey(w.startTs).startsWith(pre)));
    const topEx = Object.entries(a.ex).sort((p, q) => q[1] - p[1]).slice(0, 8);
    v.innerHTML = `<header class="top"><h1>Statistics</h1></header>
      <div class="chips" id="rg">${[[30, '30 days'], [90, '3 months'], [365, 'Year'], [1e5, 'All time']].map(([d, l]) => `<button class="chip${d === days ? ' on' : ''}" data-d="${d}">${l}</button>`).join('')}</div>
      <div class="card grid"><div><b>${a.n}</b><small>Workouts</small></div><div><b>${Math.round(a.dur)}</b><small>Minutes</small></div><div><b>${Math.round(a.vol)}</b><small>Volume (${cfg.weightUnit})</small></div>
        <div><b>${a.sets}</b><small>Sets</small></div><div><b>${a.n ? Math.round(a.dur / a.n) : 0}</b><small>Avg minutes</small></div><div><b>${streak}</b><small>Week streak</small></div></div>
      <h2>Last 7 days</h2><div class="card">${bodyMap(int)}</div>
      <h2>Workouts per week</h2><div class="card">${bars(last.map(k => wk[k]?.n || 0))}</div>
      <h2>Weekly volume</h2><div class="card">${line(last.filter(k => wk[k]).map(k => ({ x: k, y: wk[k].vol })), n => Math.round(n))}</div>
      <h2>Muscle distribution (sets)</h2><div class="card">${mus.length ? mus.map(([k, n]) => `<div class="mb"><span>${esc(k)}</span><i style="--w:${n / top * 100}%"></i><b>${r1(n)}</b></div>`).join('') + '<p class="muted"><small>Primary muscle counts fully, secondary muscles count half.</small></p>' : '<p class="muted">Log a workout to see this.</p>'}</div>
      <h2>Exercise progress (tap one)</h2><div class="card">${topEx.map(([id, n]) => `<button class="mb mbb" data-ex="${esc(id)}"><span>${esc(exName(id))}</span><i style="--w:${n / topEx[0][1] * 100}%"></i><b>${n}</b></button>`).join('') || '<p class="muted">Nothing yet.</p>'}<button class="btn2" data-pickex>Pick any exercise</button></div>
      <h2>Calendar</h2><div class="card"><div class="row cal-h"><button data-mo="-1" aria-label="Previous month">‹</button><b>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b><button data-mo="1" aria-label="Next month">›</button></div>
        <div class="cal">${(cfg.weekStart === 'mon' ? 'MTWTFSS' : 'SMTWTFS').split('').map(h => `<span class="muted">${h}</span>`).join('')}${'<span></span>'.repeat(lead)}${Array.from({ length: dim }, (_, i) => { const k = `${pre}-${String(i + 1).padStart(2, '0')}`; return `<button class="cd${byDay[k] ? ' on' : ''}" data-day="${k}">${i + 1}</button>`; }).join('')}</div>
        <p><b>Month report:</b> ${ma.n} workouts · ${ma.sets} sets · ${Math.round(ma.vol)} ${cfg.weightUnit} · ${Math.round(ma.dur)} min</p></div>`;
  };
  draw();
  v.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ex) return exerciseDetail(exById(b.dataset.ex), 'cha');
    if ('pickex' in b.dataset) { const id = await pickExercise(); if (id) exerciseDetail(exById(id), 'cha'); return; }
    if (b.dataset.d) { days = +b.dataset.d; draw(); }
    else if (b.dataset.mo) { mo += +b.dataset.mo; draw(); }
    else if (b.dataset.day) {
      const l = byDay[b.dataset.day]; if (!l) return;
      if (l.length === 1) return showWorkout(l[0].id, () => statsView(v));
      const d = sheet(`<h3>${esc(b.dataset.day)}</h3>${l.map(w => `<button class="item" data-h="${esc(w.id)}"><b>${esc(w.title)}</b></button>`).join('')}`);
      d.onclick = ev => { const h = ev.target.closest('[data-h]'); if (h) { d.close(); showWorkout(h.dataset.h, () => statsView(v)); } };
    }
  };
}

// ---------- Exercise detail: technique demo, records, history, charts ----------
let EXDB;
const tok = s => new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !['machine', 'the', 'with', 'a', 'of'].includes(t)));
async function demoFor(x) {
  try { EXDB ||= await (await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json')).json(); } catch { return null; }
  const a = tok(x.name); let best = null, bs = 0;
  for (const e of EXDB) { const b = tok(e.name); let i = 0; a.forEach(t => b.has(t) && i++); const sc = i / (a.size + b.size - i); if (sc > bs) { bs = sc; best = e; } }
  return bs >= .5 ? best : null;
}
// Rule-based estimate (not research): compound free-weight lifts rate highest.
function rate(x) {
  if (x.primary === 'cardio') return [1, 1];
  const comp = x.secondary.length >= 1 && ['wr', 'br', 'wb', 'ab'].includes(x.type), free = ['Barbell', 'Dumbbell', 'Smith machine'].includes(x.equipment);
  return [comp ? (free ? 5 : 4) : 3, comp ? (x.equipment === 'Barbell' ? 5 : free ? 4 : 3) : 2];
}
export async function exerciseDetail(x, start) {
// History and records are computed from your workouts, so they are always accurate (even after edits or deletes).
  const cfg = await S.getSettings(), ws = (await S.list('workouts')).sort((a, b) => a.startTs - b.startTs), hist = [], rec = {}, best = {};
  ws.forEach(w => {
    const xs = w.exercises.filter(e => e.exerciseId === x.id); if (!xs.length) return;
    const cs = xs.flatMap(e => e.sets).filter(s => s.type !== 'warmup' || cfg.warmupInStats), top = Math.max(0, ...cs.map(s => s.weight || 0)), e1 = Math.max(0, ...cs.map(s => (s.weight || 0) * (1 + (s.reps || 0) / 30)));
    const vol = cs.reduce((q, s) => q + (s.weight || 0) * (s.reps || 0), 0), reps = cs.reduce((q, s) => q + (s.reps || 0), 0);
    hist.push({ workoutId: w.id, date: w.startTs, topWeight: top, e1RM: r1(e1), volume: Math.round(vol), reps });
    rec.heaviest = Math.max(rec.heaviest || 0, top); rec.best1RM = Math.max(rec.best1RM || 0, r1(e1)); rec.bestSessionVolume = Math.max(rec.bestSessionVolume || 0, vol);
    cs.forEach(s => { rec.maxReps = Math.max(rec.maxReps || 0, s.reps || 0); rec.bestSetVolume = Math.max(rec.bestSetVolume || 0, (s.weight || 0) * (s.reps || 0)); if (s.reps && s.weight) best[s.reps] = Math.max(best[s.reps] || 0, s.weight); });
  });
  let tab = start || (hist.length > 1 ? 'cha' : 'sum'), metric = rec.heaviest ? 'topWeight' : 'reps', rng = 1e5;
  const d = sheet(`<h3>${esc(x.name)}</h3><div class="seg s4">${[['sum', 'Summary'], ['his', 'History'], ['cha', 'Charts'], ['rec', 'Records']].map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('')}</div><div id="tb"></div>`);
  const u = cfg.weightUnit, dt = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
  const render = async () => {
    d.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const tb = $('#tb', d);
    if (tab === 'sum') {
      const [m, s] = rate(x), int = { [x.primary]: 1 }; x.secondary.forEach(k => int[k] = .5);
      tb.innerHTML = `<div class="demo" id="dm"><p class="muted">Loading demo…</p></div>${bodyMap(int)}
        <p>Muscle building <b>${stars(m)}</b><br>Strength <b>${stars(s)}</b><br><small class="muted">My rule-based estimate (compound, free weight), not a research score.</small></p>
        <p class="muted">${hist.length} sessions${hist.length ? ' · last ' + dt(hist[hist.length - 1].date) : ''}</p><div id="ins"></div>${x.builtin ? '' : '<div class="row"><button data-ed="del" class="danger">Delete exercise</button><button data-ed="edit" class="btn">Edit exercise</button></div>'}`;
      demoFor(x).then(e => {
        if (!$('#dm', d)) return;
        if (!e) { $('#dm', d).innerHTML = '<p class="muted">No demo available for this exercise.</p>'; return; }
        $('#dm', d).innerHTML = e.images.slice(0, 2).map((i, k) => `<img alt="${esc(e.name)}, position ${k + 1}" src="https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${encodeURI(i)}" loading="lazy">`).join('');
        $('#ins', d).innerHTML = `<h4>How to do it</h4><ol>${(e.instructions || []).map(t => `<li>${esc(t)}</li>`).join('')}</ol><small class="muted">Demo and steps: free-exercise-db (public domain).</small>`;
      });
    } else if (tab === 'his') {
      tb.innerHTML = [...hist].reverse().map(h => `<button class="item hist" data-h="${esc(h.workoutId)}"><span><b>${dt(h.date)}</b><small>Top ${h.topWeight} ${u} · volume ${Math.round(h.volume)} · ${h.reps} reps</small></span></button>`).join('') || '<p class="muted">No sessions yet.</p>';
    } else if (tab === 'cha') {
      const pts = hist.filter(h => h.date >= Date.now() - rng * DAY).map(h => ({ x: h.date, y: h[metric], id: h.workoutId }));
      tb.innerHTML = `<div class="chips">${[['topWeight', 'Heaviest'], ['e1RM', 'Est. 1RM'], ['volume', 'Volume'], ['reps', 'Total reps']].map(([k, l]) => `<button class="chip${k === metric ? ' on' : ''}" data-mt="${k}">${l}</button>`).join('')}</div>
        <div class="chips">${[[30, '1M'], [90, '3M'], [180, '6M'], [365, '1Y'], [1e5, 'All']].map(([k, l]) => `<button class="chip${k === rng ? ' on' : ''}" data-rg="${k}">${l}</button>`).join('')}</div>${pts.length > 1 ? `<p><b>${r1(pts[0].y)} → ${r1(pts[pts.length - 1].y)}</b> (${pts[pts.length - 1].y >= pts[0].y ? '+' : ''}${r1(pts[pts.length - 1].y - pts[0].y)}${pts[0].y ? `, ${r1((pts[pts.length - 1].y / pts[0].y - 1) * 100)}%` : ''}) over ${pts.length} sessions</p>` : ''}${line(pts)}<small class="muted">Tap a point to open that workout.</small>`;
    } else {
      const row = (l, n, f = r1) => `<tr><td>${l}</td><td>${n ? f(n) : '–'}</td></tr>`;
      tb.innerHTML = `<table class="rt2">${row('Heaviest weight (' + u + ')', rec.heaviest)}${row('Best estimated 1RM', rec.best1RM)}${row('Best set volume', rec.bestSetVolume)}${row('Best session volume', rec.bestSessionVolume)}${row('Most reps in a set', rec.maxReps)}</table>
        <h4>Best weight by reps</h4><table class="rt2">${Object.keys(best).sort((a, b) => a - b).map(k => `<tr><td>${k} reps</td><td>${best[k]} ${u}</td></tr>`).join('') || '<tr><td>No sets yet</td><td></td></tr>'}</table>`;
    }
  };
  d.onclick = e => {
    const b = e.target.closest('[data-t],[data-mt],[data-rg],[data-h],[data-ed],circle[data-w]'); if (!b) return;
    const ds = b.dataset;
    if (ds.ed) { d.close(); import('./views.js').then(m => (ds.ed === 'edit' ? m.editExercise(x) : m.deleteExercise(x))); return; }
    if (ds.t) tab = ds.t; else if (ds.mt) metric = ds.mt; else if (ds.rg) rng = +ds.rg;
    else { const id = ds.h || ds.w; if (id) showWorkout(id, () => {}); return; }
    render();
  };
  render();
}

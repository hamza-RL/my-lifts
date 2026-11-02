import * as S from './store.js';
import { bodyMap } from './body.js';
import { sheet, esc, exById, exName, loadCustom, pickExercise } from './views.js';
import { showWorkout } from './workout.js';
import { suggest, suggestText } from './progress.js';
import { copyOrShow } from './textutil.js';

const $ = (s, r = document) => r.querySelector(s), DAY = 864e5, TZ = 'Africa/Casablanca';
const dkey = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });
const r1 = n => Math.round(n * 10) / 10;
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

// ---------- Charts and body map (own SVG, no libraries) ----------
const dmy = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
export function line(pts, fmt = r1, xf, avg) {
  if (pts.length < 2) return '<p class="muted">Not enough data yet. Log this a couple more times.</p>';
  const W = 340, H = 190, pl = 40, pr = 12, pt = 14, pb = 26, xs = pts.map(q => q.x), mn = Math.min(...xs), mx = Math.max(...xs), all = [...pts, ...(avg || [])].map(q => q.y);
  let lo = Math.min(...all), hi = Math.max(...all); if (hi === lo) { hi += 1; lo -= 1; } const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  const X = t => pl + (mx === mn ? .5 : (t - mn) / (mx - mn)) * (W - pl - pr), Y = y => H - pb - ((y - lo) / (hi - lo)) * (H - pt - pb);
  const main = avg || pts, poly = main.map(q => X(q.x).toFixed(1) + ',' + Y(q.y).toFixed(1)).join(' '), base = H - pb;
  const grid = [0, .5, 1].map(f => { const y = lo + (hi - lo) * f, yy = Y(y).toFixed(1); return `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${pl - 5}" y="${+yy + 3}" text-anchor="end" class="ct">${fmt(y)}</text>`; }).join('');
  const xl = xf ? [[mn, 'start', pl], [(mn + mx) / 2, 'middle', (pl + W - pr) / 2], [mx, 'end', W - pr]].map(([t, an, x]) => `<text x="${x}" y="${H - 8}" text-anchor="${an}" class="ct">${xf(t)}</text>`).join('') : '';
  const dots = avg ? (pts.length <= 120 ? pts.map(q => `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="2.5" fill="var(--mut)"/>`).join('') : '')
    : pts.map((q, i) => `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="var(--acc)" pointer-events="none"/>`).join('');
  const hit = avg ? '' : pts.filter(q => q.id).map(q => `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="12" fill="transparent" data-w="${esc(q.id)}"><title>${fmt(q.y)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="Line chart">${grid}${xl}<polygon points="${X(main[0].x).toFixed(1)},${base} ${poly} ${X(main[main.length - 1].x).toFixed(1)},${base}" fill="var(--acc)" opacity=".12"/>
    <polyline fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${poly}"/>${dots}${hit}</svg>`;
}
const spark = ys => {
  if (ys.length < 2) return '<span class="muted">–</span>';
  const lo = Math.min(...ys), hi = Math.max(...ys), Y = y => 24 - (hi === lo ? .5 : (y - lo) / (hi - lo)) * 20 - 2;
  return `<svg viewBox="0 0 84 28" class="spark" aria-hidden="true"><polyline fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${ys.map((y, i) => (i / (ys.length - 1) * 80 + 2).toFixed(1) + ',' + Y(y).toFixed(1)).join(' ')}"/></svg>`;
};
// Body weight detail: ranges, 7-day average line, summary numbers.
function weightDetail(ms, cfg) {
  let rng = 90;
  const u = cfg.weightUnit, d = sheet('<h3>Body weight</h3><div id="wb"></div>');
  const render = () => {
    const pts = ms.filter(m => new Date(m.id).getTime() >= Date.now() - rng * DAY).map(m => ({ x: new Date(m.id).getTime(), y: m.fields.weight }));
    const avg = pts.map(q => { const w = pts.filter(o => o.x <= q.x && o.x > q.x - 7 * DAY); return { x: q.x, y: w.reduce((a, o) => a + o.y, 0) / w.length }; });
    const ys = pts.map(q => q.y), diff = pts.length > 1 ? pts[pts.length - 1].y - pts[0].y : 0;
    $('#wb', d).innerHTML = `<div class="chips">${[[30, '1M'], [90, '3M'], [180, '6M'], [365, '1Y'], [1e5, 'All']].map(([k, l]) => `<button class="chip${k === rng ? ' on' : ''}" data-rg="${k}">${l}</button>`).join('')}</div>
      ${pts.length > 1 ? `<p><b>${r1(pts[0].y)} → ${r1(pts[pts.length - 1].y)} ${u}</b> (${diff >= 0 ? '+' : ''}${r1(diff)} ${u}) over ${pts.length} weigh-ins</p>` : ''}${line(pts, r1, dmy, avg)}
      <small class="muted">Dots are weigh-ins, the line is the 7-day average.</small>
      ${pts.length ? `<table class="rt2"><tr><td>Lowest</td><td>${r1(Math.min(...ys))} ${u}</td></tr><tr><td>Highest</td><td>${r1(Math.max(...ys))} ${u}</td></tr><tr><td>Average</td><td>${r1(ys.reduce((a, b) => a + b, 0) / ys.length)} ${u}</td></tr></table>` : ''}`;
  };
  d.onclick = e => { const b = e.target.closest('[data-rg]'); if (b) { rng = +b.dataset.rg; render(); } };
  render();
}

// ---------- Statistics tab ----------
export async function statsView(v) {
  await loadCustom();
  const cfg = await S.getSettings(), ws = (await S.list('workouts')).sort((a, b) => a.startTs - b.startTs);
  const wms = (await S.list('measurements')).filter(m => m.fields?.weight).sort((a, b) => (a.id < b.id ? -1 : 1));
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
    const topEx = Object.entries(a.ex).sort((p, q) => q[1] - p[1]).slice(0, 10);
    const series = id => ws.map(w => { const xs = w.exercises.filter(e => e.exerciseId === id); if (!xs.length) return null; const cs = xs.flatMap(e => e.sets).filter(ok), top = Math.max(0, ...cs.map(s => s.weight || 0)); return top || cs.reduce((q, s) => q + (s.reps || 0), 0); }).filter(n => n !== null);
    const wpts = wms.filter(m => new Date(m.id).getTime() >= Date.now() - days * DAY).map(m => ({ x: new Date(m.id).getTime(), y: m.fields.weight })), wl = wms[wms.length - 1];
    v.innerHTML = `<header class="top"><h1>Statistics</h1></header>
      <div class="grid2"><a class="stat" href="#/history"><b>History</b><small>Every workout, copy as text</small></a><a class="stat" href="#/compare"><b>Compare</b><small>Week vs week, month vs month</small></a></div>
      <div class="chips" id="rg">${[[30, '30 days'], [90, '3 months'], [365, 'Year'], [1e5, 'All time']].map(([d, l]) => `<button class="chip${d === days ? ' on' : ''}" data-d="${d}">${l}</button>`).join('')}</div>
      <div class="card grid"><div><b>${a.n}</b><small>Workouts</small></div><div><b>${Math.round(a.dur)}</b><small>Minutes</small></div><div><b>${Math.round(a.vol)}</b><small>Volume (${cfg.weightUnit})</small></div>
        <div><b>${a.sets}</b><small>Sets</small></div><div><b>${a.n ? Math.round(a.dur / a.n) : 0}</b><small>Avg minutes</small></div><div><b>${streak}</b><small>Week streak</small></div></div>
      <h2>Last 7 days</h2><div class="card">${bodyMap(int)}</div>
      <h2>Workouts per week</h2><div class="card">${line(last.map(k => ({ x: k * DAY, y: wk[k]?.n || 0 })), n => Math.round(n), dmy)}<small class="muted">Last 12 weeks</small></div>
      <h2>Weekly volume</h2><div class="card">${line(last.filter(k => wk[k]).map(k => ({ x: k * DAY, y: wk[k].vol })), n => Math.round(n), dmy)}</div>
      <h2>Body weight</h2><div class="card">${wl ? `<div class="rh"><b>${r1(wl.fields.weight)} ${cfg.weightUnit}</b><span class="muted">${wl.id}</span></div>` : ''}${line(wpts, r1, dmy)}${wl ? '<button class="btn2" data-wt>Weight details</button>' : '<p class="muted">Log your weight from the Home page or the Body tab.</p>'}</div>
      <h2>Muscle distribution (sets)</h2><div class="card">${mus.length ? mus.map(([k, n]) => `<div class="mb"><span>${esc(k)}</span><i style="--w:${n / top * 100}%"></i><b>${r1(n)}</b></div>`).join('') + '<p class="muted"><small>Primary muscle counts fully, secondary muscles count half.</small></p>' : '<p class="muted">Log a workout to see this.</p>'}</div>
      <h2>Exercise progress (tap one for the graph)</h2><div class="card">${topEx.map(([id]) => { const sr = series(id), last = sr[sr.length - 1], dif = sr.length > 1 ? last - sr[0] : 0, ex = exById(id); return `<button class="mbb exr" data-ex="${esc(id)}"><span>${esc(exName(id))}<small class="muted">${sr.length} sessions</small></span>${spark(sr.slice(-12))}<b>${r1(last)}<small class="${dif > 0 ? 'up' : dif < 0 ? 'dn' : 'muted'}">${dif > 0 ? '+' : ''}${r1(dif)}</small></b></button>`; }).join('') || '<p class="muted">Nothing yet.</p>'}<button class="btn2" data-pickex>Pick any exercise</button></div>
      <h2>Calendar</h2><div class="card"><div class="row cal-h"><button data-mo="-1" aria-label="Previous month">‹</button><b>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b><button data-mo="1" aria-label="Next month">›</button></div>
        <div class="cal">${(cfg.weekStart === 'mon' ? 'MTWTFSS' : 'SMTWTFS').split('').map(h => `<span class="muted">${h}</span>`).join('')}${'<span></span>'.repeat(lead)}${Array.from({ length: dim }, (_, i) => { const k = `${pre}-${String(i + 1).padStart(2, '0')}`; return `<button class="cd${byDay[k] ? ' on' : ''}" data-day="${k}">${i + 1}</button>`; }).join('')}</div>
        <p><b>Month report:</b> ${ma.n} workouts · ${ma.sets} sets · ${Math.round(ma.vol)} ${cfg.weightUnit} · ${Math.round(ma.dur)} min</p></div>`;
  };
  draw();
  v.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('wt' in b.dataset) return weightDetail(wms, cfg);
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
  const rset = (await S.list('routines')).flatMap(r => r.exercises).find(e => e.exerciseId === x.id)?.sets?.[0], sg = suggest(x.id, ws, cfg, rset?.repsMin ? [rset.repsMin, rset.repsMax || rset.repsMin] : null);
  ws.forEach(w => {
    const xs = w.exercises.filter(e => e.exerciseId === x.id); if (!xs.length) return;
    const cs = xs.flatMap(e => e.sets).filter(s => s.type !== 'warmup' || cfg.warmupInStats), top = Math.max(0, ...cs.map(s => s.weight || 0)), e1 = Math.max(0, ...cs.map(s => (s.weight || 0) * (1 + (s.reps || 0) / 30)));
    const vol = cs.reduce((q, s) => q + (s.weight || 0) * (s.reps || 0), 0), reps = cs.reduce((q, s) => q + (s.reps || 0), 0);
    hist.push({ workoutId: w.id, date: w.startTs, topWeight: top, e1RM: r1(e1), volume: Math.round(vol), reps, sets: cs.filter(s => s.weight != null || s.reps != null).map(s => (s.weight != null ? s.weight : '') + (s.weight != null && s.reps != null ? '×' : '') + (s.reps != null ? s.reps : '')).join(' · ') });
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
      tb.innerHTML = `${sg ? `<div class="card sug2"><b>Next session suggestion</b><p class="big2">${suggestText(sg, cfg)}</p><small class="muted">${esc(sg.why)}. Last time: ${esc(sg.last)}</small></div>` : ''}<div class="demo" id="dm"><p class="muted">Loading demo…</p></div>${bodyMap(int)}
        <p>Muscle building <b>${stars(m)}</b><br>Strength <b>${stars(s)}</b><br><small class="muted">My rule-based estimate (compound, free weight), not a research score.</small></p>
        <p class="muted">${hist.length} sessions${hist.length ? ' · last ' + dt(hist[hist.length - 1].date) : ''}</p><div id="ins"></div>${x.builtin ? '' : '<div class="row"><button data-ed="del" class="danger">Delete exercise</button><button data-ed="edit" class="btn">Edit exercise</button></div>'}`;
      demoFor(x).then(e => {
        if (!$('#dm', d)) return;
        if (!e) { $('#dm', d).innerHTML = '<p class="muted">No demo available for this exercise.</p>'; return; }
        $('#dm', d).innerHTML = e.images.slice(0, 2).map((i, k) => `<img alt="${esc(e.name)}, position ${k + 1}" src="https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${encodeURI(i)}" loading="lazy">`).join('');
        $('#ins', d).innerHTML = `<h4>How to do it</h4><ol>${(e.instructions || []).map(t => `<li>${esc(t)}</li>`).join('')}</ol><small class="muted">Demo and steps: free-exercise-db (public domain).</small>`;
      });
    } else if (tab === 'his') {
      tb.innerHTML = (hist.length ? '<button class="btn2" data-cp>Copy this exercise history as text</button>' : '') + ([...hist].reverse().map(h => `<button class="item hist" data-h="${esc(h.workoutId)}"><span><b>${dt(h.date)}</b><small>${esc(h.sets)}</small><small>Top ${h.topWeight} ${u} · volume ${Math.round(h.volume)} · ${h.reps} reps</small></span></button>`).join('') || '<p class="muted">No sessions yet.</p>');
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
    const b = e.target.closest('[data-t],[data-mt],[data-rg],[data-h],[data-ed],[data-cp],circle[data-w]'); if (!b) return;
    const ds = b.dataset;
    if ('cp' in ds) return copyOrShow(`Exercise: ${x.name} (weights in ${u}), oldest first. Sets are weight×reps, warm-ups excluded unless enabled.\n` + hist.map(h => `${new Date(h.date).toLocaleDateString('en-CA', { timeZone: TZ })}: ${h.sets}`).join('\n') + `\nRecords: heaviest ${rec.heaviest || 0} ${u}, best est. 1RM ${rec.best1RM || 0}`);
    if (ds.ed) { d.close(); import('./views.js').then(m => (ds.ed === 'edit' ? m.editExercise(x) : m.deleteExercise(x))); return; }
    if (ds.t) tab = ds.t; else if (ds.mt) metric = ds.mt; else if (ds.rg) rng = +ds.rg;
    else { const id = ds.h || ds.w; if (id) showWorkout(id, () => {}); return; }
    render();
  };
  render();
}

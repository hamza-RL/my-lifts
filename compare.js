import * as S from './store.js';
import { esc, exName, loadCustom } from './views.js';
import { copyOrShow, dayKey } from './textutil.js';

const r1 = n => Math.round(n * 10) / 10;
const shift = (k, n) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const fd = (k, o) => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });

function period(mode, off, cfg) {
  const t = dayKey(Date.now());
  if (mode === 'week') {
    const dow = new Date(t + 'T00:00:00Z').getUTCDay(), back = cfg.weekStart === 'mon' ? (dow + 6) % 7 : dow, from = shift(t, -back + 7 * off), to = shift(from, 6);
    return { from, to, label: `${fd(from, { day: 'numeric', month: 'short' })} – ${fd(to, { day: 'numeric', month: 'short' })}` };
  }
  const [y, m] = t.split('-').map(Number), d0 = new Date(Date.UTC(y, m - 1 + off, 1));
  return { from: d0.toISOString().slice(0, 10), to: new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 0)).toISOString().slice(0, 10),
    label: d0.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}
function agg(ws, p, cfg, ms) {
  const a = { n: 0, sets: 0, vol: 0, min: 0, ex: {}, bw: null }, wl = ws.filter(w => { const k = dayKey(w.startTs); return k >= p.from && k <= p.to; });
  a.n = wl.length;
  wl.forEach(w => { a.min += (w.endTs - w.startTs) / 6e4; w.exercises.forEach(x => {
    const e = a.ex[x.exerciseId] ||= { top: 0, e1: 0, vol: 0, sets: 0 };
    x.sets.filter(s => s.type !== 'warmup' || cfg.warmupInStats).forEach(s => {
      const wt = s.weight || 0, r = s.reps || 0; e.sets++; a.sets++; e.vol += wt * r; a.vol += wt * r;
      e.top = Math.max(e.top, wt); e.e1 = Math.max(e.e1, wt && r ? wt * (1 + r / 30) : 0);
    });
  }); });
  const b = ms.filter(m => m.id >= p.from && m.id <= p.to && m.fields?.weight);
  a.bw = b.length ? b.reduce((s, m) => s + m.fields.weight, 0) / b.length : null;
  return a;
}
const chg = (n, o) => {
  if (!n && !o) return ['–', ''];
  if (!o) return ['new', 'up'];
  const d = n - o, p = d / o * 100;
  return [`${d > 0 ? '+' : ''}${r1(d)} (${p > 0 ? '+' : ''}${Math.round(p)}%)`, d > 0 ? 'up' : d < 0 ? 'dn' : ''];
};

export async function compareView(v) {
  await loadCustom();
  const cfg = await S.getSettings(), ws = await S.list('workouts'), ms = await S.list('measurements'), u = cfg.weightUnit;
  let mode = 'week', a = 0, b = -1;
  const calc = () => { const pa = period(mode, a, cfg), pb = period(mode, b, cfg); return { pa, pb, A: agg(ws, pa, cfg, ms), B: agg(ws, pb, cfg, ms) }; };
  const ids = (A, B) => [...new Set([...Object.keys(A.ex), ...Object.keys(B.ex)])].sort((x, y) => (A.ex[y]?.vol || 0) - (A.ex[x]?.vol || 0) || (B.ex[y]?.vol || 0) - (B.ex[x]?.vol || 0));
  const row = (l, o, n, unit = '') => { const [t, c] = chg(n, o); return `<tr><td>${l}</td><td>${o ? r1(o) + unit : '–'}</td><td>${n ? r1(n) + unit : '–'}</td><td class="${c}">${t}</td></tr>`; };
  const head = '<tr class="th"><td></td><td>Before</td><td>Now</td><td>Change</td></tr>';
  const text = () => {
    const { pa, pb, A, B } = calc(), L = [`Strength comparison by ${mode}: NOW (${pa.label}) vs BEFORE (${pb.label}). Weights in ${u}.`, '',
      `Workouts: ${B.n} -> ${A.n}`, `Sets: ${B.sets} -> ${A.sets}`, `Total volume: ${Math.round(B.vol)} -> ${Math.round(A.vol)}`, `Minutes: ${Math.round(B.min)} -> ${Math.round(A.min)}`,
      `Average body weight: ${B.bw ? r1(B.bw) : 'n/a'} -> ${A.bw ? r1(A.bw) : 'n/a'}`, ''];
    ids(A, B).forEach(id => { const x = A.ex[id] || {}, y = B.ex[id] || {};
      L.push(`${exName(id)}: top weight ${y.top || '-'} -> ${x.top || '-'} | est. 1RM ${y.e1 ? r1(y.e1) : '-'} -> ${x.e1 ? r1(x.e1) : '-'} | volume ${Math.round(y.vol || 0)} -> ${Math.round(x.vol || 0)} | sets ${y.sets || 0} -> ${x.sets || 0}`); });
    return L.join('\n');
  };
  const draw = () => {
    const { pa, pb, A, B } = calc(), nav = (k, p) => `<div class="row cal-h"><button data-s="${k}:-1" aria-label="Earlier">‹</button><b>${esc(p.label)}</b><button data-s="${k}:1" aria-label="Later"${(k === 'a' ? a : b) >= 0 ? ' disabled' : ''}>›</button></div>`;
    v.innerHTML = `<header class="top"><h1>Compare</h1></header>
      <div class="seg">${[['week', 'Weeks'], ['month', 'Months']].map(([k, l]) => `<button data-m="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="card"><small class="muted">Now</small>${nav('a', pa)}<small class="muted">Compare with</small>${nav('b', pb)}
        <p class="muted"><small>A period that is still running (this week or month) will look smaller until it ends.</small></p><button class="btn" data-cp>Copy comparison as text</button></div>
      <h2>Overall</h2><div class="card"><table class="rt2 cmpt">${head}${row('Workouts', B.n, A.n)}${row('Sets', B.sets, A.sets)}${row('Volume (' + u + ')', Math.round(B.vol), Math.round(A.vol))}${row('Minutes', Math.round(B.min), Math.round(A.min))}${row('Avg body weight', B.bw, A.bw, ' ' + u)}</table></div>
      <h2>By exercise</h2>${ids(A, B).map(id => { const x = A.ex[id] || {}, y = B.ex[id] || {};
        return `<div class="card"><b>${esc(exName(id))}</b><table class="rt2 cmpt">${head}${row('Top weight', y.top, x.top)}${row('Est. 1RM', y.e1, x.e1)}${row('Volume', Math.round(y.vol || 0), Math.round(x.vol || 0))}${row('Sets', y.sets, x.sets)}</table></div>`; }).join('') || '<p class="muted">No workouts in these periods.</p>'}`;
  };
  draw();
  v.onclick = e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return; const d = t.dataset;
    if (d.m) { mode = d.m; a = 0; b = -1; }
    else if (d.s) { const [w, dir] = d.s.split(':'); if (w === 'a') a = Math.min(0, a + +dir); else b = Math.min(0, b + +dir); }
    else if ('cp' in d) return copyOrShow(text());
    draw();
  };
}

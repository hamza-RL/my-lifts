import * as S from './store.js';
import { esc, exName, loadCustom } from './views.js';
import { showWorkout } from './workout.js';
import { workoutText, copyOrShow, dayKey } from './textutil.js';

const TZ = 'Africa/Casablanca';

export async function historyView(v) {
  await loadCustom();
  const cfg = await S.getSettings(), [w0, ms] = await Promise.all([S.list('workouts'), S.list('measurements')]);
  const ws = w0.sort((a, b) => b.startTs - a.startTs), bw = Object.fromEntries(ms.filter(m => m.fields?.weight).map(m => [m.id, m.fields.weight]));
  const titles = [...new Set(ws.map(w => w.title))];
  let f = '', q = '', lim = 30;
  const shown = () => ws.filter(w => (!f || w.title === f) && (!q || w.exercises.some(x => exName(x.exerciseId).toLowerCase().includes(q))));
  v.innerHTML = `<header class="top"><h1>History</h1></header>
    <div class="chips" id="hc"></div>
    <input id="hq" type="search" placeholder="Search by exercise" aria-label="Search by exercise">
    <div class="card"><b>Copy for AI</b><p class="muted"><small>Copies the newest sessions (shown oldest first) with every exercise, set, weight and rep.</small></p>
      <div class="row"><select id="cn" aria-label="How many workouts"><option>1</option><option>3</option><option selected>5</option><option>10</option><option>20</option><option value="9999">All</option></select><button class="btn" data-cp>Copy as text</button></div></div>
    <div id="hl"></div>`;
  const chips = () => { v.querySelector('#hc').innerHTML = [['', 'All']].concat(titles.map(t => [t, t])).map(([k, l]) => `<button class="chip${k === f ? ' on' : ''}" data-f="${esc(k)}">${esc(l)}</button>`).join(''); };
  const list = () => {
    const l = shown();
    v.querySelector('#hl').innerHTML = (l.slice(0, lim).map(w => {
      const sets = w.exercises.reduce((n, x) => n + x.sets.length, 0);
      return `<button class="item hist" data-h="${esc(w.id)}"><span><b>${esc(w.title)}</b><small>${new Date(w.startTs).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })} · ${Math.round((w.endTs - w.startTs) / 6e4)} min · ${sets} sets</small><small>${esc(w.exercises.map(x => exName(x.exerciseId)).join(', '))}</small></span></button>`;
    }).join('') || '<p class="muted">No workouts found.</p>') + (l.length > lim ? '<button class="btn2" data-more>Show more</button>' : '');
  };
  chips(); list();
  v.querySelector('#hq').oninput = e => { q = e.target.value.trim().toLowerCase(); lim = 30; list(); };
  v.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.f !== undefined) { f = b.dataset.f; lim = 30; chips(); list(); }
    else if ('more' in b.dataset) { lim += 30; list(); }
    else if (b.dataset.h) showWorkout(b.dataset.h, () => historyView(v));
    else if ('cp' in b.dataset) {
      const n = +v.querySelector('#cn').value, pick = shown().slice(0, n).reverse();
      if (!pick.length) return;
      copyOrShow(`My training log (weights in ${cfg.weightUnit}), ${pick.length} workout${pick.length > 1 ? 's' : ''}, oldest first:\n\n` + pick.map(w => workoutText(w, cfg, bw[dayKey(w.startTs)])).join('\n\n----\n\n'));
    }
  };
}

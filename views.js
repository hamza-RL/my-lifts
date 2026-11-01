import * as S from './store.js';
import { exerciseDetail } from './stats.js';
import { hasActive, liveView, startWorkout, nextRoutine } from './workout.js';
import { SEED, SEED_ROUTINES, MUSCLES, EQUIP, TYPES, slug } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const toast = m => dispatchEvent(new CustomEvent('toast', { detail: m }));
let custom = [];
const all = () => [...SEED, ...custom].sort((a, b) => a.name.localeCompare(b.name));
export const loadCustom = async () => { custom = await S.list('exercises'); };
export const exById = id => all().find(x => x.id === id);
export const exName = id => all().find(x => x.id === id)?.name || id;

export async function seedOnce() {
  const m = await S.get('meta/seed');
  if (m?.routines) return;
  let i = 0;
  for (const [title, ex] of SEED_ROUTINES) {
    await S.set('routines/' + slug(title), {
      title, order: i++, folderId: null, updatedAt: Date.now(),
      exercises: ex.map(([n, s, a, b, note]) => ({
        exerciseId: slug(n), restSec: /press|pulldown|row/i.test(n) ? 150 : 90, notes: note || '', supersetId: null,
        sets: Array.from({ length: s }, () => ({ type: 'normal', weight: null, repsMin: a, repsMax: b }))
      }))
    });
  }
  await S.set('meta/seed', { ...(m || {}), routines: true });
}

export function sheet(html) {
  const d = document.createElement('dialog');
  d.className = 'sheet'; d.innerHTML = `<div class="sb"><button class="x" aria-label="Close">✕</button>${html}</div>`;
  document.body.append(d); d.showModal();
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('.x')) d.close(); });
  return d;
}
const hue = m => (MUSCLES.indexOf(m) * 47) % 360;
const opt = (list, sel) => list.map(x => `<option${x === sel ? ' selected' : ''}>${esc(x)}</option>`).join('');

// ---------- Exercises ----------
export async function exercisesView(v) {
  custom = await S.list('exercises');
  const f = { q: '', m: '', e: '' };
  const chips = (key, items) => `<div class="chips" data-f="${key}"><button class="chip on" data-v="">All</button>${items.map(i => `<button class="chip" data-v="${esc(i)}">${esc(i)}</button>`).join('')}</div>`;
  v.innerHTML = `<header class="top"><h1>Exercises</h1><button class="icon" data-n="new" aria-label="New exercise">+</button></header>
    <input id="q" type="search" placeholder="Search ${all().length} exercises" aria-label="Search exercises">
    ${chips('m', MUSCLES)}${chips('e', EQUIP)}<div id="lst"></div>`;
  const draw = () => {
    const q = f.q.toLowerCase();
    const r = all().filter(x => (!q || x.name.toLowerCase().includes(q)) && (!f.m || x.primary === f.m) && (!f.e || x.equipment === f.e));
    $('#lst').innerHTML = r.map(x => `<button class="item" data-id="${esc(x.id)}"><span class="bdg" style="--h:${hue(x.primary)}">${esc(x.primary[0].toUpperCase())}</span>
      <span><b>${esc(x.name)}</b><small>${esc(x.primary)} · ${esc(x.equipment)}${x.builtin ? '' : ' · custom'}</small></span></button>`).join('')
      || '<p class="muted">No exercises match. Clear a filter or add your own with +.</p>';
  };
  draw();
  $('#q').oninput = e => { f.q = e.target.value; draw(); };
  v.querySelectorAll('.chips').forEach(c => c.onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    f[c.dataset.f] = b.dataset.v;
    c.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    draw();
  });
  const reload = () => exercisesView(v);
  v.onclick = e => {
    if (e.target.closest('[data-n]')) return form({}, reload);
    const it = e.target.closest('.item'); if (!it) return;
    const x = all().find(y => y.id === it.dataset.id);
    return exerciseDetail(x);
    const d = sheet(`<h3>${esc(x.name)}</h3><p class="muted">${esc(x.equipment)} · ${esc(TYPES[x.type])}</p>
      <p><b>Primary:</b> ${esc(x.primary)}<br><b>Secondary:</b> ${esc(x.secondary.join(', ') || 'none')}</p>
      ${x.note ? `<p>${esc(x.note)}</p>` : ''}
      <button class="btn2" data-d="more">Technique, records and charts</button>
      ${x.builtin ? ''
        : '<div class="row"><button data-d="del" class="danger">Delete</button><button data-d="edit" class="btn">Edit</button></div>'}`);
    d.onclick = async ev => {
      const a = ev.target.dataset.d; if (!a) return;
      d.close();
      if (a === 'more') exerciseDetail(x);
      else if (a === 'edit') form(x, reload);
      else if (confirm('Delete this exercise? Past workouts keep their data.')) { await S.del('exercises/' + x.id); reload(); }
    };
  };
}

function form(x, done) {
  const d = sheet(`<h3>${x.id ? 'Edit' : 'New'} exercise</h3><form method="dialog">
    <label>Name<input name="name" required maxlength="60" value="${esc(x.name)}"></label>
    <label>Equipment<select name="equipment">${opt(EQUIP, x.equipment)}</select></label>
    <label>Primary muscle<select name="primary">${opt(MUSCLES, x.primary)}</select></label>
    <fieldset><legend>Secondary muscles</legend><div class="chips wrap">${MUSCLES.map(m =>
      `<label class="chip"><input type="checkbox" name="sec" value="${m}"${x.secondary?.includes(m) ? ' checked' : ''}>${m}</label>`).join('')}</div></fieldset>
    <label>Type<select name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}"${k === (x.type || 'wr') ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    <label>Note (optional)<textarea name="note" maxlength="300">${esc(x.note)}</textarea></label>
    <div class="row"><button value="x" formnovalidate>Cancel</button><button value="ok" class="btn">Save</button></div></form>`);
  d.addEventListener('close', async () => {
    if (d.returnValue !== 'ok') return;
    const f = new FormData(d.querySelector('form')), name = f.get('name').trim();
    if (!name) return;
    await S.set('exercises/' + (x.id || 'c_' + Date.now().toString(36)), {
      name, equipment: f.get('equipment'), primary: f.get('primary'), secondary: f.getAll('sec').filter(m => m !== f.get('primary')),
      type: f.get('type'), note: f.get('note').trim(), updatedAt: Date.now()
    });
    toast('Saved'); done();
  });
}

// ---------- Workout tab: routines ----------
export async function workoutView(v) {
  if (await hasActive()) return liveView(v);
  await loadCustom();
  const [r0, ws, plan] = await Promise.all([S.list('routines'), S.list('workouts'), S.get('meta/plan')]), rs = r0.sort((a, b) => a.order - b.order), next = nextRoutine(rs, ws, plan);
  const rng = s => (s?.repsMin ? (s.repsMin === s.repsMax ? s.repsMin : s.repsMin + '–' + s.repsMax) : '–');
  v.innerHTML = `<header class="top"><h1>Workout</h1></header>
    ${next ? `<div class="card next"><small class="muted">Up next</small><h2>${esc(next.title)}</h2><p class="prev">${esc(next.exercises.map(e => exName(e.exerciseId)).join(', '))}</p>
      <div class="row"><button data-w="change">Change</button><button class="btn" data-w="start" data-id="${esc(next.id)}">Start ${esc(next.title)}</button></div></div>` : ''}
    <button class="btn2" data-w="start">Start empty workout</button><h2>My routines</h2>
    <div class="tiles">${rs.map(r => `<button class="tile" data-r="${esc(r.id)}"><b>${esc(r.title)}</b><small>${r.exercises.length} exercises · ${r.exercises.reduce((n, e) => n + e.sets.length, 0)} sets</small></button>`).join('') || '<p class="muted">No routines yet.</p>'}</div>`;
  const go = async r => { await startWorkout(r || null); workoutView(v); };
  v.onclick = async e => {
    const w = e.target.closest('[data-w]'), t = e.target.closest('[data-r]');
    if (w?.dataset.w === 'start') return go(rs.find(x => x.id === w.dataset.id));
    if (w?.dataset.w === 'change') {
      const d = sheet(`<h3>Set what is up next</h3>${rs.map(r => `<button class="item" data-p="${esc(r.id)}"><b>${esc(r.title)}</b></button>`).join('')}`);
      d.onclick = async ev => { const p = ev.target.closest('[data-p]'); if (!p) return; await S.set('meta/plan', { nextId: p.dataset.p, updatedAt: Date.now() }); d.close(); workoutView(v); };
      return;
    }
    if (!t) return;
    const r = rs.find(x => x.id === t.dataset.r);
    const d = sheet(`<h3>${esc(r.title)}</h3>${r.exercises.map(x => `<p class="rl2"><span>${esc(exName(x.exerciseId))}</span><span class="muted">${x.sets.length} × ${rng(x.sets[0])}</span></p>`).join('')}
      <button class="btn big" data-a="start">Start ${esc(r.title)}</button><div class="row"><button data-a="dup">Duplicate</button><button data-a="del" class="danger">Delete</button></div>`);
    d.onclick = async ev => {
      const a = ev.target.dataset.a; if (!a) return;
      if (a === 'del' && !confirm('Delete this routine?')) return;
      d.close();
      if (a === 'start') return go(r);
      if (a === 'dup') await S.set('routines/r_' + Date.now().toString(36), { ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'id')), title: r.title + ' copy', order: rs.length, updatedAt: Date.now() });
      else await S.del('routines/' + r.id);
      workoutView(v);
    };
  };
}

export function pickExercise() {
  return new Promise(res => {
    const d = sheet('<h3>Add exercise</h3><input id="pq" type="search" placeholder="Search exercises" aria-label="Search"><div id="pl"></div>');
    let pick = null;
    const draw = () => { const q = $('#pq', d).value.toLowerCase(); $('#pl', d).innerHTML = all().filter(x => x.name.toLowerCase().includes(q)).slice(0, 60).map(x =>
      `<button class="item" data-id="${esc(x.id)}"><span class="bdg" style="--h:${hue(x.primary)}">${esc(x.primary[0].toUpperCase())}</span><span><b>${esc(x.name)}</b><small>${esc(x.primary)} · ${esc(x.equipment)}</small></span></button>`).join(''); };
    S.list('exercises').then(c => { custom = c; draw(); });
    $('#pq', d).oninput = draw;
    d.onclick = e => { const i = e.target.closest('.item'); if (i) { pick = i.dataset.id; d.close(); } };
    d.addEventListener('close', () => res(pick));
  });
}

export const editExercise = x => form(x, () => exercisesView($('#view')));
export async function deleteExercise(x) {
  if (confirm('Delete this exercise? Past workouts keep their data.')) { await S.del('exercises/' + x.id); exercisesView($('#view')); }
}

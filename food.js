import * as S from './store.js';
import { sheet, esc, toast } from './views.js';
import { line } from './stats.js';
import { BUILTIN, slug, toGrams, macros, unitsFor, parseQuick } from './foods.js';

const $ = (s, r = document) => r.querySelector(s), TZ = 'Africa/Casablanca', r1 = n => Math.round(n * 10) / 10;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const shift = (k, n) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const sum = items => items.reduce((a, i) => ({ k: a.k + i.k, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { k: 0, p: 0, c: 0, f: 0 });
let V, date = today(), tab = 'diary', FOODS = [], P = { fav: [], recent: [] }, cfg, day, train = false, range = 30;

const loadFoods = async () => {
  const m = new Map(BUILTIN.map(f => [f.id, f]));
  (await S.list('foods')).forEach(({ id, ...d }) => m.set(id, { units: m.get(id)?.units || {}, ...d, id, builtin: m.get(id)?.builtin, edited: m.has(id) }));
  FOODS = [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
};
const saveDay = () => { const { demo, ...d } = day; return day.slots.length ? S.set('foodLogs/' + date, { ...d, updatedAt: Date.now() }) : S.del('foodLogs/' + date); };
const mkItem = (f, qty, unit) => {
  const g = toGrams(f, qty, unit, cfg.spoonG, cfg.glassMl), m = macros(f, g);
  return { fid: f.id, n: f.name, g: Math.round(g), label: unit === 'g' ? `${Math.round(g)} g` : `${qty} ${unit === 'piece' ? f.units.piece?.label || 'piece' : unit} (${Math.round(g)} g)`, ...m };
};
const bar = (l, v, t, u = '') => `<div class="mb2"><span>${l}</span><div class="pb${v > t && t ? ' over' : ''}"><i style="--w:${t ? Math.min(100, v / t * 100) : 0}%"></i></div><b>${Math.round(v)}${u}${t ? ` / ${t}` : ''}</b><small>${t ? (v <= t ? Math.round(t - v) + ' left' : Math.round(v - t) + ' over') : 'set a target'}</small></div>`;
const ask = (title, label, val = '', list = []) => new Promise(res => {
  const d = sheet(`<h3>${esc(title)}</h3><form method="dialog"><label>${esc(label)}<input name="v" list="dl" required maxlength="40" value="${esc(val)}"></label><datalist id="dl">${list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <div class="row"><button value="x" formnovalidate>Cancel</button><button value="ok" class="btn">OK</button></div></form>`);
  d.addEventListener('close', () => res(d.returnValue === 'ok' ? new FormData(d.querySelector('form')).get('v').trim() : null));
});

export async function foodView(v) {
  V = v; cfg = await S.getSettings(); await loadFoods(); P = { fav: [], recent: [], ...((await S.get('meta/foodPrefs')) || {}) };
  v.onclick = onClick; render();
}
async function render() {
  v: {
    const v = V;
    v.innerHTML = `<header class="top"><h1>Food</h1><button class="icon" data-f="tg" aria-label="Targets">⚙</button></header>
      <div class="seg s3">${[['diary', 'Diary'], ['ana', 'Analytics'], ['db', 'Foods']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="fb"></div>`;
    await ({ diary, ana, db })[tab]($('#fb'));
  }
}

async function diary(el) {
  day = (await S.get('foodLogs/' + date)) || { slots: [] };
  const ws = (await S.list('workouts')).filter(w => new Date(w.startTs).toLocaleDateString('en-CA', { timeZone: TZ }) === date);
  train = ws.length > 0;
  const T = train ? { k: cfg.kcalTrain, p: cfg.proteinTrain, c: cfg.carbsTrain, f: cfg.fatTrain } : { k: cfg.kcalRest, p: cfg.proteinRest, c: cfg.carbsRest, f: cfg.fatRest };
  const all = sum(day.slots.flatMap(s => s.items)), wt = (await S.get('measurements/' + date))?.fields?.weight ?? '';
  el.innerHTML = `<div class="row cal-h"><button data-sh="-1" aria-label="Previous day">‹</button><b>${new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}${date === today() ? ' (today)' : ''}</b><button data-sh="1" aria-label="Next day">›</button></div>
    <div class="card"><div class="rh"><b>${train ? 'Training day' : 'Rest day'} targets</b><button class="chip on" data-f="tg">Edit targets</button></div>${!T.k && !T.p ? '<p class="err">No target set yet. Tap Edit targets to enter your daily calories and protein.</p>' : ''}${bar('Calories', all.k, T.k)}${bar('Protein', all.p, T.p, ' g')}${bar('Carbs', all.c, T.c, ' g')}${bar('Fat', all.f, T.f, ' g')}</div>
    ${day.slots.map((s, si) => `<section class="card"><div class="rh"><b>${esc(s.name)}</b><span><b>${Math.round(sum(s.items).k)}</b> kcal <button class="icon" data-sm="${si}" aria-label="Meal menu">⋯</button></span></div>
      ${s.items.map((i, ii) => `<button class="item" data-e="${si}:${ii}"><span><b>${esc(i.n)}</b><small>${esc(i.label)} · ${i.p}P ${i.c}C ${i.f}F</small></span><b>${i.k}</b></button>`).join('')}
      <button class="btn2" data-add="${si}">+ Add food</button></section>`).join('') || '<p class="muted">Nothing logged yet. Add a meal slot below, or tap Quick snack.</p>'}
    <div class="row"><button data-ns>+ New meal slot</button><button data-snack class="btn">Quick snack</button></div>
    <div class="row"><button data-copy>Copy yesterday</button></div>
    <div class="card"><label>Weigh-in (${cfg.weightUnit})<input id="wi" inputmode="decimal" value="${wt}"></label><button class="btn2" data-wi>Save weight</button></div>`;
}

async function onClick(e) {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.tab) { tab = d.tab; return render(); }
  if (d.f === 'tg') return targets();
  if (d.sh) { date = shift(date, +d.sh); return render(); }
  if (d.rg) { range = +d.rg; return render(); }
  if (d.ns !== undefined) { const n = await ask('New meal slot', 'Name', 'Meal ' + (day.slots.length + 1), ['Post-Gym', 'Late Snack', 'Snacks', 'Pre-Gym']); if (n) { day.slots.push({ id: 's' + Date.now().toString(36), name: n, items: [] }); await saveDay(); render(); } return; }
  if (d.snack !== undefined) { let i = day.slots.findIndex(s => s.name === 'Snacks'); if (i < 0) { day.slots.push({ id: 's' + Date.now().toString(36), name: 'Snacks', items: [] }); i = day.slots.length - 1; await saveDay(); } return addSheet(i); }
  if (d.add !== undefined) return addSheet(+d.add);
  if (d.copy !== undefined) { const y = await S.get('foodLogs/' + shift(date, -1)); if (!y?.slots?.length) return toast('Nothing logged yesterday.'); y.slots.forEach(s => day.slots.push({ ...s, id: 's' + Math.random().toString(36).slice(2, 7) })); await saveDay(); return render(); }
  if (d.wi !== undefined) { const w = parseFloat($('#wi').value.replace(',', '.')); if (!w) return; const old = (await S.get('measurements/' + date)) || {}; const { demo, ...o } = old; await S.set('measurements/' + date, { ...o, date, fields: { ...(o.fields || {}), weight: w } }); return toast('Weight saved.'); }
  if (d.sm !== undefined) return slotMenu(+d.sm);
  if (d.e !== undefined) return editItem(...d.e.split(':').map(Number));
  if (d.food) return foodForm(FOODS.find(f => f.id === d.food));
  if (d.nf !== undefined) return foodForm({});
}

function slotMenu(si) {
  const s = day.slots[si], dlg = sheet(`<h3>${esc(s.name)}</h3><button class="btn2" data-a="ren">Rename</button><button class="btn2" data-a="tpl">Save as meal template</button><button class="btn2 danger" data-a="del">Delete this slot</button>`);
  dlg.onclick = async e => {
    const a = e.target.dataset.a; if (!a) return; dlg.close();
    if (a === 'ren') { const n = await ask('Rename', 'Name', s.name); if (n) s.name = n; }
    else if (a === 'tpl') { if (!s.items.length) return toast('Add food first.'); const n = await ask('Save as meal', 'Template name', s.name); if (!n) return; await S.set('savedMeals/m_' + Date.now().toString(36), { name: n, items: s.items, updatedAt: Date.now() }); return toast('Template saved.'); }
    else day.slots.splice(si, 1);
    await saveDay(); render();
  };
}
function editItem(si, ii) {
  const it = day.slots[si].items[ii], f = FOODS.find(x => x.id === it.fid);
  const dlg = sheet(`<h3>${esc(it.n)}</h3>${f ? `<label>Grams<input id="eg" inputmode="decimal" value="${it.g}"></label>` : '<p class="muted">Quick entry: delete and re-add to change it.</p>'}<div class="row"><button class="danger" data-a="del">Delete</button>${f ? '<button class="btn" data-a="ok">Save</button>' : ''}</div>`);
  dlg.onclick = async e => {
    const a = e.target.dataset.a; if (!a) return; dlg.close();
    if (a === 'del') day.slots[si].items.splice(ii, 1);
    else { const g = parseFloat($('#eg', dlg).value.replace(',', '.')) || it.g; day.slots[si].items[ii] = { ...it, g, label: g + ' g', ...macros(f, g) }; }
    await saveDay(); render();
  };
}

function addSheet(si) {
  const dlg = sheet(`<h3>Add to ${esc(day.slots[si].name)}</h3><div class="seg s4">${[['s', 'Search'], ['t', 'Type it'], ['q', 'Quick'], ['m', 'Meals']].map(([k, l]) => `<button data-m="${k}">${l}</button>`).join('')}</div><div id="ab"></div>`);
  const body = () => $('#ab', dlg);
  const done = async items => { day.slots[si].items.push(...items); items.forEach(i => i.fid && (P.recent = [i.fid, ...P.recent.filter(x => x !== i.fid)].slice(0, 20))); await saveDay(); S.set('meta/foodPrefs', P); dlg.close(); render(); };
  const mode = m => {
    dlg.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    if (m === 's') search(); else if (m === 't') typeIt(); else if (m === 'q') quick(); else meals();
  };
  const search = () => {
    body().innerHTML = '<input id="sq" type="search" placeholder="Search foods" aria-label="Search foods"><div id="sl"></div>';
    const draw = () => {
      const q = $('#sq', dlg).value.toLowerCase(), l = q ? FOODS.filter(f => f.name.toLowerCase().includes(q)).slice(0, 40) : [...new Set([...P.fav, ...P.recent])].map(id => FOODS.find(f => f.id === id)).filter(Boolean);
      $('#sl', dlg).innerHTML = l.map(f => `<button class="item" data-fid="${esc(f.id)}"><span><b>${P.fav.includes(f.id) ? '★ ' : ''}${esc(f.name)}</b><small>${f.k} kcal · ${f.p}P ${f.c}C ${f.f}F per 100 g</small></span></button>`).join('') || '<p class="muted">Type to search, or favorite foods appear here.</p>';
    };
    draw(); $('#sq', dlg).oninput = draw;
  };
  const amount = f => {
    const us = unitsFor(f), u0 = us.includes('piece') ? 'piece' : 'g';
    body().innerHTML = `<h4>${esc(f.name)}</h4><div class="row"><input id="qa" inputmode="decimal" value="${u0 === 'g' ? 100 : 1}"><select id="ua">${us.map(u => `<option${u === u0 ? ' selected' : ''}>${u}</option>`).join('')}</select></div><p id="pv" class="muted"></p>
      <div class="row"><button data-fav>${P.fav.includes(f.id) ? '★ Favorite' : '☆ Favorite'}</button><button class="btn" data-ok>Add</button></div>`;
    const cur = () => mkItem(f, parseFloat($('#qa', dlg).value.replace(',', '.')) || 0, $('#ua', dlg).value), pv = () => { const i = cur(); $('#pv', dlg).textContent = `${i.k} kcal · ${i.p}P ${i.c}C ${i.f}F (${i.g} g)`; };
    pv(); $('#qa', dlg).oninput = pv; $('#ua', dlg).onchange = pv;
    body().onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if ('ok' in b.dataset) done([cur()]); else if ('fav' in b.dataset) { P.fav = P.fav.includes(f.id) ? P.fav.filter(x => x !== f.id) : [...P.fav, f.id]; S.set('meta/foodPrefs', P); amount(f); } };
  };
  const typeIt = () => {
    body().innerHTML = '<textarea id="tx" placeholder="4 large eggs, 100 g oats, 20 g tagine goat meat" aria-label="Describe what you ate"></textarea><button class="btn2" data-go>Understand</button><div id="rows"></div>';
    let rows = [];
    const show = () => {
      $('#rows', dlg).innerHTML = rows.map((r, i) => {
        if (!r.food) return `<div class="card"><b>${esc(r.text)}</b><p class="err">No match found. Remove it, or add it as a custom food in the Foods tab.</p><button data-rm="${i}">Remove</button></div>`;
        const it = mkItem(r.food, r.qty, r.unit);
        return `<div class="card"><div class="rh"><b>${esc(r.text)}</b><button class="icon" data-rm="${i}" aria-label="Remove">✕</button></div>
          <select data-ci="${i}">${r.cands.map(c => `<option value="${esc(c.id)}"${c.id === r.food.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <div class="row"><input data-qq="${i}" inputmode="decimal" value="${r.qty}"><select data-uu="${i}">${unitsFor(r.food).map(u => `<option${u === r.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
          <p class="muted">${it.k} kcal · ${it.p}P ${it.c}C ${it.f}F (${it.g} g)</p></div>`;
      }).join('');
      const ok = rows.filter(r => r.food), t = sum(ok.map(r => mkItem(r.food, r.qty, r.unit)));
      if (ok.length) $('#rows', dlg).insertAdjacentHTML('beforeend', `<p><b>Total:</b> ${Math.round(t.k)} kcal · ${r1(t.p)}P ${r1(t.c)}C ${r1(t.f)}F</p><button class="btn" data-all>Save to diary</button>`);
    };
    body().onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const d = b.dataset;
      if ('go' in d) { rows = parseQuick($('#tx', dlg).value, FOODS); show(); }
      else if (d.rm) { rows.splice(+d.rm, 1); show(); }
      else if ('all' in d) done(rows.filter(r => r.food).map(r => mkItem(r.food, r.qty, r.unit))); };
    body().onchange = ev => { const d = ev.target.dataset;
      if (d.ci !== undefined) { const r = rows[+d.ci]; r.food = r.cands.find(c => c.id === ev.target.value); r.unit = unitsFor(r.food).includes(r.unit) ? r.unit : 'g'; }
      else if (d.qq !== undefined) rows[+d.qq].qty = parseFloat(ev.target.value.replace(',', '.')) || 0;
      else if (d.uu !== undefined) rows[+d.uu].unit = ev.target.value; else return;
      show(); };
  };
  const quick = () => {
    body().innerHTML = `<label>Name (optional)<input id="qn" maxlength="40"></label>${[['k', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)']].map(([k, l]) => `<label>${l}<input id="q${k}" inputmode="decimal"></label>`).join('')}<button class="btn" data-q>Add</button>`;
    body().onclick = ev => { if (!ev.target.closest('[data-q]')) return; const n = k => parseFloat($('#q' + k, dlg).value.replace(',', '.')) || 0, it = { n: $('#qn', dlg).value.trim() || 'Quick add', g: 0, label: 'quick add', k: Math.round(n('k')), p: n('p'), c: n('c'), f: n('f') }; if (!it.k && !it.p) return toast('Enter calories or protein.'); done([it]); };
  };
  const meals = async () => {
    const ms = await S.list('savedMeals');
    body().innerHTML = ms.map(m => `<div class="item"><button class="item" data-tm="${esc(m.id)}"><span><b>${esc(m.name)}</b><small>${m.items.length} items · ${Math.round(sum(m.items).k)} kcal</small></span></button><button class="icon" data-dm="${esc(m.id)}" aria-label="Delete template">✕</button></div>`).join('') || '<p class="muted">No templates yet. Open a meal slot menu and choose "Save as meal template".</p>';
    body().onclick = async ev => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.tm) done(ms.find(m => m.id === b.dataset.tm).items.map(i => ({ ...i }))); else if (b.dataset.dm && confirm('Delete this template?')) { await S.del('savedMeals/' + b.dataset.dm); meals(); } };
  };
  dlg.onclick = ev => { const b = ev.target.closest('[data-m]'); if (b) return mode(b.dataset.m); const f = ev.target.closest('[data-fid]'); if (f) amount(FOODS.find(x => x.id === f.dataset.fid)); };
  mode('s');
}

async function db(el) {
  el.innerHTML = `<button class="btn2 btn" data-nf>+ Custom food</button><input id="fq" type="search" placeholder="Search ${FOODS.length} foods to edit" aria-label="Search foods"><p class="muted"><small>Values are approximate, per 100 g. Tap a food to edit its numbers.</small></p><div id="fl"></div>`;
  const draw = () => { const q = $('#fq').value.toLowerCase(); $('#fl').innerHTML = FOODS.filter(f => !q || f.name.toLowerCase().includes(q)).slice(0, 60).map(f => `<button class="item" data-food="${esc(f.id)}"><span><b>${esc(f.name)}${f.edited ? ' ✎' : ''}</b><small>${f.k} kcal · ${f.p}P ${f.c}C ${f.f}F</small></span></button>`).join(''); };
  draw(); $('#fq').oninput = draw;
}
function foodForm(f) {
  const dlg = sheet(`<h3>${f.id ? 'Edit food' : 'Custom food'}</h3><form method="dialog"><label>Name<input name="name" required maxlength="60" value="${esc(f.name)}"></label>
    ${[['k', 'Calories per 100 g'], ['p', 'Protein per 100 g'], ['c', 'Carbs per 100 g'], ['f', 'Fat per 100 g']].map(([k, l]) => `<label>${l}<input name="${k}" inputmode="decimal" required value="${f[k] ?? ''}"></label>`).join('')}
    <label>Weight of one piece in g (optional)<input name="pg" inputmode="decimal" value="${f.units?.piece?.g ?? ''}"></label><label>Piece name (egg, slice…)<input name="pl" maxlength="20" value="${esc(f.units?.piece?.label ?? '')}"></label>
    <div class="row">${f.edited ? '<button value="reset" formnovalidate class="danger">Reset</button>' : '<button value="x" formnovalidate>Cancel</button>'}<button value="ok" class="btn">Save</button></div></form>`);
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue === 'reset') { await S.del('foods/' + f.id); await loadFoods(); return render(); }
    if (dlg.returnValue !== 'ok') return;
    const x = new FormData(dlg.querySelector('form')), n = k => parseFloat(String(x.get(k)).replace(',', '.')) || 0, pg = n('pg');
    const units = { ...(f.units || {}) }; if (pg) units.piece = { g: pg, label: x.get('pl').trim() || 'piece' }; else delete units.piece;
    await S.set('foods/' + (f.id || 'c_' + Date.now().toString(36)), { name: x.get('name').trim(), k: n('k'), p: n('p'), c: n('c'), f: n('f'), units, updatedAt: Date.now() });
    toast('Saved'); await loadFoods(); render();
  });
}
function targets() {
  const sec = (title, s) => `<fieldset><legend><b>${title}</b></legend>${[['kcal', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g), optional'], ['fat', 'Fat (g), optional']].map(([k, l]) => `<label>${l}<input name="${k}${s}" inputmode="numeric" value="${cfg[k + s] || ''}" placeholder="0"></label>`).join('')}</fieldset>`;
  const dlg = sheet(`<h3>Daily targets</h3><p class="muted">A training day is a day you log a workout. Every other day uses the rest-day targets.</p><form method="dialog">${sec('Training day', 'Train')}${sec('Rest day', 'Rest')}
    <label>Moroccan spoon (m3l9a) in grams of honey<input name="spoonG" inputmode="decimal" value="${cfg.spoonG}"></label><label>Glass size (ml)<input name="glassMl" inputmode="numeric" value="${cfg.glassMl}"></label>
    <div class="row"><button value="x" formnovalidate>Cancel</button><button value="ok" class="btn">Save targets</button></div></form>`);
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue !== 'ok') return; const patch = {};
    for (const [k, v] of new FormData(dlg.querySelector('form'))) patch[k] = parseFloat(String(v).replace(',', '.')) || 0;
    if (!patch.spoonG) patch.spoonG = 12; if (!patch.glassMl) patch.glassMl = 250;
    cfg = await S.patchSettings(patch); toast('Targets saved'); render();
  });
}

async function ana(el) {
  const to = today(), from = shift(to, -(Math.max(range, 30) - 1));
  const logs = Object.fromEntries((await S.listRange('foodLogs', from, to)).map(l => [l.id, sum(l.slots.flatMap(s => s.items))]));
  const ms = Object.fromEntries((await S.listRange('measurements', from, to)).filter(m => m.fields?.weight).map(m => [m.id, m.fields.weight]));
  const days = Array.from({ length: Math.max(range, 30) }, (_, i) => shift(from, i)), shown = days.slice(-range);
  const avg = (arr, f) => { const a = arr.map(f).filter(x => x != null); return a.length ? r1(a.reduce((x, y) => x + y, 0) / a.length) : '–'; };
  const roll = (key, i) => { const a = days.slice(Math.max(0, i - 6), i + 1).map(key).filter(x => x != null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const kc = d => logs[d]?.k ?? null, pr = d => logs[d]?.p ?? null, wg = d => ms[d] ?? null;
  const A = days.map((d, i) => ({ d, a: roll(kc, i), w: roll(wg, i) })).filter(x => x.a != null && x.w != null);
  const bkt = range > 30 ? 7 : 1, vals = []; for (let i = 0; i < shown.length; i += bkt) { const v = avg(shown.slice(i, i + bkt), kc); vals.push(v === '–' ? 0 : Math.round(v)); }
  const mx = Math.max(1, ...vals), cal = vals.map(n => `<i style="height:${Math.max(3, n / mx * 100)}%" title="${n}"></i>`).join('');
  const x0 = A.length && A[0].d, span = A.length > 1 ? new Date(A[A.length - 1].d) - new Date(x0) || 1 : 1;
  const norm = (k, c) => { if (A.length < 2) return ''; const v = A.map(a => a[k]), lo = Math.min(...v), hi = Math.max(...v); return `<polyline fill="none" stroke="${c}" stroke-width="2.5" points="${A.map(a => `${(24 + (new Date(a.d) - new Date(x0)) / span * 272).toFixed(1)},${(120 - (hi === lo ? .5 : (a[k] - lo) / (hi - lo)) * 96).toFixed(1)}`).join(' ')}"/>`; };
  el.innerHTML = `<div class="chips">${[[14, '14 days'], [30, '30 days'], [90, '90 days']].map(([d, l]) => `<button class="chip${d === range ? ' on' : ''}" data-rg="${d}">${l}</button>`).join('')}</div>
    <div class="card grid"><div><b>${avg(days.slice(-7), kc)}</b><small>Avg kcal, 7 days</small></div><div><b>${avg(days.slice(-30), kc)}</b><small>Avg kcal, 30 days</small></div><div><b>${avg(days.slice(-7), pr)}</b><small>Avg protein, 7 days</small></div><div><b>${avg(days.slice(-30), pr)}</b><small>Avg protein, 30 days</small></div></div>
    <h2>Calories ${bkt > 1 ? '(weekly average)' : 'per day'}</h2><div class="card"><div class="bars">${cal}</div></div>
    <h2>Protein per day (g)</h2><div class="card">${line(shown.filter(d => pr(d) != null).map(d => ({ x: new Date(d).getTime(), y: pr(d) })), n => Math.round(n))}</div>
    <h2>7-day average calories vs weight</h2><div class="card">${A.length > 1 ? `<svg viewBox="0 0 320 140" class="ch" role="img" aria-label="Calories and weight trends">${norm('a', 'var(--acc)')}${norm('w', '#ff9f43')}</svg><p><span style="color:var(--acc)">●</span> Calories (${Math.round(A[0].a)} → ${Math.round(A[A.length - 1].a)}) &nbsp; <span style="color:#ff9f43">●</span> Weight (${r1(A[0].w)} → ${r1(A[A.length - 1].w)} ${cfg.weightUnit})</p><small class="muted">Each line is scaled to its own range, so compare the direction, not the height.</small>` : '<p class="muted">Log food and weigh-ins on a few days to see this.</p>'}</div>`;
}

import * as S from './store.js';
import { SEED } from './data.js';
import { tokens, slug } from './foods.js';
import { sheet, esc, toast, exName, loadCustom } from './views.js';

const $ = (s, r = document) => r.querySelector(s), TZ = 'Africa/Casablanca', r1 = n => Math.round(n * 10) / 10;
let cfg;
const dl = (name, text, type = 'text/csv') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
const ce = x => { const s = String(x ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => rows.map(r => r.map(ce).join(',')).join('\n');
const day = () => new Date().toISOString().slice(0, 10);

function parseCSV(t) {
  const first = t.split('\n')[0], d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',', rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === d) { r.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); c = ''; rows.push(r); r = []; } else c += ch;
  }
  if (c || r.length) { r.push(c); rows.push(r); }
  return rows.filter(x => x.length > 1 || x[0]);
}

export async function toolsView(v) {
  cfg = await S.getSettings();
  v.innerHTML = `<header class="top"><h1>Tools</h1></header>
    <div class="card"><h3>Plate calculator</h3><div class="fgrid"><label>Target weight (${cfg.weightUnit})<input id="pt" inputmode="decimal" value="100"></label><label>Bar weight<input id="pb" inputmode="decimal" value="${cfg.barWeight}"></label></div>
      <label>Plates you have (each side)<input id="pp" value="${cfg.plates.join(', ')}"></label><div id="pr" class="big2"></div></div>
    <div class="card"><h3>1RM calculator</h3><div class="fgrid"><label>Weight<input id="rw" inputmode="decimal" value="100"></label><label>Reps<input id="rr" inputmode="numeric" value="5"></label></div><div id="ro"></div></div>
    <div class="card"><h3>Warm-up formula</h3><label>Percent × reps<input id="wf" value="${cfg.warmupSteps.map(s => s.p + 'x' + s.r).join(', ')}"></label><label>Round weights to<input id="wr" inputmode="decimal" value="${cfg.rounding}"></label><button class="btn2" data-t="wf">Save</button></div>
    <h2>Export</h2><div class="card"><button class="btn2" data-t="xw">Workouts CSV (Hevy layout)</button><button class="btn2" data-t="xb">Body measurements CSV</button><button class="btn2" data-t="xf">Food log CSV</button><button class="btn2" data-t="xj">Full JSON backup</button>
      <p class="muted"><small>The Hevy layout follows the column names I know (title, start_time, end_time, exercise_title, set_index, set_type, weight_kg, reps, distance_km, duration_seconds, rpe). I could not check Hevy's current file, so the order or date format may differ slightly.</small></p></div>
    <h2>Import and restore</h2><div class="card"><button class="btn2" data-t="ic">Import Hevy or Strong CSV</button><button class="btn2" data-t="ij">Restore from JSON backup</button><button class="btn2 danger" data-t="undo">Undo last CSV import</button>
      <input type="file" id="fcsv" accept=".csv,text/csv" hidden><input type="file" id="fjson" accept=".json,application/json" hidden></div>`;
  const plateCalc = () => {
    const t = parseFloat($('#pt').value.replace(',', '.')), bar = parseFloat($('#pb').value.replace(',', '.')) || 0, av = $('#pp').value.split(/[,\s]+/).map(parseFloat).filter(x => x > 0).sort((a, b) => b - a);
    if (!t || t < bar) { $('#pr').textContent = 'Enter a target above the bar weight.'; return; }
    let side = Math.round((t - bar) / 2 * 1e4) / 1e4; const out = [];
    av.forEach(p => { while (side + 1e-6 >= p) { out.push(p); side = Math.round((side - p) * 1e4) / 1e4; } });
    $('#pr').innerHTML = `${out.length ? out.join(' + ') : 'No plates'} <small class="muted">per side</small>${side > 1e-6 ? `<br><small class="err">Closest possible: ${r1(t - side * 2)} ${cfg.weightUnit} (${r1(side * 2)} short)</small>` : ''}`;
  };
  const orm = () => {
    const w = parseFloat($('#rw').value.replace(',', '.')), r = parseInt($('#rr').value);
    if (!w || !r || r < 1 || r > 30) { $('#ro').textContent = ''; return; }
    const e = w * (1 + r / 30), b = r < 37 ? w * 36 / (37 - r) : 0;
    $('#ro').innerHTML = `<p class="big2">${r1(e)} ${cfg.weightUnit} <small class="muted">Epley${b ? ' · Brzycki ' + r1(b) : ''}</small></p><table class="rt2">${[95, 90, 85, 80, 75, 70, 60].map(p => `<tr><td>${p}%</td><td>${r1(e * p / 100)} ${cfg.weightUnit}</td></tr>`).join('')}</table>`;
  };
  ['pt', 'pb', 'pp'].forEach(i => $('#' + i).oninput = plateCalc); ['rw', 'rr'].forEach(i => $('#' + i).oninput = orm); plateCalc(); orm();
  $('#pb').onchange = async () => { cfg = await S.patchSettings({ barWeight: parseFloat($('#pb').value) || 20 }); };
  $('#pp').onchange = async () => { const p = $('#pp').value.split(/[,\s]+/).map(parseFloat).filter(x => x > 0); if (p.length) cfg = await S.patchSettings({ plates: p }); };
  $('#fcsv').onchange = e => e.target.files[0] && importCSV(e.target.files[0]); $('#fjson').onchange = e => e.target.files[0] && restoreJSON(e.target.files[0]);
  v.onclick = async e => {
    const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return;
    try {
      if (t === 'wf') {
        const st = $('#wf').value.split(',').map(s => s.trim().toLowerCase().split('x').map(parseFloat)).filter(a => a[0] > 0 && a[1] > 0).map(a => ({ p: a[0], r: a[1] }));
        if (!st.length) return toast('Use the format 50x10, 70x5, 85x2');
        cfg = await S.patchSettings({ warmupSteps: st, rounding: parseFloat($('#wr').value.replace(',', '.')) || 2.5 }); toast('Saved');
      } else if (t === 'xw') await exportWorkouts(); else if (t === 'xb') await exportBody(); else if (t === 'xf') await exportFood(); else if (t === 'xj') await S.downloadBackup();
      else if (t === 'ic') $('#fcsv').click(); else if (t === 'ij') $('#fjson').click(); else if (t === 'undo') await undoImport();
    } catch (err) { toast(S.errMsg(err)); }
  };
}

// ---------- Export ----------
async function exportWorkouts() {
  await loadCustom(); const kg = cfg.weightUnit === 'lb' ? .45359237 : 1, km = cfg.distUnit === 'mi' ? 1.609344 : 1;
  const fmt = ts => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  const rows = [['title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes', 'set_index', 'set_type', 'weight_kg', 'reps', 'distance_km', 'duration_seconds', 'rpe']];
  (await S.list('workouts')).sort((a, b) => a.startTs - b.startTs).forEach(w => w.exercises.forEach(x => x.sets.forEach((s, i) =>
    rows.push([w.title, fmt(w.startTs), fmt(w.endTs), w.notes || '', exName(x.exerciseId), x.supersetId || '', x.notes || '', i, s.type === 'drop' ? 'dropset' : s.type, s.weight != null ? r1(s.weight * kg * 100) / 100 : '', s.reps ?? '', s.distance != null ? r1(s.distance * km * 100) / 100 : '', s.duration ?? '', s.rpe ?? '']))));
  dl(`my-lifts-workouts-${day()}.csv`, csv(rows)); toast(`Exported ${rows.length - 1} sets.`);
}
async function exportBody() {
  const ms = (await S.list('measurements')).sort((a, b) => (a.id < b.id ? -1 : 1)), keys = [...new Set(ms.flatMap(m => Object.keys(m.fields || {})))];
  dl(`my-lifts-body-${day()}.csv`, csv([['date', ...keys], ...ms.map(m => [m.id, ...keys.map(k => m.fields?.[k] ?? '')])])); toast(`Exported ${ms.length} entries.`);
}
async function exportFood() {
  const rows = [['date', 'meal', 'food', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g']];
  (await S.list('foodLogs')).sort((a, b) => (a.id < b.id ? -1 : 1)).forEach(d => d.slots.forEach(s => s.items.forEach(i => rows.push([d.id, s.name, i.n, i.g, i.k, i.p, i.c, i.f]))));
  dl(`my-lifts-food-${day()}.csv`, csv(rows)); toast(`Exported ${rows.length - 1} food entries.`);
}

// ---------- Import (Hevy / Strong CSV) with preview and undo ----------
const wDate = s => { let d = new Date(s); if (isNaN(d)) { const m = String(s).match(/(\d{1,2}) (\w{3}) (\d{4}),? (\d{1,2}):(\d{2})/); if (m) d = new Date(`${m[1]} ${m[2]} ${m[3]} ${m[4]}:${m[5]}`); } return isNaN(d) ? null : d.getTime(); };
const wDur = s => { const h = /(\d+)\s*h/.exec(s), m = /(\d+)\s*m/.exec(s); return ((h ? +h[1] : 0) * 60 + (m ? +m[1] : 0)) * 6e4 || null; };
async function importCSV(file) {
  await loadCustom(); const rows = parseCSV(await file.text()), head = rows[0].map(h => h.trim().toLowerCase().replace(/^\ufeff/, '')), col = n => head.findIndex(h => n.includes(h));
  const C = { title: col(['title', 'workout name']), start: col(['start_time', 'date']), end: col(['end_time']), dur: col(['duration']), ex: col(['exercise_title', 'exercise name']), type: col(['set_type']),
    w: col(['weight_kg', 'weight']), reps: col(['reps']), dist: col(['distance_km', 'distance']), sec: col(['duration_seconds', 'seconds']), rpe: col(['rpe']) }, hevy = head.includes('weight_kg');
  if (C.start < 0 || C.ex < 0) return toast('Could not find the date and exercise columns. Is this a Hevy or Strong export?');
  const lib = [...SEED, ...(await S.list('exercises'))].map(e => ({ id: e.id, t: tokens(e.name) })), cache = {}, fresh = new Set();
  const match = n => cache[n] ||= (() => { const q = tokens(n); let best = null, bs = 0; lib.forEach(e => { let i = 0; q.forEach(x => e.t.has(x) && i++); const s = i / (q.size + e.t.size - i); if (s > bs) { bs = s; best = e; } }); if (bs >= .7) return best.id; fresh.add(n); return 'c_imp_' + slug(n); })();
  const groups = new Map(); let sets = 0;
  rows.slice(1).forEach(r => {
    const k = (r[C.title] || 'Workout') + '|' + r[C.start]; if (!groups.has(k)) groups.set(k, { title: r[C.title] || 'Workout', start: wDate(r[C.start]), end: C.end >= 0 ? wDate(r[C.end]) : null, dur: C.dur >= 0 ? wDur(r[C.dur]) : null, ex: new Map() });
    const g = groups.get(k), n = r[C.ex]; if (!n) return; const id = match(n), num = i => { const x = parseFloat(String(r[i] ?? '').replace(',', '.')); return i >= 0 && !isNaN(x) ? x : null; };
    const kgf = hevy && cfg.weightUnit === 'lb' ? 1 / .45359237 : 1, kmf = hevy && cfg.distUnit === 'mi' ? 1 / 1.609344 : 1, ty = (r[C.type] || 'normal').toLowerCase();
    if (!g.ex.has(id)) g.ex.set(id, []);
    g.ex.get(id).push({ type: ty === 'dropset' ? 'drop' : ['warmup', 'failure'].includes(ty) ? ty : 'normal', weight: num(C.w) != null ? r1(num(C.w) * kgf * 100) / 100 : null, reps: num(C.reps), duration: num(C.sec), distance: num(C.dist) != null ? num(C.dist) * kmf : null, rpe: num(C.rpe), done: true }); sets++;
  });
  const ws = [...groups.values()].filter(g => g.start);
  if (!ws.length) return toast('No workouts with a readable date were found.');
  const d = sheet(`<h3>Import preview</h3><p><b>${ws.length}</b> workouts · <b>${sets}</b> sets · <b>${fresh.size}</b> new exercises</p><p class="muted">Detected: ${hevy ? 'Hevy' : 'Strong or generic'} layout. Weights are read as ${hevy ? 'kg and converted to your unit' : 'already in your unit'}.</p>
    ${fresh.size ? `<p>These will be created as custom exercises (set their muscle later): <small>${[...fresh].slice(0, 12).map(esc).join(', ')}${fresh.size > 12 ? '…' : ''}</small></p>` : ''}<div class="row"><button value="x">Cancel</button><button class="btn" data-go>Import</button></div>`);
  d.onclick = async e => {
    if (e.target.value === 'x') return d.close();
    if (!('go' in e.target.dataset)) return; e.target.disabled = true;
    const batch = 'b' + Date.now().toString(36); let n = 0; const latest = {};
    for (const n2 of fresh) await S.set('exercises/c_imp_' + slug(n2), { name: n2, equipment: 'Other', primary: 'cardio', secondary: [], type: 'wr', note: 'Imported. Edit to set the muscle.', importBatch: batch, updatedAt: Date.now() });
    for (const g of ws) {
      const end = g.end || (g.dur ? g.start + g.dur : g.start + 60 * 6e4), exercises = [...g.ex].map(([exerciseId, s]) => ({ exerciseId, notes: '', restSec: 90, sets: s }));
      await S.set(`workouts/imp_${batch}_${n++}`, { title: g.title, startTs: g.start, endTs: end, routineId: null, notes: '', exercises, importBatch: batch });
      exercises.forEach(x => { if (!latest[x.exerciseId] || latest[x.exerciseId].t < g.start) latest[x.exerciseId] = { t: g.start, sets: x.sets }; });
    }
    for (const [id, o] of Object.entries(latest)) if (!(await S.get('exerciseStats/' + id))) await S.set('exerciseStats/' + id, { importBatch: batch, records: {}, history: [], lastRoutineSets: {}, lastSets: o.sets.map(({ weight, reps, duration, distance }) => ({ weight, reps, duration, distance })) });
    await S.set('meta/lastImport', { batch, count: n, at: Date.now() }); d.close(); toast(`Imported ${n} workouts. You can undo it from this page.`);
  };
}
async function undoImport() {
  const m = await S.get('meta/lastImport'); if (!m) return toast('Nothing to undo.');
  if (!confirm(`Remove the ${m.count} workouts from your last import?`)) return;
  for (const c of ['workouts', 'exercises', 'exerciseStats']) for (const d of await S.list(c)) if (d.importBatch === m.batch) await S.del(`${c}/${d.id}`);
  await S.del('meta/lastImport'); toast('Import undone.');
}
async function restoreJSON(file) {
  let j; try { j = JSON.parse(await file.text()); } catch { return toast('That is not a valid JSON file.'); }
  if (j.app !== 'my-lifts' || !j.data) return toast('This is not a My Lifts backup.');
  if (j.schemaVersion > S.SCHEMA_VERSION) return toast('This backup is from a newer app version. Update the app first.');
  const n = Object.entries(j.data).filter(([c]) => c !== 'meta').reduce((a, [, l]) => a + l.length, 0);
  if (!confirm(`Restore ${n} items? They are merged into your data, and items with the same ID are overwritten. Download a backup of your current data first?`)) return;
  await S.downloadBackup();
  for (const [c, l] of Object.entries(j.data)) { if (c === 'meta') continue; for (const { id, ...d } of l) await S.set(`${c}/${id}`, d); }
  toast(`Restored ${n} items.`);
}

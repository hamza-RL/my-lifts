import * as S from './store.js';
import { hasActive, historyHtml, showWorkout, importStart } from './workout.js';
import { bodyView } from './measure.js';
import { toolsView } from './tools.js';
import { homeView } from './home.js';
import { foodView } from './food.js';
import { loadDemo, removeDemo } from './demo.js';
import { statsView } from './stats.js';
import { seedOnce, exercisesView, workoutView } from './views.js';

const $ = (s, r = document) => r.querySelector(s), root = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let settings, reg, version = '…', refreshing = false;

const VOL = [['off', 'Off'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High']];
const FIELDS = [
  ['theme', 'Theme', 'select', [['dark', 'Dark'], ['light', 'Light']]],
  ['weightUnit', 'Weight unit', 'select', [['kg', 'kg'], ['lb', 'lb']]],
  ['distUnit', 'Distance unit', 'select', [['km', 'km'], ['mi', 'mi']]],
  ['weekStart', 'Week starts on', 'select', [['mon', 'Monday'], ['sun', 'Sunday']]],
  ['restOn', 'Automatic rest timer', 'check'],
  ['restBig', 'Rest on big lifts (seconds)', 'num'],
  ['restSmall', 'Rest on small exercises (seconds)', 'num'],
  ['timerSound', 'Timer sound', 'select', [['beep', 'Beep'], ['chime', 'Chime'], ['none', 'None']]],
  ['timerVolume', 'Timer volume', 'select', VOL],
  ['setSound', 'Sound when a set is checked', 'check'],
  ['prVolume', 'New record notification volume', 'select', VOL],
  ['keepAwake', 'Keep screen awake during workouts', 'check'],
  ['rpe', 'Log RPE', 'check'],
  ['warmupCalc', 'Warm-up calculator', 'check'],
  ['rounding', 'Round weights to', 'num'],
  ['barWeight', 'Bar weight', 'num'],
  ['warmupInStats', 'Include warm-up sets in stats', 'check'],
  ['previousFrom', 'Previous values come from', 'select',
    [['exercise', 'Last workout with this exercise'], ['routine', 'Last workout of this routine']]]
];
const IC = d => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const TABS = [['home', IC('M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10'), 'Home'], ['workout', IC('M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12'), 'Workout'],
  ['exercises', IC('M4 6h16M4 12h16M4 18h10'), 'Exercises'], ['food', IC('M7 3v8M11 3v8M7 7h4M9 11v10M17 3c-2 2-2 8 0 9v9'), 'Food'],
  ['profile', IC('M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6'), 'Profile']];
const soon = (t, p) => v => { v.innerHTML = `<h1>${t}</h1><div class="card">Coming in ${p}.</div>`; };
const views = { home: homeView, workout: workoutView, exercises: exercisesView, stats: statsView, body: bodyView, tools: toolsView, food: foodView, profile };

function toast(m) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = m; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 3500);
}
function ask(title, fields) {
  return new Promise(res => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3>${fields.map(([n, l, t]) =>
      `<label>${esc(l)}<input name="${n}" type="${t || 'text'}" required autocomplete="off"></label>`).join('')}
      <div class="row"><button value="x" formnovalidate>Cancel</button><button value="ok" class="btn">Save</button></div></form>`;
    document.body.append(d); d.showModal();
    d.onclose = () => { res(d.returnValue === 'ok' ? Object.fromEntries(new FormData(d.querySelector('form'))) : null); d.remove(); };
  });
}
function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  try { localStorage.setItem('ml-theme', settings.theme); } catch { /* ignore */ }
}
const fatal = e => { root.innerHTML = `<main class="center"><div class="card"><h2>Something went wrong</h2>
  <p class="err">${esc(S.errMsg(e))}</p><button class="btn" onclick="location.reload()">Try again</button></div></main>`; };

// ---------- Auth screen ----------
function showAuth() {
  let m = 'in';
  const draw = () => {
    root.innerHTML = `<main class="center"><h1>My Lifts</h1><form id="af" class="card"><div class="seg"><button type="button" data-m="in" class="${m === 'in' ? 'on' : ''}">Sign in</button><button type="button" data-m="up" class="${m === 'up' ? 'on' : ''}">Create account</button></div>
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      ${m === 'reset' ? '' : `<label>Password<input name="pw" type="password" required minlength="6" autocomplete="${m === 'in' ? 'current-password' : 'new-password'}"></label>`}
      <p id="err" class="err" role="alert"></p>
      <button class="btn">${{ in: 'Sign in', up: 'Create account', reset: 'Send reset email' }[m]}</button>
      <p class="links"><a href="#" data-m="reset">Forgot password?</a></p></form></main>`;
    root.querySelectorAll('[data-m]').forEach(a => a.onclick = e => { e.preventDefault(); m = a.dataset.m; draw(); });
    $('#af').onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target)), b = $('#af .btn');
      b.disabled = true; $('#err').textContent = '';
      try {
        if (m === 'in') await S.signIn(f.email, f.pw);
        else if (m === 'up') await S.signUp(f.email, f.pw);
        else { await S.resetPassword(f.email); toast('Reset email sent. Check your inbox.'); }
      } catch (err) { $('#err').textContent = S.errMsg(err); }
      b.disabled = false;
    };
  };
  draw();
}

// ---------- Shell and router ----------
function shell() {
  root.innerHTML = `<div id="view"></div><nav aria-label="Main">${TABS.map(([k, i, l]) =>
    `<a href="#/${k}" data-k="${k}"><span aria-hidden="true">${i}</span>${l}</a>`).join('')}</nav>`;
  route();
}
async function route() {
  const v = $('#view'); if (!v) return;
  const k = location.hash.slice(2) || 'home', key = views[k] ? k : 'home';
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.k === (['stats', 'body', 'tools'].includes(key) ? 'profile' : key)));
  v.innerHTML = ''; v.onclick = v.oninput = null;
  try { await views[key](v); } catch (e) { v.innerHTML = `<p class="err">${esc(S.errMsg(e))}</p>`; }
}
addEventListener('hashchange', route);
addEventListener('toast', e => toast(e.detail));
// Never fail silently: show any unexpected save/load error.
addEventListener('unhandledrejection', e => { console.error(e.reason); toast(S.errMsg(e.reason)); });
addEventListener('store-error', e => toast(S.errMsg(e.detail)));

async function profile(v) {
  const u = S.user();
  const field = ([k, l, t, o]) => `<label class="${t === 'check' ? 'chk' : ''}"><span>${esc(l)}</span>` + (t === 'select'
    ? `<select data-k="${k}">${o.map(([a, b]) => `<option value="${a}"${a === settings[k] ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>`
    : t === 'check' ? `<input type="checkbox" data-k="${k}"${settings[k] ? ' checked' : ''}>`
      : `<input type="number" inputmode="decimal" step="any" min="0" data-k="${k}" value="${esc(settings[k])}">`) + '</label>';
  v.innerHTML = `<h1>Profile</h1><a class="card resume" href="#/stats"><b>Statistics, calendar and reviews</b><br><span class="muted">Charts, muscle map, records</span></a><a class="card resume" href="#/body"><b>Body measurements and photos</b><br><span class="muted">Weight, waist, progress photos</span></a><a class="card resume" href="#/tools"><b>Tools, export and import</b><br><span class="muted">Plate calculator, 1RM, CSV, backup</span></a><h2>Settings</h2><form id="sf" class="card">${FIELDS.map(field).join('')}</form>
    <h2>Account</h2><div class="card">${u ? `<p>${esc(u.email)}</p>
      <button class="btn2" data-a="email">Change email</button><button class="btn2" data-a="pw">Change password</button>
      <button class="btn2" data-a="out">Sign out</button><button class="btn2 danger" data-a="del">Delete account and all data</button>`
      : '<p class="muted">Demo mode: no account yet.</p>'}</div>
    <h2>Data</h2><div class="card"><button class="btn2" data-a="backup">Download JSON backup</button><button class="btn2" data-a="seed">Import my starting numbers</button><button class="btn2" data-a="demo">Load a year of demo data</button><button class="btn2 danger" data-a="undemo">Delete demo data</button></div>
    <h2>About</h2><div class="card"><p>App version: <b id="ver">${esc(version)}</b><br>Data schema version: <b>${S.SCHEMA_VERSION}</b><br>
      Mode: ${S.cloudConfigured ? 'Cloud sync' : 'Demo (this device only)'}</p><button class="btn2" data-a="check">Check for updates</button></div>`;
  $('#sf').onchange = async e => {
    const el = e.target, k = el.dataset.k; if (!k) return;
    const t = FIELDS.find(f => f[0] === k)[2];
    settings[k] = t === 'check' ? el.checked : t === 'num' ? (parseFloat(el.value) || 0) : el.value;
    settings = await S.patchSettings({ [k]: settings[k] });
    if (k === 'theme') applyTheme();
    toast('Saved');
  };
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-a]'); if (!a) return;
  const k = a.dataset.a;
  try {
    if (k === 'backup') await S.downloadBackup();
    else if (k === 'check') { await reg?.update(); toast('You are up to date, or an update banner will appear.'); }
    else if (k === 'upd') { refreshing = true; reg.waiting?.postMessage('skip'); }
    else if (k === 'seed') toast(`Imported ${await importStart()} exercises`);
    else if (k === 'demo') { if (confirm('Add a year of fake workouts, food and weigh-ins? They are tagged as demo and can be deleted in one tap.')) { toast('Creating demo data…'); const r = await loadDemo(); toast(`Added ${r.workouts} workouts, ${r.foodDays} food days, ${r.weighIns} weigh-ins.`); } }
    else if (k === 'undemo') { if (confirm('Delete ONLY the demo data? Your real data stays.')) { toast('Deleting…'); const r = await removeDemo(); toast(`Deleted ${Object.values(r).reduce((x, y) => x + y, 0)} demo items.`); } }
    else if (k === 'out') await S.logOut();
    else if (k === 'upload') {
      if (confirm('Upload local data to your account and clear the local copy?')) { toast(`Uploaded ${await S.uploadLocal()} items`); route(); }
    } else if (k === 'email') {
      const r = await ask('Change email', [['email', 'New email', 'email'], ['pw', 'Current password', 'password']]);
      if (r) { await S.changeEmail(r.email, r.pw); toast('Check your new inbox to confirm the change.'); }
    } else if (k === 'pw') {
      const r = await ask('Change password', [['o', 'Current password', 'password'], ['n', 'New password', 'password']]);
      if (r) { await S.changePassword(r.o, r.n); toast('Password changed.'); }
    } else if (k === 'del') {
      if (!confirm('Delete your account and ALL your data permanently? This cannot be undone.')) return;
      const r = await ask('Confirm with your password', [['pw', 'Password', 'password']]);
      if (r) { await S.deleteAccount(r.pw); toast('Account deleted.'); }
    }
  } catch (err) { toast(S.errMsg(err)); }
});

// ---------- Service worker and "update available" ----------
function banner() {
  if ($('#upd')) return;
  const d = document.createElement('div'); d.id = 'upd';
  d.innerHTML = '<span>A new version is available.</span><button data-a="upd">Update</button>';
  document.body.prepend(d);
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(r => {
    if (!r) return;
    reg = r;
    if (r.waiting && navigator.serviceWorker.controller) banner();
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) banner(); });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update(); });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) location.reload(); });
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.version) { version = e.data.version; const el = $('#ver'); if (el) el.textContent = version; }
  });
  navigator.serviceWorker.ready.then(r => r.active.postMessage('version'));
}

// ---------- Start ----------
S.watchAuth(async u => {
  try {
    if (S.cloudConfigured && !u) return showAuth();
    if (!(await S.ensureSchema()).ok) {
      root.innerHTML = '<main class="center"><div class="card"><h2>Please update the app</h2><p>Your data was saved by a newer version. Reload the page to get it.</p></div></main>';
      return;
    }
    await seedOnce(); settings = await S.getSettings(); applyTheme(); shell();
  } catch (e) { fatal(e); }
}).catch(fatal);

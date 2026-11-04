import { firebaseConfig as C, FIREBASE_VERSION as V } from './firebase-config.js';

export const SCHEMA_VERSION = 1;
export const cloudConfigured = !!C.apiKey;
export const COLLECTIONS = ['settings', 'exercises', 'routineFolders', 'routines', 'workouts', 'exerciseStats',
  'activeWorkout', 'measurements', 'photoMeta', 'photoData', 'foodLogs', 'foods', 'savedMeals', 'meta'];
const USER_DATA = ['exercises', 'routineFolders', 'routines', 'workouts', 'exerciseStats', 'measurements', 'photoMeta', 'photoData', 'foodLogs', 'foods', 'savedMeals'];

// New settings added in future versions only need a default here: old data keeps working.
export const DEFAULT_SETTINGS = {
  theme: 'dark', weightUnit: 'kg', distUnit: 'km', weekStart: 'mon', timezone: 'Africa/Casablanca',
  restOn: true, restBig: 150, restSmall: 90, timerSound: 'beep', timerVolume: 'normal', setSound: true,
  prVolume: 'normal', keepAwake: true, bgTimer: false, restNote: true, rpe: false, warmupCalc: true, warmupSteps: [{ p: 50, r: 10 }, { p: 70, r: 5 }, { p: 85, r: 2 }],
  rounding: 2.5, barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], warmupInStats: false, previousFrom: 'exercise',
  // Nutrition (used from its own phase): training-day and rest-day targets, Moroccan spoon (m3l9a) in grams, glass in ml
  kcalTrain: 0, proteinTrain: 0, carbsTrain: 0, fatTrain: 0, kcalRest: 0, proteinRest: 0, carbsRest: 0, fatRest: 0, spoonG: 12, glassMl: 250, customFields: []
};

// ---------- Local store (demo mode + offline drafts), IndexedDB ----------
let dbp;
const idb = () => dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open('mylifts', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('docs');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction('docs', mode), out = fn(t.objectStore('docs'));
    t.oncomplete = () => res(Array.isArray(out) ? out.map(r => r.result) : out.result);
    t.onerror = () => rej(t.error);
  });
};
const local = {
  get: async p => (await tx('readonly', s => s.get(p))) ?? null,
  set: (p, d) => tx('readwrite', s => s.put(d, p)),
  del: p => tx('readwrite', s => s.delete(p)),
  async list(c) {
    const r = IDBKeyRange.bound(c + '/', c + '0');
    const [k, v] = await tx('readonly', s => [s.getAllKeys(r), s.getAll(r)]);
    return k.map((key, i) => ({ id: key.slice(c.length + 1), ...v[i] }));
  }
};

// ---------- Cloud store (Firestore under users/{uid}/...) ----------
let fb, db, auth, uid, mode = 'local';
const ref = p => fb.doc(db, 'users', uid, ...p.split('/'));
const cref = c => fb.collection(db, 'users', uid, c);
const fail = e => window.dispatchEvent(new CustomEvent('store-error', { detail: e }));
const cloud = {
  async get(p) { const s = await fb.getDoc(ref(p)); return s.exists() ? s.data() : null; },
  // Writes go to the offline cache first and sync in the background, so they never block the UI.
  set(p, d) { fb.setDoc(ref(p), d).catch(fail); return Promise.resolve(); },
  del(p) { fb.deleteDoc(ref(p)).catch(fail); return Promise.resolve(); },
  async list(c) { return (await fb.getDocs(cref(c))).docs.map(d => ({ id: d.id, ...d.data() })); }
};
const be = () => (mode === 'cloud' ? cloud : local);
export const get = p => be().get(p);
// Firestore rejects lists inside lists and undefined values. Check every write the same way in demo mode too,
// so a problem is found and reported here instead of failing silently in the cloud.
const normSteps = a => (a || []).map(x => (Array.isArray(x) ? { p: x[0], r: x[1] } : x));
function check(v, path) {
  if (Array.isArray(v)) v.forEach((x, i) => { if (Array.isArray(x)) throw new Error(`Cannot save: list inside a list at ${path}[${i}]`); check(x, `${path}[${i}]`); });
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (x === undefined) throw new Error(`Cannot save: undefined value at ${path}.${k}`); check(x, `${path}.${k}`); }
}
export const set = (p, d) => { if (p === 'settings/main' && d?.warmupSteps) d = { ...d, warmupSteps: normSteps(d.warmupSteps) }; check(d, p); return be().set(p, d); };
export const del = p => be().del(p);
export const list = c => be().list(c);
export async function listRange(c, a, b) { // documents whose id is between a and b (dates), so charts read only what they need
  if (mode === 'cloud') return (await fb.getDocs(fb.query(cref(c), fb.where(fb.documentId(), '>=', a), fb.where(fb.documentId(), '<=', b)))).docs.map(d => ({ id: d.id, ...d.data() }));
  return (await local.list(c)).filter(d => d.id >= a && d.id <= b);
}
export const user = () => auth?.currentUser || null;

export async function watchAuth(cb) {
  if (!cloudConfigured) { mode = 'local'; return cb(null); }
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const mods = await Promise.all(['app', 'firestore', 'auth'].map(m => import(`${base}firebase-${m}.js`)));
  fb = Object.assign({}, ...mods);
  const app = fb.initializeApp(C);
  db = fb.initializeFirestore(app, {
    localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() })
  });
  auth = fb.getAuth(app);
  fb.onAuthStateChanged(auth, u => { uid = u?.uid; mode = u ? 'cloud' : 'local'; cb(u); });
}

// ---------- Schema version, migrations, settings ----------
// Add migrations as MIGRATIONS[2] = async () => {...}. Each must be safe to run on old data.
const MIGRATIONS = {};
export async function ensureSchema() {
  const m = await get('meta/app');
  if (!m) { await set('meta/app', { schemaVersion: SCHEMA_VERSION, createdAt: Date.now() }); return { ok: true }; }
  const v = m.schemaVersion || 1;
  if (v > SCHEMA_VERSION) return { ok: false };
  if (v < SCHEMA_VERSION) {
    if (confirm('My Lifts needs to update how your data is stored. Download a backup first? (Recommended)')) await downloadBackup();
    for (let n = v + 1; n <= SCHEMA_VERSION; n++) await MIGRATIONS[n]?.();
    await set('meta/app', { ...m, schemaVersion: SCHEMA_VERSION, migratedAt: Date.now() });
  }
  return { ok: true };
}
export const getSettings = async () => { const s = { ...DEFAULT_SETTINGS, ...((await get('settings/main')) || {}) }; s.warmupSteps = normSteps(s.warmupSteps); return s; };
export const saveSettings = s => set('settings/main', s);
// Saves only the keys you pass (never overwrites other settings with stale values).
export async function patchSettings(p) { const n = { ...(await getSettings()), ...p }; await set('settings/main', n); return n; }

// ---------- Backup and demo-to-cloud upload ----------
export async function exportAll() {
  const out = { app: 'my-lifts', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: {} };
  for (const c of COLLECTIONS) out.data[c] = await list(c);
  return out;
}
const stamp = () => { try { localStorage.setItem('mylifts-lastbackup', String(Date.now())); } catch { /* ignore */ } };
export const lastBackup = () => { try { return +localStorage.getItem('mylifts-lastbackup') || 0; } catch { return 0; } };
export function saveFile(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const bname = () => `my-lifts-backup-${new Date().toISOString().slice(0, 10)}.json`;
export async function downloadBackup() { saveFile(await exportAll(), bname()); stamp(); }
// Opens the phone's share sheet so the backup can go to Google Drive, email, WhatsApp, etc.
export async function shareBackup() {
  const file = new File([JSON.stringify(await exportAll(), null, 1)], bname(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'My Lifts backup' }); stamp(); return true; }
  await downloadBackup(); return false;
}
// Puts a backup file's data into the account you are logged in to. Same ids are overwritten, nothing else is deleted.
export async function importBackup(o) {
  if (o?.app !== 'my-lifts' || !o.data) throw new Error('This is not a My Lifts backup file.');
  let n = 0;
  for (const c of COLLECTIONS) {
    if (c === 'meta' || c === 'activeWorkout') continue;
    for (const { id, ...d } of o.data[c] || []) { if (d.warmupSteps) d.warmupSteps = normSteps(d.warmupSteps); await be().set(`${c}/${id}`, d); n++; }
  }
  return n;
}
// Safety copy kept inside this phone's browser, separate from your account. It survives a lost login.
const sdb = () => new Promise((res, rej) => { const r = indexedDB.open('mylifts-safe', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const sget = async k => { const d = await sdb(); return new Promise((res, rej) => { const r = d.transaction('s').objectStore('s').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); };
const sput = async (k, v) => { const d = await sdb(); return new Promise((res, rej) => { const t = d.transaction('s', 'readwrite'); t.objectStore('s').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
const count = o => Object.entries(o.data).reduce((a, [c, l]) => a + (USER_DATA.includes(c) ? l.length : 0), 0);
export async function autoSnapshot() {
  let at = 0; try { at = +localStorage.getItem('mylifts-snap') || 0; } catch { /* ignore */ }
  if (Date.now() - at < 12 * 36e5) return;
  const o = await exportAll(), n = count(o); if (!n) return;
  await sput('last', o);
  const best = await sget('best'); if (!best || n >= count(best)) await sput('best', o);
  try { localStorage.setItem('mylifts-snap', String(Date.now())); } catch { /* ignore */ }
}
export async function deviceSnapshots() { return { last: await sget('last'), best: await sget('best') }; }
export async function localCount() {
  let n = 0;
  for (const c of USER_DATA) n += (await local.list(c)).length;
  return n;
}
export async function uploadLocal() {
  let b = fb.writeBatch(db), n = 0;
  for (const c of COLLECTIONS) {
    if (c === 'meta') continue;
    for (const { id, ...d } of await local.list(c)) {
      if (d.warmupSteps) d.warmupSteps = normSteps(d.warmupSteps);
      b.set(ref(`${c}/${id}`), d);
      if (++n % 400 === 0) { await b.commit(); b = fb.writeBatch(db); }
    }
  }
  await b.commit(); // needs a connection; throws if offline, so local data is kept
  await tx('readwrite', s => s.clear());
  return n;
}

// ---------- Auth ----------
const ERR = {
  'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.', 'auth/email-already-in-use': 'That email already has an account.',
  'auth/weak-password': 'Use a password of at least 6 characters.', 'auth/invalid-email': 'That email address looks wrong.',
  'auth/network-request-failed': 'No connection. Try again when you are online.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes.',
  'auth/requires-recent-login': 'Sign out, sign in again, then retry.',
  'permission-denied': 'Permission denied. Check the Firestore rules in the Firebase console.'
};
export const errMsg = e => (ERR[e?.code] ? ERR[e.code] + (String(e.code).startsWith('auth/') ? ` [${e.code}]` : '') : e?.message || String(e));
export const signIn = (e, p) => fb.signInWithEmailAndPassword(auth, e, p);
export const signUp = (e, p) => fb.createUserWithEmailAndPassword(auth, e, p);
export const resetPassword = e => fb.sendPasswordResetEmail(auth, e);
export const logOut = () => fb.signOut(auth);

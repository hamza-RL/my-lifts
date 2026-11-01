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
  prVolume: 'normal', keepAwake: true, rpe: false, warmupCalc: true, warmupSteps: [[50, 10], [70, 5], [85, 2]],
  rounding: 2.5, barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], warmupInStats: false, previousFrom: 'exercise',
  // Nutrition (used from its own phase): training-day and rest-day targets, Moroccan spoon (m3l9a) in grams, glass in ml
  kcalTrain: 0, proteinTrain: 0, carbsTrain: 0, fatTrain: 0, kcalRest: 0, proteinRest: 0, carbsRest: 0, fatRest: 0, spoonG: 12, glassMl: 250
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
export const set = (p, d) => be().set(p, d);
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
export const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...((await get('settings/main')) || {}) });
export const saveSettings = s => set('settings/main', s);

// ---------- Backup and demo-to-cloud upload ----------
export async function exportAll() {
  const out = { app: 'my-lifts', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: {} };
  for (const c of COLLECTIONS) out.data[c] = await list(c);
  return out;
}
export async function downloadBackup() {
  const blob = new Blob([JSON.stringify(await exportAll(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `my-lifts-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
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
export const errMsg = e => ERR[e?.code] || e?.message || String(e);
export const signIn = (e, p) => fb.signInWithEmailAndPassword(auth, e, p);
export const signUp = (e, p) => fb.createUserWithEmailAndPassword(auth, e, p);
export const resetPassword = e => fb.sendPasswordResetEmail(auth, e);
export const logOut = () => fb.signOut(auth);
const reauth = pw => fb.reauthenticateWithCredential(auth.currentUser,
  fb.EmailAuthProvider.credential(auth.currentUser.email, pw));
export async function changeEmail(email, pw) { await reauth(pw); await fb.verifyBeforeUpdateEmail(auth.currentUser, email); }
export async function changePassword(oldPw, newPw) { await reauth(oldPw); await fb.updatePassword(auth.currentUser, newPw); }
export async function deleteAccount(pw) {
  await reauth(pw);
  for (const c of COLLECTIONS) {
    let b = fb.writeBatch(db), n = 0;
    for (const d of (await fb.getDocs(cref(c))).docs) {
      b.delete(d.ref);
      if (++n % 400 === 0) { await b.commit(); b = fb.writeBatch(db); }
    }
    await b.commit();
  }
  await fb.deleteUser(auth.currentUser);
}

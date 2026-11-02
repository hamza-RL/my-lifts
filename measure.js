import * as S from './store.js';
import { sheet, esc, toast } from './views.js';

const $ = (s, r = document) => r.querySelector(s), TZ = 'Africa/Casablanca', DAY = 864e5, r1 = n => Math.round(n * 10) / 10;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const FIELDS = [['weight', 'Weight', ''], ['bodyFat', 'Body fat', '%'], ['neck', 'Neck', 'cm'], ['shoulders', 'Shoulders', 'cm'], ['chest', 'Chest', 'cm'], ['waist', 'Waist', 'cm'], ['hips', 'Hips', 'cm'],
  ['bicepL', 'Left biceps', 'cm'], ['bicepR', 'Right biceps', 'cm'], ['forearm', 'Forearms', 'cm'], ['thigh', 'Thighs', 'cm'], ['calf', 'Calves', 'cm']];
let V, cfg, tab = 'm', metric = 'weight', rng = 1e5, date = today(), pf = '', sel = null;
const fields = () => [...FIELDS.map(([k, l, u]) => [k, l, k === 'weight' ? cfg.weightUnit : u]), ...(cfg.customFields || []).map(f => [f.k, f.l, f.u])];

export async function bodyView(v) {
  V = v; cfg = await S.getSettings(); v.onclick = onClick; v.onchange = onChange; render();
}
async function render() {
  V.innerHTML = `<header class="top"><h1>Body</h1></header><div class="seg">${[['m', 'Measurements'], ['p', 'Photos']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="bb"></div>`;
  await (tab === 'm' ? meas : photos)($('#bb'));
}

// ---------- Measurements ----------
function chart(raw, avg) {
  if (raw.length < 2) return '<p class="muted">Add at least two entries to see a chart.</p>';
  const W = 320, H = 160, p = 28, all = [...raw, ...avg], xs = raw.map(q => q.x), mn = Math.min(...xs), mx = Math.max(...xs), lo = Math.min(...all.map(q => q.y)), hi = Math.max(...all.map(q => q.y));
  const X = t => p + (mx === mn ? 0 : (t - mn) / (mx - mn)) * (W - 2 * p), Y = y => H - p - (hi === lo ? .5 : (y - lo) / (hi - lo)) * (H - 2 * p), pl = a => a.map(q => X(q.x).toFixed(1) + ',' + Y(q.y).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="Measurement chart">${raw !== avg && raw.length <= 90 ? raw.map(q => `<circle cx="${X(q.x)}" cy="${Y(q.y)}" r="3" fill="var(--mut)"/>`).join('') : ''}
    <polyline fill="none" stroke="var(--acc)" stroke-width="3" stroke-linejoin="round" points="${pl(avg)}"/><text x="4" y="12" class="ct">${r1(hi)}</text><text x="4" y="${H - 6}" class="ct">${r1(lo)}</text></svg>`;
}
async function meas(el) {
  const ms = (await S.list('measurements')).sort((a, b) => (a.id < b.id ? -1 : 1)), cur = ms.find(m => m.id === date), fl = fields();
  const have = fl.filter(([k]) => ms.some(m => m.fields?.[k] != null)); if (!have.some(h => h[0] === metric)) metric = have[0]?.[0] || 'weight';
  const pts = ms.filter(m => m.fields?.[metric] != null && new Date(m.id) >= Date.now() - rng * DAY).map(m => ({ x: new Date(m.id).getTime(), y: m.fields[metric] }));
  const avg = metric === 'weight' ? pts.map(q => { const w = pts.filter(o => o.x <= q.x && o.x > q.x - 7 * DAY); return { x: q.x, y: w.reduce((a, o) => a + o.y, 0) / w.length }; }) : pts;
  el.innerHTML = `<div class="card"><label>Date<input type="date" id="md" value="${date}" max="${today()}"></label>
    <div class="fgrid">${fl.map(([k, l, u]) => `<label>${esc(l)}${u ? ' (' + esc(u) + ')' : ''}<input data-mf="${esc(k)}" inputmode="decimal" value="${cur?.fields?.[k] ?? ''}"></label>`).join('')}</div>
    <button class="btn2" data-cf>+ Add custom field (e.g. ankle gap)</button><div class="row">${cur ? '<button class="danger" data-md>Delete entry</button>' : ''}<button class="btn" data-ms>Save</button></div></div>
    <h2>Progress</h2><div class="chips">${have.map(([k, l]) => `<button class="chip${k === metric ? ' on' : ''}" data-mt="${esc(k)}">${esc(l)}</button>`).join('') || '<span class="muted">Save a first entry to see charts.</span>'}</div>
    <div class="chips">${[[30, '1M'], [90, '3M'], [180, '6M'], [365, '1Y'], [1e5, 'All']].map(([k, l]) => `<button class="chip${k === rng ? ' on' : ''}" data-rg="${k}">${l}</button>`).join('')}</div>
    <div class="card">${chart(pts, avg)}${metric === 'weight' && pts.length > 1 ? '<p class="muted"><small>Dots are your weigh-ins. The line is the 7-day average, which smooths scale noise.</small></p>' : ''}</div>
    <h2>Entries</h2>${[...ms].reverse().slice(0, 40).map(m => `<button class="item" data-ed="${m.id}"><span><b>${m.id}</b><small>${fl.filter(([k]) => m.fields?.[k] != null).slice(0, 4).map(([k, l, u]) => `${esc(l)} ${m.fields[k]}${u ? ' ' + esc(u) : ''}`).join(' · ')}</small></span></button>`).join('') || '<p class="muted">No entries yet.</p>'}`;
}

// ---------- Photos ----------
async function compress(file) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }); }
  const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight, big = Math.max(w0, h0);
  const mk = (px, q) => { const sc = Math.min(1, px / big), c = document.createElement('canvas'); c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return [c.toDataURL('image/jpeg', q), c.width, c.height]; };
  let q = .7, r = mk(1000, q); while (r[0].length > 700000 && q > .35) { q -= .1; r = mk(1000, q); } // stay well under Firestore's 1 MiB document limit
  return { data: r[0], w: r[1], h: r[2], thumb: mk(180, .6)[0] };
}
async function photos(el) {
  const ps = (await S.list('photoMeta')).sort((a, b) => (a.date < b.date ? 1 : -1)).filter(p => !pf || p.angle === pf), byDate = {};
  ps.forEach(p => (byDate[p.date] ||= []).push(p));
  el.innerHTML = `<button class="btn big" data-pa>+ Add progress photos</button>
    <div class="chips">${[['', 'All'], ['front', 'Front'], ['side', 'Side'], ['back', 'Back']].map(([k, l]) => `<button class="chip${k === pf ? ' on' : ''}" data-pf="${k}">${l}</button>`).join('')}<button class="chip${sel ? ' on' : ''}" data-cmp>${sel ? 'Pick 2 photos…' : 'Compare'}</button></div>
    ${Object.entries(byDate).map(([d, l]) => `<h2>${d}</h2><div class="pgrid">${l.map(p => `<button class="ph${sel?.includes(p.id) ? ' sel' : ''}" data-ph="${esc(p.id)}"><img src="${p.thumb}" alt="${esc(p.angle)} photo, ${d}"><small>${esc(p.angle)}</small></button>`).join('')}</div>`).join('') || '<p class="muted">No photos yet. Take your first front, side and back photos so you can compare later.</p>'}
    <p class="muted"><small>Photos are compressed on your device (max 1000 px) and stored in your private account.</small></p>`;
}
function addPhoto() {
  let angle = 'front', pend = null, stream = null;
  const d = sheet(`<h3>Add progress photo</h3><div class="seg s3">${['front', 'side', 'back'].map(a => `<button data-an="${a}" class="${a === angle ? 'on' : ''}">${a[0].toUpperCase() + a.slice(1)}</button>`).join('')}</div>
    <label>Date<input type="date" id="pd" value="${today()}" max="${today()}"></label><label>Camera<select id="pc"><option value="environment">Rear camera</option><option value="user">Front camera</option></select></label>
    <button class="btn2 btn" data-c="cam">Take photo</button><button class="btn2" data-c="file">Choose from gallery</button>${navigator.mediaDevices?.getUserMedia ? '<button class="btn2" data-c="web">Use webcam</button>' : ''}
    <input type="file" id="fc" accept="image/*" capture="environment" hidden><input type="file" id="ff" accept="image/*" hidden><div id="pv"></div>`);
  const stop = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };
  d.addEventListener('close', stop);
  const preview = async f => {
    try { pend = await compress(f); } catch { return toast('Could not read that image.'); }
    $('#pv', d).innerHTML = `<h4>Preview</h4><img class="pvimg" src="${pend.data}" alt="Photo preview"><p class="muted">${pend.w}×${pend.h}px · ${Math.round(pend.data.length * .75 / 1024)} KB · <b>${angle}</b></p><div class="row"><button data-c="retake">Retake</button><button class="btn" data-c="save">Save photo</button></div>`;
  };
  $('#fc', d).onchange = $('#ff', d).onchange = e => e.target.files[0] && preview(e.target.files[0]);
  d.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.an) { angle = b.dataset.an; d.querySelectorAll('[data-an]').forEach(x => x.classList.toggle('on', x === b)); if (pend) $('#pv', d).querySelector('p b').textContent = angle; return; }
    const c = b.dataset.c;
    if (c === 'cam') { $('#fc', d).setAttribute('capture', $('#pc', d).value); $('#fc', d).click(); }
    else if (c === 'file') $('#ff', d).click();
    else if (c === 'retake') { pend = null; $('#pv', d).innerHTML = ''; }
    else if (c === 'web') {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: $('#pc', d).value } }); } catch { return toast('Camera not available. Use "Choose from gallery".'); }
      $('#pv', d).innerHTML = '<video autoplay playsinline muted class="pvimg"></video><button class="btn2 btn" data-c="snap">Capture</button>'; $('#pv', d).querySelector('video').srcObject = stream;
    } else if (c === 'snap') {
      const vd = $('#pv', d).querySelector('video'), cv = document.createElement('canvas'); cv.width = vd.videoWidth; cv.height = vd.videoHeight; cv.getContext('2d').drawImage(vd, 0, 0); stop();
      cv.toBlob(bl => preview(bl), 'image/jpeg', .92);
    } else if (c === 'save') {
      const id = 'p_' + Date.now().toString(36), dt = $('#pd', d).value || today();
      await S.set('photoData/' + id, { data: pend.data, updatedAt: Date.now() });
      await S.set('photoMeta/' + id, { date: dt, angle, w: pend.w, h: pend.h, thumb: pend.thumb, updatedAt: Date.now() });
      toast(`Saved ${angle} photo.`); pend = null; $('#pv', d).innerHTML = '<p class="muted">Saved. Take the next angle, or close this window.</p>';
      angle = { front: 'side', side: 'back', back: 'back' }[angle]; d.querySelectorAll('[data-an]').forEach(x => x.classList.toggle('on', x.dataset.an === angle)); render();
    }
  };
}
async function viewPhotos(ids) {
  const metas = await Promise.all(ids.map(id => S.get('photoMeta/' + id))), datas = await Promise.all(ids.map(id => S.get('photoData/' + id)));
  const wts = await Promise.all(metas.map(m => S.get('measurements/' + m.date)));
  const d = sheet(ids.length === 2 ? `<h3>Compare</h3><div class="cmp">${metas.map((m, i) => `<figure><img src="${datas[i]?.data || m.thumb}" alt="${esc(m.angle)} ${m.date}"><figcaption>${m.date} · ${esc(m.angle)}${wts[i]?.fields?.weight ? ' · ' + wts[i].fields.weight + ' ' + cfg.weightUnit : ''}</figcaption></figure>`).join('')}</div>`
    : `<h3>${esc(metas[0].angle)} · ${metas[0].date}</h3><img class="pvimg" src="${datas[0]?.data || metas[0].thumb}" alt="${esc(metas[0].angle)} photo"><button class="btn2 danger" data-del>Delete photo</button>`);
  d.onclick = async e => { if (!('del' in e.target.dataset) || !confirm('Delete this photo?')) return; d.close(); await S.del('photoMeta/' + ids[0]); await S.del('photoData/' + ids[0]); render(); };
}

async function onClick(e) {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.tab) { tab = d.tab; return render(); }
  if (d.mt) { metric = d.mt; return render(); }
  if (d.rg) { rng = +d.rg; return render(); }
  if (d.ed) { date = d.ed; return render(); }
  if (d.pf !== undefined) { pf = d.pf; return render(); }
  if ('pa' in d) return addPhoto();
  if ('cmp' in d) { sel = sel ? null : []; return render(); }
  if (d.ph) { if (sel) { sel = sel.includes(d.ph) ? sel.filter(x => x !== d.ph) : [...sel, d.ph]; if (sel.length === 2) { const two = sel; sel = null; await render(); return viewPhotos(two); } return render(); } return viewPhotos([d.ph]); }
  if ('md' in d) { if (confirm('Delete this entry?')) { await S.del('measurements/' + date); render(); } return; }
  if ('cf' in d) {
    const dlg = sheet('<h3>Custom measurement</h3><form method="dialog"><label>Name<input name="l" required maxlength="30" placeholder="Ankle gap"></label><label>Unit<input name="u" maxlength="8" value="cm"></label><div class="row"><button value="x" formnovalidate>Cancel</button><button value="ok" class="btn">Add</button></div></form>');
    dlg.addEventListener('close', async () => { if (dlg.returnValue !== 'ok') return; const f = new FormData(dlg.querySelector('form')), l = f.get('l').trim(); if (!l) return;
      cfg = await S.patchSettings({ customFields: [...(cfg.customFields || []), { k: 'x_' + l.toLowerCase().replace(/[^a-z0-9]+/g, '_'), l, u: f.get('u').trim() }] }); render(); });
    return;
  }
  if ('ms' in d) {
    const dt = $('#md').value || today(), old = (await S.get('measurements/' + dt)) || {}, { demo, ...o } = old, f = { ...(o.fields || {}) };
    document.querySelectorAll('[data-mf]').forEach(i => { const n = parseFloat(i.value.replace(',', '.')); if (i.value.trim() === '') delete f[i.dataset.mf]; else if (n >= 0) f[i.dataset.mf] = n; });
    if (!Object.keys(f).length) return toast('Enter at least one value.');
    await S.set('measurements/' + dt, { ...o, date: dt, fields: f, updatedAt: Date.now() }); date = dt; toast('Saved'); render();
  }
}
function onChange(e) { if (e.target.id === 'md') { date = e.target.value || today(); render(); } }

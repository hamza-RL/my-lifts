// A small floating timer window (picture-in-picture) that stays on top of other apps, plus a silent rest notification.
// It plays no audio, so it does not stop your music.
const pad = n => String(n).padStart(2, '0');
const fmt = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
let cv, cx, vid, tm, endT, st = { title: 'Workout', startTs: 0, restEnd: 0 };

export const supported = () => { const v = document.createElement('video'); return !!(document.pictureInPictureEnabled || v.webkitSupportsPresentationMode?.('picture-in-picture')) && !!HTMLCanvasElement.prototype.captureStream; };
export const info = (title, startTs) => { st.title = title; st.startTs = startTs; };

function draw() {
  const left = st.restEnd ? Math.ceil((st.restEnd - Date.now()) / 1000) : 0, over = st.restEnd && left <= 0 && Date.now() - st.restEnd < 8000;
  const resting = left > 0;
  cx.fillStyle = over ? '#1f8f4e' : resting ? '#7a2e12' : '#16181d'; cx.fillRect(0, 0, 480, 270);
  cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.font = '600 34px system-ui, sans-serif'; cx.fillText(st.title, 240, 42);
  cx.font = '700 120px system-ui, sans-serif'; cx.fillText(over ? 'GO' : resting ? fmt(left) : fmt((Date.now() - st.startTs) / 1000), 240, 140);
  cx.font = '500 28px system-ui, sans-serif'; cx.fillStyle = 'rgba(255,255,255,.8)';
  cx.fillText(over ? 'Rest is over' : resting ? 'Rest' : 'Workout time', 240, 232);
}

export async function open() {
  if (!cv) { cv = document.createElement('canvas'); cv.width = 480; cv.height = 270; cx = cv.getContext('2d'); }
  if (!vid) {
    vid = document.createElement('video'); vid.muted = true; vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.srcObject = cv.captureStream(5);
    vid.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.append(vid);
  }
  draw(); await vid.play();
  if (vid.requestPictureInPicture) await vid.requestPictureInPicture(); else vid.webkitSetPresentationMode('picture-in-picture');
  clearInterval(tm); tm = setInterval(draw, 500);
}
export function close() {
  clearInterval(tm); tm = null;
  try { if (document.pictureInPictureElement) document.exitPictureInPicture(); else vid?.webkitSetPresentationMode?.('inline'); } catch { /* ignore */ }
}

const reg = () => navigator.serviceWorker?.ready;
const hide = async () => { try { (await (await reg())?.getNotifications({ tag: 'rest' }))?.forEach(n => n.close()); } catch { /* ignore */ } };
export function askPerm() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ } }

// Call when a rest starts or is changed. end = time the rest ends (ms), 0 = no rest.
export async function rest(end, title, cfg) {
  clearTimeout(endT); st.restEnd = end; st.title = title;
  if (!end || cfg.restNote === false || !('Notification' in window) || Notification.permission !== 'granted') return;
  const r = await reg(); if (!r) return;
  const at = new Date(end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  r.showNotification(`${title}: resting`, { body: `Rest ends at ${at}`, tag: 'rest', silent: true, icon: 'icon-192.png', badge: 'icon-192.png' });
  endT = setTimeout(() => { // only works while the phone keeps the app alive (it does while the floating window is open)
    if (!document.hidden) return hide();
    r.showNotification('Rest is over', { body: `${title}: next set`, tag: 'rest', renotify: true, vibrate: [300, 120, 300, 120, 600], icon: 'icon-192.png', badge: 'icon-192.png' });
  }, Math.max(0, end - Date.now()));
}
export function cancelRest() { clearTimeout(endT); st.restEnd = 0; hide(); }
export function end() { cancelRest(); close(); }

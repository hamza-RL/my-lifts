// Rest timer that keeps running when you leave the app.
// It plays one real audio track: silence for the rest time, then three beeps. The phone plays audio in the
// background, so the beeps arrive on time. A media notification (like Spotify) shows the workout and the rest.
const RATE = 8000, pad = n => String(n).padStart(2, '0');
const fmt = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
let au = null, url = null;

function wav(secs, gain, hz) {
  const n = Math.round((secs + 1.3) * RATE), buf = new Uint8Array(44 + n), dv = new DataView(buf.buffer), s0 = Math.round(secs * RATE);
  const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, RATE, true); dv.setUint32(28, RATE, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    let v = 128 + (i & 1); // inaudible, but not pure silence, so the phone keeps treating it as playing audio
    if (gain && i >= s0) {
      const t = (i - s0) / RATE, k = t % .45;
      if (t < 1.2 && k < .25) v = 128 + Math.round(Math.sin(2 * Math.PI * hz * t) * 127 * gain * Math.min(1, k / .01, (.25 - k) / .01));
    }
    buf[44 + i] = v;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export const active = () => !!au && !au.paused && !au.ended;
export function askPerm() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ } }

export function stop() {
  if (au) { au.onended = au.ontimeupdate = null; au.pause(); au.removeAttribute('src'); au.load(); au = null; }
  if (url) { URL.revokeObjectURL(url); url = null; }
  const ms = navigator.mediaSession;
  if (ms) { try { ms.playbackState = 'none'; ms.metadata = null; ['pause', 'stop', 'nexttrack', 'previoustrack'].forEach(a => ms.setActionHandler(a, null)); } catch { /* unsupported */ } }
}

// secs = rest time left, name = workout title (for example "Push B"), h = { skip(), add(seconds) }
export function start(secs, name, cfg, h) {
  stop();
  const vol = { off: 0, low: .1, normal: .3, high: .8 }[cfg.timerVolume] ?? .3, gain = cfg.timerSound === 'none' ? 0 : vol;
  url = URL.createObjectURL(wav(secs, gain, cfg.timerSound === 'chime' ? 880 : 660));
  const a = au = new Audio(url), end = Date.now() + secs * 1000, ms = navigator.mediaSession;
  if (ms) {
    try {
      ms.metadata = new MediaMetadata({ title: `Rest ${fmt(secs)}`, artist: name, album: 'My Lifts',
        artwork: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
      ms.setActionHandler('pause', () => h.skip()); ms.setActionHandler('stop', () => h.skip());
      ms.setActionHandler('nexttrack', () => h.add(15)); ms.setActionHandler('previoustrack', () => h.add(-15));
    } catch { /* unsupported */ }
  }
  a.ontimeupdate = () => { // keeps the notification title counting down while the app is in the background
    if (ms?.metadata) { const t = `Rest ${fmt(Math.max(0, Math.ceil((end - Date.now()) / 1000)))}`; if (ms.metadata.title !== t) ms.metadata.title = t; }
  };
  a.onended = () => {
    const hidden = document.hidden; stop();
    if (hidden) {
      navigator.vibrate?.([300, 120, 300, 120, 600]);
      try { if (Notification.permission === 'granted') navigator.serviceWorker.ready.then(r => r.showNotification('Rest is over', { body: `${name}: next set`, tag: 'rest', renotify: true, vibrate: [300, 120, 300, 120, 600], icon: 'icon-192.png', badge: 'icon-192.png' })); } catch { /* ignore */ }
    }
  };
  a.play().then(() => { if (ms) { try { ms.playbackState = 'playing'; ms.setPositionState?.({ duration: secs + 1.3, position: 0, playbackRate: 1 }); } catch { /* ignore */ } } })
    .catch(() => stop()); // blocked (no tap yet): the on-screen timer still works
}

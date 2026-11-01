import * as S from './store.js';
import { esc, toast, sheet } from './views.js';

let weightChart = null;

export async function bodyView(v) {
  const measurements = (await S.list('measurements')).sort((a, b) => b.ts - a.ts);
  const photos = (await S.list('photoMeta')).sort((a, b) => b.ts - a.ts);

  v.innerHTML = `
    <header class="top"><h1>Body & Tools</h1><button class="btn2" id="openPlateCalc" style="width:auto; margin:0;">Plate Calc 🏋️</button></header>
    <h2>Weight & Measurements</h2>
    <div class="card">
      <button class="btn" id="addLogBtn">+ Log Body Measurement</button>
      <div style="position:relative; height:200px; width:100%; margin-top:16px;">
        <canvas id="bodyWeightChart"></canvas>
      </div>
    </div>
    <h2>Progress Photos</h2>
    <div class="card">
      <input type="file" id="photoInput" accept="image/*" style="display:none;">
      <button class="btn2" onclick="document.getElementById('photoInput').click()">📷 Take / Upload Progress Photo</button>
      <div class="photo-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:12px;">
        ${photos.map(p => `<img src="${p.dataUrl}" style="width:100%; border-radius:12px; height:100px; object-fit:cover;">`).join('') || '<p class="muted">No photos logged yet.</p>'}
      </div>
    </div>
  `;

  $('#openPlateCalc').onclick = showPlateCalculator;
  $('#addLogBtn').onclick = () => showLogModal(v);
  $('#photoInput').onchange = (e) => handlePhotoUpload(e.target.files[0], v);

  renderWeightChart(measurements);
}

async function handlePhotoUpload(file, v) {
  if (!file) return;
  toast('Compressing image on device...');
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 800;
      let width = img.width, height = img.height;
      if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedData = canvas.toDataURL('image/jpeg', 0.65);
      const id = 'photo_' + Date.now().toString(36);
      await S.set('photoMeta/' + id, { ts: Date.now(), dataUrl: compressedData });
      toast('Photo saved!');
      bodyView(v);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderWeightChart(measurements) {
  const ctx = document.getElementById('bodyWeightChart')?.getContext('2d');
  if (!ctx || !measurements.length) return;
  if (weightChart) weightChart.destroy();

  const sorted = [...measurements].reverse();
  const labels = sorted.map(m => new Date(m.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  const rawWeights = sorted.map(m => m.weight);

  const avgWeights = rawWeights.map((val, idx, arr) => {
    const start = Math.max(0, idx - 6);
    const subset = arr.slice(start, idx + 1);
    return Math.round((subset.reduce((a, b) => a + b, 0) / subset.length) * 10) / 10;
  });

  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Weight', data: rawWeights, borderColor: '#8b96a4', borderDash: [4, 4], pointRadius: 2 },
        { label: '7-Day Avg', data: avgWeights, borderColor: '#4cc2ff', borderWidth: 2, pointRadius: 0 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }
  });
}

export function showPlateCalculator() {
  const d = sheet(`
    <h3>Plate Calculator</h3>
    <label>Target Weight (total kg)<input type="number" id="targetW" value="60" step="2.5"></label>
    <label>Barbell Weight<input type="number" id="barW" value="20"></label>
    <div id="plateResults" class="card" style="text-align:center; font-weight:700;"></div>
  `);

  const calc = () => {
    const target = parseFloat($('#targetW', d).value) || 0;
    const bar = parseFloat($('#barW', d).value) || 0;
    let sideWeight = (target - bar) / 2;
    if (sideWeight <= 0) { $('#plateResults', d).textContent = 'Load bar only (no plates)'; return; }

    const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
    const loaded = [];
    availablePlates.forEach(p => {
      while (sideWeight >= p) {
        loaded.push(p);
        sideWeight -= p;
      }
    });

    $('#plateResults', d).innerHTML = `Plates per side:<br><span style="color:var(--acc); font-size:1.4rem;">${loaded.join(' kg, ') || 'None'} kg</span>`;
  };

  $('#targetW', d).oninput = calc;
  $('#barW', d).oninput = calc;
  calc();
}

function showLogModal(v) {
  const d = sheet(`
    <h3>Log Body Measurement</h3>
    <label>Body Weight (kg)<input type="number" id="bwVal" step="0.1"></label>
    <label>Waist Circumference (cm)<input type="number" id="waistVal" step="0.5"></label>
    <button class="btn" id="saveBodyLog">Save</button>
  `);
  $('#saveBodyLog', d).onclick = async () => {
    const w = parseFloat($('#bwVal', d).value);
    if (!w) return toast('Enter body weight');
    await S.set('measurements/m_' + Date.now().toString(36), {
      ts: Date.now(),
      weight: w,
      waist: parseFloat($('#waistVal', d).value) || null
    });
    d.close();
    toast('Measurement logged');
    bodyView(v);
  };
}
import * as S from './store.js';
import { esc, toast, sheet } from './views.js';
import { FOOD_DATABASE } from './food-data.js';

export async function nutritionView(v) {
  const settings = await S.getSettings();
  const todayKey = new Date().toISOString().slice(0, 10);
  const logs = (await S.get('foodLogs/' + todayKey)) || { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] } };

  // Support both array structure and meal categories structure
  if (!logs.meals) {
    logs.meals = { breakfast: logs.items || [], lunch: [], dinner: [], snacks: [] };
  }

  const allItems = [...(logs.meals.breakfast || []), ...(logs.meals.lunch || []), ...(logs.meals.dinner || []), ...(logs.meals.snacks || [])];
  const totals = allItems.reduce((acc, item) => {
    acc.kcal += item.kcal || 0;
    acc.protein += item.protein || 0;
    acc.carbs += item.carbs || 0;
    acc.fat += item.fat || 0;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const isRest = new Date().getDay() === 0 || new Date().getDay() === 5; // e.g. Friday/Sunday rest
  const targetKcal = isRest ? (settings.kcalRest || 2100) : (settings.kcalTrain || 2400);
  const targetProt = isRest ? (settings.proteinRest || 150) : (settings.proteinTrain || 160);

  v.innerHTML = `
    <header class="top"><h1>Nutrition & Macros</h1></header>
    
    <div class="card" style="text-align:center;">
      <h2>Today's Intake (${isRest ? 'Rest Day' : 'Training Day'})</h2>
      <p style="font-size:2.2rem; font-weight:800; color:var(--acc); margin:4px 0;">${Math.round(totals.kcal)} / ${targetKcal} kcal</p>
      <div style="display:flex; justify-content:space-around; margin-top:12px;">
        <div><b>Protein</b><br>${Math.round(totals.protein)} / ${targetProt}g</div>
        <div><b>Carbs</b><br>${Math.round(totals.carbs)}g</div>
        <div><b>Fat</b><br>${Math.round(totals.fat)}g</div>
      </div>
    </div>

    <div class="card">
      <button class="btn" id="smartQuickAdd">+ Smart Natural Language Quick Add</button>
      <button class="btn2" id="addFoodBtn">+ Add Food from Database</button>
    </div>

    ${['breakfast', 'lunch', 'dinner', 'snacks'].map(meal => `
      <h2>${meal[0].toUpperCase() + meal.slice(1)}</h2>
      <div class="card">
        ${(logs.meals[meal] || []).map((item, idx) => `
          <div class="item" style="justify-content:space-between; display:flex; align-items:center;">
            <span><b>${esc(item.name)}</b><small>${item.amount}${item.unit} · ${Math.round(item.kcal)} kcal (${Math.round(item.protein)}g P)</small></span>
            <button class="danger" style="min-height:36px; padding:0 12px;" data-meal="${meal}" data-del="${idx}">X</button>
          </div>
        `).join('') || '<p class="muted">No items logged.</p>'}
      </div>
    `).join('')}
  `;

  $('#smartQuickAdd').onclick = () => showSmartModal(v, todayKey, logs);
  $('#addFoodBtn').onclick = () => showFoodSearchModal(v, todayKey, logs);

  v.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      const meal = b.dataset.meal;
      const idx = parseInt(b.dataset.del);
      logs.meals[meal].splice(idx, 1);
      await S.set('foodLogs/' + todayKey, logs);
      toast('Item removed');
      nutritionView(v);
    };
  });
}

function showSmartModal(v, todayKey, logs) {
  const d = sheet(`
    <h3>Smart Quick Add (Natural Language)</h3>
    <p class="muted">Type items like: <code>4 large eggs, 100g oats, 1 m3l9a honey</code></p>
    <textarea id="smartInput" placeholder="4 large eggs, 150g rice cooked..." rows="3" style="width:100%;"></textarea>
    <button class="btn" id="parseSmart" style="margin-top:12px;">Calculate & Add to Breakfast</button>
  `);

  $('#parseSmart', d).onclick = async () => {
    const text = $('#smartInput', d).value.toLowerCase();
    if (!text) return;

    // Rule-based matching engine
    const lines = text.split(/,|
/);
    lines.forEach(line => {
      const numMatch = line.match(/\d+(\.\d+)?/);
      const val = numMatch ? parseFloat(numMatch[0]) : 100;
      
      let matched = FOOD_DATABASE.find(f => line.includes(f.name.toLowerCase().split(' ')[0]));
      if (!matched && line.includes('egg')) matched = FOOD_DATABASE[0];
      if (!matched && line.includes('rice')) matched = FOOD_DATABASE[3];
      if (!matched && line.includes('oat')) matched = FOOD_DATABASE[2];
      if (!matched && line.includes('honey')) matched = FOOD_DATABASE[16];

      if (matched) {
        const ratio = matched.unit === '100g' || matched.unit === '100ml' ? val / 100 : val;
        logs.meals.breakfast.push({
          name: matched.name,
          amount: val,
          unit: matched.unit,
          kcal: Math.round(matched.kcal * ratio),
          protein: Math.round(matched.protein * ratio * 10) / 10,
          carbs: Math.round(matched.carbs * ratio * 10) / 10,
          fat: Math.round(matched.fat * ratio * 10) / 10
        });
      }
    });

    await S.set('foodLogs/' + todayKey, logs);
    d.close();
    toast('Added via Smart Parser!');
    nutritionView(v);
  };
}

function showFoodSearchModal(v, todayKey, logs) {
  const d = sheet(`
    <h3>Food Database</h3>
    <input id="fsearch" type="search" placeholder="Search food or Moroccan items...">
    <div id="fresults" style="max-height:300px; overflow-y:auto; margin-top:10px;"></div>
  `);

  const renderList = (filter = '') => {
    const res = FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(filter));
    $('#fresults', d).innerHTML = res.map(f => `
      <button class="item2" data-fid="${f.id}" style="width:100%; text-align:left; padding:10px; margin:4px 0; background:var(--s2); border-radius:8px; border:1px solid var(--line);">
        <b>${esc(f.name)}</b><small class="muted">${f.kcal} kcal per ${f.unit}</small>
      </button>
    `).join('');
  };

  renderList();
  $('#fsearch', d).oninput = (e) => renderList(e.target.value.toLowerCase());

  $('#fresults', d).onclick = async (e) => {
    const btn = e.target.closest('[data-fid]');
    if (!btn) return;
    const food = FOOD_DATABASE.find(f => f.id === btn.dataset.fid);
    d.close();

    const d2 = sheet(`
      <h3>Log ${esc(food.name)}</h3>
      <label>Amount (${food.unit})<input id="camt" type="number" value="${food.unit === '100g' ? 100 : 1}"></label>
      <label>Meal Time
        <select id="cmeal">
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snacks">Snacks</option>
        </select>
      </label>
      <button class="btn" id="saveLogItem">Save</button>
    `);

    $('#saveLogItem', d2).onclick = async () => {
      const amt = parseFloat($('#camt', d2).value) || 1;
      const meal = $('#cmeal', d2).value;
      const ratio = food.unit === '100g' ? amt / 100 : amt;

      logs.meals[meal].push({
        name: food.name,
        amount: amt,
        unit: food.unit,
        kcal: Math.round(food.kcal * ratio),
        protein: Math.round(food.protein * ratio * 10) / 10,
        carbs: Math.round(food.carbs * ratio * 10) / 10,
        fat: Math.round(food.fat * ratio * 10) / 10
      });

      await S.set('foodLogs/' + todayKey, logs);
      d2.close();
      toast('Food logged!');
      nutritionView(v);
    };
  };
}
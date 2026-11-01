export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const r1 = n => Math.round(n * 10) / 10;

// name|kcal|protein|carbs|fat (per 100 g) | units: p<g>:<label> piece, t<g> tablespoon, c<g> cup, l<g> 250 ml glass
// All values are approximate (mostly USDA-style averages); Moroccan dishes vary a lot by recipe, so edit them to match yours.
const RAW = `Egg whole (large, raw)|143|12.6|0.7|9.5|p50:large egg
Egg boiled (large)|155|12.6|1.1|10.6|p50:large egg
Egg fried (large)|196|13.6|0.8|14.8|p46:large egg
Egg white (raw)|52|10.9|0.7|0.2|p33:egg white
Egg yolk (raw)|322|15.9|3.6|26.5|p17:egg yolk
Milk whole|61|3.2|4.8|3.3|c244;l257
Milk semi-skimmed|46|3.4|4.8|1.5|c244;l257
Milk skimmed|34|3.4|5|0.1|c244;l257
Yogurt plain whole|61|3.5|4.7|3.3|p125:pot;c245
Yogurt plain low-fat|63|5.3|7|1.6|p125:pot;c245
Greek yogurt 0% fat|59|10.2|3.6|0.4|p150:pot;c245
Greek yogurt whole|97|9|4|5|p150:pot;c245
Skyr|63|11|4|0.2|p150:pot
Leben / raib (fermented milk)|60|3.3|4.5|3.3|l257
Cottage cheese|98|11.1|3.4|4.3|c225
Cheddar cheese|403|24.9|1.3|33.1|p28:slice
Mozzarella|280|28|3.1|17|p28:slice
Feta cheese|264|14.2|4.1|21.3|p30:piece
Cream cheese|342|5.9|4.1|34|t15
Processed cheese triangle|270|11|7|21|p17:triangle
Butter|717|0.9|0.1|81|t14
Smen (clarified butter)|876|0.3|0|99|t13
Whey protein powder|400|80|8|6|p30:scoop
Oats (dry)|379|13.2|67.7|6.5|c90;t10
Oats cooked (porridge, water)|71|2.5|12|1.5|c234
Granola|471|10|64|20|c60
Cornflakes|357|7|84|0.4|c28
Rice white (dry)|365|7.1|80|0.7|c185
Rice white (cooked)|130|2.7|28.2|0.3|c158
Rice brown (dry)|370|7.9|77.2|2.9|c190
Rice brown (cooked)|112|2.3|23.5|0.8|c195
Pasta (dry)|371|13|74.7|1.5|c100
Pasta (cooked)|158|5.8|30.9|0.9|c140
Couscous (dry)|376|12.8|77.4|0.6|c173
Couscous (cooked)|112|3.8|23.2|0.2|c157
Semolina (dry)|360|12.7|72.8|1.1|c167
Bulgur (dry)|342|12.3|75.9|1.3|c140
Bulgur (cooked)|83|3.1|18.6|0.2|c182
Quinoa (dry)|368|14.1|64.2|6.1|c170
Quinoa (cooked)|120|4.4|21.3|1.9|c185
Flour white (dry)|364|10|76|1|c125
Khobz (Moroccan bread)|265|8.5|52|2|p100:half loaf
Bread wholewheat|247|13|41|3.4|p28:slice
Bread white|265|9|49|3.2|p25:slice
Baguette|270|9|56|1|p60:piece
Batbout (Moroccan pita bread)|250|8|48|2|p60:piece
Harcha (semolina flatbread)|290|6|45|9|p90:piece
Tortilla wrap wheat|310|8|52|8|p45:piece
Rice cakes|387|8|82|2.8|p9:cake
Potato boiled|87|1.9|20.1|0.1|p170:medium
Potato raw|77|2|17.5|0.1|p170:medium
French fries|312|3.4|41|15|c120
Sweet potato raw|86|1.6|20.1|0.1|p130:medium
Sweet potato baked|90|2|20.7|0.2|p130:medium
Lentils (dry)|352|24.6|63.4|1.1|c192
Lentils (cooked)|116|9|20.1|0.4|c198
Chickpeas (dry)|364|19|61|6|c200
Chickpeas (cooked)|164|8.9|27.4|2.6|c164
Chickpeas canned (drained)|139|7.1|22.5|2.8|c164
White beans (cooked)|139|9.7|25|0.5|c179
Kidney beans (cooked)|127|8.7|22.8|0.5|c177
Black beans (cooked)|132|8.9|23.7|0.5|c172
Fava beans (cooked)|110|7.6|19.7|0.4|c170
Green peas|81|5.4|14.5|0.4|c145
Hummus|166|7.9|14.3|9.6|t15
Tofu firm|144|17.3|2.8|8.7|p85:slice
Peanut butter|588|25|20|50|t16
Chicken breast (raw)|120|22.5|0|2.6|p170:breast
Chicken breast (cooked)|165|31|0|3.6|p120:breast
Chicken thigh skinless (raw)|121|19.7|0|4.1|p90:thigh
Chicken thigh skinless (cooked)|179|24.8|0|8.2|p75:thigh
Turkey breast (raw)|114|24|0|1.5
Turkey breast (cooked)|150|29|0|3
Turkey mince (raw)|148|19|0|8
Beef mince 10% fat (raw)|176|20|0|10
Beef mince 20% fat (raw)|254|17.2|0|20
Beef steak lean (cooked)|206|29|0|9.2
Beef stew meat (cooked)|230|28|0|13
Lamb (cooked)|220|25|0|12
Goat meat (raw)|109|20|0|2.3
Goat meat (cooked)|143|27.1|0|3
Beef liver (cooked)|175|26.4|5.1|4.7
Kefta (seasoned beef mince, raw)|230|17|2|17|p40:ball
Merguez sausage|290|15|2|25|p60:sausage
Tuna canned in water|116|25.5|0|0.8|p110:can drained
Tuna canned in oil (drained)|198|29|0|8.2|p110:can drained
Sardines canned in oil|208|24.6|0|11.5|p90:can drained
Sardines fresh (raw)|135|18|0|6.5|p40:sardine
Salmon (raw)|208|20.4|0|13.4|p150:fillet
Salmon (cooked)|206|22|0|12|p140:fillet
Cod / hake white fish (raw)|82|17.8|0|0.7
Mackerel (raw)|205|18.6|0|13.9
Tilapia (raw)|96|20|0|1.7
Shrimp (cooked)|99|24|0.2|0.3
Calamari squid (raw)|92|15.6|3.1|1.4
Banana|89|1.1|22.8|0.3|p118:medium
Apple|52|0.3|13.8|0.2|p182:medium
Orange|47|0.9|11.8|0.1|p131:medium
Mandarin|53|0.8|13.3|0.3|p88:piece
Dates medjool|277|1.8|75|0.2|p24:date
Dates deglet noor|282|2.5|75|0.4|p8:date
Pomegranate (seeds)|83|1.7|18.7|1.2|c174
Grapes|69|0.7|18.1|0.2|c92
Strawberries|32|0.7|7.7|0.3|c152
Watermelon|30|0.6|7.6|0.2|c152
Melon cantaloupe|34|0.8|8.2|0.2|c160
Peach|39|0.9|9.5|0.3|p150:medium
Pear|57|0.4|15.2|0.1|p178:medium
Figs fresh|74|0.8|19.2|0.3|p50:fig
Figs dried|249|3.3|63.9|0.9|p19:fig
Avocado|160|2|8.5|14.7|p136:medium
Mango|60|0.8|15|0.4|c165
Pineapple|50|0.5|13.1|0.1|c165
Kiwi|61|1.1|14.7|0.5|p69:kiwi
Prickly pear|41|0.7|9.6|0.5|p100:piece
Raisins|299|3.1|79.2|0.5|c145
Lemon|29|1.1|9.3|0.3|p58:lemon
Olives|115|0.8|6|10.7|p4:olive
Olive oil|884|0|0|100|t13.5
Argan oil|884|0|0|100|t13.5
Sunflower oil|884|0|0|100|t13.5
Almonds|579|21.2|21.6|49.9|p1.2:almond;c143
Walnuts|654|15.2|13.7|65.2|p5:half;c100
Peanuts|567|25.8|16.1|49.2|c146
Cashews|553|18.2|30.2|43.9|c137
Pistachios|560|20.2|27.2|45.3|c123
Sunflower seeds|584|20.8|20|51.5|t9
Chia seeds|486|16.5|42.1|30.7|t12
Flaxseed|534|18.3|28.9|42.2|t10
Sesame seeds|573|17.7|23.5|49.7|t9
Tahini|595|17|21.2|53.8|t15
Amlou (almond-argan spread)|590|15|20|50|t16
Chocolate hazelnut spread|539|6.3|57.5|30.9|t18
Mayonnaise|680|1|0.6|75|t14
Dark chocolate 70%|598|7.8|45.9|42.6|p10:square
Milk chocolate|535|7.7|59.4|29.7|p10:square
Honey|304|0.3|82.4|0|t21
Sugar|387|0|100|0|t12.5
Jam|250|0.4|65|0.1|t20
Chebakia (honey sesame pastry)|450|7|55|22|p35:piece
Croissant|406|8.2|45.8|21|p60:piece
Biscuit (plain)|440|7|72|13|p7:biscuit
Cola|42|0|10.6|0|l258
Orange juice|45|0.7|10.4|0.2|l262
Water|0|0|0|0|l250
Coffee black|1|0.1|0|0|l250
Mint tea (no sugar)|1|0|0.2|0|l250
Creatine monohydrate|0|0|0|0|p5:scoop
Tomato|18|0.9|3.9|0.2|p123:medium
Cucumber|15|0.7|3.6|0.1|p200:medium
Onion|40|1.1|9.3|0.1|p110:medium
Carrot|41|0.9|9.6|0.2|p61:medium
Zucchini|17|1.2|3.1|0.3|p196:medium
Eggplant|25|1|5.9|0.2|p458:medium
Bell pepper|31|1|6|0.3|p119:medium
Spinach|23|2.9|3.6|0.4|c30
Lettuce|15|1.4|2.9|0.2|c36
Broccoli|34|2.8|6.6|0.4|c91
Cauliflower|25|1.9|5|0.3|c107
Cabbage|25|1.3|5.8|0.1|c89
Green beans|31|1.8|7|0.2|c110
Mushrooms|22|3.1|3.3|0.3|c70
Garlic|149|6.4|33|0.5|p3:clove
Pumpkin|26|1|6.5|0.1|c116
Turnip|28|0.9|6.4|0.1|p122:medium
Beetroot|43|1.6|9.6|0.2|p82:medium
Sweet corn|86|3.3|19|1.4|c145
Artichoke (cooked)|53|2.9|11.9|0.4|p120:medium
Harira (Moroccan soup)|55|3|8|1.3|c240
Bissara (fava bean soup)|85|5|11|2.5|c240
Lentil soup|75|5|11|1.5|c240
Msemen (plain)|330|7|45|13|p90:piece
Baghrir (semolina pancake)|200|6|35|2.5|p40:piece
Tagine chicken with vegetables|130|10|5|8|c240
Tagine beef with prunes|170|12|12|8|c240
Tagine goat meat (cooked, with sauce)|150|17|2|8|c240
Tagine kefta with egg|190|13|5|13|c240
Couscous with vegetables and meat (plate)|150|7|22|4|c240
Zaalouk (eggplant salad)|90|2|8|6|c200
Moroccan salad (tomato-cucumber)|45|1.2|6|2|c150`;

export const BUILTIN = RAW.split('\n').map(l => {
  const [name, k, p, c, f, x = ''] = l.split('|'), o = { id: slug(name), name, k: +k, p: +p, c: +c, f: +f, builtin: true, units: {} };
  x.split(';').filter(Boolean).forEach(u => {
    if (u[0] === 'p') { const [g, lab] = u.slice(1).split(':'); o.units.piece = { g: +g, label: lab || 'piece' }; }
    else if (u[0] === 't') o.units.tbsp = +u.slice(1); else if (u[0] === 'c') o.units.cup = +u.slice(1); else if (u[0] === 'l') o.units.glass = +u.slice(1);
  });
  return o;
});

// m3l9a = a small Moroccan spoon: spoonG grams of honey (default 12 g), scaled by density for other foods. Glass = glassMl ml.
export function toGrams(food, qty, unit, spoonG = 12, glassMl = 250) {
  const u = food.units || {};
  return ({
    g: qty, kg: qty * 1000, ml: qty * (u.glass ? u.glass / 250 : 1), piece: qty * (u.piece ? u.piece.g : 100),
    tbsp: qty * (u.tbsp || 15), tsp: qty * (u.tbsp || 15) / 3, m3l9a: qty * (u.tbsp || 21) * spoonG / 21,
    cup: qty * (u.cup || 240), glass: qty * (u.glass ? u.glass * glassMl / 250 : glassMl)
  })[unit] ?? qty;
}
export const macros = (f, g) => ({ k: Math.round(f.k * g / 100), p: r1(f.p * g / 100), c: r1(f.c * g / 100), f: r1(f.f * g / 100) });
export const unitsFor = f => ['g', ...(f.units?.piece ? ['piece'] : []), ...(f.units?.tbsp ? ['tbsp', 'tsp', 'm3l9a'] : []), ...(f.units?.cup ? ['cup'] : []), ...(f.units?.glass ? ['glass', 'ml'] : [])];

// ---------- Rule-based quick entry (no AI): "4 large eggs, 100 g oats, 20 g tagine goat meat" ----------
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: .5 };
const UN = { g: 'g', gr: 'g', gram: 'g', grams: 'g', kg: 'kg', ml: 'ml', cup: 'cup', cups: 'cup', tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tsp: 'tsp', teaspoon: 'tsp',
  teaspoons: 'tsp', m3l9a: 'm3l9a', mlaqa: 'm3l9a', m3la9a: 'm3l9a', glass: 'glass', glasses: 'glass', piece: 'piece', pieces: 'piece', slice: 'piece', slices: 'piece', scoop: 'piece', scoops: 'piece' };
const STOP = new Set(['of', 'the', 'and', 'with', 'in', 'a', 'an', 'some', 'fresh']);
const sing = t => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);
export const tokens = s => new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !STOP.has(t)).map(sing));

export function parseQuick(text, foods) {
  return text.split(/[,;\n]+|\s+\+\s+|\s+and\s+/i).map(s => s.trim()).filter(Boolean).map(seg => {
    const w = seg.split(/\s+/); let qty = 1, unit = null, i = 0;
    const n = w[0].toLowerCase(), frac = n.match(/^(\d+)\/(\d+)$/), mm = n.match(/^(\d+(?:[.,]\d+)?)([a-z0-9]*)$/);
    if (frac) { qty = +frac[1] / +frac[2]; i = 1; }
    else if (mm) { qty = parseFloat(mm[1].replace(',', '.')); i = 1; if (mm[2] && UN[mm[2]]) unit = UN[mm[2]]; else if (mm[2]) { w[0] = mm[2]; i = 0; } }
    else if (NUM[n] !== undefined) { qty = NUM[n]; i = 1; }
    if (!unit && w[i] && UN[w[i].toLowerCase()]) { unit = UN[w[i].toLowerCase()]; i++; }
    if (w[i]?.toLowerCase() === 'of') i++;
    const name = w.slice(i).join(' '), q = tokens(name), state = ['dry', 'cooked', 'raw'].some(s => q.has(s));
    const cands = foods.map(f => {
      const t = tokens(f.name); let h = 0; q.forEach(x => t.has(x) && h++); if (!h) return null;
      let sc = h / q.size * 2 + h / t.size;
      if (q.has('cooked') && t.has('cooked')) sc += 1;
      if ((q.has('dry') || q.has('raw')) && (t.has('dry') || t.has('raw'))) sc += 1;
      if (unit && unitsFor(f).includes(unit)) sc += .6; // a food that supports the unit you typed (glass, tbsp...) wins ties
      if (!state && (t.has('dry') || t.has('raw'))) sc += .3; // no state given: assume dry/raw, user can correct
      return [sc, f];
    }).filter(Boolean).sort((a, b) => b[0] - a[0]).slice(0, 6).map(x => x[1]);
    const food = cands[0] || null;
    return { text: seg, qty, unit: unit || (food?.units?.piece ? 'piece' : 'g'), food, cands };
  });
}

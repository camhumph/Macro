/* ============================================================
   Macro — food log: search, photo, quantity, remaining macros
   ============================================================ */
window.App = window.App || {};

App.Food = (function () {
  const { DATA } = App;
  const Store = App.Store, UI = App.UI;

  const MEALS = ['Breakfast','Lunch','Dinner','Snacks'];
  const barcodeIco = `<svg width="16" height="16" viewBox="0 0 24 24" style="fill:currentColor;vertical-align:-2px"><path d="M2 5h2v14H2V5Zm3 0h1v14H5V5Zm2 0h2v14H7V5Zm3 0h1v14h-1V5Zm3 0h2v14h-2V5Zm3 0h1v14h-1V5Zm2 0h3v14h-3V5Z"/></svg>`;

  function mealOf(entry) { return entry.meal || 'Snacks'; }

  /* ---------- main Food page ---------- */
  function page(container) {
    const p = Store.profile();
    const t = Store.dayTotals();
    const remaining = Math.max(0, p.cal - t.cal);
    const log = Store.foodLog();

    // pace hint: how much more to eat, framed by time of day and goal
    const hour = new Date().getHours();
    const dir = p.weightDir || 0;
    let pace = '';
    if (remaining > 0) {
      const protLeft = Math.max(0, p.protein - t.protein);
      pace = `<b>${UI.round(remaining)} cal</b> left today${protLeft > 0 ? ` · ${UI.round(protLeft)}g protein to go` : ''}.`;
      if (hour >= 19 && remaining > 600 && dir >= 0) pace = `<b>${UI.round(remaining)} cal short</b> with the day winding down — a shake or another protein-and-carb meal closes the gap.`;
    } else {
      const over = UI.round(t.cal - p.cal);
      pace = dir < 0 ? `Over target by <b>${over} cal</b> — tighten portions to stay in your deficit.` : `Target reached — <b>${over} cal</b> over.`;
    }

    let html = `
      <div class="hero">
        <div class="eyebrow">Today's nutrition</div>
        <div class="ring-wrap" style="margin-top:14px">
          ${UI.ring(t.cal, p.cal, UI.round(remaining), 'cal left', 'var(--accent)')}
          <div class="macro-bars">
            ${UI.macroBar('Protein', t.protein, p.protein, 'var(--protein)')}
            ${UI.macroBar('Carbs', t.carbs, p.carbs, 'var(--carbs)')}
            ${UI.macroBar('Fat', t.fat, p.fat, 'var(--fat)')}
          </div>
        </div>
        <div class="banner ${remaining>0?'info':'good'}" style="margin:16px 0 0">
          <span class="b-ico">${remaining>0?'🍽️':'✅'}</span><div>${pace}</div>
        </div>
      </div>

      <button class="btn primary" id="food-add" style="margin-top:14px"><svg width="18" height="18" viewBox="0 0 24 24" style="fill:currentColor"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg> Add Food</button>
      <div class="btn-row">
        <button class="btn" id="food-barcode">${barcodeIco} Barcode</button>
        <button class="btn" id="food-scan">🏷️ Label</button>
        <button class="btn" id="food-photo">📷 Photo</button>
      </div>
    `;

    // Water tracker
    html += waterCard();

    // Saved meals (quick add)
    html += mealsRow();

    // My Foods / pantry (scanned items you draw portions from)
    html += App.Scan.pantryRows();

    // grouped meals
    html += MEALS.map(m => {
      const items = log.filter(e => mealOf(e) === m);
      if (!items.length) return '';
      const mt = items.reduce((s,e)=>s+(e.cal||0),0);
      return `
        <div class="meal-head"><b>${m}</b><span>${UI.round(mt)} cal</span></div>
        <div class="card" style="padding:6px 16px">
          ${items.map(foodItemRow).join('')}
        </div>`;
    }).join('');

    if (log.length) {
      html += `<button class="btn ghost small" id="food-savemeal" style="width:100%;margin-top:14px">💾 Save today's foods as a meal</button>`;
    } else {
      html += `<div class="empty"><div class="big">🍽️</div>Nothing logged yet.<br>Add a food, scan a barcode, or pick a saved meal.</div>`;
    }

    container.innerHTML = html;

    container.querySelector('#food-add').onclick = () => searchSheet();
    container.querySelector('#food-barcode').onclick = () => App.Barcode.scan();
    container.querySelector('#food-scan').onclick = () => App.Scan.scanLabel();
    container.querySelector('#food-photo').onclick = () => photoSheet();
    // water
    container.querySelectorAll('[data-water]').forEach(b => b.onclick = () => { Store.addWater(+b.dataset.water); page(container); });
    // meals
    container.querySelectorAll('[data-meal]').forEach(b => b.onclick = () => { logMeal(b.dataset.meal); page(container); UI.toast('Meal logged', 'good'); });
    container.querySelectorAll('[data-mealdel]').forEach(b => b.onclick = (e) => { e.stopPropagation(); Store.removeMeal(b.dataset.mealdel); page(container); });
    const sm = container.querySelector('#food-savemeal');
    if (sm) sm.onclick = () => saveMealSheet(container);
    App.Scan.wirePantry(container);
    container.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => editEntrySheet(el.dataset.edit));
    container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      Store.removeFood(b.dataset.del);
      page(container);
      UI.toast('Removed');
    });
  }

  /* ---------- water ---------- */
  function waterCard() {
    const cups = Store.water();
    const goal = Store.profile().waterGoal || 8;
    const pct = UI.clamp(cups / goal * 100, 0, 100);
    return `
    <div class="card" style="margin-top:14px">
      <div class="spread" style="margin-bottom:10px">
        <b>💧 Water</b>
        <span class="muted">${cups} / ${goal} cups</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:var(--fat)"></div></div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn small" data-water="-1">− cup</button>
        <button class="btn small" data-water="1">＋ cup</button>
        <button class="btn small" data-water="2">＋ 2</button>
      </div>
    </div>`;
  }

  /* ---------- saved meals ---------- */
  function mealsRow() {
    const meals = Store.meals();
    if (!meals.length) return '';
    return `
      <div class="meal-head"><b>Saved Meals</b><span>tap to log</span></div>
      <div class="card" style="padding:6px 16px">
        ${meals.map(m => {
          const t = m.items.reduce((s, e) => s + (e.cal || 0), 0);
          return `<div class="food-item">
            <div class="food-thumb" data-meal="${m.id}">${m.emoji || '🍱'}</div>
            <div class="fi-main" data-meal="${m.id}"><b>${UI.esc(m.name)}</b><small>${m.items.length} items · ${UI.round(t)} cal</small></div>
            <button class="btn small primary" data-meal="${m.id}" style="width:auto">Log</button>
            <button class="icon-btn" data-mealdel="${m.id}" style="width:30px;height:30px;color:var(--faint);font-size:18px">×</button>
          </div>`;
        }).join('')}
      </div>`;
  }
  function logMeal(id) {
    const m = Store.meals().find(x => x.id === id);
    if (!m) return;
    const meal = mealSlot();
    m.items.forEach(it => Store.addFood({ ...it, meal }));
  }
  function mealSlot() {
    const h = new Date().getHours();
    return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks';
  }
  function saveMealSheet(container) {
    const items = Store.foodLog();
    if (!items.length) return UI.toast('Log some foods first');
    UI.modal(`
      <h2>Save as a meal</h2>
      <p class="muted" style="margin:-8px 0 12px;font-size:13px">Saves today's ${items.length} logged foods as a reusable meal you can add in one tap.</p>
      ${UI.field('Meal name', `<input class="input" id="sm-name" placeholder="e.g. My usual breakfast">`)}
      <button class="btn primary" id="sm-go">Save meal</button>
    `, (m, close) => {
      m.querySelector('#sm-go').onclick = () => {
        const name = m.querySelector('#sm-name').value.trim();
        if (!name) return UI.toast('Name it first');
        Store.addMeal(name, items.map(e => ({ name:e.name, emoji:e.emoji, qtyLabel:e.qtyLabel, cal:e.cal, protein:e.protein, carbs:e.carbs, fat:e.fat })));
        close(); page(container); UI.toast('Meal saved', 'good');
      };
    });
  }

  function foodItemRow(e) {
    const thumb = e.photo ? `<img src="${e.photo}" alt="">` : (e.emoji || '🍴');
    return `
    <div class="food-item">
      <div class="food-thumb" data-edit="${e.id}">${thumb}</div>
      <div class="fi-main" data-edit="${e.id}">
        <b>${UI.esc(e.name)} <span class="faint" style="font-weight:500;font-size:12px">✎</span></b>
        <small>${UI.esc(e.qtyLabel || '')} · P${UI.round(e.protein)} C${UI.round(e.carbs)} F${UI.round(e.fat)}</small>
      </div>
      <div class="fi-cal" data-edit="${e.id}">${UI.round(e.cal)}<small>cal</small></div>
      <button class="icon-btn" data-del="${e.id}" style="width:30px;height:30px;color:var(--faint);font-size:18px">×</button>
    </div>`;
  }

  /* ---------- edit an already-logged entry ---------- */
  function editEntrySheet(entryId) {
    const e = Store.foodLog().find(x => x.id === entryId);
    if (!e) return;
    UI.modal(`
      <h2>Edit entry</h2>
      ${UI.field('Name', `<input class="input" id="ee-name" value="${UI.esc(e.name)}">`)}
      ${UI.field('Amount / note', `<input class="input" id="ee-qty" value="${UI.esc(e.qtyLabel || '')}" placeholder="e.g. 1 serving">`)}
      <div class="inline-fields" style="margin-bottom:10px">
        <div class="field" style="margin:0"><label>Cal</label><input class="input" id="ee-cal" type="number" inputmode="numeric" value="${UI.round(e.cal)}"></div>
        <div class="field" style="margin:0"><label>Protein</label><input class="input" id="ee-p" type="number" inputmode="decimal" value="${UI.round(e.protein)}"></div>
        <div class="field" style="margin:0"><label>Carbs</label><input class="input" id="ee-c" type="number" inputmode="decimal" value="${UI.round(e.carbs)}"></div>
        <div class="field" style="margin:0"><label>Fat</label><input class="input" id="ee-f" type="number" inputmode="decimal" value="${UI.round(e.fat)}"></div>
      </div>
      ${UI.field('Meal', mealSelect(e.meal))}
      <button class="btn primary" id="ee-save">Save changes</button>
      <button class="btn ghost danger" id="ee-del" style="margin-top:10px">Delete entry</button>
    `, (m, close) => {
      m.querySelector('#ee-save').onclick = () => {
        Store.updateFood(entryId, {
          name: m.querySelector('#ee-name').value.trim() || e.name,
          qtyLabel: m.querySelector('#ee-qty').value.trim(),
          meal: m.querySelector('#q-meal').value,
          cal: +m.querySelector('#ee-cal').value || 0,
          protein: +m.querySelector('#ee-p').value || 0,
          carbs: +m.querySelector('#ee-c').value || 0,
          fat: +m.querySelector('#ee-f').value || 0,
        });
        close(); App.Router.refresh(); UI.toast('Updated ✅', 'good');
      };
      m.querySelector('#ee-del').onclick = () => { Store.removeFood(entryId); close(); App.Router.refresh(); UI.toast('Removed'); };
    });
  }

  /* ---------- search sheet ---------- */
  function searchSheet(presetMeal) {
    UI.modal(`
      <h2>Add Food</h2>
      <input class="input" id="food-q" placeholder="Search foods (e.g. chicken, rice, oats)…" autocomplete="off">
      <div class="btn-row" style="margin-top:10px">
        <button class="btn ghost small" id="food-bc2" style="flex:1">${barcodeIco} Barcode</button>
        <button class="btn ghost small" id="food-scan2" style="flex:1">🏷️ Label</button>
      </div>
      <div id="food-results" style="margin-top:14px"></div>
    `, (m) => {
      const q = m.querySelector('#food-q');
      const res = m.querySelector('#food-results');
      m.querySelector('#food-scan2').onclick = () => { UI.closeModal(); App.Scan.scanLabel(); };
      m.querySelector('#food-bc2').onclick = () => { UI.closeModal(); App.Barcode.scan(); };
      const renderResults = () => {
        const term = q.value.trim().toLowerCase();
        // pantry / My Foods matches first
        let pan = Store.pantry();
        if (term) pan = pan.filter(p => p.name.toLowerCase().includes(term));
        const panHTML = pan.length ? `<div class="meal-head" style="margin-top:0"><b>My Foods</b><span>portions</span></div>` + pan.map(p => `
          <div class="search-result" data-portion="${p.id}">
            <div class="food-thumb">🏷️</div>
            <div class="sr-main"><b>${UI.esc(p.name)}</b><small>${UI.round(p.perServing.cal)} cal / ${UI.esc(p.servingSizeText||'serving')} · ${UI.round(p.remainingServings*10)/10} left</small></div>
            <div style="color:var(--accent);font-size:24px">＋</div>
          </div>`).join('') + `<div class="meal-head"><b>Database</b><span></span></div>` : '';

        let list = DATA.FOODS;
        if (term) list = DATA.FOODS.filter(f =>
          f.name.toLowerCase().includes(term) || (f.tags||[]).some(t => t.includes(term)));
        list = list.slice(0, 30);
        res.innerHTML = panHTML + (list.length ? list.map(f => `
          <div class="search-result" data-food="${f.id}">
            <div class="food-thumb">${f.emoji||'🍴'}</div>
            <div class="sr-main"><b>${UI.esc(f.name)}</b><small>${UI.esc(f.serving)} · ${f.cal} cal · P${f.p} C${f.c} F${f.f}</small></div>
            <div style="color:var(--accent);font-size:24px">＋</div>
          </div>`).join('') : (term ? `<div class="empty" style="padding:18px">No database match.</div>` : '')) +
          `<button class="btn ghost" id="food-custom" style="margin-top:6px">Can't find it? Enter custom macros</button>`;
        res.querySelectorAll('[data-food]').forEach(el => el.onclick = () => quantitySheet(DATA.foodById[el.dataset.food], presetMeal));
        res.querySelectorAll('[data-portion]').forEach(el => el.onclick = () => { UI.closeModal(); App.Scan.portionSheet(el.dataset.portion); });
        const cust = res.querySelector('#food-custom');
        if (cust) cust.onclick = () => customSheet(presetMeal);
      };
      q.addEventListener('input', renderResults);
      renderResults();
      setTimeout(() => q.focus(), 250);
    });
  }

  /* ---------- quantity sheet ---------- */
  function quantitySheet(food, presetMeal) {
    UI.modal(`
      <h2>${UI.esc(food.name)}</h2>
      <p class="muted" style="margin:-8px 0 16px">${UI.esc(food.serving)} · ${food.cal} cal</p>
      ${UI.field('Servings', `<input class="input" id="q-amt" type="number" inputmode="decimal" value="1" step="0.25" min="0">`)}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 14px">
        ${[['¼',0.25],['½',0.5],['¾',0.75],['1',1],['2',2]].map(([l,v]) => `<button class="btn small" data-q="${v}">${l}</button>`).join('')}
      </div>
      ${UI.field('Meal', mealSelect(presetMeal))}
      <div class="card" id="q-preview" style="margin-bottom:14px"></div>
      <button class="btn primary" id="q-add">Add to Log</button>
    `, (m, close) => {
      const amt = m.querySelector('#q-amt');
      const preview = m.querySelector('#q-preview');
      const upd = () => {
        const n = parseFloat(amt.value) || 0;
        preview.innerHTML = `<div class="spread"><b>${UI.round(food.cal*n)} cal</b>
          <span class="muted">P ${UI.round(food.p*n)} · C ${UI.round(food.c*n)} · F ${UI.round(food.f*n)}</span></div>`;
      };
      m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { amt.value = b.dataset.q; upd(); });
      amt.addEventListener('input', upd); upd();
      m.querySelector('#q-add').onclick = () => {
        const n = parseFloat(amt.value) || 0;
        if (n <= 0) return UI.toast('Enter an amount');
        Store.addFood({
          name: food.name, emoji: food.emoji,
          qtyLabel: `${n} × ${food.serving}`,
          meal: m.querySelector('#q-meal').value,
          cal: food.cal*n, protein: food.p*n, carbs: food.c*n, fat: food.f*n,
        });
        UI.closeModal();
        App.Router.refresh();
        UI.toast('Logged ✅', 'good');
      };
    });
  }

  /* ---------- custom macros ---------- */
  function customSheet(presetMeal, photo) {
    UI.modal(`
      <h2>Custom Food</h2>
      ${UI.field('Name', `<input class="input" id="c-name" placeholder="e.g. Mom's lasagna">`)}
      ${UI.field('Calories (optional — auto-calcs from macros)', `<input class="input" id="c-cal" type="number" inputmode="numeric" placeholder="0">`)}
      <div class="inline-fields">
        <div class="field">${labelInput('Protein','c-p')}</div>
        <div class="field">${labelInput('Carbs','c-c')}</div>
        <div class="field">${labelInput('Fat','c-f')}</div>
      </div>
      ${UI.field('Meal', mealSelect(presetMeal))}
      <button class="btn primary" id="c-add">Add to Log</button>
    `, (m) => {
      m.querySelector('#c-add').onclick = () => {
        const name = m.querySelector('#c-name').value.trim() || 'Custom food';
        const cal = +m.querySelector('#c-cal').value || 0;
        const pr = +m.querySelector('#c-p').value || 0;
        const cb = +m.querySelector('#c-c').value || 0;
        const ft = +m.querySelector('#c-f').value || 0;
        const calc = cal || (pr*4 + cb*4 + ft*9);
        Store.addFood({
          name, emoji:'🍴', qtyLabel:'1 serving', photo,
          meal: m.querySelector('#q-meal').value,
          cal: calc, protein:pr, carbs:cb, fat:ft,
        });
        UI.closeModal();
        App.Router.refresh();
        UI.toast('Logged ✅','good');
      };
    });
  }

  /* ---------- photo capture ---------- */
  function photoSheet() {
    // Hidden file input with camera capture, then attach to a custom entry.
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      document.body.removeChild(inp);
      if (!file) return;
      downscale(file, 480, (dataUrl) => {
        UI.modal(`
          <h2>Snap & Log</h2>
          <img src="${dataUrl}" style="width:100%;border-radius:14px;margin-bottom:14px;max-height:240px;object-fit:cover">
          <p class="muted" style="margin-top:-6px">Photo saved to this entry. Search the food to auto-fill macros, or type them in.</p>
          <div class="btn-row">
            <button class="btn primary" id="ph-search">Find Macros</button>
            <button class="btn" id="ph-custom">Enter Manually</button>
          </div>
        `, (m) => {
          m.querySelector('#ph-search').onclick = () => searchSheetWithPhoto(dataUrl);
          m.querySelector('#ph-custom').onclick = () => customSheet(null, dataUrl);
        });
      });
    };
    inp.click();
  }

  // search but carry the photo onto whatever is chosen
  function searchSheetWithPhoto(photo) {
    UI.modal(`
      <h2>Match the Photo</h2>
      <img src="${photo}" style="width:84px;height:84px;border-radius:12px;object-fit:cover;float:right;margin-left:12px">
      <input class="input" id="food-q" placeholder="Search…" autocomplete="off">
      <div id="food-results" style="margin-top:14px;clear:both"></div>
    `, (m) => {
      const q = m.querySelector('#food-q'), res = m.querySelector('#food-results');
      const draw = () => {
        const term = q.value.trim().toLowerCase();
        let list = term ? DATA.FOODS.filter(f => f.name.toLowerCase().includes(term) || (f.tags||[]).some(t=>t.includes(term))) : DATA.FOODS;
        res.innerHTML = list.slice(0,25).map(f => `
          <div class="search-result" data-food="${f.id}">
            <div class="food-thumb">${f.emoji}</div>
            <div class="sr-main"><b>${UI.esc(f.name)}</b><small>${f.cal} cal</small></div>
            <div style="color:var(--accent);font-size:22px">＋</div>
          </div>`).join('') + `<button class="btn ghost" id="food-custom" style="margin-top:6px">None of these — manual</button>`;
        res.querySelectorAll('[data-food]').forEach(el => el.onclick = () => {
          const f = DATA.foodById[el.dataset.food];
          Store.addFood({ name:f.name, emoji:f.emoji, qtyLabel:`1 × ${f.serving}`, photo, meal:'Snacks', cal:f.cal, protein:f.p, carbs:f.c, fat:f.f });
          UI.closeModal(); App.Router.refresh(); UI.toast('Logged with photo 📸','good');
        });
        res.querySelector('#food-custom').onclick = () => customSheet(null, photo);
      };
      q.addEventListener('input', draw); draw();
    });
  }

  function downscale(file, maxW, cb) {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const cv = document.createElement('canvas');
      cv.width = img.width*scale; cv.height = img.height*scale;
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL('image/jpeg', 0.7));
    };
    reader.readAsDataURL(file);
  }

  /* ---------- small helpers ---------- */
  function mealSelect(preset) {
    const h = new Date().getHours();
    const def = preset || (h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks');
    return `<select class="input" id="q-meal">${MEALS.map(m => `<option ${m===def?'selected':''}>${m}</option>`).join('')}</select>`;
  }
  function labelInput(label, id) {
    return `<label>${label} (g)</label><input class="input" id="${id}" type="number" inputmode="decimal" placeholder="0">`;
  }

  return { page, searchSheet, photoSheet };
})();

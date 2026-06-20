/* ============================================================
   Macro — Nutrition-label scanner + pantry / portion tracking
   On-device OCR via Tesseract.js (loaded on demand, no API key).
   ============================================================ */
window.App = window.App || {};

App.Scan = (function () {
  const Store = App.Store, UI = App.UI;
  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const OZ_G = 28.3495;

  /* ---------- load Tesseract on first use ---------- */
  let tessPromise = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessPromise) return tessPromise;
    tessPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESS_URL; s.async = true;
      s.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract missing'));
      s.onerror = () => reject(new Error('load failed'));
      document.head.appendChild(s);
    });
    return tessPromise;
  }

  /* ---------- camera capture → downscaled dataURL ---------- */
  function capture(maxW, cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      document.body.removeChild(inp);
      if (!file) return;
      const img = new Image(), reader = new FileReader();
      reader.onload = () => img.src = reader.result;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.85));
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  /* ---------- public entry: scan a nutrition label ---------- */
  function scanLabel() {
    capture(1200, (dataUrl) => runOCR(dataUrl));
  }

  function runOCR(photo) {
    const close = UI.modal(`
      <h2>Reading label…</h2>
      <img src="${photo}" style="width:100%;max-height:200px;object-fit:cover;border-radius:14px;margin-bottom:14px">
      <div class="bar-track"><div class="bar-fill" id="ocr-bar" style="width:6%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></div></div>
      <p class="muted center" id="ocr-status" style="margin-top:12px">Loading scanner…</p>
    `, () => {});
    const setBar = (p, msg) => {
      const b = document.getElementById('ocr-bar'), s = document.getElementById('ocr-status');
      if (b) b.style.width = Math.max(6, Math.round(p * 100)) + '%';
      if (s && msg) s.textContent = msg;
    };

    loadTesseract().then(T =>
      T.recognize(photo, 'eng', {
        logger: m => { if (m.status === 'recognizing text') setBar(0.15 + m.progress * 0.85, 'Reading numbers…'); else setBar(0.1, 'Preparing…'); }
      })
    ).then(res => {
      UI.closeModal();
      const parsed = parseLabel(res.data.text || '');
      parsed._raw = res.data.text || '';
      reviewSheet(parsed, photo);
    }).catch(() => {
      UI.closeModal();
      UI.toast('Scanner needs internet the first time — enter it manually');
      reviewSheet(emptyParsed(), photo);
    });
  }

  /* ---------- parse Nutrition Facts text ---------- */
  function cleanNum(str) {
    if (str == null) return null;
    const n = parseFloat(String(str).replace(/[,\s]/g, '')
      .replace(/[oO]/g, '0').replace(/[lI]/g, '1').replace(/[sS]/g, '5').replace(/B/g, '8'));
    return isFinite(n) ? n : null;
  }
  function firstNum(text, res) {
    for (const re of res) { const m = text.match(re); if (m) { const v = cleanNum(m[1]); if (v != null) return v; } }
    return null;
  }
  function emptyParsed() {
    return { name:'', servingSizeText:'', servingGrams:null, servingsPerContainer:1, cal:null, p:null, c:null, f:null };
  }
  function parseLabel(raw) {
    const text = ' ' + raw.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').toLowerCase() + ' ';
    const p = emptyParsed();

    p.cal = firstNum(text, [/calories\s*(?:from fat\s*\d+)?[^0-9a-z]{0,4}([0-9oeolisb.,]{1,5})/i]);
    p.f  = firstNum(text, [/total\s*fat[^0-9a-z]{0,4}([0-9oelisb.,]{1,4})\s*g/i, /\bfat[^0-9a-z]{0,4}([0-9oelisb.,]{1,4})\s*g/i]);
    p.c  = firstNum(text, [/total\s*carb(?:ohydrate)?[a-z.]*[^0-9a-z]{0,4}([0-9oelisb.,]{1,4})\s*g/i, /\bcarb[a-z.]*[^0-9a-z]{0,4}([0-9oelisb.,]{1,4})\s*g/i]);
    p.p  = firstNum(text, [/protein[^0-9a-z]{0,4}([0-9oelisb.,]{1,4})\s*g/i]);

    // servings per container
    p.servingsPerContainer = firstNum(text, [
      /(?:about\s*)?([0-9oelisb.,]{1,4})\s*servings?\s*per\s*container/i,
      /servings?\s*per\s*container[^0-9a-z]{0,6}([0-9oelisb.,]{1,4})/i
    ]) || 1;

    // serving size text + grams
    const ss = text.match(/serving\s*size[^a-z0-9]{0,4}([^.]{1,40}?)(?:\s+servings?\s+per|\s+amount\s+per|\s+calories|$)/i);
    if (ss) p.servingSizeText = ss[1].trim().replace(/\s+/g, ' ').slice(0, 40);
    const g = (p.servingSizeText || text).match(/\(?\s*([0-9.]{1,5})\s*g\b/);
    if (g) p.servingGrams = cleanNum(g[1]);
    if (!p.servingGrams) {
      const oz = (p.servingSizeText || text).match(/([0-9.]{1,4})\s*oz/);
      if (oz) p.servingGrams = Math.round(cleanNum(oz[1]) * OZ_G);
    }

    // fill calories from macros if missing
    if (p.cal == null && (p.p != null || p.c != null || p.f != null))
      p.cal = Math.round((p.p || 0) * 4 + (p.c || 0) * 4 + (p.f || 0) * 9);
    return p;
  }

  /* ---------- review / correct sheet → save to pantry ---------- */
  function reviewSheet(p, photo) {
    UI.modal(`
      <h2>Check the macros</h2>
      <p class="muted" style="margin:-8px 0 14px">Scanned from the label — fix anything that looks off, then save it. Values are <b>per serving</b>.</p>
      ${photo ? `<img src="${photo}" style="width:74px;height:74px;border-radius:12px;object-fit:cover;float:right;margin:0 0 10px 12px">` : ''}
      ${UI.field('Food name', `<input class="input" id="r-name" placeholder="e.g. Ground Beef 90/10" value="${UI.esc(p.name||'')}">`)}
      <div class="inline-fields" style="margin-bottom:14px;clear:both">
        <div class="field" style="margin:0"><label>Serving size</label><input class="input" id="r-ss" placeholder="4 oz (112g)" value="${UI.esc(p.servingSizeText||'')}"></div>
        <div class="field" style="margin:0"><label>Servings / pack</label><input class="input" id="r-spc" type="number" inputmode="decimal" step="0.5" value="${p.servingsPerContainer||1}"></div>
      </div>
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Per serving</label>
      <div class="inline-fields" style="margin-bottom:8px">
        <div class="field" style="margin:0"><label>Cal</label><input class="input" id="r-cal" type="number" inputmode="numeric" value="${p.cal??''}"></div>
        <div class="field" style="margin:0"><label>Protein</label><input class="input" id="r-p" type="number" inputmode="decimal" value="${p.p??''}"></div>
        <div class="field" style="margin:0"><label>Carbs</label><input class="input" id="r-c" type="number" inputmode="decimal" value="${p.c??''}"></div>
        <div class="field" style="margin:0"><label>Fat</label><input class="input" id="r-f" type="number" inputmode="decimal" value="${p.f??''}"></div>
      </div>
      <div class="card" id="r-pack" style="margin:6px 0 14px"></div>
      <button class="btn primary" id="r-save">Save to My Foods</button>
      <button class="btn ghost" id="r-savelog" style="margin-top:10px">Save & log a portion now</button>
    `, (m, close) => {
      const read = () => {
        const ss = m.querySelector('#r-ss').value.trim();
        let grams = p.servingGrams;
        const g = ss.match(/([0-9.]+)\s*g\b/); const oz = ss.match(/([0-9.]+)\s*oz/);
        if (g) grams = parseFloat(g[1]); else if (oz) grams = Math.round(parseFloat(oz[1]) * OZ_G);
        return {
          name: m.querySelector('#r-name').value.trim(),
          servingSizeText: ss,
          servingGrams: grams || null,
          servingsPerContainer: parseFloat(m.querySelector('#r-spc').value) || 1,
          perServing: {
            cal:+m.querySelector('#r-cal').value || 0, p:+m.querySelector('#r-p').value || 0,
            c:+m.querySelector('#r-c').value || 0,  f:+m.querySelector('#r-f').value || 0,
          },
        };
      };
      const drawPack = () => {
        const d = read();
        const tot = d.perServing.cal * d.servingsPerContainer;
        m.querySelector('#r-pack').innerHTML =
          `<div class="spread"><b>Whole package</b><span class="muted">${UI.round(d.servingsPerContainer*10)/10} servings</span></div>
           <div class="spread" style="margin-top:6px"><span class="muted">${UI.round(tot)} cal · P${UI.round(d.perServing.p*d.servingsPerContainer)} C${UI.round(d.perServing.c*d.servingsPerContainer)} F${UI.round(d.perServing.f*d.servingsPerContainer)}</span></div>`;
      };
      m.querySelectorAll('input').forEach(i => i.addEventListener('input', drawPack));
      drawPack();

      const commit = (thenLog) => {
        const d = read();
        if (!d.name) return UI.toast('Name your food first');
        if (!d.perServing.cal) return UI.toast('Enter calories');
        const item = Store.addPantry({
          name:d.name, emoji:'🏷️', servingSizeText:d.servingSizeText, servingGrams:d.servingGrams,
          perServing:d.perServing, totalServings:d.servingsPerContainer, remainingServings:d.servingsPerContainer,
        });
        close();
        App.Router.refresh();
        if (thenLog) portionSheet(item.id);
        else UI.toast('Saved to My Foods ✅', 'good');
      };
      m.querySelector('#r-save').onclick = () => commit(false);
      m.querySelector('#r-savelog').onclick = () => commit(true);
    });
  }

  /* ---------- log a portion (decrements remaining in the pack) ---------- */
  function portionSheet(itemId) {
    const item = Store.pantry().find(p => p.id === itemId);
    if (!item) return;
    const hasG = !!item.servingGrams;
    const remG = hasG ? item.remainingServings * item.servingGrams : null;

    UI.modal(`
      <h2>${UI.esc(item.name)}</h2>
      <p class="muted" style="margin:-8px 0 12px">
        ${UI.round(item.remainingServings*10)/10} servings left${hasG ? ` · ${UI.round(remG)} g (${UI.round(remG/OZ_G*10)/10} oz)` : ''}
      </p>
      ${hasG ? `<div class="segment" id="p-mode"><button data-mode="weight" class="on">By weight</button><button data-mode="serv">By servings</button></div>` : ''}
      <div id="p-amtwrap"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 12px">
        <button class="btn small" data-chip="0.5">½ serving</button>
        <button class="btn small" data-chip="1">1 serving</button>
        <button class="btn small" data-chip="2">2 servings</button>
        <button class="btn small" data-chip="rest">Rest of pack</button>
      </div>
      <div class="card" id="p-preview" style="margin-bottom:14px"></div>
      <button class="btn primary" id="p-log">Log this portion</button>
      <button class="btn ghost" id="p-refill" style="margin-top:10px">Opened a new pack — refill to ${UI.round(item.totalServings*10)/10} servings</button>
    `, (m, close) => {
      let mode = hasG ? 'weight' : 'serv';
      const amtWrap = m.querySelector('#p-amtwrap');
      const drawAmt = () => {
        amtWrap.innerHTML = mode === 'weight'
          ? UI.field('Amount eaten (g)', `<input class="input" id="p-amt" type="number" inputmode="decimal" placeholder="grams" value="${item.servingGrams||''}">`)
          : UI.field('Servings eaten', `<input class="input" id="p-amt" type="number" inputmode="decimal" step="0.25" value="1">`);
        m.querySelector('#p-amt').addEventListener('input', preview);
      };
      const servingsUsed = () => {
        const v = parseFloat(m.querySelector('#p-amt').value) || 0;
        return mode === 'weight' && hasG ? v / item.servingGrams : v;
      };
      const preview = () => {
        const s = servingsUsed();
        const pv = item.perServing;
        const over = s > item.remainingServings + 1e-6;
        m.querySelector('#p-preview').innerHTML =
          `<div class="spread"><b>${UI.round(pv.cal*s)} cal</b><span class="muted">P${UI.round(pv.p*s)} · C${UI.round(pv.c*s)} · F${UI.round(pv.f*s)}</span></div>
           <div class="last-hint" style="margin-top:6px">${UI.round(s*100)/100} servings · ${over ? '⚠️ more than what\'s left (pack will hit 0)' : `${UI.round((item.remainingServings-s)*10)/10} left after`}</div>`;
      };
      drawAmt(); preview();

      if (hasG) m.querySelectorAll('#p-mode button').forEach(b => b.onclick = () => {
        mode = b.dataset.mode;
        m.querySelectorAll('#p-mode button').forEach(x => x.classList.toggle('on', x === b));
        drawAmt(); preview();
      });
      m.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
        const chip = b.dataset.chip;
        const servings = chip === 'rest' ? item.remainingServings : parseFloat(chip);
        mode = 'serv';
        if (hasG) m.querySelectorAll('#p-mode button').forEach(x => x.classList.toggle('on', x.dataset.mode === 'serv'));
        drawAmt();
        m.querySelector('#p-amt').value = UI.round(servings*100)/100;
        preview();
      });

      m.querySelector('#p-log').onclick = () => {
        const s = servingsUsed();
        if (s <= 0) return UI.toast('Enter an amount');
        const pv = item.perServing;
        const grams = hasG ? UI.round(s * item.servingGrams) : null;
        Store.addFood({
          name:item.name, emoji:'🏷️',
          qtyLabel: grams != null ? `${grams} g (${UI.round(s*100)/100} serv)` : `${UI.round(s*100)/100} × ${item.servingSizeText || 'serving'}`,
          cal:pv.cal*s, protein:pv.p*s, carbs:pv.c*s, fat:pv.f*s,
        });
        Store.updatePantry(item.id, { remainingServings: Math.max(0, item.remainingServings - s) });
        close();
        App.Router.refresh();
        UI.toast('Portion logged 🏷️', 'good');
      };
      m.querySelector('#p-refill').onclick = () => {
        Store.updatePantry(item.id, { remainingServings: item.totalServings });
        close(); App.Router.refresh(); UI.toast('Pack refilled');
      };
    });
  }

  /* ---------- "My Foods" pantry section on the Food page ---------- */
  function pantryRows() {
    const items = Store.pantry();
    if (!items.length) return '';
    return `
      <div class="meal-head"><b>My Foods · Pantry</b><span>${items.length}</span></div>
      <div class="card" style="padding:6px 16px">
        ${items.map(it => {
          const left = UI.round(it.remainingServings * 10) / 10;
          const pct = it.totalServings ? UI.clamp(it.remainingServings / it.totalServings * 100, 0, 100) : 0;
          const low = it.remainingServings <= 0.01;
          return `
          <div class="food-item">
            <div class="food-thumb">🏷️</div>
            <div class="fi-main">
              <b>${UI.esc(it.name)}</b>
              <small>${UI.round(it.perServing.cal)} cal / ${UI.esc(it.servingSizeText || 'serving')} · ${low ? '<span style="color:var(--accent-2)">empty — tap to refill</span>' : left + ' serv left'}</small>
              <div class="bar-track" style="margin-top:6px;height:5px"><div class="bar-fill" style="width:${pct}%;background:${low?'var(--accent-2)':'var(--accent)'}"></div></div>
            </div>
            <button class="btn small primary" data-portion="${it.id}" style="width:auto">Log</button>
            <button class="icon-btn" data-pdel="${it.id}" style="width:30px;height:30px;color:var(--faint);font-size:18px">×</button>
          </div>`;
        }).join('')}
      </div>`;
  }
  function wirePantry(container) {
    container.querySelectorAll('[data-portion]').forEach(b => b.onclick = () => portionSheet(b.dataset.portion));
    container.querySelectorAll('[data-pdel]').forEach(b => b.onclick = () => {
      if (confirm('Remove this saved food?')) { Store.removePantry(b.dataset.pdel); App.Router.refresh(); }
    });
  }

  return { scanLabel, portionSheet, reviewSheet, parseLabel, pantryRows, wirePantry };
})();

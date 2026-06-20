/* ============================================================
   Macro — Barcode scanner -> Open Food Facts lookup -> pantry
   Live camera scan via ZXing (loaded on demand). No API key.
   ============================================================ */
window.App = window.App || {};

App.Barcode = (function () {
  const UI = App.UI;
  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  const OFF = code => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,serving_size,serving_quantity,nutriments`;
  const OZ_G = 28.3495;

  let zPromise = null;
  function loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (zPromise) return zPromise;
    zPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ZXING_URL; s.async = true;
      s.onload = () => window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing missing'));
      s.onerror = () => reject(new Error('load failed'));
      document.head.appendChild(s);
    });
    return zPromise;
  }

  /* ---------- public entry ---------- */
  function scan() {
    let reader = null, done = false;
    const stop = () => { try { reader && reader.reset(); } catch (e) {} reader = null; };

    UI.modal(`
      <h2>Scan Barcode</h2>
      <div class="bc-frame">
        <video id="bc-video" playsinline muted autoplay></video>
        <div class="bc-reticle"><span class="bc-line"></span></div>
      </div>
      <p class="muted center" id="bc-status" style="margin:12px 0">Point the camera at the barcode…</p>
      <button class="btn ghost" id="bc-manual">Type the barcode number instead</button>
    `, (m, close) => {
      const host = document.getElementById('modal-host');
      const finish = () => { stop(); close(); };
      host.onclick = (e) => { if (e.target === host) finish(); };
      m.querySelector('#bc-manual').onclick = () => { finish(); manualEntry(); };

      const status = m.querySelector('#bc-status');
      const video = m.querySelector('#bc-video');

      loadZXing().then(ZXing => {
        reader = new ZXing.BrowserMultiFormatReader();
        const onResult = (result, err) => {
          if (result && !done) {
            done = true;
            if (navigator.vibrate) navigator.vibrate(40);
            const code = result.getText();
            stop();
            status.textContent = 'Found ' + code + ' — looking up…';
            lookup(code, close);
          }
        };
        const constraints = { video: { facingMode: { ideal: 'environment' } } };
        const starter = reader.decodeFromConstraints
          ? reader.decodeFromConstraints(constraints, video, onResult)
          : reader.decodeFromVideoDevice(undefined, video, onResult);
        Promise.resolve(starter).catch(() => {
          status.innerHTML = 'Camera unavailable. <b>Tap below to type the code.</b>';
        });
      }).catch(() => {
        status.innerHTML = 'Scanner needs internet the first time.<br><b>Type the code below</b> or try again on Wi-Fi.';
      });
    });
  }

  function manualEntry() {
    UI.modal(`
      <h2>Enter Barcode</h2>
      <p class="muted" style="margin:-8px 0 14px">The long number under the bars (UPC/EAN).</p>
      ${UI.field('Barcode number', `<input class="input" id="bc-code" type="number" inputmode="numeric" placeholder="e.g. 0123456789012">`)}
      <button class="btn primary" id="bc-go">Look up</button>
    `, (m, close) => {
      const inp = m.querySelector('#bc-code');
      setTimeout(() => inp.focus(), 200);
      m.querySelector('#bc-go').onclick = () => {
        const code = inp.value.trim();
        if (!code) return UI.toast('Enter the number');
        lookup(code, close);
      };
    });
  }

  /* ---------- Open Food Facts lookup ---------- */
  function lookup(code, closePrev) {
    const close = UI.modal(`
      <h2>Looking up…</h2>
      <div class="bar-track"><div class="bar-fill" style="width:40%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></div></div>
      <p class="muted center" style="margin-top:12px">Searching Open Food Facts for ${UI.esc(code)}</p>
    `, () => {});
    if (closePrev) try { closePrev(); } catch (e) {}

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    fetch(OFF(code), { signal: ctrl.signal })
      .then(r => r.json())
      .then(json => {
        clearTimeout(t);
        UI.closeModal();
        if (json && json.status === 1 && json.product) {
          const parsed = mapProduct(json.product);
          App.Scan.reviewSheet(parsed, null);
        } else {
          notFound(code);
        }
      })
      .catch(() => {
        clearTimeout(t);
        UI.closeModal();
        UI.toast('Lookup failed — check your connection');
        notFound(code);
      });
  }

  function notFound(code) {
    UI.modal(`
      <h2>Not in the database</h2>
      <p class="muted" style="margin:-8px 0 14px">Barcode <b>${UI.esc(code)}</b> isn't listed yet. Scan the nutrition label instead, or enter the macros by hand.</p>
      <button class="btn primary" id="nf-label">🏷️ Scan the label</button>
      <button class="btn ghost" id="nf-manual" style="margin-top:10px">Enter macros manually</button>
    `, (m, close) => {
      m.querySelector('#nf-label').onclick = () => { close(); App.Scan.scanLabel(); };
      m.querySelector('#nf-manual').onclick = () => { close(); App.Scan.reviewSheet(blank(), null); };
    });
  }

  /* ---------- map Open Food Facts product -> review object ---------- */
  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const n = parseFloat(v); return isFinite(n) ? n : null;
  }
  function blank() { return { name:'', servingSizeText:'', servingGrams:null, servingsPerContainer:1, cal:null, p:null, c:null, f:null }; }

  function mapProduct(pr) {
    const n = pr.nutriments || {};
    const out = blank();
    out.name = (pr.product_name || pr.brands || 'Scanned product').toString().slice(0, 50);

    const servG = num(pr.serving_quantity); // grams in one serving
    const hasServingMacros = servG && (n['energy-kcal_serving'] != null || n.proteins_serving != null);

    if (hasServingMacros) {
      out.servingGrams = servG;
      out.servingSizeText = (pr.serving_size || `${servG} g`).toString().slice(0, 40);
      out.cal = num(n['energy-kcal_serving']);
      out.p  = num(n.proteins_serving);
      out.c  = num(n.carbohydrates_serving);
      out.f  = num(n.fat_serving);
    } else {
      // fall back to per-100g basis (clean for weight-based portions)
      out.servingGrams = 100;
      out.servingSizeText = '100 g';
      out.cal = num(n['energy-kcal_100g']);
      out.p  = num(n.proteins_100g);
      out.c  = num(n.carbohydrates_100g);
      out.f  = num(n.fat_100g);
    }
    // energy fallback (kJ -> kcal) if kcal missing
    if (out.cal == null) {
      const kj = num(n['energy-kj_serving']) || num(n['energy-kj_100g']) || num(n.energy_100g);
      if (kj != null) out.cal = Math.round(kj / 4.184);
    }
    if (out.cal == null && (out.p != null || out.c != null || out.f != null))
      out.cal = Math.round((out.p||0)*4 + (out.c||0)*4 + (out.f||0)*9);

    // servings per container from net quantity
    const packG = parseQtyGrams(pr.quantity);
    out.servingsPerContainer = (packG && out.servingGrams)
      ? Math.max(1, Math.round((packG / out.servingGrams) * 10) / 10) : 1;

    // tidy rounding
    ['cal'].forEach(k => out[k] = out[k] != null ? Math.round(out[k]) : null);
    ['p','c','f'].forEach(k => out[k] = out[k] != null ? Math.round(out[k]*10)/10 : null);
    return out;
  }

  function parseQtyGrams(q) {
    if (!q) return null;
    const s = String(q).toLowerCase();
    let m;
    if ((m = s.match(/([0-9.]+)\s*kg/))) return parseFloat(m[1]) * 1000;
    if ((m = s.match(/([0-9.]+)\s*lb/))) return parseFloat(m[1]) * 453.592;
    if ((m = s.match(/([0-9.]+)\s*oz/))) return parseFloat(m[1]) * OZ_G;
    if ((m = s.match(/([0-9.]+)\s*g/)))  return parseFloat(m[1]);
    if ((m = s.match(/([0-9.]+)\s*ml/))) return parseFloat(m[1]); // approx 1ml≈1g
    return null;
  }

  return { scan, manualEntry, lookup, mapProduct };
})();

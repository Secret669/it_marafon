/**
 * app.js — АгроФорма (повна версія з каскадним аналізом)
 */

import {
  getOptions, addOption,
  listForms, getForm, createForm, updateForm, deleteForm,
} from './api.js';

// ============================================================
// STATE
// ============================================================
let currentModule = 'crop';
let currentFormId = null;
let currentTab    = 0;
let currentForm   = null;

const MODULES = {
  crop:  { label: 'Рослинництво',       icon: '🌱',
           tabs: ['Загальна інформація', 'Маржинальний дохід', 'Основні засоби', 'Аналіз прибутковості'] },
  swine: { label: 'Відгодівля свиней',  icon: '🐷',
           tabs: ['МД — Таблиця 1', 'Каскад прибутковості', 'Аналіз беззбитковості'] },
  bulls: { label: 'Розведення бичків',  icon: '🐂',
           tabs: ['МД — Таблиця 1', 'Агрегація — Таблиця 2', 'Прибуток — Таблиця 3'] },
  dairy: { label: 'Молочне скотарство', icon: '🐄',
           tabs: ['МД — Таблиця 1', 'Агрегація — Таблиця 2', 'Прибуток — Таблиця 3'] },
};

// ============================================================
// NAVIGATION
// ============================================================
function switchModule(mod) {
  currentModule = mod;
  currentFormId = null;
  currentForm   = null;
  currentTab    = 0;
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + mod).classList.add('active');
  document.getElementById('forms-panel-title').textContent = MODULES[mod].label;
  renderFormsList();
  showEmpty();
}
window.switchModule = switchModule;

function showEmpty() {
  document.getElementById('editor-empty').style.display   = 'flex';
  document.getElementById('editor-content').style.display = 'none';
}
function showEditor() {
  document.getElementById('editor-empty').style.display   = 'none';
  document.getElementById('editor-content').style.display = 'flex';
}

// ============================================================
// FORMS LIST PANEL
// ============================================================
async function renderFormsList() {
  const list = document.getElementById('forms-list');
  list.innerHTML = '<div style="padding:12px;color:var(--gray);font-size:12px">Завантаження…</div>';
  const forms = await listForms(currentModule);
  if (!forms.length) {
    list.innerHTML = '<div style="padding:16px;color:var(--gray);font-size:12px;text-align:center">Поки немає форм.<br>Натисніть «+ Нова»</div>';
    return;
  }
  list.innerHTML = forms.map(f => {
    const date = f.updated_at
      ? new Date(f.updated_at).toLocaleDateString('uk')
      : new Date(f.updatedAt).toLocaleDateString('uk');
    return `<div class="form-item ${String(f.id) === String(currentFormId) ? 'active' : ''}" onclick="openForm('${f.id}')">
      <div class="form-item-name">${escH(f.name)}</div>
      <div class="form-item-date">${date}</div>
    </div>`;
  }).join('');
}

async function openForm(id) {
  currentFormId = String(id);
  currentTab    = 0;
  currentForm   = await getForm(id);
  if (!currentForm) return;
  if (typeof currentForm.data === 'string') currentForm.data = JSON.parse(currentForm.data);
  renderFormsList();
  renderEditor();
}
window.openForm = openForm;

window.newForm = async function() {
  const name = 'Нова форма ' + new Date().toLocaleDateString('uk');
  const f    = await createForm(currentModule, name);
  currentFormId = String(f.id);
  currentForm   = f;
  currentTab    = 0;
  await renderFormsList();
  renderEditor();
  toast('Нову форму створено', 'success');
};

window.saveCurrentForm = async function() {
  if (!currentFormId || !currentForm) return;
  const name = document.getElementById('form-name-input').value || currentForm.name;
  const data = collectFormData();
  currentForm.name = name;
  currentForm.data = data;
  await updateForm(currentFormId, name, data);
  renderFormsList();
  toast('Збережено', 'success');
};

window.duplicateForm = async function() {
  if (!currentFormId || !currentForm) return;
  const f = await createForm(currentModule, currentForm.name + ' (копія)');
  await updateForm(f.id, f.name, currentForm.data || {});
  currentFormId = String(f.id);
  currentForm   = await getForm(f.id);
  if (typeof currentForm.data === 'string') currentForm.data = JSON.parse(currentForm.data);
  currentTab    = 0;
  await renderFormsList();
  renderEditor();
  toast('Форму продубльовано');
};

window.deleteCurrentForm = async function() {
  if (!currentFormId) return;
  if (!confirm('Видалити цю форму?')) return;
  await deleteForm(currentFormId);
  currentFormId = null;
  currentForm   = null;
  await renderFormsList();
  showEmpty();
  toast('Форму видалено');
};

// ============================================================
// COLLECT DATA
// ============================================================
function collectFormData() {
  const data = {};
  document.querySelectorAll('[data-field]').forEach(el => {
    data[el.dataset.field] = el.value;
  });
  document.querySelectorAll('[data-dyn-section]').forEach(tbody => {
    const section = tbody.dataset.dynSection;
    const rows = [];
    tbody.querySelectorAll('tr[data-row-idx]').forEach(tr => {
      const row = {};
      tr.querySelectorAll('[data-col]').forEach(inp => {
        row[inp.dataset.col] = inp.value;
      });
      rows.push(row);
    });
    data[section] = rows;
  });
  return data;
}

function fillField(data, key, def = '') {
  return (data && data[key] !== undefined) ? data[key] : def;
}
function dynRows(data, section, defaults = []) {
  if (data && Array.isArray(data[section]) && data[section].length) return data[section];
  return defaults;
}

// ============================================================
// EDITOR
// ============================================================
function renderEditor() {
  if (!currentForm) return;
  showEditor();
  document.getElementById('form-name-input').value = currentForm.name;
  renderTabs();
  renderTab();
}

function renderTabs() {
  const tabs = MODULES[currentModule].tabs;
  document.getElementById('form-tabs').innerHTML = tabs
    .map((t, i) => `<div class="form-tab ${i === currentTab ? 'active' : ''}" onclick="switchTab(${i})">${t}</div>`)
    .join('');
}
window.switchTab = function(i) {
  window.saveCurrentForm();
  currentTab = i;
  renderTabs();
  renderTab();
};

function renderTab() {
  if (!currentForm) return;
  const body = document.getElementById('form-body');
  const builders = {
    crop:  [buildCropGeneral,  buildCropGM,    buildCropAssets,   buildCropAnalysis],
    swine: [buildSwineF1,      buildSwineF2,   buildSwineAnalysis],
    bulls: [buildBullsMD,      buildBullsAgg,  buildBullsProfit],
    dairy: [buildDairyMD,      buildDairyAgg,  buildDairyProfit],
  };
  body.innerHTML = '';
  builders[currentModule][currentTab](body, currentForm.data || {});
  recalcAll();
}

// ============================================================
// BASE HELPERS
// ============================================================
function escH(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 2500);
}
function fnum(v)       { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmt(v, dec=2) { return isNaN(v)||!isFinite(v) ? '—' : Number(v).toFixed(dec); }

function row(label, inputHtml, unit = '', small = '') {
  return `<div class="field-row">
    <div class="field-label">${label}${small ? `<small>${small}</small>` : ''}</div>
    <div class="field-input">${inputHtml}</div>
    <div class="field-unit">${unit}</div>
  </div>`;
}
function sectionWrap(title, content, colorClass = '') {
  return `<div class="section">
    <div class="section-header ${colorClass}">${title}</div>
    <div class="section-body">${content}</div>
  </div>`;
}
function numField(field, data, def = '', readonly = false) {
  const val = fillField(data, field, def);
  if (readonly) return `<input type="text" data-field="${field}" value="${escH(val)}" readonly class="calc" placeholder="авто">`;
  return `<input type="number" data-field="${field}" value="${escH(val)}" step="any" oninput="recalcAll()">`;
}
function textField(field, data, placeholder = '') {
  return `<input type="text" data-field="${field}" value="${escH(fillField(data,field))}" placeholder="${placeholder}" oninput="recalcAll()">`;
}
function selectField(field, data, options) {
  const val  = fillField(data, field);
  const opts = options.map(o => `<option value="${escH(o)}" ${val===o?'selected':''}>${escH(o)}</option>`).join('');
  return `<select data-field="${field}" onchange="recalcAll()">${opts}</select>`;
}

// ── Combobox ─────────────────────────────────────────────────
async function cbHtml(field, data, optKey, placeholder = '') {
  const val  = escH(fillField(data, field));
  const opts = await getOptions(optKey);
  return `
<div class="combobox" id="cb-${field}">
  <div class="combobox-input-wrap">
    <input type="text" data-field="${field}" value="${val}" placeholder="${placeholder}"
      oninput="recalcAll()" onfocus="openCB('${field}','${optKey}')" autocomplete="off">
    <button class="combobox-btn" type="button" onclick="toggleCB('${field}','${optKey}')">▼</button>
  </div>
  <div class="combobox-dropdown" id="cbd-${field}">
    ${opts.map(o=>`<div class="combobox-option" onclick="selectCB('${field}','${optKey}',this)">${escH(o)}</div>`).join('')}
    <div class="combobox-add" onclick="addCBOption('${field}','${optKey}')">＋ Додати нову сталу…</div>
  </div>
</div>`;
}

window.openCB = function(field, optKey) {
  refreshCBDropdown(field, optKey);
  document.getElementById('cbd-' + field).classList.add('open');
  document.addEventListener('click', function h(e) {
    if (!document.getElementById('cb-' + field)?.contains(e.target)) {
      document.getElementById('cbd-' + field)?.classList.remove('open');
      document.removeEventListener('click', h);
    }
  });
};
window.toggleCB = function(field, optKey) {
  const dd = document.getElementById('cbd-' + field);
  if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
  window.openCB(field, optKey);
};
window.selectCB = function(field, optKey, el) {
  const inp = document.querySelector(`[data-field="${field}"]`);
  if (inp) { inp.value = el.textContent; recalcAll(); }
  document.getElementById('cbd-' + field).classList.remove('open');
};
window.addCBOption = async function(field, optKey) {
  const val = prompt('Введіть нове значення:');
  if (!val) return;
  await addOption(optKey, val.trim());
  refreshCBDropdown(field, optKey);
  const inp = document.querySelector(`[data-field="${field}"]`);
  if (inp) { inp.value = val.trim(); recalcAll(); }
};
async function refreshCBDropdown(field, optKey) {
  const opts   = await getOptions(optKey);
  const dd     = document.getElementById('cbd-' + field);
  if (!dd) return;
  const addBtn = dd.querySelector('.combobox-add');
  dd.querySelectorAll('.combobox-option').forEach(e => e.remove());
  opts.forEach(o => {
    const d = document.createElement('div');
    d.className   = 'combobox-option';
    d.textContent = o;
    d.onclick = () => window.selectCB(field, optKey, d);
    dd.insertBefore(d, addBtn);
  });
}

// ============================================================
// DYNAMIC TABLE COMPONENT
// ============================================================
function dynTable(section, rows, columns, opts = {}) {
  const addLabel  = opts.addLabel || '+ Додати рядок';
  const headerCells = columns.map(c => `<th${c.width ? ` style="width:${c.width}"` : ''}>${c.label}</th>`).join('') + '<th style="width:32px"></th>';
  const bodyRows = rows.map((r, idx) => {
    const cells = columns.map(c => {
      const val = escH(r[c.key] || c.def || '');
      if (c.type === 'calc') {
        return `<td><input data-col="${c.key}" data-dyn-row="${idx}" value="${val}" readonly class="calc"></td>`;
      }
      const type = c.type === 'number' ? 'number' : 'text';
      return `<td><input type="${type}" data-col="${c.key}" data-dyn-row="${idx}" value="${val}" step="any" oninput="recalcAll()"></td>`;
    }).join('');
    return `<tr data-row-idx="${idx}">${cells}<td><button class="dyn-del-btn" onclick="dynDelRow('${section}',${idx})" title="Видалити">✕</button></td></tr>`;
  }).join('');

  return `<div class="dyn-table-wrap"><table class="table-section">
    <thead><tr>${headerCells}</tr></thead>
    <tbody data-dyn-section="${section}">${bodyRows}</tbody>
  </table></div>
  <button class="add-row-btn" onclick="dynAddRow('${section}')">${addLabel}</button>`;
}

window.dynAddRow = function(section) {
  const tbody = document.querySelector(`[data-dyn-section="${section}"]`);
  if (!tbody) return;
  const idx     = tbody.querySelectorAll('tr[data-row-idx]').length;
  const tr      = document.createElement('tr');
  tr.dataset.rowIdx = idx;
  const firstRow = tbody.querySelector('tr[data-row-idx="0"]');
  if (firstRow) {
    tr.innerHTML = firstRow.innerHTML
      .replace(/data-dyn-row="\d+"/g, `data-dyn-row="${idx}"`)
      .replace(/value="[^"]*"/g, 'value=""');
    const btn = tr.querySelector('.dyn-del-btn');
    if (btn) btn.setAttribute('onclick', `dynDelRow('${section}',${idx})`);
  }
  tbody.appendChild(tr);
  recalcAll();
};

window.dynDelRow = function(section, idx) {
  const tbody = document.querySelector(`[data-dyn-section="${section}"]`);
  if (!tbody) return;
  const tr = tbody.querySelector(`tr[data-row-idx="${idx}"]`);
  if (tr) { tr.remove(); reindexDyn(tbody); recalcAll(); }
};

function reindexDyn(tbody) {
  tbody.querySelectorAll('tr[data-row-idx]').forEach((tr, i) => {
    tr.dataset.rowIdx = i;
    tr.querySelectorAll('[data-dyn-row]').forEach(el => { el.dataset.dynRow = i; });
    const btn = tr.querySelector('.dyn-del-btn');
    if (btn) btn.setAttribute('onclick', `dynDelRow('${tbody.dataset.dynSection}',${i})`);
  });
}

(function injectDynStyles() {
  if (document.getElementById('dyn-style')) return;
  const s = document.createElement('style');
  s.id = 'dyn-style';
  s.textContent = `
    .dyn-del-btn{background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:2px 4px;border-radius:4px}
    .dyn-del-btn:hover{background:#fee2e2}
    .add-row-btn{margin-top:6px;background:none;border:1px dashed var(--border);border-radius:4px;padding:5px 12px;color:var(--gray);cursor:pointer;font-size:12px}
    .add-row-btn:hover{border-color:var(--blue);color:var(--blue)}
  `;
  document.head.appendChild(s);
})();

// ============================================================
// CASCADE TABLE HELPERS
// ============================================================
function cRow(label, field, data, def = '', sign = '−', small = '') {
  return `<tr class="cascade-row">
    <td class="cascade-sign">${sign}</td>
    <td class="cascade-label">${label}${small ? `<small>${small}</small>` : ''}</td>
    <td class="cascade-value">${numField(field, data, def)}</td>
  </tr>`;
}
function cRowCalc(label, field, data, sign = '−', small = '') {
  return `<tr class="cascade-row">
    <td class="cascade-sign">${sign}</td>
    <td class="cascade-label">${label}${small ? `<small>${small}</small>` : ''}</td>
    <td class="cascade-value">${numField(field, data, '', true)}</td>
  </tr>`;
}
function cResult(label, field, data) {
  return `<tr class="cascade-result">
    <td class="cascade-sign">=</td>
    <td class="cascade-label">${label}</td>
    <td class="cascade-value">${numField(field, data, '', true)}</td>
  </tr>`;
}
function cProfit(label, field, data) {
  return `<tr id="cprofit-${field}" class="cascade-profit">
    <td class="cascade-sign">=</td>
    <td class="cascade-label">${label}</td>
    <td class="cascade-value">${numField(field, data, '', true)}</td>
  </tr>`;
}

// Shared cascade parameters section (capital, labour, land, fixed)
function cascadeParamsSection(prefix, data) {
  return sectionWrap('⚙️ Параметри каскаду (капітал, праця, земля, постійні)', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div class="cascade-params-header">💰 Капітал оборотних активів</div>
        ${row('% власного капіталу', numField(prefix+'_cap_own_pct', data, '15'), '%')}
        ${row('% залученого капіталу', numField(prefix+'_cap_hire_pct', data, '17'), '%')}
        ${row('Частка власного капіталу', numField(prefix+'_cap_own_share', data, '0.5'), '0–1')}
        <div class="cascade-params-header">🛠️ Техніка</div>
        ${row('Вартість придбання (A)', numField(prefix+'_mach_a', data, '1250'), 'грн/гол.')}
        ${row('Амортизація', numField(prefix+'_mach_dep_pct', data, '10'), '%')}
        ${row('Ремонт', numField(prefix+'_mach_rep_pct', data, '1'), '%')}
        <div class="cascade-params-header">🏗️ Будівлі</div>
        ${row('Вартість придбання (A)', numField(prefix+'_build_a', data, '2501'), 'грн/гол.')}
        ${row('Амортизація', numField(prefix+'_build_dep_pct', data, '4'), '%')}
        ${row('Утримання', numField(prefix+'_build_maint_pct', data, '1'), '%')}
      </div>
      <div>
        <div class="cascade-params-header">👷 Праця виробнича</div>
        ${row('Власна праця', numField(prefix+'_labor_own_h', data, '5'), 'год/гол.')}
        ${row('ЗП власна', numField(prefix+'_wage_own', data, '2.5'), 'грн/год')}
        ${row('Найм. праця', numField(prefix+'_labor_hire_h', data, '5'), 'год/гол.')}
        ${row('ЗП наймана', numField(prefix+'_wage_hire', data, '2.8'), 'грн/год')}
        <div class="cascade-params-header">🌿 Земля та інші альтернативні</div>
        ${row('Власна земля', numField(prefix+'_land_own', data, '125'), 'грн/гол.')}
        ${row('Оренда землі', numField(prefix+'_land_rent', data, '150'), 'грн/гол.')}
        ${row('Інші альтернативні', numField(prefix+'_land_other', data, '0'), 'грн/гол.')}
        <div class="cascade-params-header">📦 Постійні витрати</div>
        ${row('Загальна праця', numField(prefix+'_gen_labor_h', data, '5'), 'год/гол.')}
        ${row('Інші пост. спеціальні', numField(prefix+'_fixed_spec', data, '25'), 'грн/гол.')}
        ${row('Накладні витрати', numField(prefix+'_overhead', data, '18'), 'грн/гол.')}
      </div>
    </div>
  `);
}

// Render full cascade waterfall for a prefix
// grossField: auto-calculated gross revenue per head
// varField: auto-calculated variable costs per head
function cascadeWaterfall(prefix, data, grossField, varField, resultLabel) {
  return `
  <table class="cascade-table">
    ${cRowCalc('Валова виручка / гол.', grossField, data, '')}
    ${cRowCalc('Пропорційні змінні витрати / гол.', varField, data)}
    ${cResult('МД практичний / гол.', prefix+'_md_pract', data)}
    ${cRowCalc('Відсотки на оборотний капітал',  prefix+'_cap_oa', data, '',
       'ЗВ × 0.6 × (власн.% × частка + залуч.% × (1–частка))')}
    ${cResult('МД I / гол.', prefix+'_md1', data)}
    ${cRowCalc('Виробнича праця (власна + найм.)', prefix+'_labor_total', data, '',
       'год × ставка')}
    ${cResult('МД II / гол.', prefix+'_md2', data)}
    ${cRowCalc('Земля (власна + оренда)', prefix+'_land_total', data)}
    ${cRowCalc('Інші альтернативні витрати', prefix+'_land_other_c', data)}
    ${cResult('МД III / гол.', prefix+'_md3', data)}
    ${cRowCalc('Техніка: амортизація + ремонт', prefix+'_mach_fixed', data, '',
       'A × (деп% + рем%)')}
    ${cRowCalc('Будівлі: амортизація + утримання', prefix+'_build_fixed', data, '',
       'A × (деп% + утрим%)')}
    ${cRowCalc('Відсотки на осн. капітал', prefix+'_main_cap', data, '',
       '(A_тех + A_буд)/2 × avg%')}
    ${cRowCalc('Загальна праця', prefix+'_gen_labor', data)}
    ${cRowCalc('Інші постійні спеціальні', prefix+'_fixed_spec_c', data)}
    ${cRowCalc('Накладні витрати', prefix+'_overhead_c', data)}
    ${cProfit(resultLabel, prefix+'_profit', data)}
  </table>`;
}

// Build manure nutrient table (adds to revenue)
// prefix: field prefix; lu_field: field name of LU per head
// defaults: {n_kg, n_eff, p_kg, p_eff, k_kg, k_eff}
function manureTable(prefix, data, lu_field, defaults) {
  const d = defaults;
  const f = (key, def) => `<input type="number" data-field="${prefix}${key}" value="${fillField(data, prefix+key, def)}" step="any" style="width:100%;padding:3px 5px;border:1px solid var(--border);border-radius:4px;font-size:12px;outline:none" oninput="recalcAll()">`;
  const c = (key) => `<input data-field="${prefix}${key}" readonly class="calc" style="width:100%;padding:3px 5px;border-radius:4px;font-size:12px">`;
  return `<table class="manure-table">
    <thead><tr>
      <th>Речовина</th><th style="width:65px">кг/УГ</th><th style="width:50px">Еф.</th>
      <th style="width:80px">Розр. к-сть</th><th style="width:65px">Ціна/кг</th>
      <th style="width:80px">Вартість</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>N (азот)</td>
        <td>${f('_man_n_kg', d.n_kg)}</td><td>${f('_man_n_eff', d.n_eff)}</td>
        <td>${c('_man_n_qty')}</td><td>${f('_man_n_price', '')}</td><td>${c('_man_n_val')}</td>
      </tr>
      <tr>
        <td>P₂O₅ (фосфор)</td>
        <td>${f('_man_p_kg', d.p_kg)}</td><td>${f('_man_p_eff', d.p_eff)}</td>
        <td>${c('_man_p_qty')}</td><td>${f('_man_p_price', '')}</td><td>${c('_man_p_val')}</td>
      </tr>
      <tr>
        <td>K₂O (калій)</td>
        <td>${f('_man_k_kg', d.k_kg)}</td><td>${f('_man_k_eff', d.k_eff)}</td>
        <td>${c('_man_k_qty')}</td><td>${f('_man_k_price', '')}</td><td>${c('_man_k_val')}</td>
      </tr>
    </tbody>
  </table>
  <div style="font-size:11px;color:var(--gray);margin-bottom:4px">УГ / гол. (авто): <input data-field="${prefix}${lu_field}" readonly class="calc" style="width:70px;padding:2px 5px;font-size:11px;border-radius:4px"> УГ</div>
  ${row('<strong>Вартість гною, всього</strong>', numField(prefix+'_man_total', data, '', true), 'грн')}`;
}

// ============================================================
// MODULE: РОСЛИННИЦТВО
// ============================================================
async function buildCropGeneral(body, data) {
  body.innerHTML = sectionWrap('📋 Загальна інформація про підприємство', `
    ${row('ПІБ викладача / відповідального', textField('gen_teacher', data))}
    ${row('Навчальний заклад',               textField('gen_school',  data))}
    ${row('Район, область',                  '<div id="ph-gen_region"></div>')}
    ${row('Розмір підприємства',             numField('gen_size', data), 'га')}
    ${row('Організаційно-правова форма',     '<div id="ph-gen_orgform"></div>')}
    ${row('Спеціалізація',                   '<div id="ph-gen_spec"></div>')}
    ${row('Річна кількість опадів',          numField('gen_rain', data), 'мм')}
    ${row('Використання зрошування',         selectField('gen_irrig', data, ['no','yes']))}
    ${row('Система вирощування',             '<div id="ph-gen_system"></div>')}
    ${row('Вегетаційний період',             numField('gen_veg', data), 'місяців')}
    ${row('Грошова одиниця',                 '<div id="ph-gen_curr"></div>')}
  `) + sectionWrap('👥 Співробітники', `
    ${dynTable('employees', dynRows(data,'employees',[{name:'',role:'',phone:'',email:''}]), [
      { key:'name',  label:'ПІБ',    type:'text' },
      { key:'role',  label:'Посада', type:'text' },
      { key:'phone', label:'Тел.',   type:'text' },
      { key:'email', label:'Email',  type:'text' },
    ], { addLabel:'+ Додати співробітника' })}
  `,'blue');

  for (const [field, key, ph] of [
    ['gen_region', 'regions',   'напр. Полтавський р-н…'],
    ['gen_orgform','orgforms',  'ФГ, ТОВ, ПП…'],
    ['gen_spec',   'specs',     'рослинництво…'],
    ['gen_system', 'growsys',   'conventional farming'],
    ['gen_curr',   'currencies','грн, €, $'],
  ]) {
    const ph_el = document.getElementById('ph-' + field);
    if (ph_el) ph_el.outerHTML = await cbHtml(field, data, key, ph);
  }
}

async function buildCropGM(body, data) {
  const curr = fillField(data, 'gm_curr', 'грн');
  body.innerHTML = `
  ${sectionWrap('🌾 Назва та параметри культури', `
    <div id="ph-gm_crop"></div>
    ${row('Площа вирощування', numField('gm_area', data), 'га')}
    <div id="ph-gm_curr-row"></div>
  `, 'blue')}

  ${sectionWrap('💰 Валова виручка', `
    <table class="table-section">
      <thead><tr>
        <th>Продукція</th><th style="width:55px">Од.</th>
        <th style="width:90px">Вал. врожайність</th>
        <th style="width:90px">Товарна к-сть</th>
        <th style="width:80px">Ціна/од.</th>
        <th style="width:90px">Сума (авто)</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>Основна продукція</td>
          <td><input data-field="gm_p1_unit" value="${fillField(data,'gm_p1_unit','ц')}" oninput="recalcAll()" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px"></td>
          <td><input type="number" data-field="gm_p1_gross_qty" value="${fillField(data,'gm_p1_gross_qty','')}" step="any" oninput="recalcAll()" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px"></td>
          <td><input type="number" data-field="gm_p1_qty" value="${fillField(data,'gm_p1_qty','')}" step="any" oninput="recalcAll()" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px"></td>
          <td><input type="number" data-field="gm_p1_price" value="${fillField(data,'gm_p1_price','')}" step="any" oninput="recalcAll()" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px"></td>
          <td><input data-field="gm_p1_sum" readonly class="calc" style="width:100%"></td>
        </tr>
      </tbody>
    </table>
    <div style="margin:8px 0 4px;font-size:12px;color:var(--gray);font-weight:600">Побічна продукція:</div>
    ${dynTable('gm_side', dynRows(data,'gm_side',[{name:'Солома',unit:'ц',qty:'',price:'',sum:''}]), [
      { key:'name',  label:'Вид продукції', type:'text'   },
      { key:'unit',  label:'Од.',           type:'text',   width:'55px', def:'ц' },
      { key:'qty',   label:'К-сть/га',      type:'number' },
      { key:'price', label:'Ціна/од.',      type:'number' },
      { key:'sum',   label:'Сума (авто)',   type:'calc'   },
    ], {addLabel:'+ Побічна продукція'})}
    ${row('Побічна продукція, всього', numField('gm_p_side_total',data,'',true), curr)}
    ${row('Субсидії / дотації', numField('gm_subsidy',data), curr, 'грн/га')}
    ${row('<strong>Валова виручка, всього</strong>', numField('gm_gross_rev',data,'',true), curr)}
  `, 'green')}

  ${sectionWrap('🌱 Насіння', `
    ${dynTable('gm_seeds', dynRows(data,'gm_seeds',[{name:'',unit:'кг',qty:'',price:'',sum:''}]), [
      { key:'name',  label:'Назва',         type:'text'   },
      { key:'unit',  label:'Од.',           type:'text',   width:'55px', def:'кг' },
      { key:'qty',   label:'К-сть/га',      type:'number' },
      { key:'price', label:'Ціна/од.',      type:'number' },
      { key:'sum',   label:'Сума (авто)',   type:'calc'   },
    ])}
    ${row('<strong>Витрати на насіння, всього</strong>', numField('gm_seed_total',data,'',true), curr)}
  `)}

  ${sectionWrap('🧪 Добрива', `
    <table class="table-section">
      <thead><tr>
        <th>Речовина</th>
        <th style="width:90px">кг/ц осн.прод.</th>
        <th style="width:90px">кг/ц боч.прод.</th>
        <th style="width:90px">К-сть (авто), кг/га</th>
        <th style="width:70px">Ціна/кг</th>
        <th style="width:90px">Сума (авто)</th>
      </tr></thead>
      <tbody>
        ${[['N','1.2','0.4'],['P2O5','1.0','1.0'],['K2O','1.0','1.0']].map(([nm,dm,ds])=>`<tr>
          <td>${nm.replace('2O5','₂O₅').replace('2O','₂O')}</td>
          <td><input type="number" data-field="gm_${nm}_main" value="${fillField(data,'gm_'+nm+'_main',dm)}" step="any" oninput="recalcAll()"></td>
          <td><input type="number" data-field="gm_${nm}_side" value="${fillField(data,'gm_'+nm+'_side',ds)}" step="any" oninput="recalcAll()"></td>
          <td><input data-field="gm_${nm}_qty" readonly class="calc"></td>
          <td><input type="number" data-field="gm_${nm}_price" value="${fillField(data,'gm_'+nm+'_price','')}" step="any" oninput="recalcAll()"></td>
          <td><input data-field="gm_${nm}_sum" readonly class="calc"></td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${row('<strong>Витрати на добрива, всього</strong>', numField('gm_fert_total',data,'',true), curr)}
  `)}

  ${sectionWrap('🌿 Засоби захисту рослин (ЗЗР)', `
    ${dynTable('gm_zzr', dynRows(data,'gm_zzr',[{name:'',unit:'л/га',qty:'',price:'',sum:''}]), [
      { key:'name',  label:'Препарат',      type:'text'   },
      { key:'unit',  label:'Од.',           type:'text',   width:'55px', def:'л/га' },
      { key:'qty',   label:'К-сть/га',      type:'number' },
      { key:'price', label:'Ціна/од.',      type:'number' },
      { key:'sum',   label:'Сума (авто)',   type:'calc'   },
    ])}
    ${row('<strong>Витрати на ЗЗР, всього</strong>', numField('gm_zzr_total',data,'',true), curr)}
  `)}

  ${sectionWrap('⚙️ Механізація та послуги', `
    ${row('Послуги підрядників (механізація)', numField('gm_mech_contract',data), curr)}
    ${row('Змінні витрати власної техніки',    numField('gm_mech_own',data),      curr)}
    ${row('Ремонт та ТО основних засобів',     numField('gm_mech_repair',data),   curr)}
    ${row('Сушка та зберігання',              numField('gm_dry',data),            curr)}
    ${row('Страхування (від граду)',           numField('gm_insure',data),         curr)}
    ${row('Інші прямі витрати',               numField('gm_other',data),          curr)}
    ${row('<strong>Механізація та ін., всього</strong>', numField('gm_mech_total',data,'',true), curr)}
  `)}

  <div class="md-summary">
    <h3>Маржинальний дохід</h3>
    <div class="md-value" id="md-crop-val">—</div>
    <div class="md-per-unit" id="md-crop-per">на 1 га: —</div>
  </div>

  ${sectionWrap('📊 Підсумок МД', `
    ${row('Пропорційні змінні витрати, всього', numField('gm_var_total',data,'',true), curr)}
    ${row('<strong>Маржинальний дохід (МД)</strong>', numField('gm_md',data,'',true), curr)}
    ${row('МД на 1 га',                               numField('gm_md_per_ha',data,'',true), curr+'/га')}
    ${row('МД на 1 ц основної продукції',              numField('gm_md_per_dt',data,'',true), curr+'/ц')}
    ${row('Потреба в капіталі (ЗВ × 0.6)',             numField('gm_capital',data,'',true), curr)}
  `)}`;

  for (const [field, key, ph] of [['gm_crop','crops','пшениця, кукурудза…'],['gm_curr','currencies','грн, €, $']]) {
    const el = document.getElementById('ph-' + field) || document.getElementById('ph-' + field + '-row');
    if (el) {
      const html = await cbHtml(field, data, key, ph);
      if (field === 'gm_crop') el.outerHTML = row('Назва культури', html);
      else                      el.outerHTML = row('Грошова одиниця', html);
    }
  }
}

async function buildCropAssets(body, data) {
  body.innerHTML =
    sectionWrap('🚜 Машини, інструменти, обладнання', `
      ${dynTable('ast_machines', dynRows(data,'ast_machines',[{name:'',cnt:'1',a:'',r:'',n:'',pct:'',dep:'',rep:''}]), [
        { key:'name', label:'Опис',           type:'text'   },
        { key:'cnt',  label:'К-ть',           type:'number', width:'50px', def:'1' },
        { key:'a',    label:'Варт. A',         type:'number' },
        { key:'r',    label:'Залишк. R',       type:'number' },
        { key:'n',    label:'Строк N, р.',     type:'number' },
        { key:'pct',  label:'% ремонту',       type:'number' },
        { key:'dep',  label:'Аморт. (авто)',   type:'calc'   },
        { key:'rep',  label:'Рем. (авто)',     type:'calc'   },
      ])}
      ${row('<strong>Амортизація, всього</strong>',      numField('ast_m_dep_total',data,'',true), 'грн')}
      ${row('<strong>Відрах. на ремонт, всього</strong>',numField('ast_m_rep_total',data,'',true), 'грн')}
    `) +
    sectionWrap('🏗️ Будівлі та споруди', `
      ${dynTable('ast_buildings', dynRows(data,'ast_buildings',[{name:'',cnt:'1',a:'',r:'',n:'',pct:'',dep:'',maint:''}]), [
        { key:'name',  label:'Опис',           type:'text'   },
        { key:'cnt',   label:'К-ть',           type:'number', width:'50px', def:'1' },
        { key:'a',     label:'Варт. A',         type:'number' },
        { key:'r',     label:'Залишк. R',       type:'number' },
        { key:'n',     label:'Строк N, р.',     type:'number' },
        { key:'pct',   label:'% догляду',       type:'number' },
        { key:'dep',   label:'Аморт. (авто)',   type:'calc'   },
        { key:'maint', label:'Дог. (авто)',     type:'calc'   },
      ])}
      ${row('<strong>Амортизація, всього</strong>',      numField('ast_b_dep_total',data,'',true), 'грн')}
      ${row('<strong>Відрах. на догляд, всього</strong>',numField('ast_b_maint_total',data,'',true),'грн')}
    `);
}

function buildCropAnalysis(body, data) {
  body.innerHTML = `
  <div style="font-size:12px;color:var(--gray);margin-bottom:12px">
    Аналіз прибутковості (каскад МД → МД I → МД II → МД III → Прибуток) на 1 га.
    Значення МД береться з вкладки «Маржинальний дохід».
  </div>

  ${sectionWrap('⚙️ Параметри аналізу (на 1 га)', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div class="cascade-params-header">💰 Капітал оборотних активів</div>
        ${row('% власного капіталу', numField('ca_cap_own_pct', data, '15'), '%')}
        ${row('% залученого капіталу', numField('ca_cap_hire_pct', data, '17'), '%')}
        ${row('Частка власного', numField('ca_cap_own_share', data, '0.5'), '0–1')}
        <div class="cascade-params-header">🛠️ Техніка на 1 га</div>
        ${row('Вартість придбання', numField('ca_mach_a', data, ''), 'грн/га')}
        ${row('Амортизація', numField('ca_mach_dep_pct', data, '10'), '%')}
        ${row('Ремонт', numField('ca_mach_rep_pct', data, '1'), '%')}
        <div class="cascade-params-header">🏗️ Будівлі на 1 га</div>
        ${row('Вартість придбання', numField('ca_build_a', data, ''), 'грн/га')}
        ${row('Амортизація', numField('ca_build_dep_pct', data, '4'), '%')}
        ${row('Утримання', numField('ca_build_maint_pct', data, '1'), '%')}
      </div>
      <div>
        <div class="cascade-params-header">👷 Праця виробнича</div>
        ${row('Власна праця', numField('ca_labor_own_h', data, ''), 'год/га')}
        ${row('ЗП власна', numField('ca_wage_own', data, '2.5'), 'грн/год')}
        ${row('Найм. праця', numField('ca_labor_hire_h', data, ''), 'год/га')}
        ${row('ЗП наймана', numField('ca_wage_hire', data, '2.8'), 'грн/год')}
        <div class="cascade-params-header">🌿 Земля (грн/га)</div>
        ${row('Власна земля', numField('ca_land_own', data, ''), 'грн/га')}
        ${row('Оренда землі', numField('ca_land_rent', data, ''), 'грн/га')}
        ${row('Інші альтернативні', numField('ca_land_other', data, '0'), 'грн/га')}
        <div class="cascade-params-header">📦 Постійні витрати</div>
        ${row('Загальна праця', numField('ca_gen_labor_h', data, ''), 'год/га')}
        ${row('Ставка загал. праці', numField('ca_gen_wage', data, '2.5'), 'грн/год')}
        ${row('Інші пост. спеціальні', numField('ca_fixed_spec', data, ''), 'грн/га')}
        ${row('Накладні витрати', numField('ca_overhead', data, ''), 'грн/га')}
      </div>
    </div>
  `)}

  ${sectionWrap('📊 Каскад прибутковості на 1 га', `
    <table class="cascade-table">
      ${cRowCalc('МД практичний / га', 'gm_md_per_ha', data, '')}
      ${cRowCalc('Відсотки на оборотний капітал', 'ca_cap_oa', data, '',
         'ЗВ/га × 0.6 × avg%')}
      ${cResult('МД I / га', 'ca_md1', data)}
      ${cRowCalc('Виробнича праця / га', 'ca_labor_total', data)}
      ${cResult('МД II / га', 'ca_md2', data)}
      ${cRowCalc('Земля та альтернативні / га', 'ca_land_total', data)}
      ${cResult('МД III / га', 'ca_md3', data)}
      ${cRowCalc('Техніка: аморт. + ремонт', 'ca_mach_fixed', data)}
      ${cRowCalc('Будівлі: аморт. + утримання', 'ca_build_fixed', data)}
      ${cRowCalc('Відсотки на осн. капітал', 'ca_main_cap', data)}
      ${cRowCalc('Загальна праця', 'ca_gen_labor', data)}
      ${cRowCalc('Інші постійні спеціальні', 'ca_fixed_spec_c', data)}
      ${cRowCalc('Накладні витрати', 'ca_overhead_c', data)}
      ${cProfit('Прибуток / га', 'ca_profit_ha', data)}
    </table>
    ${row('Площа (з вкладки МД)', numField('gm_area', data, '', true), 'га')}
    ${row('<strong>Прибуток загальний</strong>', numField('ca_profit_total', data, '', true), 'грн')}
  `, 'green')}`;
}

// ============================================================
// MODULE: ВІДГОДІВЛЯ СВИНЕЙ
// ============================================================
function buildSwineF1(body, data) {
  body.innerHTML = `
  <div style="margin-bottom:10px;font-size:12px;color:var(--gray)">
    Таблиця 1 — Маржинальний дохід. Два варіанти відгодівлі для порівняння.
  </div>
  <div class="cascade-cols">
  ${['1','2'].map(v => `<div>
    ${sectionWrap(`🐷 Варіант ${v}`, `
      <div style="font-size:11px;font-weight:700;color:var(--gray);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Виробничі показники</div>
      ${row('Вага поросяти (початок)', numField('sw'+v+'_w_start',data,'25'), 'кг')}
      ${row('Вага реалізації (кінець)', numField('sw'+v+'_w_end',data,'110'), 'кг')}
      ${row('Загальний приріст', numField('sw'+v+'_gain',data,'',true), 'кг')}
      ${row('Тривалість відгодівлі', numField('sw'+v+'_days_fat',data,'105'), 'днів')}
      ${row('Санітарні заходи (пусті дні)', numField('sw'+v+'_days_san',data,'5'), 'днів')}
      ${row('Тривалість циклу', numField('sw'+v+'_cycle',data,'',true), 'днів')}
      ${row('Середньодобовий приріст', numField('sw'+v+'_adg',data,'',true), 'г/день')}
      ${row('К-сть циклів на рік', numField('sw'+v+'_turns',data,'',true), 'об./рік')}
      ${row('Вихід туші', numField('sw'+v+'_yield',data,'79'), '%')}
      ${row('Товарна маса / голову', numField('sw'+v+'_mkt_w',data,'',true), 'кг заб.маси')}
      ${row('К-сть місць (голів)', numField('sw'+v+'_heads',data,'100'), 'гол.')}
      ${row('УГ / голову (авто)', numField('sw'+v+'_lu',data,'',true), 'УГ', 'Серед. жива маса / 500')}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Виручка</div>
      ${row('Ціна реалізації', numField('sw'+v+'_price',data), 'грн/кг заб.маси')}
      ${row('Виручка від свиней', numField('sw'+v+'_rev',data,'',true), 'грн')}
      ${row('Субсидії / дотації', numField('sw'+v+'_subsidy',data), 'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:8px 0 4px">♻️ Вартість гною (на цикл)</div>
      ${manureTable('sw'+v, data, '_lu', {n_kg:'3.6',n_eff:'0.6',p_kg:'2.0',p_eff:'1.0',k_kg:'2.8',k_eff:'1.0'})}
      ${row('<strong>Валова виручка</strong>', numField('sw'+v+'_gross',data,'',true), 'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--red);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Пропорційні змінні витрати</div>
      ${row('Поросята (закупівля)', numField('sw'+v+'_piglet_cost',data), 'грн/гол.')}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Корми:</div>
      ${dynTable('sw'+v+'_feeds', dynRows(data,'sw'+v+'_feeds',[
        {name:'Стартер',  unit:'кг', mj:'13.5', qty:'',price:'',sum:''},
        {name:'Гровер',   unit:'кг', mj:'13.2', qty:'',price:'',sum:''},
        {name:'Фінішер',  unit:'кг', mj:'13.0', qty:'',price:'',sum:''},
      ]), [
        { key:'name',  label:'Назва корму',    type:'text' },
        { key:'unit',  label:'Од.',            type:'text',   width:'45px', def:'кг' },
        { key:'mj',    label:'МДж ОЕ/кг',     type:'number', width:'75px' },
        { key:'qty',   label:'К-сть/гол.',     type:'number' },
        { key:'price', label:'Ціна/од.',       type:'number' },
        { key:'sum',   label:'Сума (авто)',    type:'calc'   },
      ], {addLabel:'+ Корм'})}
      ${row('Корми, всього', numField('sw'+v+'_feed_total',data,'',true), 'грн')}
      ${row('МДж ОЕ, всього (авто)', numField('sw'+v+'_mj_total',data,'',true), 'МДж')}
      ${row('Ветеринар, медикаменти, гігієна', numField('sw'+v+'_vet',data), 'грн')}
      ${row('Послуги підрядників', numField('sw'+v+'_services',data), 'грн')}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Механізація (власна):</div>
      ${row('— Роздавання кормів', numField('sw'+v+'_mech_feed',data), 'грн')}
      ${row('— Вентиляція', numField('sw'+v+'_mech_vent',data), 'грн')}
      ${row('— Прибирання гною', numField('sw'+v+'_mech_man',data), 'грн')}
      ${row('Інші прямі витрати', numField('sw'+v+'_other',data), 'грн')}
      ${row('<strong>Змінні витрати, всього</strong>', numField('sw'+v+'_costs',data,'',true), 'грн')}

      <div style="height:8px;border-top:2px solid var(--blue);margin-top:10px"></div>
      ${row('<strong>МД практичний</strong>', numField('sw'+v+'_md',data,'',true), 'грн')}
      ${row('МД на 1 голову', numField('sw'+v+'_md_head',data,'',true), 'грн/гол.')}
      ${row('МД на 1 місце в рік', numField('sw'+v+'_md_place',data,'',true), 'грн/міс./рік')}
    `,'blue')}
  </div>`).join('')}
  </div>`;
}

function buildSwineF2(body, data) {
  body.innerHTML = `
  <div style="font-size:12px;color:var(--gray);margin-bottom:12px">
    Каскад прибутковості на 1 голову. Заповніть параметри нижче; МД береться з Таблиці 1.
  </div>
  ${cascadeParamsSection('swc', data)}
  <div class="cascade-cols">
  ${['1','2'].map(v => `
  <div>
    ${sectionWrap(`💹 Варіант ${v} — Каскад на 1 гол.`, `
      ${cascadeWaterfall(
        'swc'+v, data,
        'sw'+v+'_gross_per', 'sw'+v+'_costs_per',
        'Прибуток / гол. Вар. '+v
      )}
      ${row('Прибуток / місце в рік', numField('swc'+v+'_profit_place', data,'',true), 'грн/міс./рік')}
    `, 'green')}
  </div>`).join('')}
  </div>`;
}

function buildSwineAnalysis(body, data) {
  body.innerHTML = sectionWrap('📊 Аналіз беззбитковості', `
    <div class="cascade-cols">
    ${['1','2'].map(v => `
    <div>
      <strong style="display:block;margin-bottom:8px;color:var(--navy)">Варіант ${v}</strong>
      ${row('Поріг ціни (беззбитковість МД)',     numField('swa'+v+'_bep_price_md',data,'',true), 'грн/кг')}
      ${row('Поріг ціни (повні витрати)',          numField('swa'+v+'_bep_price_full',data,'',true),'грн/кг')}
      ${row('Поріг завантаженості місць',          numField('swa'+v+'_bep_load',data,'',true), '%')}
      ${row('Потреба в оборотному капіталі',       numField('swa'+v+'_working_cap',data,'',true),'грн')}
      ${row('Рентабельність за МД',                numField('swa'+v+'_rent_md',data,'',true), '%')}
      ${row('Рентабельність за прибутком',         numField('swa'+v+'_rent_profit',data,'',true),'%')}
    </div>`).join('')}
    </div>
  `, 'blue');
}

// ============================================================
// MODULE: РОЗВЕДЕННЯ БИЧКІВ
// ============================================================
function buildBullsMD(body, data) {
  body.innerHTML = `
  <div style="margin-bottom:10px;font-size:12px;color:var(--gray)">
    Таблиця 1 — МД розведення бичків. Два варіанти (породи/технології) для порівняння.
  </div>
  <div class="cascade-cols">
  ${['I','II'].map((v,vi) => `<div>
    ${sectionWrap(`🐂 Бички ${v}`, `
      <div style="font-size:11px;font-weight:700;color:var(--gray);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Виробничі показники</div>
      ${row('Початкова маса',            numField('bl'+vi+'_w_start',data), 'кг')}
      ${row('Кінцева маса (реалізація)', numField('bl'+vi+'_w_end',data),   'кг')}
      ${row('Загальний приріст',         numField('bl'+vi+'_gain',data,'',true), 'кг')}
      ${row('Вік на початку',           numField('bl'+vi+'_age_start',data,'3'), 'тижнів')}
      ${row('Вік по закінченню',        numField('bl'+vi+'_age_end',data,'24'), 'місяців')}
      ${row('Тривалість (авто)',         numField('bl'+vi+'_duration',data,'',true), 'днів')}
      ${row('Середньодобовий приріст',  numField('bl'+vi+'_adg',data,'',true), 'г/день')}
      ${row('Вихід м\'яса (туші)',       numField('bl'+vi+'_yield',data,'58'), '%')}
      ${row('К-сть тварин',            numField('bl'+vi+'_heads',data), 'гол.')}
      ${row('УГ / голову (авто)',       numField('bl'+vi+'_lu',data,'',true), 'УГ', 'Кінц. жива маса / 500')}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Виручка</div>
      ${row('Ціна реалізації',          numField('bl'+vi+'_price',data), 'грн/кг ЖМ')}
      ${row('Виручка від реалізації',   numField('bl'+vi+'_rev',data,'',true), 'грн')}
      ${row('Субсидії',                numField('bl'+vi+'_subsidy',data), 'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:8px 0 4px">♻️ Вартість органічних добрив</div>
      ${manureTable('bl'+vi, data, '_lu', {n_kg:'45',n_eff:'0.8',p_kg:'27',p_eff:'1.0',k_kg:'50',k_eff:'1.0'})}
      ${row('<strong>Виручка, всього</strong>', numField('bl'+vi+'_gross',data,'',true), 'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--red);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Пропорційні змінні витрати</div>
      ${row('Теля (закупівля)', numField('bl'+vi+'_calf_cost',data), 'грн/гол.')}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Корми:</div>
      ${dynTable('bl'+vi+'_feeds', dynRows(data,'bl'+vi+'_feeds',[
        {name:'Сухе молоко',    unit:'ц', mj:'',  qty:'',price:'',sum:''},
        {name:'Корм для телят', unit:'ц', mj:'',  qty:'',price:'',sum:''},
        {name:'Концентр. корм', unit:'ц', mj:'13.0',qty:'',price:'',sum:''},
        {name:'Силос кукур.',   unit:'ц', mj:'5.5', qty:'',price:'',sum:''},
        {name:'Сінаж',         unit:'ц', mj:'6.0', qty:'',price:'',sum:''},
      ]), [
        { key:'name',  label:'Назва корму',  type:'text' },
        { key:'unit',  label:'Од.',          type:'text',   width:'45px', def:'ц' },
        { key:'mj',    label:'МДж ОЕ/кг',  type:'number', width:'75px' },
        { key:'qty',   label:'К-сть/гол.',  type:'number' },
        { key:'price', label:'Ціна/од.',    type:'number' },
        { key:'sum',   label:'Сума (авто)', type:'calc'   },
      ], {addLabel:'+ Корм'})}
      ${row('Корми, всього', numField('bl'+vi+'_feed_total',data,'',true), 'грн')}
      ${row('МДж ОЕ, всього (авто)', numField('bl'+vi+'_mj_total',data,'',true), 'МДж')}
      ${row('Ветеринар, медикаменти', numField('bl'+vi+'_vet',data), 'грн')}
      ${row('Роботи і послуги підрядників', numField('bl'+vi+'_services',data), 'грн')}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Механізація (власна):</div>
      ${row('— Роздавання кормів', numField('bl'+vi+'_mech_feed',data), 'грн')}
      ${row('— Вентиляція', numField('bl'+vi+'_mech_vent',data), 'грн')}
      ${row('— Прибирання гною', numField('bl'+vi+'_mech_man',data), 'грн')}
      ${row('Інші прямі витрати', numField('bl'+vi+'_other',data), 'грн')}
      ${row('<strong>Змінні витрати, всього</strong>', numField('bl'+vi+'_costs',data,'',true), 'грн')}

      <div style="height:8px;border-top:2px solid var(--blue);margin-top:10px"></div>
      ${row('<strong>МД практичний</strong>', numField('bl'+vi+'_md',data,'',true), 'грн')}
      ${row('МД на 1 голову', numField('bl'+vi+'_md_head',data,'',true), 'грн/гол.')}
      ${row('МД на 1 УГ', numField('bl'+vi+'_md_lu',data,'',true), 'грн/УГ')}
    `,'blue')}
  </div>`).join('')}
  </div>`;
}

function buildBullsAgg(body, data) {
  body.innerHTML = sectionWrap('🔗 Агрегація кормовиробництва і тваринництва', `
    ${dynTable('agg_bulls', dynRows(data,'agg_bulls',[
      {name:'Бички на відгодівлі', heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
      {name:'Кукурудза на силос',  heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
      {name:'Люцерна на сінаж',   heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
      {name:'Люцерна на сіно',    heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
    ]), [
      { key:'name',   label:'Виробництво',   type:'text'   },
      { key:'heads',  label:'Голів/га',       type:'number' },
      { key:'area',   label:'Площа, га',      type:'number' },
      { key:'ration', label:'Раціон, %',      type:'number' },
      { key:'mj',     label:'МДж ОЕ',        type:'number' },
      { key:'rev',    label:'Тов.прод., грн', type:'number' },
      { key:'cost',   label:'Витрати, грн',  type:'number' },
      { key:'md',     label:'МД, грн',       type:'calc'   },
    ], {addLabel:'+ Позиція'})}
    ${row('<strong>МД разом</strong>', numField('agg_bulls_md_tot',data,'',true), 'грн')}
  `, 'green');
}

function buildBullsProfit(body, data) {
  body.innerHTML = `
  <div style="font-size:12px;color:var(--gray);margin-bottom:12px">
    Таблиця 3 — Каскад прибутковості на 1 голову. МД береться з Таблиці 1.
  </div>
  ${cascadeParamsSection('bpc', data)}
  <div class="cascade-cols">
  ${['0','1'].map(vi => `
  <div>
    ${sectionWrap(`💹 Бички ${'I II'.split(' ')[vi]} — Каскад на 1 гол.`, `
      ${cascadeWaterfall(
        'bpc'+vi, data,
        'bl'+vi+'_gross_per', 'bl'+vi+'_costs_per',
        'Прибуток / гол.'
      )}
    `, 'green')}
  </div>`).join('')}
  </div>`;
}

// ============================================================
// MODULE: МОЛОЧНЕ СКОТАРСТВО
// ============================================================
function buildDairyMD(body, data) {
  body.innerHTML = `
  <div style="margin-bottom:10px;font-size:12px;color:var(--gray)">
    Таблиця 1 — МД молочного скотарства. Два варіанти (породи/технології).
  </div>
  <div class="cascade-cols">
  ${['І','ІІ'].map((v,vi) => `<div>
    ${sectionWrap(`🐄 Молочна худоба ${v}`, `
      <div style="font-size:11px;font-weight:700;color:var(--gray);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Виробничі показники</div>
      ${row('Жива маса',                    numField('dy'+vi+'_lw',data,vi===0?'600':''), 'кг')}
      ${row('УГ (авто)',                    numField('dy'+vi+'_lu',data,'',true), 'УГ', 'Жива маса / 500')}
      ${row('Термін використання',          numField('dy'+vi+'_lifespan',data,vi===0?'4.5':''), 'років')}
      ${row('Ремонт поголів\'я',            numField('dy'+vi+'_replace_pct',data,vi===0?'22.2':''), '%/рік')}
      ${row('Міжотельний період',           numField('dy'+vi+'_calving_int',data,vi===0?'385':''), 'днів')}
      ${row('Міжотельний (років, авто)',    numField('dy'+vi+'_calving_yr',data,'',true), 'р.')}
      ${row('К-сть телят на рік (авто)',    numField('dy'+vi+'_calves',data,'',true), 'гол./рік')}
      ${row('Падіж телят',                 numField('dy'+vi+'_calf_loss',data,vi===0?'4':''), '%')}
      ${row('Молочна продуктивність',       numField('dy'+vi+'_milk_yr',data,vi===0?'6000':''), 'кг/рік')}
      ${row('Жирність',                    numField('dy'+vi+'_fat',data,vi===0?'4.1':''), '%')}
      ${row('Білок',                       numField('dy'+vi+'_prot',data,vi===0?'3.6':''), '%')}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Виручка</div>
      ${row('Ціна молока',                 numField('dy'+vi+'_milk_price',data), 'грн/кг')}
      ${row('Виручка від молока (авто)',   numField('dy'+vi+'_milk_rev',data,'',true), 'грн')}
      ${row('Ціна теляти',                 numField('dy'+vi+'_calf_price',data), 'грн/гол.')}
      ${row('Виручка від телят (авто)',    numField('dy'+vi+'_calf_rev',data,'',true), 'грн')}
      ${row('Вихід вибракуваних корів',    numField('dy'+vi+'_cull_yield',data,'55'), '%')}
      ${row('Ціна вибракуваної корови',    numField('dy'+vi+'_cull_price',data), 'грн/кг ЖМ')}
      ${row('Виручка від вибракуваних',   numField('dy'+vi+'_cull_rev',data,'',true), 'грн')}
      ${row('Субсидії / дотації',         numField('dy'+vi+'_subsidy',data), 'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:8px 0 4px">♻️ Вартість органічних добрив</div>
      ${manureTable('dy'+vi, data, '_lu', {n_kg:'81.4',n_eff:'0.55',p_kg:'33.0',p_eff:'1.0',k_kg:'60.0',k_eff:'1.0'})}
      ${row('<strong>Виручка, всього</strong>', numField('dy'+vi+'_gross',data,'',true), 'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--red);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Пропорційні змінні витрати</div>
      ${row('Телиця (ремонт поголів\'я)',  numField('dy'+vi+'_heifer',data), 'грн/рік')}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Покупні корми:</div>
      ${dynTable('dy'+vi+'_feeds', dynRows(data,'dy'+vi+'_feeds',[
        {name:'ЗЦМ',           unit:'ц', mj:'713', qty:'',price:'',sum:''},
        {name:'Фуражний ячмінь',unit:'ц', mj:'713', qty:'',price:'',sum:''},
        {name:'Соєвий шрот',   unit:'ц', mj:'705', qty:'',price:'',sum:''},
      ]), [
        { key:'name',  label:'Назва корму',  type:'text' },
        { key:'unit',  label:'Од.',          type:'text',   width:'45px', def:'ц' },
        { key:'mj',    label:'МДж ЧЕЛ/ц',  type:'number', width:'75px' },
        { key:'qty',   label:'К-сть/рік',   type:'number' },
        { key:'price', label:'Ціна/од.',    type:'number' },
        { key:'sum',   label:'Сума (авто)', type:'calc'   },
      ], {addLabel:'+ Корм'})}
      ${row('Корми, всього', numField('dy'+vi+'_feed_total',data,'',true), 'грн')}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Механізація та послуги:</div>
      ${row('Доїльна установка', numField('dy'+vi+'_milk_mech',data), 'грн')}
      ${row('Роздавання кормів', numField('dy'+vi+'_feed_mech',data), 'грн')}
      ${row('Вентиляція',       numField('dy'+vi+'_vent',data), 'грн')}
      ${row('Прибирання гною',  numField('dy'+vi+'_manure_mech',data), 'грн')}
      ${row('Ветеринар, гігієна',numField('dy'+vi+'_vet',data), 'грн')}
      ${row('Енергія, вода',    numField('dy'+vi+'_energy',data), 'грн')}
      ${row('Запліднення',      numField('dy'+vi+'_insem',data), 'грн')}
      ${row('Страхування',      numField('dy'+vi+'_insure',data), 'грн')}
      ${row('Інші прямі',       numField('dy'+vi+'_other',data), 'грн')}
      ${row('<strong>Змінні витрати, всього</strong>', numField('dy'+vi+'_costs',data,'',true), 'грн')}

      <div style="height:8px;border-top:2px solid var(--blue);margin-top:10px"></div>
      ${row('<strong>МД практичний</strong>', numField('dy'+vi+'_md',data,'',true), 'грн')}
      ${row('МД на 1 УГ',                    numField('dy'+vi+'_md_lu',data,'',true), 'грн/УГ')}
    `,'blue')}
  </div>`).join('')}
  </div>`;
}

function buildDairyAgg(body, data) {
  body.innerHTML = sectionWrap('🔗 Агрегація кормовиробництва і тваринництва', `
    ${dynTable('agg_dairy', dynRows(data,'agg_dairy',[
      {name:'Молочна худоба',    heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
      {name:'Кукурудза на силос',heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
      {name:'Люцерна на сінаж', heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
      {name:'Люцерна на сіно',  heads:'',area:'',ration:'',mj:'',rev:'',cost:'',md:''},
    ]), [
      { key:'name',   label:'Виробництво',   type:'text'   },
      { key:'heads',  label:'Голів/га',       type:'number' },
      { key:'area',   label:'Площа, га',      type:'number' },
      { key:'ration', label:'Раціон, %',      type:'number' },
      { key:'mj',     label:'МДж ЧЕЛ',       type:'number' },
      { key:'rev',    label:'Тов.прод., грн', type:'number' },
      { key:'cost',   label:'Витрати, грн',  type:'number' },
      { key:'md',     label:'МД, грн',       type:'calc'   },
    ], {addLabel:'+ Позиція'})}
    ${row('<strong>МД разом</strong>', numField('agg_dairy_md_tot',data,'',true), 'грн')}
  `, 'green');
}

function buildDairyProfit(body, data) {
  body.innerHTML = `
  <div style="font-size:12px;color:var(--gray);margin-bottom:12px">
    Таблиця 3 — Каскад прибутковості на 1 голову. МД береться з Таблиці 1.
  </div>
  ${cascadeParamsSection('dpc', data)}
  <div class="cascade-cols">
  ${['0','1'].map(vi => `
  <div>
    ${sectionWrap(`💹 Молочна худоба ${'І ІІ'.split(' ')[vi]} — Каскад на 1 гол.`, `
      ${cascadeWaterfall(
        'dpc'+vi, data,
        'dy'+vi+'_gross_per', 'dy'+vi+'_costs_per',
        'Прибуток / гол.'
      )}
    `, 'green')}
  </div>`).join('')}
  </div>`;
}

// ============================================================
// CALCULATION ENGINE
// ============================================================
function setCalc(field, value) {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (el) el.value = (!isFinite(value) || isNaN(value)) ? '' : Number(value).toFixed(2);
}
function getVal(field) {
  const el = document.querySelector(`[data-field="${field}"]`);
  return el ? fnum(el.value) : 0;
}
function dynColSum(section, col) {
  let s = 0;
  document.querySelectorAll(`[data-dyn-section="${section}"] [data-col="${col}"]`).forEach(el => { s += fnum(el.value); });
  return s;
}
function dynCalcSum(section) {
  let total = 0;
  document.querySelectorAll(`[data-dyn-section="${section}"] tr[data-row-idx]`).forEach(tr => {
    const qty   = fnum(tr.querySelector('[data-col="qty"]')?.value);
    const price = fnum(tr.querySelector('[data-col="price"]')?.value);
    const sum   = qty * price;
    const sumEl = tr.querySelector('[data-col="sum"]');
    if (sumEl) sumEl.value = sum > 0 ? sum.toFixed(2) : '';
    total += sum;
  });
  return total;
}
function dynCalcMJ(section) {
  let total = 0;
  document.querySelectorAll(`[data-dyn-section="${section}"] tr[data-row-idx]`).forEach(tr => {
    const mj  = fnum(tr.querySelector('[data-col="mj"]')?.value);
    const qty = fnum(tr.querySelector('[data-col="qty"]')?.value);
    total += mj * qty;
  });
  return total;
}

// Manure calc: nutrient qty = kg/LU × LU × eff; val = qty × price
function calcManure(prefix, lu) {
  let total = 0;
  for (const n of ['n','p','k']) {
    const qty = getVal(prefix+'_man_'+n+'_kg') * lu * getVal(prefix+'_man_'+n+'_eff');
    const val = qty * getVal(prefix+'_man_'+n+'_price');
    setCalc(prefix+'_man_'+n+'_qty', qty);
    setCalc(prefix+'_man_'+n+'_val', val);
    total += val;
  }
  setCalc(prefix+'_man_total', total);
  return total;
}

// Cascade waterfall calc
// grossPerHead: auto gross revenue per head
// varPerHead: variable costs per head
// prefix_c: cascade prefix (e.g. 'swc1', 'bpc0', 'dpc0')
// params_prefix: shared params prefix (e.g. 'swc', 'bpc', 'dpc')
function calcCascade(prefix_c, params_prefix, grossPerHead, varPerHead, turns_per_year) {
  const ownPct   = getVal(params_prefix+'_cap_own_pct')   / 100;
  const hirePct  = getVal(params_prefix+'_cap_hire_pct')  / 100;
  const ownShare = getVal(params_prefix+'_cap_own_share');
  const avgRate  = ownPct * ownShare + hirePct * (1 - ownShare);

  const capOA  = varPerHead * 0.6 * avgRate;
  const md_pract = grossPerHead - varPerHead;
  const md1 = md_pract - capOA;

  const laborOwn  = getVal(params_prefix+'_labor_own_h')  * getVal(params_prefix+'_wage_own');
  const laborHire = getVal(params_prefix+'_labor_hire_h') * getVal(params_prefix+'_wage_hire');
  const laborTotal = laborOwn + laborHire;
  const md2 = md1 - laborTotal;

  const landTotal = getVal(params_prefix+'_land_own') + getVal(params_prefix+'_land_rent');
  const landOther = getVal(params_prefix+'_land_other');
  const md3 = md2 - landTotal - landOther;

  const machA    = getVal(params_prefix+'_mach_a');
  const buildA   = getVal(params_prefix+'_build_a');
  const machFixed  = machA  * (getVal(params_prefix+'_mach_dep_pct')/100  + getVal(params_prefix+'_mach_rep_pct')/100);
  const buildFixed = buildA * (getVal(params_prefix+'_build_dep_pct')/100 + getVal(params_prefix+'_build_maint_pct')/100);
  const mainCap  = (machA + buildA) / 2 * avgRate;
  const genLabor = getVal(params_prefix+'_gen_labor_h') * ((getVal(params_prefix+'_wage_own') + getVal(params_prefix+'_wage_hire')) / 2);
  const fixedSpec = getVal(params_prefix+'_fixed_spec');
  const overhead  = getVal(params_prefix+'_overhead');
  const profit = md3 - machFixed - buildFixed - mainCap - genLabor - fixedSpec - overhead;

  setCalc(prefix_c+'_cap_oa',      capOA);
  setCalc(prefix_c+'_md_pract',    md_pract);
  setCalc(prefix_c+'_md1',         md1);
  setCalc(prefix_c+'_labor_total', laborTotal);
  setCalc(prefix_c+'_md2',         md2);
  setCalc(prefix_c+'_land_total',  landTotal);
  setCalc(prefix_c+'_land_other_c',landOther);
  setCalc(prefix_c+'_md3',         md3);
  setCalc(prefix_c+'_mach_fixed',  machFixed);
  setCalc(prefix_c+'_build_fixed', buildFixed);
  setCalc(prefix_c+'_main_cap',    mainCap);
  setCalc(prefix_c+'_gen_labor',   genLabor);
  setCalc(prefix_c+'_fixed_spec_c',fixedSpec);
  setCalc(prefix_c+'_overhead_c',  overhead);
  setCalc(prefix_c+'_profit',      profit);

  if (turns_per_year > 0) {
    setCalc(prefix_c+'_profit_place', profit * turns_per_year);
  }

  // Color profit row
  const profitRow = document.getElementById('cprofit-' + prefix_c + '_profit');
  if (profitRow) {
    profitRow.className = profit >= 0 ? 'cascade-profit' : 'cascade-loss';
  }
}

function recalcAll() {
  if (!currentFormId) return;
  const mod = currentModule, tab = currentTab;
  if (mod === 'crop'  && tab === 1) recalcCropGM();
  if (mod === 'crop'  && tab === 2) recalcCropAssets();
  if (mod === 'crop'  && tab === 3) recalcCropAnalysis();
  if (mod === 'swine' && tab === 0) recalcSwine();
  if (mod === 'swine' && tab === 1) recalcSwineProfit();
  if (mod === 'swine' && tab === 2) recalcSwineAnalysis();
  if (mod === 'bulls' && tab === 0) recalcBulls();
  if (mod === 'bulls' && tab === 1) recalcBullsAgg();
  if (mod === 'bulls' && tab === 2) recalcBullsProfit();
  if (mod === 'dairy' && tab === 0) recalcDairy();
  if (mod === 'dairy' && tab === 1) recalcDairyAgg();
  if (mod === 'dairy' && tab === 2) recalcDairyProfit();
}

// ── Crop GM ──────────────────────────────────────────────────
function recalcCropGM() {
  const p1_gross = getVal('gm_p1_gross_qty');
  const p1  = getVal('gm_p1_qty') * getVal('gm_p1_price');
  setCalc('gm_p1_sum', p1);

  const sideTotal = dynCalcSum('gm_side');
  setCalc('gm_p_side_total', sideTotal);

  const sub  = getVal('gm_subsidy');
  const grossRev = p1 + sideTotal + sub;
  setCalc('gm_gross_rev', grossRev);

  const seedTotal = dynCalcSum('gm_seeds');
  setCalc('gm_seed_total', seedTotal);

  const mainQty = getVal('gm_p1_qty');
  let sideQtySum = 0;
  document.querySelectorAll('[data-dyn-section="gm_side"] tr[data-row-idx]').forEach(tr => {
    sideQtySum += fnum(tr.querySelector('[data-col="qty"]')?.value);
  });

  let fertTotal = 0;
  for (const nm of ['N','P2O5','K2O']) {
    const nQty = getVal('gm_'+nm+'_main') * mainQty + getVal('gm_'+nm+'_side') * sideQtySum;
    setCalc('gm_'+nm+'_qty', nQty);
    const nSum = nQty * getVal('gm_'+nm+'_price');
    setCalc('gm_'+nm+'_sum', nSum);
    fertTotal += nSum;
  }
  setCalc('gm_fert_total', fertTotal);

  const zzrTotal = dynCalcSum('gm_zzr');
  setCalc('gm_zzr_total', zzrTotal);

  const mechTotal = getVal('gm_mech_contract') + getVal('gm_mech_own') +
    getVal('gm_mech_repair') + getVal('gm_dry') + getVal('gm_insure') + getVal('gm_other');
  setCalc('gm_mech_total', mechTotal);

  const varTotal = seedTotal + fertTotal + zzrTotal + mechTotal;
  setCalc('gm_var_total', varTotal);

  const md   = grossRev - varTotal;
  const area = getVal('gm_area') || 1;
  const mdPerHa = md / area;
  const mdPerDt = (getVal('gm_p1_qty') * area) > 0 ? md / (getVal('gm_p1_qty') * area) : 0;

  setCalc('gm_md', md);
  setCalc('gm_md_per_ha', mdPerHa);
  setCalc('gm_md_per_dt', mdPerDt);
  setCalc('gm_capital', varTotal * 0.6);

  const mdEl  = document.getElementById('md-crop-val');
  const mdPer = document.getElementById('md-crop-per');
  if (mdEl)  { mdEl.textContent = fmt(md) + ' грн'; mdEl.className = 'md-value ' + (md >= 0 ? 'positive' : 'negative'); }
  if (mdPer) { mdPer.textContent = 'на 1 га: ' + fmt(mdPerHa) + ' грн/га'; }
}

// ── Crop Assets ───────────────────────────────────────────────
function recalcCropAssets() {
  let mDep=0, mRep=0;
  document.querySelectorAll('[data-dyn-section="ast_machines"] tr[data-row-idx]').forEach(tr => {
    const a=fnum(tr.querySelector('[data-col="a"]')?.value), r=fnum(tr.querySelector('[data-col="r"]')?.value);
    const n=fnum(tr.querySelector('[data-col="n"]')?.value), cnt=fnum(tr.querySelector('[data-col="cnt"]')?.value)||1;
    const pct=fnum(tr.querySelector('[data-col="pct"]')?.value)/100;
    const dep=n>0?(a-r)/n*cnt:0, rep=a*pct*cnt;
    const depEl=tr.querySelector('[data-col="dep"]'), repEl=tr.querySelector('[data-col="rep"]');
    if(depEl) depEl.value=dep>0?dep.toFixed(2):''; if(repEl) repEl.value=rep>0?rep.toFixed(2):'';
    mDep+=dep; mRep+=rep;
  });
  setCalc('ast_m_dep_total',mDep); setCalc('ast_m_rep_total',mRep);

  let bDep=0, bMaint=0;
  document.querySelectorAll('[data-dyn-section="ast_buildings"] tr[data-row-idx]').forEach(tr => {
    const a=fnum(tr.querySelector('[data-col="a"]')?.value), r=fnum(tr.querySelector('[data-col="r"]')?.value);
    const n=fnum(tr.querySelector('[data-col="n"]')?.value), cnt=fnum(tr.querySelector('[data-col="cnt"]')?.value)||1;
    const pct=fnum(tr.querySelector('[data-col="pct"]')?.value)/100;
    const dep=n>0?(a-r)/n*cnt:0, maint=a*pct*cnt;
    const depEl=tr.querySelector('[data-col="dep"]'), maintEl=tr.querySelector('[data-col="maint"]');
    if(depEl) depEl.value=dep>0?dep.toFixed(2):''; if(maintEl) maintEl.value=maint>0?maint.toFixed(2):'';
    bDep+=dep; bMaint+=maint;
  });
  setCalc('ast_b_dep_total',bDep); setCalc('ast_b_maint_total',bMaint);
}

// ── Crop Analysis ────────────────────────────────────────────
function recalcCropAnalysis() {
  const mdPerHa  = getVal('gm_md_per_ha');
  const varPerHa = getVal('gm_var_total') / (getVal('gm_area') || 1);
  const area     = getVal('gm_area') || 1;

  const ownPct   = getVal('ca_cap_own_pct')   / 100;
  const hirePct  = getVal('ca_cap_hire_pct')  / 100;
  const ownShare = getVal('ca_cap_own_share');
  const avgRate  = ownPct * ownShare + hirePct * (1 - ownShare);

  const capOA   = varPerHa * 0.6 * avgRate;
  const md1     = mdPerHa - capOA;
  const labor   = getVal('ca_labor_own_h') * getVal('ca_wage_own') + getVal('ca_labor_hire_h') * getVal('ca_wage_hire');
  const md2     = md1 - labor;
  const landTot = getVal('ca_land_own') + getVal('ca_land_rent') + getVal('ca_land_other');
  const md3     = md2 - landTot;

  const machFixed  = getVal('ca_mach_a')  * (getVal('ca_mach_dep_pct')/100  + getVal('ca_mach_rep_pct')/100);
  const buildFixed = getVal('ca_build_a') * (getVal('ca_build_dep_pct')/100 + getVal('ca_build_maint_pct')/100);
  const mainCap  = (getVal('ca_mach_a') + getVal('ca_build_a')) / 2 * avgRate;
  const genLabor = getVal('ca_gen_labor_h') * getVal('ca_gen_wage');
  const profitHa = md3 - machFixed - buildFixed - mainCap - genLabor - getVal('ca_fixed_spec') - getVal('ca_overhead');

  setCalc('ca_cap_oa',    capOA);
  setCalc('ca_md1',       md1);
  setCalc('ca_labor_total',labor);
  setCalc('ca_md2',       md2);
  setCalc('ca_land_total',landTot);
  setCalc('ca_md3',       md3);
  setCalc('ca_mach_fixed',machFixed);
  setCalc('ca_build_fixed',buildFixed);
  setCalc('ca_main_cap',  mainCap);
  setCalc('ca_gen_labor', genLabor);
  setCalc('ca_fixed_spec_c', getVal('ca_fixed_spec'));
  setCalc('ca_overhead_c',   getVal('ca_overhead'));
  setCalc('ca_profit_ha',    profitHa);
  setCalc('ca_profit_total', profitHa * area);

  const profitRow = document.getElementById('cprofit-ca_profit_ha');
  if (profitRow) profitRow.className = profitHa >= 0 ? 'cascade-profit' : 'cascade-loss';
}

// ── Swine F1 ─────────────────────────────────────────────────
function recalcSwine() {
  for (const v of ['1','2']) {
    const wS = getVal('sw'+v+'_w_start'), wE = getVal('sw'+v+'_w_end');
    const gain  = wE - wS;
    const daysFat = getVal('sw'+v+'_days_fat'), daysSan = getVal('sw'+v+'_days_san');
    const cycle = daysFat + daysSan;
    const adg   = daysFat > 0 ? gain * 1000 / daysFat : 0;
    const turns = cycle > 0 ? 365 / cycle : 0;
    const mktW  = wE * getVal('sw'+v+'_yield') / 100;
    const lu    = (wS + wE) / 2 / 500;

    setCalc('sw'+v+'_gain',   gain);
    setCalc('sw'+v+'_cycle',  cycle);
    setCalc('sw'+v+'_adg',    adg);
    setCalc('sw'+v+'_turns',  turns);
    setCalc('sw'+v+'_mkt_w',  mktW);
    setCalc('sw'+v+'_lu',     lu);

    const heads = getVal('sw'+v+'_heads');
    const rev   = mktW * heads * getVal('sw'+v+'_price');
    const sub   = getVal('sw'+v+'_subsidy');
    setCalc('sw'+v+'_rev', rev);

    const manTotal = calcManure('sw'+v, lu);
    setCalc('sw'+v+'_gross', rev + sub + manTotal);

    const feedTotal = dynCalcSum('sw'+v+'_feeds');
    const mjTotal   = dynCalcMJ('sw'+v+'_feeds');
    setCalc('sw'+v+'_feed_total', feedTotal);
    setCalc('sw'+v+'_mj_total',   mjTotal);

    const mechSub = getVal('sw'+v+'_mech_feed') + getVal('sw'+v+'_mech_vent') + getVal('sw'+v+'_mech_man');
    const costs = getVal('sw'+v+'_piglet_cost') * heads + feedTotal +
      getVal('sw'+v+'_vet') + getVal('sw'+v+'_services') + mechSub + getVal('sw'+v+'_other');
    const md    = getVal('sw'+v+'_gross') - costs;

    setCalc('sw'+v+'_costs',    costs);
    setCalc('sw'+v+'_md',       md);
    setCalc('sw'+v+'_md_head',  heads > 0 ? md / heads : 0);
    setCalc('sw'+v+'_md_place', heads > 0 ? md / heads * turns : 0);
  }
}

// ── Swine F2 Cascade ─────────────────────────────────────────
function recalcSwineProfit() {
  for (const v of ['1','2']) {
    const heads = getVal('sw'+v+'_heads') || 1;
    const turns = getVal('sw'+v+'_turns') || 1;
    const grossPer = getVal('sw'+v+'_gross') / heads;
    const costsPer = getVal('sw'+v+'_costs') / heads;
    setCalc('sw'+v+'_gross_per', grossPer);
    setCalc('sw'+v+'_costs_per', costsPer);
    calcCascade('swc'+v, 'swc', grossPer, costsPer, turns);
  }
}

// ── Swine Analysis ───────────────────────────────────────────
function recalcSwineAnalysis() {
  for (const v of ['1','2']) {
    const heads  = getVal('sw'+v+'_heads') || 1;
    const turns  = getVal('sw'+v+'_turns') || 1;
    const gross  = getVal('sw'+v+'_gross');
    const costs  = getVal('sw'+v+'_costs');
    const mktW   = getVal('sw'+v+'_mkt_w');
    const price  = getVal('sw'+v+'_price');
    const md     = getVal('sw'+v+'_md');

    const bepPriceMD   = costs > 0 && mktW > 0 ? (costs / heads) / mktW : 0;
    const rentMD       = gross > 0 ? md / gross * 100 : 0;
    const workingCap   = costs * 0.6;

    setCalc('swa'+v+'_bep_price_md',   bepPriceMD);
    setCalc('swa'+v+'_bep_price_full', bepPriceMD * 1.1);
    setCalc('swa'+v+'_bep_load',       90);
    setCalc('swa'+v+'_working_cap',    workingCap);
    setCalc('swa'+v+'_rent_md',        rentMD);
    setCalc('swa'+v+'_rent_profit',    0);
  }
}

// ── Bulls MD ─────────────────────────────────────────────────
function recalcBulls() {
  for (let vi = 0; vi < 2; vi++) {
    const wS = getVal('bl'+vi+'_w_start'), wE = getVal('bl'+vi+'_w_end');
    const gain = wE - wS;
    const dur  = getVal('bl'+vi+'_age_end') * 30 - getVal('bl'+vi+'_age_start') * 7;
    const adg  = dur > 0 ? gain * 1000 / dur : 0;
    const lu   = wE / 500;

    setCalc('bl'+vi+'_gain',     gain);
    setCalc('bl'+vi+'_duration', dur > 0 ? dur : 0);
    setCalc('bl'+vi+'_adg',      adg);
    setCalc('bl'+vi+'_lu',       lu);

    const heads = getVal('bl'+vi+'_heads');
    const rev   = wE * (getVal('bl'+vi+'_yield') / 100) * heads * getVal('bl'+vi+'_price');
    const sub   = getVal('bl'+vi+'_subsidy');
    setCalc('bl'+vi+'_rev', rev);

    const manTotal = calcManure('bl'+vi, lu);
    setCalc('bl'+vi+'_gross', rev + sub + manTotal);

    const feedTotal = dynCalcSum('bl'+vi+'_feeds');
    const mjTotal   = dynCalcMJ('bl'+vi+'_feeds');
    setCalc('bl'+vi+'_feed_total', feedTotal);
    setCalc('bl'+vi+'_mj_total',   mjTotal);

    const mechSub = getVal('bl'+vi+'_mech_feed') + getVal('bl'+vi+'_mech_vent') + getVal('bl'+vi+'_mech_man');
    const costs = getVal('bl'+vi+'_calf_cost') * heads + feedTotal +
      getVal('bl'+vi+'_vet') + getVal('bl'+vi+'_services') + mechSub + getVal('bl'+vi+'_other');
    const md = getVal('bl'+vi+'_gross') - costs;

    setCalc('bl'+vi+'_costs',   costs);
    setCalc('bl'+vi+'_md',      md);
    setCalc('bl'+vi+'_md_head', heads > 0 ? md / heads : 0);
    setCalc('bl'+vi+'_md_lu',   lu > 0 ? md / lu : 0);
  }
}

// ── Bulls Agg ────────────────────────────────────────────────
function recalcBullsAgg() {
  let mTot = 0;
  document.querySelectorAll('[data-dyn-section="agg_bulls"] tr[data-row-idx]').forEach(tr => {
    const r = fnum(tr.querySelector('[data-col="rev"]')?.value);
    const c = fnum(tr.querySelector('[data-col="cost"]')?.value);
    const mdEl = tr.querySelector('[data-col="md"]');
    if (mdEl) mdEl.value = (r - c).toFixed(2);
    mTot += r - c;
  });
  setCalc('agg_bulls_md_tot', mTot);
}

// ── Bulls Profit Cascade ──────────────────────────────────────
function recalcBullsProfit() {
  for (let vi = 0; vi < 2; vi++) {
    const heads    = getVal('bl'+vi+'_heads') || 1;
    const grossPer = getVal('bl'+vi+'_gross') / heads;
    const costsPer = getVal('bl'+vi+'_costs') / heads;
    setCalc('bl'+vi+'_gross_per', grossPer);
    setCalc('bl'+vi+'_costs_per', costsPer);
    calcCascade('bpc'+vi, 'bpc', grossPer, costsPer, 0);
  }
}

// ── Dairy MD ─────────────────────────────────────────────────
function recalcDairy() {
  for (let vi = 0; vi < 2; vi++) {
    const lw       = getVal('dy'+vi+'_lw');
    const calvInt  = getVal('dy'+vi+'_calving_int');
    const calvYr   = calvInt > 0 ? 365 / calvInt : 0;
    const calves   = calvYr * (1 - getVal('dy'+vi+'_calf_loss') / 100);
    const lu       = lw / 500;

    setCalc('dy'+vi+'_lu',         lu);
    setCalc('dy'+vi+'_calving_yr', calvYr);
    setCalc('dy'+vi+'_calves',     calves);

    const milkYr   = getVal('dy'+vi+'_milk_yr');
    const milkRev  = milkYr * getVal('dy'+vi+'_milk_price');
    const calfRev  = calves * getVal('dy'+vi+'_calf_price');
    const cullRev  = getVal('dy'+vi+'_replace_pct') / 100 * lw *
                     (getVal('dy'+vi+'_cull_yield') / 100) * getVal('dy'+vi+'_cull_price');
    const sub      = getVal('dy'+vi+'_subsidy');

    setCalc('dy'+vi+'_milk_rev', milkRev);
    setCalc('dy'+vi+'_calf_rev', calfRev);
    setCalc('dy'+vi+'_cull_rev', cullRev);

    const manTotal = calcManure('dy'+vi, lu);
    const gross = milkRev + calfRev + cullRev + sub + manTotal;
    setCalc('dy'+vi+'_gross', gross);

    const feedTotal = dynCalcSum('dy'+vi+'_feeds');
    setCalc('dy'+vi+'_feed_total', feedTotal);

    const costs = getVal('dy'+vi+'_heifer') + feedTotal +
      getVal('dy'+vi+'_milk_mech') + getVal('dy'+vi+'_feed_mech') + getVal('dy'+vi+'_vent') +
      getVal('dy'+vi+'_manure_mech') + getVal('dy'+vi+'_vet') + getVal('dy'+vi+'_energy') +
      getVal('dy'+vi+'_insem') + getVal('dy'+vi+'_insure') + getVal('dy'+vi+'_other');
    const md = gross - costs;

    setCalc('dy'+vi+'_costs', costs);
    setCalc('dy'+vi+'_md',    md);
    setCalc('dy'+vi+'_md_lu', lu > 0 ? md / lu : 0);
  }
}

// ── Dairy Agg ────────────────────────────────────────────────
function recalcDairyAgg() {
  let mTot = 0;
  document.querySelectorAll('[data-dyn-section="agg_dairy"] tr[data-row-idx]').forEach(tr => {
    const r = fnum(tr.querySelector('[data-col="rev"]')?.value);
    const c = fnum(tr.querySelector('[data-col="cost"]')?.value);
    const mdEl = tr.querySelector('[data-col="md"]');
    if (mdEl) mdEl.value = (r - c).toFixed(2);
    mTot += r - c;
  });
  setCalc('agg_dairy_md_tot', mTot);
}

// ── Dairy Profit Cascade ──────────────────────────────────────
function recalcDairyProfit() {
  for (let vi = 0; vi < 2; vi++) {
    const grossPer = getVal('dy'+vi+'_gross');
    const costsPer = getVal('dy'+vi+'_costs');
    setCalc('dy'+vi+'_gross_per', grossPer);
    setCalc('dy'+vi+'_costs_per', costsPer);
    calcCascade('dpc'+vi, 'dpc', grossPer, costsPer, 0);
  }
}

// ============================================================
// BOOT
// ============================================================
renderFormsList();

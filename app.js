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
  crop:    { label: 'Рослинництво',       icon: '🌱',
             tabs: ['Загальна інформація', 'Маржинальний дохід', 'Основні засоби', 'Аналіз прибутковості'] },
  swine:   { label: 'Відгодівля свиней',  icon: '🐷',
             tabs: ['МД — Таблиця 1', 'Каскад прибутковості', 'Аналіз беззбитковості'] },
  bulls:   { label: 'Розведення бичків',  icon: '🐂',
             tabs: ['МД — Таблиця 1', 'Агрегація — Таблиця 2', 'Прибуток — Таблиця 3'] },
  dairy:   { label: 'Молочне скотарство', icon: '🐄',
             tabs: ['МД — Таблиця 1', 'Агрегація — Таблиця 2', 'Прибуток — Таблиця 3'] },
  poultry: { label: 'Птахівництво',       icon: '🐔',
             tabs: ['МД — Таблиця 1', 'Каскад прибутковості', 'Аналіз беззбитковості'] },
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
  // Merge with existing data to preserve values from other tabs
  const data = Object.assign({}, currentForm ? (currentForm.data || {}) : {});
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
  // Silent auto-save: preserve current tab data without showing toast
  if (currentFormId && currentForm) {
    const name = document.getElementById('form-name-input')?.value || currentForm.name;
    const data = collectFormData();
    currentForm.name = name;
    currentForm.data = data;
    updateForm(currentFormId, name, data);
  }
  currentTab = i;
  renderTabs();
  renderTab();
};

function renderTab() {
  if (!currentForm) return;
  const body = document.getElementById('form-body');
  const builders = {
    crop:    [buildCropGeneral,   buildCropGM,    buildCropAssets,    buildCropAnalysis],
    swine:   [buildSwineF1,       buildSwineF2,   buildSwineAnalysis],
    bulls:   [buildBullsMD,       buildBullsAgg,  buildBullsProfit],
    dairy:   [buildDairyMD,       buildDairyAgg,  buildDairyProfit],
    poultry: [buildPoultryMD,     buildPoultryProfit, buildPoultryAnalysis],
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

// ============================================================
// TOOLTIPS — підказки для полів
// Ключ: ім'я поля (або загальний префікс без варіанту: sw_, bl_, dy_, pt_)
// ============================================================
const TOOLTIPS = {
  // Загальна інформація (crop)
  gen_rain:          'Середньорічна кількість опадів у мм (для більшості регіонів України 450–650 мм)',
  gen_veg:           'Тривалість вегетаційного сезону в місяцях (зазвичай 6–8 місяців)',
  gen_rent_price:    'Середня орендна плата за 1 га с/г угідь на рік',
  gen_land_value:    'Ринкова вартість 1 га власної землі — потрібна для розрахунку альтернативних витрат',
  gen_workers_perm:  'Кількість постійно зайнятих працівників господарства (на повну ставку)',
  gen_workers_seas:  'Кількість сезонних (тимчасових) працівників у пікові періоди',
  gen_labor_family:  'Сукупна кількість годин праці членів родини господаря на рік',
  gen_wage_own:      'Годинна ставка оплати власної (сімейної) праці — використовується як альтернативні витрати',
  gen_wage_hire:     'Годинна ставка оплати найманих працівників (без ПДФО та нарахувань)',
  // Маржинальний дохід (crop)
  gm_area:           'Площа вирощування даної культури в гектарах',
  gm_p1_gross_qty:   'Валова врожайність основної продукції в ц/га (включно з насіннєвим фондом)',
  gm_p1_qty:         'Товарна кількість продукції в ц/га, що реалізується (без насіннєвого фонду)',
  gm_p1_price:       'Ціна реалізації 1 ц (або кг) основної продукції',
  gm_subsidy:        'Субсидії, дотації та прямі виплати держави на 1 га посіву',
  gm_mech_contract:  'Вартість послуг підрядних механізованих організацій (оранка, посів, збирання тощо)',
  gm_mech_own:       'Змінні витрати на паливо та мастило власної техніки',
  gm_mech_repair:    'Поточний ремонт та технічне обслуговування основних засобів',
  gm_dry:            'Витрати на сушіння та зберігання зерна або іншої продукції',
  gm_insure:         'Витрати на страхування посівів від граду, засухи та інших ризиків',
  gm_other:          'Інші прямі витрати, що не включені в попередні категорії',
  // Каскад (crop)
  ca_cap_own_pct:    'Процентна ставка на власний капітал (альтернативна вартість) — зазвичай 12–18%',
  ca_cap_hire_pct:   'Процентна ставка на залучений (банківський) капітал — зазвичай 15–22%',
  ca_cap_own_share:  'Частка власного капіталу від 0 до 1 (наприклад 0.5 = 50% власний)',
  ca_labor_own_h:    'Кількість годин власної праці на 1 га вирощування культури',
  ca_labor_hire_h:   'Кількість годин найманої праці на 1 га вирощування культури',
  ca_land_own:       'Альтернативні витрати на власну землю грн/га (зазвичай = ставка оренди)',
  ca_land_rent:      'Реальна орендна плата за орендовану землю грн/га',
  // Свині (загальний ключ, застосовується до sw1_ та sw2_)
  sw_w_start:        'Жива маса поросяти на початку відгодівлі в кг (зазвичай 25–30 кг)',
  sw_w_end:          'Жива маса свині при реалізації в кг (зазвичай 100–120 кг)',
  sw_days_fat:       'Тривалість відгодівлі від постановки до реалізації в днях (зазвичай 90–120 днів)',
  sw_days_san:       'Санітарна пауза між партіями для дезінфекції та очищення приміщень (зазвичай 5–14 днів)',
  sw_yield:          'Вихід туші від живої маси в % (стандартно 74–80% для товарних свиней)',
  sw_heads:          'Кількість місць (голів) в одній виробничій партії',
  sw_price:          'Ціна реалізації 1 кг забійної маси (туші)',
  sw_piglet_cost:    'Закупівельна вартість одного поросяти при постановці на відгодівлю',
  sw_vet:            'Витрати на ветеринарні препарати, вакцинацію та гігієну на всю партію',
  sw_services:       'Вартість послуг підрядних організацій (зоотехнік, забій тощо)',
  sw_mech_feed:      'Витрати на роботу автоматичних кормороздавачів та кормових ліній',
  sw_mech_vent:      'Витрати на роботу вентиляційних систем та мікроклімату',
  sw_mech_man:       'Витрати на механічне прибирання гною та гноєсховище',
  sw_other:          'Інші прямі змінні витрати, що не включені вище',
  // Бички
  bl_w_start:        'Початкова жива маса телятини при постановці на відгодівлю в кг',
  bl_w_end:          'Кінцева жива маса бичка при реалізації в кг',
  bl_age_start:      'Вік тварини на початку відгодівлі в тижнях',
  bl_age_end:        'Вік тварини при реалізації в місяцях',
  bl_yield:          'Вихід м\'яса (туші) від живої маси в % (зазвичай 52–60% для бичків)',
  bl_heads:          'Загальна кількість бичків у виробничій групі',
  bl_price:          'Ціна реалізації 1 кг живої маси або забійної маси (за домовленістю)',
  bl_calf_cost:      'Закупівельна вартість одного телятини для відгодівлі',
  // Молочне скотарство
  dy_lw:             'Жива маса однієї корови в кг (використовується для розрахунку УГ і вибракування)',
  dy_lifespan:       'Середній термін використання корови в господарстві в роках (зазвичай 3–5 років)',
  dy_replace_pct:    'Щорічний відсоток ремонту (заміни) поголів\'я — зазвичай 20–25%',
  dy_calving_int:    'Міжотельний інтервал у днях (норма 365–385 днів)',
  dy_calf_loss:      'Відсоток падежу телят від народження до відлучення',
  dy_milk_yr:        'Річна молочна продуктивність однієї корови в кг',
  dy_fat:            'Жирність молока в % (впливає на залікову вагу та надбавку до ціни)',
  dy_prot:           'Вміст білка в молоці в % (впливає на якісну надбавку)',
  dy_milk_price:     'Ціна реалізації 1 кг молока',
  dy_calf_price:     'Ціна реалізації одного теляти (зазвичай у 1–2 тижні)',
  dy_cull_yield:     'Вихід забійної маси вибракуваної корови від живої маси в %',
  dy_cull_price:     'Ціна реалізації 1 кг живої маси вибракуваної корови',
  // Птахівництво
  pt_w_start:        'Жива маса добового курчати при постановці в г (стандартно 40–45 г)',
  pt_w_end:          'Цільова жива маса бройлера при забої в г (стандартно 2200–2600 г)',
  pt_days_fat:       'Тривалість вирощування від постановки до забою в днях (стандартно 35–42 дні)',
  pt_days_san:       'Санітарна пауза між партіями в днях (зазвичай 10–14 днів)',
  pt_yield:          'Вихід тушки від живої маси в % (стандарт для бройлерів 74–76%)',
  pt_heads:          'Кількість місць (голів птиці) у виробничій партії',
  pt_price:          'Ціна реалізації 1 кг забійної тушки бройлера',
  pt_chick_cost:     'Закупівельна вартість одного добового курчати',
  pt_vet:            'Витрати на ветеринарні препарати, вакцинацію та дезінфекцію на партію',
  pt_services:       'Вартість підрядних послуг (зоотехнік, ветеринар-профілактик, ін.)',
  pt_mech_feed:      'Витрати на роботу кормових ліній та бункерних годівниць',
  pt_mech_vent:      'Витрати на роботу вентиляційних систем та системи мікроклімату',
  pt_mech_man:       'Витрати на видалення підстилки та прибирання після виїмки',
  pt_mech_heat:      'Витрати на газові та електричні обігрівачі (броудери) для курчат',
  pt_other:          'Інші прямі змінні витрати (підстилка, тара, транспорт тощо)',
  // Параметри каскаду
  swc_cap_own_pct:   'Ставка альтернативних витрат на власний капітал (зазвичай 12–18%)',
  swc_cap_hire_pct:  'Ставка по банківському кредиту на оборотний капітал (зазвичай 15–22%)',
  swc_mach_a:        'Повна вартість придбання техніки та обладнання на 1 голову',
  swc_build_a:       'Повна вартість будівництва або придбання приміщення на 1 голову',
  swc_labor_own_h:   'Кількість годин власної праці на 1 голову за цикл',
  swc_labor_hire_h:  'Кількість годин найманої праці на 1 голову за цикл',
  swc_land_own:      'Альтернативні витрати на власну землю під будівлями та дорогами (грн/гол.)',
  swc_land_rent:     'Орендна плата за землю під виробничими будівлями (грн/гол.)',
  swc_gen_labor_h:   'Кількість годин загальної (управлінської) праці на 1 голову',
  swc_fixed_spec:    'Інші постійні спеціальні витрати на 1 голову (страхування будівлі тощо)',
  swc_overhead:      'Накладні витрати на 1 голову (бухгалтерія, зв\'язок, канцелярія тощо)',
};

// Підказки для колонок динамічних таблиць (за ключем колонки)
const COL_TIPS = {
  crop:         'Назва культури, що вирощується',
  area:         'Площа вирощування в гектарах (не може бути від\'ємною)',
  own:          'Власна площа угідь у гектарах',
  rent:         'Орендована площа угідь у гектарах',
  rotation_pos: 'Порядковий номер або назва позиції в сівозміні',
  prev_crop:    'Культура-попередник у сівозміні (впливає на родючість і хвороби)',
  notes:        'Довільні примітки або коментарі',
  heads:        'Кількість голів тварин даної групи',
  lu:           'Умовні голови (УГ) — авторозрахунок за коефіцієнтом виду',
  facility:     'Кількість місць у виробничому приміщенні',
  species:      'Вид тварин (корова, бичок, свиня, вівця тощо)',
  type:         'Статево-вікова група тварин',
  name:         'Назва корму, препарату або статті витрат',
  unit:         'Одиниця виміру (кг, ц, л, шт.)',
  qty:          'Кількість на 1 голову або 1 га за цикл',
  price:        'Ціна за одиницю виміру',
  sum:          'Сума = кількість × ціна (авторозрахунок)',
  mj:           'Вміст обмінної енергії в МДж на кг корму',
  dep:          'Амортизація = (A − R) / N × кількість (авторозрахунок)',
  rep:          'Витрати на ремонт = A × % ремонту (авторозрахунок)',
  maint:        'Витрати на догляд/утримання = A × % догляду (авторозрахунок)',
  cnt:          'Кількість одиниць даного виду техніки або будівлі',
  a:            'Вартість придбання (балансова) одного об\'єкта в грн',
  r:            'Залишкова (ліквідаційна) вартість одного об\'єкта в грн',
  n:            'Нормативний строк служби в роках',
  pct:          'Відсоток витрат на ремонт від балансової вартості',
  rev:          'Товарна продукція (виручка) від цього виду виробництва',
  cost:         'Витрати на це виробництво',
  md:           'Маржинальний дохід = виручка − витрати (авторозрахунок)',
  ration:       'Частка цього корму в добовому раціоні тварин у відсотках',
  role:         'Посада або функція працівника в господарстві',
  phone:        'Номер телефону для оперативного зв\'язку',
  email:        'Електронна адреса працівника',
  pct:          'Відсоток від балансової вартості (не може бути від\'ємним)',
};

// Підказки за суфіксом поля — один запис покриває всі модулі
// (sw1_vet, bl0_vet, dy0_vet → всі дають 'vet')
const SUFFIX_TIPS = {
  subsidy:         'Субсидії, дотації та прямі виплати від держави (грн)',
  vet:             'Витрати на ветеринарні препарати, вакцинацію та санітарну гігієну',
  services:        'Вартість послуг підрядних організацій (зоотехнік, забій, транспорт тощо)',
  mech_feed:       'Витрати на роботу кормових ліній та автоматичних годівниць',
  mech_vent:       'Витрати на роботу вентиляційних систем та підтримання мікроклімату',
  mech_man:        'Витрати на механічне прибирання гною або видалення підстилки',
  other:           'Інші прямі витрати, не включені в попередні категорії',
  // Молочне скотарство
  heifer:          'Щорічні витрати на ремонт поголів\'я (вартість телиці / термін використання)',
  milk_mech:       'Витрати на роботу доїльної установки або доїльного залу',
  feed_mech:       'Витрати на роботу кормороздавача або мобільного кормовоза',
  vent:            'Витрати на роботу вентиляційної системи корівника',
  manure_mech:     'Витрати на механічне прибирання гною (скрепер, насос гноєсховища)',
  energy:          'Витрати на електроенергію, воду та опалення приміщення',
  insem:           'Витрати на штучне запліднення (сперма + робота техніка-осіменатора)',
  insure:          'Витрати на страхування тварин від хвороб та стихійних лих',
  // Каскад прибутковості — параметри (однакові для всіх модулів)
  cap_own_pct:     'Ставка альтернативних витрат на власний капітал (зазвичай 12–18%)',
  cap_hire_pct:    'Ставка по банківському кредиту на оборотний капітал (зазвичай 15–22%)',
  cap_own_share:   'Частка власного капіталу від 0 до 1 (наприклад 0.5 = 50% власний)',
  mach_a:          'Балансова вартість техніки та обладнання на 1 голову або 1 га',
  mach_dep_pct:    'Норма амортизації техніки у % на рік (зазвичай 8–15%)',
  mach_rep_pct:    'Норма відрахувань на ремонт техніки у % від балансової вартості',
  build_a:         'Балансова вартість виробничих будівель та споруд на 1 голову або 1 га',
  build_dep_pct:   'Норма амортизації будівель у % на рік (зазвичай 4–5%)',
  build_maint_pct: 'Норма відрахувань на утримання будівель у % від балансової вартості',
  labor_own_h:     'Кількість годин власної (сімейної) праці на 1 голову або 1 га',
  labor_hire_h:    'Кількість годин найманої праці на 1 голову або 1 га',
  wage_own:        'Годинна ставка оплати власної (сімейної) праці',
  wage_hire:       'Годинна ставка оплати найманих працівників',
  land_own:        'Альтернативні витрати на власну землю під будівлями та дорогами',
  land_rent:       'Орендна плата за землю під виробничими будівлями',
  land_other:      'Інші альтернативні витрати, пов\'язані із землею та розташуванням',
  gen_labor_h:     'Кількість годин загальногосподарської (управлінської) праці',
  gen_wage:        'Годинна ставка загальногосподарської (управлінської) праці',
  fixed_spec:      'Інші постійні спеціальні витрати (страхування будівлі, ліцензії тощо)',
  overhead:        'Накладні витрати (бухгалтерія, зв\'язок, канцелярія, управління)',
  // Аналіз беззбитковості
  bep_price_md:    'Мінімальна ціна для покриття змінних витрат (беззбитковість за МД)',
  bep_price_full:  'Мінімальна ціна для покриття всіх витрат (повна беззбитковість)',
  bep_load:        'Мінімальний відсоток завантаженості потужностей для беззбитковості',
  working_cap:     'Потреба в оборотному капіталі = змінні витрати × 0.6',
  rent_md:         'Рентабельність за МД = МД / Виручка × 100%',
  rent_profit:     'Рентабельність за прибутком = Прибуток / Виручка × 100%',
};

function getTip(field) {
  if (TOOLTIPS[field]) return TOOLTIPS[field];
  // Загальний ключ: sw1_/sw2_ → sw_, bl0_/bl1_ → bl_, dy0_/dy1_ → dy_, pt1_/pt2_ → pt_
  const gen = field.replace(/^(sw|pt)[12]_/, '$1_').replace(/^(bl|dy)[01]_/, '$1_');
  if (TOOLTIPS[gen]) return TOOLTIPS[gen];
  // Суфіксний пошук — видаляємо будь-який модульний префікс (sw1_, bpc_, ca_, swa2_ тощо)
  const suffix = field.replace(/^[a-z]{2,4}[0-9]?_/, '');
  if (SUFFIX_TIPS[suffix]) return SUFFIX_TIPS[suffix];
  // Fallback до підказок колонок таблиць
  return COL_TIPS[field] || '';
}

// ============================================================
// VALIDATION — антибаран-система
// ============================================================
(function initValidation() {
  // Глобальний обробник подій введення — спрацьовує у фазі захоплення (до oninput)
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.type !== 'number' || el.readOnly) return;
    const val = parseFloat(el.value);
    if (isNaN(val)) return;
    const minAttr = el.hasAttribute('min') ? parseFloat(el.getAttribute('min')) : null;
    const maxAttr = el.hasAttribute('max') ? parseFloat(el.getAttribute('max')) : null;
    let clamped = false;
    if (minAttr !== null && val < minAttr) { el.value = minAttr; clamped = true; }
    if (maxAttr !== null && val > maxAttr) { el.value = maxAttr; clamped = true; }
    if (clamped) {
      el.classList.add('input-clamped');
      setTimeout(() => el.classList.remove('input-clamped'), 700);
    }
  }, true);
})();

// ============================================================
// TOOLTIP BAR — плаваючи підказка (desktop hover + mobile focus)
// ============================================================
(function initTipPopup() {
  const pop = document.createElement('div');
  pop.id = 'field-tip-pop';
  pop.className = 'field-tip-pop';
  document.body.appendChild(pop);

  let hideTimer = null;

  function showTip(text, anchorEl) {
    if (!text) return;
    clearTimeout(hideTimer);
    pop.textContent = text;
    pop.classList.add('visible');
    positionTip(anchorEl);
  }

  function positionTip(anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const popW = 260;
    const gap = 8;

    // Default: below the field
    let top  = rect.bottom + scrollY + gap;
    let left = rect.left  + scrollX;

    // Clamp to viewport horizontally
    const vw = window.innerWidth;
    if (left + popW > vw - 12) left = vw - popW - 12;
    if (left < 8) left = 8;

    // If not enough space below, flip above
    if (rect.bottom + gap + 80 > window.innerHeight) {
      top = rect.top + scrollY - gap - 80;
      pop.classList.add('above');
    } else {
      pop.classList.remove('above');
    }

    pop.style.top  = top  + 'px';
    pop.style.left = left + 'px';
    pop.style.width = popW + 'px';
  }

  function hideTip() {
    hideTimer = setTimeout(() => pop.classList.remove('visible'), 120);
  }

  document.addEventListener('focusin', e => {
    const el = e.target;
    if (!el.matches('input:not([readonly]),select')) return;
    const tip = el.dataset.tip;
    if (tip) showTip(tip, el);
    else hideTip();
  });

  document.addEventListener('focusout', hideTip);

  // Also show on hover (desktop)
  document.addEventListener('mouseover', e => {
    const el = e.target;
    if (!el.matches('input:not([readonly]),select')) return;
    if (el.dataset.tip) showTip(el.dataset.tip, el);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.matches('input,select')) hideTip();
  });
})();

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
function numField(field, data, def = '', readonly = false, minVal = 0, maxVal = null) {
  const val  = fillField(data, field, def);
  const tip  = escH(getTip(field));
  if (readonly) return `<input type="text" data-field="${field}" value="${escH(val)}" readonly class="calc" placeholder="авто"${tip ? ` data-tip="${tip}"` : ''}>`;
  const minAttr = minVal !== null ? ` min="${minVal}"` : '';
  const maxAttr = maxVal !== null ? ` max="${maxVal}"` : '';
  return `<input type="number" data-field="${field}" value="${escH(val)}" step="any"${minAttr}${maxAttr} oninput="recalcAll()"${tip ? ` data-tip="${tip}"` : ''}>`;
}
function pctField(field, data, def = '') {
  return numField(field, data, def, false, 0, 100);
}
function textField(field, data, placeholder = '') {
  const tip = escH(getTip(field));
  return `<input type="text" data-field="${field}" value="${escH(fillField(data,field))}" placeholder="${placeholder}" oninput="recalcAll()"${tip ? ` data-tip="${tip}"` : ''}>`;
}
function selectField(field, data, options) {
  const val  = fillField(data, field);
  const tip  = escH(getTip(field));
  const opts = options.map(o => `<option value="${escH(o)}" ${val===o?'selected':''}>${escH(o)}</option>`).join('');
  return `<select data-field="${field}" onchange="recalcAll()"${tip ? ` data-tip="${tip}"` : ''}>${opts}</select>`;
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
      const tip = escH(getTip(c.key) || (c.tip || ''));
      const tipAttr = tip ? ` data-tip="${tip}"` : '';
      if (c.type === 'calc') {
        return `<td><input data-col="${c.key}" data-dyn-row="${idx}" value="${val}" readonly class="calc"${tipAttr}></td>`;
      }
      const type = c.type === 'number' ? 'number' : 'text';
      const minAttr = type === 'number' ? ' min="0"' : '';
      return `<td><input type="${type}" data-col="${c.key}" data-dyn-row="${idx}" value="${val}" step="any"${minAttr} oninput="recalcAll()"${tipAttr}></td>`;
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
      <th>Речовина</th><th style="width:65px">кг/УГ</th><th style="width:70px">Еф.</th>
      <th style="width:90px">Розр. к-сть</th><th style="width:70px">Ціна/кг</th>
      <th style="width:90px">Вартість</th>
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
  body.innerHTML =

  // ── 1. Базові відомості про господарство ─────────────────
  sectionWrap('📋 Загальна інформація про підприємство', `
    ${row('ПІБ викладача / відповідального', textField('gen_teacher', data))}
    ${row('Навчальний заклад',               textField('gen_school',  data))}
    ${row('Район, область',                  '<div id="ph-gen_region"></div>')}
    ${row('Організаційно-правова форма',     '<div id="ph-gen_orgform"></div>')}
    ${row('Спеціалізація господарства',      '<div id="ph-gen_spec"></div>')}
    ${row('Система вирощування',             '<div id="ph-gen_system"></div>')}
    ${row('Річна кількість опадів',          numField('gen_rain', data), 'мм')}
    ${row('Використання зрошування',         selectField('gen_irrig', data, ['ні','так']))}
    ${row('Вегетаційний період',             numField('gen_veg', data), 'місяців')}
    ${row('Грошова одиниця',                 '<div id="ph-gen_curr"></div>')}
  `) +

  // ── 2. Земельний фонд ────────────────────────────────────
  sectionWrap('🗺️ Земельний фонд господарства', `
    <table class="table-section">
      <thead><tr>
        <th>Вид угідь</th>
        <th style="width:110px">Власна, га</th>
        <th style="width:110px">Орендована, га</th>
        <th style="width:110px">Разом, га</th>
      </tr></thead>
      <tbody data-dyn-section="land_fund">
        ${dynRows(data,'land_fund',[
          {type:'Рілля',                        own:'',rent:'',total:''},
          {type:'Луки та природні пасовища',    own:'',rent:'',total:''},
          {type:'Сіяні пасовища',               own:'',rent:'',total:''},
          {type:'Сінокоси',                     own:'',rent:'',total:''},
          {type:'Багаторічні насадження',       own:'',rent:'',total:''},
          {type:'Ліс та лісосмуги',             own:'',rent:'',total:''},
          {type:'Ставки та водойми',            own:'',rent:'',total:''},
          {type:'Ін. с/г угіддя',               own:'',rent:'',total:''},
        ]).map((r,idx) => `<tr data-row-idx="${idx}">
          <td><input type="text"   data-col="type"  data-dyn-row="${idx}" value="${escH(r.type||'')}" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;outline:none" oninput="recalcAll()"></td>
          <td><input type="number" data-col="own"   data-dyn-row="${idx}" value="${escH(r.own||'')}"  step="any" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;outline:none" oninput="recalcAll()"></td>
          <td><input type="number" data-col="rent"  data-dyn-row="${idx}" value="${escH(r.rent||'')}" step="any" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;outline:none" oninput="recalcAll()"></td>
          <td><input data-col="total" data-dyn-row="${idx}" value="${escH(r.total||'')}" readonly class="calc" style="width:100%"></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <button class="add-row-btn" onclick="dynAddRow('land_fund')">+ Рядок</button>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
      <div>${row('<strong>Всього с/г угідь</strong>', numField('gen_land_total',data,'',true), 'га')}</div>
      <div>${row('в т.ч. власна', numField('gen_land_own',data,'',true), 'га')}</div>
      <div>${row('в т.ч. орендована', numField('gen_land_rent',data,'',true), 'га')}</div>
    </div>
    ${row('Середня орендна плата', numField('gen_rent_price',data), 'грн/га/рік')}
    ${row('Вартість власної землі (оцінка)', numField('gen_land_value',data), 'грн/га')}
  `, 'blue') +

  // ── 3. Структура посівних площ та сівозміна ─────────────
  sectionWrap('🌾 Структура посівних площ та сівозміна', `
    <div style="font-size:11px;color:var(--gray);margin-bottom:8px">
      Вкажіть усі культури, які вирощуються в господарстві. Площа рілля автоматично підраховується з блоку «Земельний фонд».
    </div>
    ${dynTable('crop_plan', dynRows(data,'crop_plan',[
      {crop:'',area:'',pct:'',rotation_pos:'',prev_crop:'',notes:''},
    ]), [
      { key:'crop',         label:'Культура',              type:'text'   },
      { key:'area',         label:'Площа, га',             type:'number' },
      { key:'pct',          label:'% від ріллі (авто)',   type:'calc'   },
      { key:'rotation_pos', label:'Позиція в сівозміні',  type:'text'   },
      { key:'prev_crop',    label:'Попередник',           type:'text'   },
      { key:'notes',        label:'Примітки',             type:'text'   },
    ], {addLabel:'+ Додати культуру'})}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
      <div>${row('Всього під культурами', numField('gen_crops_total',data,'',true), 'га')}</div>
      <div>${row('Пар / незайнятий', numField('gen_fallow',data,'',true), 'га')}</div>
      <div>${row('К-сть культур', numField('gen_crops_count',data,'',true), 'шт.')}</div>
    </div>
  `) +

  // ── 4. Структура поголів'я худоби ────────────────────────
  sectionWrap('🐄 Структура поголів\'я худоби (якщо є)', `
    ${dynTable('livestock_plan', dynRows(data,'livestock_plan',[
      {species:'',type:'',heads:'',lu:'',facility:'',notes:''},
    ]), [
      { key:'species',  label:'Вид тварин',        type:'text'   },
      { key:'type',     label:'Статево-вікова гр.',type:'text'   },
      { key:'heads',    label:'Поголів\'я, гол.',  type:'number' },
      { key:'lu',       label:'УГ (авто)',          type:'calc'   },
      { key:'facility', label:'Місць у приміщенні',type:'number' },
      { key:'notes',    label:'Примітки',          type:'text'   },
    ], {addLabel:'+ Вид тварин'})}
    ${row('Всього УГ (авто)', numField('gen_lu_total',data,'',true), 'УГ')}
  `) +

  // ── 5. Трудові ресурси ───────────────────────────────────
  sectionWrap('👥 Трудові ресурси', `
    ${row('Кількість постійних працівників', numField('gen_workers_perm',data), 'осіб')}
    ${row('Кількість сезонних працівників',  numField('gen_workers_seas',data), 'осіб')}
    ${row('Сімейна праця (власна)',          numField('gen_labor_family',data), 'люд-год/рік')}
    ${row('Годинна ставка (власна праця)',   numField('gen_wage_own',data,'2.5'), 'грн/год')}
    ${row('Годинна ставка (найм. праця)',    numField('gen_wage_hire',data,'2.8'), 'грн/год')}
    <div style="margin-top:8px">
    ${dynTable('employees', dynRows(data,'employees',[{name:'',role:'',phone:'',email:''}]), [
      { key:'name',  label:'ПІБ',    type:'text' },
      { key:'role',  label:'Посада', type:'text' },
      { key:'phone', label:'Тел.',   type:'text' },
      { key:'email', label:'Email',  type:'text' },
    ], { addLabel:'+ Додати співробітника' })}
    </div>
  `,'blue');

  // Async comboboxes
  for (const [field, key, ph] of [
    ['gen_region', 'regions',   'напр. Полтавський р-н…'],
    ['gen_orgform','orgforms',  'ФГ, ТОВ, ПП…'],
    ['gen_spec',   'specs',     'рослинництво, тваринництво, змішане…'],
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
// MODULE: ПТАХІВНИЦТВО (Broiler production)
// ============================================================

// Manure table for poultry — uses kg/bird instead of kg/LU
function poultryManureTable(prefix, data) {
  const f = (key, def) => `<input type="number" data-field="${prefix}${key}" value="${fillField(data, prefix+key, def)}" step="any" min="0" style="width:100%;padding:3px 5px;border:1px solid var(--border);border-radius:4px;font-size:12px;outline:none" oninput="recalcAll()">`;
  const c = (key) => `<input data-field="${prefix}${key}" readonly class="calc" style="width:100%;padding:3px 5px;border-radius:4px;font-size:12px">`;
  return `<table class="manure-table">
    <thead><tr>
      <th>Речовина</th>
      <th style="width:90px">кг/гол./цикл</th>
      <th style="width:70px">Еф.</th>
      <th style="width:90px">Ефект. к-сть</th>
      <th style="width:70px">Ціна/кг</th>
      <th style="width:90px">Вартість/гол.</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>N (азот)</td>
        <td>${f('_man_n_kg','0.035')}</td><td>${f('_man_n_eff','0.40')}</td>
        <td>${c('_man_n_qty')}</td><td>${f('_man_n_price','')}</td><td>${c('_man_n_val')}</td>
      </tr>
      <tr>
        <td>P₂O₅ (фосфор)</td>
        <td>${f('_man_p_kg','0.025')}</td><td>${f('_man_p_eff','1.00')}</td>
        <td>${c('_man_p_qty')}</td><td>${f('_man_p_price','')}</td><td>${c('_man_p_val')}</td>
      </tr>
      <tr>
        <td>K₂O (калій)</td>
        <td>${f('_man_k_kg','0.020')}</td><td>${f('_man_k_eff','1.00')}</td>
        <td>${c('_man_k_qty')}</td><td>${f('_man_k_price','')}</td><td>${c('_man_k_val')}</td>
      </tr>
    </tbody>
  </table>
  ${row('<strong>Вартість посліду / гол.</strong>', numField(prefix+'_man_head', data, '', true), 'грн')}`;
}

function buildPoultryMD(body, data) {
  body.innerHTML = `
  <div style="margin-bottom:10px;font-size:12px;color:var(--gray)">
    Таблиця 1 — Маржинальний дохід птахівництва (бройлери). Два варіанти для порівняння.
  </div>
  <div class="cascade-cols">
  ${['1','2'].map(v => `<div>
    ${sectionWrap(`🐔 Варіант ${v}`, `
      <div style="font-size:11px;font-weight:700;color:var(--gray);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Виробничі показники</div>
      ${row('Маса добового курчати',           numField('pt'+v+'_w_start',data,'40'),   'г',    '',  getTip('pt_w_start'))}
      ${row('Цільова жива маса (забій)',         numField('pt'+v+'_w_end',data,'2400'),  'г',    '',  getTip('pt_w_end'))}
      ${row('Загальний приріст (авто)',          numField('pt'+v+'_gain',data,'',true),  'г')}
      ${row('Тривалість вирощування',            numField('pt'+v+'_days_fat',data,'42'), 'днів', '',  getTip('pt_days_fat'))}
      ${row('Санітарна пауза',                  numField('pt'+v+'_days_san',data,'14'), 'днів', '',  getTip('pt_days_san'))}
      ${row('Тривалість циклу (авто)',           numField('pt'+v+'_cycle',data,'',true), 'днів')}
      ${row('Середньодобовий приріст (авто)',    numField('pt'+v+'_adg',data,'',true),   'г/день')}
      ${row('К-сть циклів на рік (авто)',        numField('pt'+v+'_turns',data,'',true), 'об./рік')}
      ${row('Вихід тушки від живої маси',        pctField('pt'+v+'_yield',data,'74'),    '%',    '',  getTip('pt_yield'))}
      ${row('Маса тушки / гол. (авто)',           numField('pt'+v+'_carcass',data,'',true),'кг')}
      ${row('К-сть місць (голів)',               numField('pt'+v+'_heads',data,'10000'), 'гол.', '',  getTip('pt_heads'))}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Виручка</div>
      ${row('Ціна реалізації',                  numField('pt'+v+'_price',data),    'грн/кг тушки', '', getTip('pt_price'))}
      ${row('Виручка від птиці (авто)',          numField('pt'+v+'_rev',data,'',true), 'грн')}
      ${row('Субсидії / дотації',               numField('pt'+v+'_subsidy',data),  'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--green);margin:8px 0 4px">♻️ Вартість посліду (на цикл, на партію)</div>
      ${poultryManureTable('pt'+v, data)}
      ${row('<strong>Вартість посліду, всього (авто)</strong>', numField('pt'+v+'_man_total',data,'',true), 'грн')}
      ${row('<strong>Валова виручка (авто)</strong>',           numField('pt'+v+'_gross',data,'',true), 'грн')}

      <div style="font-size:11px;font-weight:700;color:var(--red);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px">Пропорційні змінні витрати</div>
      ${row('Добове курча (закупівля)',          numField('pt'+v+'_chick_cost',data),  'грн/гол.', '', getTip('pt_chick_cost'))}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Корми:</div>
      ${dynTable('pt'+v+'_feeds', dynRows(data,'pt'+v+'_feeds',[
        {name:'Стартер (0–10 днів)',  unit:'кг', mj:'13.5', qty:'0.12', price:'',sum:''},
        {name:'Гровер (10–28 днів)',  unit:'кг', mj:'13.2', qty:'0.90', price:'',sum:''},
        {name:'Фінішер (28–42 дні)', unit:'кг', mj:'13.0', qty:'3.08', price:'',sum:''},
      ]), [
        { key:'name',  label:'Назва корму',   type:'text'   },
        { key:'unit',  label:'Од.',           type:'text',  width:'45px', def:'кг' },
        { key:'mj',    label:'МДж ОЕ/кг',    type:'number', width:'75px' },
        { key:'qty',   label:'кг/гол.',       type:'number' },
        { key:'price', label:'Ціна/кг',       type:'number' },
        { key:'sum',   label:'Сума (авто)',   type:'calc'   },
      ], {addLabel:'+ Корм'})}
      ${row('Корми, всього (авто)',               numField('pt'+v+'_feed_total',data,'',true), 'грн')}
      ${row('МДж ОЕ / гол. (авто)',               numField('pt'+v+'_mj_total',data,'',true), 'МДж')}
      ${row('Ветеринар, вакцинація, дезінфекція', numField('pt'+v+'_vet',data),        'грн', '', getTip('pt_vet'))}
      ${row('Послуги підрядників',                numField('pt'+v+'_services',data),   'грн', '', getTip('pt_services'))}
      <div style="font-size:11px;color:var(--gray);margin:6px 0 2px">Механізація (власна):</div>
      ${row('— Кормові лінії',                   numField('pt'+v+'_mech_feed',data),  'грн', '', getTip('pt_mech_feed'))}
      ${row('— Вентиляція та мікроклімат',        numField('pt'+v+'_mech_vent',data),  'грн', '', getTip('pt_mech_vent'))}
      ${row('— Видалення підстилки',              numField('pt'+v+'_mech_man',data),   'грн', '', getTip('pt_mech_man'))}
      ${row('— Обігрів (броудери)',               numField('pt'+v+'_mech_heat',data),  'грн', '', getTip('pt_mech_heat'))}
      ${row('Інші прямі витрати',                 numField('pt'+v+'_other',data),      'грн', '', getTip('pt_other'))}
      ${row('<strong>Змінні витрати, всього (авто)</strong>', numField('pt'+v+'_costs',data,'',true), 'грн')}

      <div style="height:8px;border-top:2px solid var(--blue);margin-top:10px"></div>
      ${row('<strong>МД практичний (авто)</strong>', numField('pt'+v+'_md',data,'',true), 'грн')}
      ${row('МД на 1 голову (авто)',                 numField('pt'+v+'_md_head',data,'',true), 'грн/гол.')}
      ${row('МД на 1 місце в рік (авто)',            numField('pt'+v+'_md_place',data,'',true), 'грн/міс./рік')}
    `,'blue')}
  </div>`).join('')}
  </div>`;
}

function buildPoultryProfit(body, data) {
  body.innerHTML = `
  <div style="font-size:12px;color:var(--gray);margin-bottom:12px">
    Каскад прибутковості на 1 голову. Заповніть параметри нижче; МД береться з Таблиці 1.
  </div>
  ${cascadeParamsSection('ptc', data)}
  <div class="cascade-cols">
  ${['1','2'].map(v => `
  <div>
    ${sectionWrap(`💹 Варіант ${v} — Каскад на 1 гол.`, `
      ${cascadeWaterfall(
        'ptc'+v, data,
        'pt'+v+'_gross_per', 'pt'+v+'_costs_per',
        'Прибуток / гол. Вар. '+v
      )}
      ${row('Прибуток / місце в рік', numField('ptc'+v+'_profit_place',data,'',true), 'грн/міс./рік')}
    `,'green')}
  </div>`).join('')}
  </div>`;
}

function buildPoultryAnalysis(body, data) {
  body.innerHTML = sectionWrap('📊 Аналіз беззбитковості', `
    <div class="cascade-cols">
    ${['1','2'].map(v => `
    <div>
      <strong style="display:block;margin-bottom:8px;color:var(--navy)">Варіант ${v}</strong>
      ${row('Поріг ціни (беззбитковість МД)',      numField('pta'+v+'_bep_price_md',data,'',true),   'грн/кг')}
      ${row('Поріг ціни (повні витрати)',           numField('pta'+v+'_bep_price_full',data,'',true), 'грн/кг')}
      ${row('Поріг завантаженості місць',           numField('pta'+v+'_bep_load',data,'',true),       '%')}
      ${row('Потреба в оборотному капіталі',        numField('pta'+v+'_working_cap',data,'',true),    'грн')}
      ${row('Рентабельність за МД',                 numField('pta'+v+'_rent_md',data,'',true),        '%')}
      ${row('Рентабельність за прибутком',          numField('pta'+v+'_rent_profit',data,'',true),    '%')}
    </div>`).join('')}
    </div>
  `,'blue');
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
  if (el) return fnum(el.value);
  // Fallback to saved data for fields from other tabs not currently in DOM
  if (currentForm && currentForm.data) return fnum(currentForm.data[field]);
  return 0;
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
  if (mod === 'crop'  && tab === 0) recalcCropGeneral();
  if (mod === 'crop'  && tab === 1) recalcCropGM();
  if (mod === 'crop'  && tab === 2) recalcCropAssets();
  if (mod === 'crop'  && tab === 3) recalcCropAnalysis();
  if (mod === 'swine' && tab === 0) recalcSwine();
  if (mod === 'swine' && tab === 1) recalcSwineProfit();
  if (mod === 'swine' && tab === 2) recalcSwineAnalysis();
  if (mod === 'bulls' && tab === 0) recalcBulls();
  if (mod === 'bulls' && tab === 1) recalcBullsAgg();
  if (mod === 'bulls' && tab === 2) recalcBullsProfit();
  if (mod === 'dairy'   && tab === 0) recalcDairy();
  if (mod === 'dairy'   && tab === 1) recalcDairyAgg();
  if (mod === 'dairy'   && tab === 2) recalcDairyProfit();
  if (mod === 'poultry' && tab === 0) recalcPoultry();
  if (mod === 'poultry' && tab === 1) recalcPoultryProfit();
  if (mod === 'poultry' && tab === 2) recalcPoultryAnalysis();
}

// ── Crop General ─────────────────────────────────────────────
function recalcCropGeneral() {
  // Земельний фонд: total = own + rent per row
  let totalOwn = 0, totalRent = 0;
  document.querySelectorAll('[data-dyn-section="land_fund"] tr[data-row-idx]').forEach(tr => {
    const own  = fnum(tr.querySelector('[data-col="own"]')?.value);
    const rent = fnum(tr.querySelector('[data-col="rent"]')?.value);
    const tot  = own + rent;
    const totEl = tr.querySelector('[data-col="total"]');
    if (totEl) totEl.value = tot > 0 ? tot.toFixed(2) : '';
    totalOwn  += own;
    totalRent += rent;
  });
  setCalc('gen_land_own',   totalOwn);
  setCalc('gen_land_rent',  totalRent);
  setCalc('gen_land_total', totalOwn + totalRent);

  // Структура посівних площ: % від ріллі, сума площ
  const rillya = (() => {
    let r = 0;
    document.querySelectorAll('[data-dyn-section="land_fund"] tr[data-row-idx]').forEach(tr => {
      const typeEl = tr.querySelector('[data-col="type"]');
      if (typeEl && typeEl.value.toLowerCase().includes('рілля')) {
        r = fnum(tr.querySelector('[data-col="own"]')?.value) + fnum(tr.querySelector('[data-col="rent"]')?.value);
      }
    });
    return r;
  })();

  let cropTotal = 0, cropCount = 0;
  document.querySelectorAll('[data-dyn-section="crop_plan"] tr[data-row-idx]').forEach(tr => {
    const area = fnum(tr.querySelector('[data-col="area"]')?.value);
    const pctEl = tr.querySelector('[data-col="pct"]');
    if (pctEl) pctEl.value = (rillya > 0 && area > 0) ? (area / rillya * 100).toFixed(1) : '';
    if (area > 0) { cropTotal += area; cropCount++; }
  });
  setCalc('gen_crops_total', cropTotal);
  setCalc('gen_fallow',      Math.max(0, rillya - cropTotal));
  setCalc('gen_crops_count', cropCount);

  // Поголів'я худоби: УГ = heads × коефіцієнт (за типом)
  const LU_COEFF = {
    'корова':0.8,'корови':0.8,'дійні':0.8,'молочна':0.8,
    'бичок':0.6,'бичків':0.6,'бики':0.6,'бичків':0.6,'телиця':0.5,'телиці':0.5,
    'свиня':0.12,'свині':0.12,'свиней':0.12,'кнур':0.2,
    'вівця':0.1,'вівці':0.1,'коза':0.1,'кінь':1.0,'коні':1.0,
  };
  let luTotal = 0;
  document.querySelectorAll('[data-dyn-section="livestock_plan"] tr[data-row-idx]').forEach(tr => {
    const speciesEl = tr.querySelector('[data-col="species"]');
    const heads = fnum(tr.querySelector('[data-col="heads"]')?.value);
    let coeff = 0.5;
    if (speciesEl) {
      const sp = speciesEl.value.toLowerCase();
      for (const [key, val] of Object.entries(LU_COEFF)) {
        if (sp.includes(key)) { coeff = val; break; }
      }
    }
    const lu = heads * coeff;
    const luEl = tr.querySelector('[data-col="lu"]');
    if (luEl) luEl.value = lu > 0 ? lu.toFixed(2) : '';
    luTotal += lu;
  });
  setCalc('gen_lu_total', luTotal);
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

    // manure per head, display per herd
    const manPerHead = calcManure('sw'+v, lu);
    const manTotal   = manPerHead * heads;
    setCalc('sw'+v+'_man_total', manTotal);
    setCalc('sw'+v+'_gross', rev + sub + manTotal);

    // feed cost per head × heads = total herd feed cost
    const feedPerHead = dynCalcSum('sw'+v+'_feeds');
    const feedTotal   = feedPerHead * heads;
    const mjTotal     = dynCalcMJ('sw'+v+'_feeds');
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

    // manure per head × heads = total herd value
    const manPerHead = calcManure('bl'+vi, lu);
    const manTotal   = manPerHead * heads;
    setCalc('bl'+vi+'_man_total', manTotal);
    setCalc('bl'+vi+'_gross', rev + sub + manTotal);

    // feed cost per head × heads = total herd feed cost
    const feedPerHead = dynCalcSum('bl'+vi+'_feeds');
    const feedTotal   = feedPerHead * heads;
    const mjTotal     = dynCalcMJ('bl'+vi+'_feeds');
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

// ── Poultry manure calc (per bird, not per LU) ───────────────
function calcPoultryManure(prefix) {
  let total = 0;
  for (const n of ['n','p','k']) {
    const qty = getVal(prefix+'_man_'+n+'_kg') * getVal(prefix+'_man_'+n+'_eff');
    const val = qty * getVal(prefix+'_man_'+n+'_price');
    setCalc(prefix+'_man_'+n+'_qty', qty);
    setCalc(prefix+'_man_'+n+'_val', val);
    total += val;
  }
  setCalc(prefix+'_man_head', total);
  return total;
}

// ── Poultry MD ───────────────────────────────────────────────
function recalcPoultry() {
  for (const v of ['1','2']) {
    const wS  = getVal('pt'+v+'_w_start');   // grams
    const wE  = getVal('pt'+v+'_w_end');     // grams
    const gain = wE - wS;
    const daysFat = getVal('pt'+v+'_days_fat');
    const daysSan = getVal('pt'+v+'_days_san');
    const cycle   = daysFat + daysSan;
    const adg     = daysFat > 0 ? gain / daysFat : 0;
    const turns   = cycle > 0 ? 365 / cycle : 0;
    const carcass = wE / 1000 * getVal('pt'+v+'_yield') / 100;  // kg per bird

    setCalc('pt'+v+'_gain',    gain);
    setCalc('pt'+v+'_cycle',   cycle);
    setCalc('pt'+v+'_adg',     adg);
    setCalc('pt'+v+'_turns',   turns);
    setCalc('pt'+v+'_carcass', carcass);

    const heads = getVal('pt'+v+'_heads');
    const rev   = carcass * heads * getVal('pt'+v+'_price');
    const sub   = getVal('pt'+v+'_subsidy');
    setCalc('pt'+v+'_rev', rev);

    // poultry manure per bird, display per herd
    const manPerBird = calcPoultryManure('pt'+v);
    const manTotal   = manPerBird * heads;
    setCalc('pt'+v+'_man_total', manTotal);
    setCalc('pt'+v+'_gross', rev + sub + manTotal);

    // feed cost per bird × heads
    const feedPerBird = dynCalcSum('pt'+v+'_feeds');
    const feedTotal   = feedPerBird * heads;
    const mjTotal     = dynCalcMJ('pt'+v+'_feeds');
    setCalc('pt'+v+'_feed_total', feedTotal);
    setCalc('pt'+v+'_mj_total',   mjTotal);

    const mechSub = getVal('pt'+v+'_mech_feed') + getVal('pt'+v+'_mech_vent') +
                    getVal('pt'+v+'_mech_man')   + getVal('pt'+v+'_mech_heat');
    const costs = getVal('pt'+v+'_chick_cost') * heads + feedTotal +
      getVal('pt'+v+'_vet') + getVal('pt'+v+'_services') + mechSub + getVal('pt'+v+'_other');
    const md = getVal('pt'+v+'_gross') - costs;

    setCalc('pt'+v+'_costs',    costs);
    setCalc('pt'+v+'_md',       md);
    setCalc('pt'+v+'_md_head',  heads > 0 ? md / heads : 0);
    setCalc('pt'+v+'_md_place', heads > 0 ? md / heads * turns : 0);
  }
}

// ── Poultry Cascade ──────────────────────────────────────────
function recalcPoultryProfit() {
  for (const v of ['1','2']) {
    const heads   = getVal('pt'+v+'_heads') || 1;
    const turns   = getVal('pt'+v+'_turns') || 1;
    const grossPer = getVal('pt'+v+'_gross') / heads;
    const costsPer = getVal('pt'+v+'_costs') / heads;
    setCalc('pt'+v+'_gross_per', grossPer);
    setCalc('pt'+v+'_costs_per', costsPer);
    calcCascade('ptc'+v, 'ptc', grossPer, costsPer, turns);
  }
}

// ── Poultry Break-even ───────────────────────────────────────
function recalcPoultryAnalysis() {
  for (const v of ['1','2']) {
    const heads   = getVal('pt'+v+'_heads') || 1;
    const gross   = getVal('pt'+v+'_gross');
    const costs   = getVal('pt'+v+'_costs');
    const carcass = getVal('pt'+v+'_carcass');
    const md      = getVal('pt'+v+'_md');

    const bepPriceMD   = carcass > 0 && heads > 0 ? (costs / heads) / carcass : 0;
    const rentMD       = gross > 0 ? md / gross * 100 : 0;
    const workingCap   = costs * 0.6;

    setCalc('pta'+v+'_bep_price_md',   bepPriceMD);
    setCalc('pta'+v+'_bep_price_full', bepPriceMD * 1.15);
    setCalc('pta'+v+'_bep_load',       bepPriceMD > 0 ? Math.min(100, costs / (gross || 1) * 100) : 0);
    setCalc('pta'+v+'_working_cap',    workingCap);
    setCalc('pta'+v+'_rent_md',        rentMD);
    setCalc('pta'+v+'_rent_profit',    0);
  }
}

// ============================================================
// MOBILE NAVIGATION
// ============================================================
window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  const isOpen  = sidebar.classList.contains('open');
  closeMobileOverlays();
  if (!isOpen) {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  }
};

window.toggleFormsPanel = function() {
  const panel   = document.getElementById('forms-panel');
  const overlay = document.getElementById('mobile-overlay');
  const isOpen  = panel.classList.contains('open');
  closeMobileOverlays();
  if (!isOpen) {
    panel.classList.add('open');
    overlay.classList.add('show');
  }
};

window.closeMobileOverlays = function() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('forms-panel')?.classList.remove('open');
  document.getElementById('mobile-overlay')?.classList.remove('show');
};

// Close panels on swipe left (basic touch support)
(function initSwipeClose() {
  let startX = 0;
  document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -60) closeMobileOverlays();
  }, { passive: true });
})();

// ============================================================
// BOOT
// ============================================================
renderFormsList();

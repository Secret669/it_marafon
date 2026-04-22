/**
 * api.js — Клієнтський модуль для роботи з сервером.
 * Якщо сервер недоступний — автоматично fallback на localStorage,
 * щоб застосунок працював і в офлайн-режимі.
 */

const API_BASE = '/api';
let _serverAvailable = null;   // null = ще не перевірено

// ── Утиліти ──────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Server error');
  return json.data;
}

/** Перевіряємо доступність сервера один раз при завантаженні */
async function checkServer() {
  if (_serverAvailable !== null) return _serverAvailable;
  try {
    await fetch(API_BASE + '/options/currencies', { signal: AbortSignal.timeout(2000) });
    _serverAvailable = true;
  } catch {
    _serverAvailable = false;
    console.warn('⚠️ Server unavailable — using localStorage fallback');
  }
  updateConnectionBadge();
  return _serverAvailable;
}

function updateConnectionBadge() {
  let badge = document.getElementById('conn-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'conn-badge';
    badge.style.cssText = 'position:fixed;bottom:24px;left:24px;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;z-index:9999;pointer-events:none';
    document.body.appendChild(badge);
  }
  badge.textContent     = _serverAvailable ? '🟢 Сервер' : '🟡 Офлайн (localStorage)';
  badge.style.background = _serverAvailable ? '#dcfce7' : '#fef3c7';
  badge.style.color      = _serverAvailable ? '#166534' : '#92400e';
}

// ================================================================
// OPTIONS (combobox persistent values)
// ================================================================

const _optCache = {};   // in-memory cache to avoid repeated requests

export async function getOptions(key) {
  if (_optCache[key]) return _optCache[key];
  if (await checkServer()) {
    try {
      const vals = await apiFetch(`/options/${key}`);
      _optCache[key] = vals;
      return vals;
    } catch { /* fallthrough */ }
  }
  // localStorage fallback
  const vals = JSON.parse(localStorage.getItem('cb_' + key) || '[]');
  _optCache[key] = vals;
  return vals;
}

export async function addOption(key, value) {
  if (!value) return;
  // Оновлюємо кеш одразу (optimistic)
  if (!_optCache[key]) await getOptions(key);
  if (!_optCache[key].includes(value)) _optCache[key].push(value);

  if (await checkServer()) {
    try { await apiFetch(`/options/${key}`, { method: 'POST', body: { value } }); return; }
    catch { /* fallthrough to localStorage */ }
  }
  // localStorage fallback
  const opts = JSON.parse(localStorage.getItem('cb_' + key) || '[]');
  if (!opts.includes(value)) {
    opts.push(value);
    localStorage.setItem('cb_' + key, JSON.stringify(opts));
  }
}

// ================================================================
// FORMS CRUD
// ================================================================

export async function listForms(module) {
  if (await checkServer()) {
    try { return await apiFetch(`/forms?module=${module}`); }
    catch { /* fallthrough */ }
  }
  // localStorage fallback
  return Object.values(JSON.parse(localStorage.getItem('forms') || '{}'))
    .filter(f => f.module === module)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(f => ({ id: f.id, module: f.module, name: f.name, updated_at: new Date(f.updatedAt).toISOString() }));
}

export async function getForm(id) {
  if (await checkServer()) {
    try { return await apiFetch(`/forms/${id}`); }
    catch { /* fallthrough */ }
  }
  const all = JSON.parse(localStorage.getItem('forms') || '{}');
  return all[id] || null;
}

export async function createForm(module, name) {
  const form = { module, name, data: {}, updatedAt: Date.now() };
  if (await checkServer()) {
    try {
      const saved = await apiFetch('/forms', { method: 'POST', body: { module, name, data: {} } });
      return { ...saved, updatedAt: Date.now() };
    } catch { /* fallthrough */ }
  }
  // localStorage fallback
  form.id = Date.now().toString();
  const all = JSON.parse(localStorage.getItem('forms') || '{}');
  all[form.id] = form;
  localStorage.setItem('forms', JSON.stringify(all));
  return form;
}

export async function updateForm(id, name, data) {
  const updatedAt = Date.now();
  if (await checkServer()) {
    try { await apiFetch(`/forms/${id}`, { method: 'PUT', body: { name, data } }); return; }
    catch { /* fallthrough */ }
  }
  // localStorage fallback
  const all = JSON.parse(localStorage.getItem('forms') || '{}');
  if (all[id]) { all[id].name = name; all[id].data = data; all[id].updatedAt = updatedAt; }
  localStorage.setItem('forms', JSON.stringify(all));
}

export async function deleteForm(id) {
  if (await checkServer()) {
    try { await apiFetch(`/forms/${id}`, { method: 'DELETE' }); return; }
    catch { /* fallthrough */ }
  }
  // localStorage fallback
  const all = JSON.parse(localStorage.getItem('forms') || '{}');
  delete all[id];
  localStorage.setItem('forms', JSON.stringify(all));
}

// Ініціалізація (перевірка сервера при завантаженні)
checkServer();

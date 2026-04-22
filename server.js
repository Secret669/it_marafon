/**
 * АгроФорма — Express + MySQL API
 * Запуск: node server.js
 * Потрібно: npm install express mysql2 cors dotenv
 */

require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));   // віддає index.html / app.js / styles.css

// ── DB pool ──────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT      || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'agroforma',
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'utf8mb4',
});

// Перевірка з'єднання при старті
pool.getConnection()
  .then(conn => { conn.release(); console.log('✅ MySQL connected'); })
  .catch(err  => console.error('❌ MySQL error:', err.message));

// ── Helper ───────────────────────────────────────────────────────
function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}
function err(res, message, status = 500) {
  res.status(status).json({ ok: false, error: message });
}

// ================================================================
// ROUTES — FORMS
// ================================================================

// GET /api/forms?module=crop
app.get('/api/forms', async (req, res) => {
  try {
    const mod = req.query.module;
    let rows;
    if (mod) {
      [rows] = await pool.query(
        'SELECT id, module, name, updated_at FROM forms WHERE module = ? ORDER BY updated_at DESC',
        [mod]
      );
    } else {
      [rows] = await pool.query(
        'SELECT id, module, name, updated_at FROM forms ORDER BY updated_at DESC'
      );
    }
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// GET /api/forms/:id
app.get('/api/forms/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, module, name, data, created_at, updated_at FROM forms WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return err(res, 'Not found', 404);
    const form = rows[0];
    // data зберігається як JSON string — MySQL вже парсить, але про всяк випадок:
    if (typeof form.data === 'string') form.data = JSON.parse(form.data);
    ok(res, form);
  } catch (e) { err(res, e.message); }
});

// POST /api/forms  { module, name, data }
app.post('/api/forms', async (req, res) => {
  try {
    const { module, name, data = {} } = req.body;
    if (!module || !name) return err(res, 'module and name are required', 400);
    const [result] = await pool.query(
      'INSERT INTO forms (module, name, data) VALUES (?, ?, ?)',
      [module, name, JSON.stringify(data)]
    );
    ok(res, { id: result.insertId, module, name, data }, 201);
  } catch (e) { err(res, e.message); }
});

// PUT /api/forms/:id  { name?, data? }
app.put('/api/forms/:id', async (req, res) => {
  try {
    const { name, data } = req.body;
    const updates = [];
    const params  = [];
    if (name !== undefined) { updates.push('name = ?');           params.push(name); }
    if (data !== undefined) { updates.push('data = ?');           params.push(JSON.stringify(data)); }
    if (!updates.length)    return err(res, 'Nothing to update', 400);
    params.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE forms SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    if (!result.affectedRows) return err(res, 'Not found', 404);
    ok(res, { id: parseInt(req.params.id) });
  } catch (e) { err(res, e.message); }
});

// DELETE /api/forms/:id
app.delete('/api/forms/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM forms WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return err(res, 'Not found', 404);
    ok(res, { deleted: parseInt(req.params.id) });
  } catch (e) { err(res, e.message); }
});

// ================================================================
// ROUTES — COMBOBOX OPTIONS
// ================================================================

// GET /api/options/:key
app.get('/api/options/:key', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT value FROM cb_options WHERE opt_key = ? ORDER BY sort_order, id',
      [req.params.key]
    );
    ok(res, rows.map(r => r.value));
  } catch (e) { err(res, e.message); }
});

// POST /api/options/:key  { value }
app.post('/api/options/:key', async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return err(res, 'value is required', 400);
    await pool.query(
      'INSERT IGNORE INTO cb_options (opt_key, value) VALUES (?, ?)',
      [req.params.key, value.trim()]
    );
    ok(res, { key: req.params.key, value: value.trim() }, 201);
  } catch (e) { err(res, e.message); }
});

// DELETE /api/options/:key/:value  (тільки не системні)
app.delete('/api/options/:key/:value', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM cb_options WHERE opt_key = ? AND value = ? AND is_system = 0',
      [req.params.key, decodeURIComponent(req.params.value)]
    );
    ok(res, { deleted: result.affectedRows });
  } catch (e) { err(res, e.message); }
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌾 АгроФорма server running at http://localhost:${PORT}`);
});

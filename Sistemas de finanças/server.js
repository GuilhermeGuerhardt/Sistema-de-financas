const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Caminho do arquivo do banco de dados na mesma pasta do projeto
const dbPath = path.join(__dirname, 'financas.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function nowIso() {
  return new Date().toISOString();
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function hashPassword(password) {
  const iterations = 120000;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, 32, 'sha256')
    .toString('hex');
  return `pbkdf2$sha256$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 5) return false;
    const [kind, algo, itStr, salt, hashHex] = parts;
    // formato: pbkdf2$sha256$<iterations>$<salt>$<hash>
    if (kind !== 'pbkdf2' || algo !== 'sha256') return false;
    const iterations = Number(itStr);
    if (!Number.isFinite(iterations) || iterations < 10000) return false;
    if (!salt || !hashHex) return false;
    const derived = crypto
      .pbkdf2Sync(password, salt, iterations, 32, 'sha256')
      .toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(hashHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Tabelas principais (criação/migração)
db.prepare(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    desc TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  )
`).run();

// users / sessions
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();

// migração: adicionar user_id em transactions (se ainda não existir)
const txCols = db.prepare(`PRAGMA table_info(transactions)`).all();
const hasUserId = txCols.some((c) => c && c.name === 'user_id');
if (!hasUserId) {
  db.prepare(`ALTER TABLE transactions ADD COLUMN user_id INTEGER`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`).run();
}

db.prepare(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type)`
).run();

const catColInfo = db.prepare(`PRAGMA table_info(categories)`).all();
const catColNames = new Set(catColInfo.map((c) => c && c.name).filter(Boolean));
if (catColInfo.length > 0) {
  if (!catColNames.has('user_id')) {
    db.prepare(`ALTER TABLE categories ADD COLUMN user_id INTEGER`).run();
  }
  if (!catColNames.has('type')) {
    db.prepare(`ALTER TABLE categories ADD COLUMN type TEXT`).run();
    db.prepare(
      `UPDATE categories SET type = 'expense' WHERE type IS NULL OR TRIM(COALESCE(type, '')) = ''`
    ).run();
  }
  if (!catColNames.has('created_at')) {
    db.prepare(`ALTER TABLE categories ADD COLUMN created_at TEXT`).run();
  }
  const fixTime = nowIso();
  db.prepare(
    `UPDATE categories SET created_at = ? WHERE created_at IS NULL OR TRIM(COALESCE(created_at, '')) = ''`
  ).run(fixTime);
  db.prepare(
    `UPDATE categories SET type = 'expense' WHERE type IS NULL OR TRIM(COALESCE(type, '')) = ''`
  ).run();
}

const catColInfoAfter = db.prepare(`PRAGMA table_info(categories)`).all();
const userIdCol = catColInfoAfter.find((c) => c && c.name === 'user_id');
if (userIdCol && Number(userIdCol.notnull) === 1) {
  const tRebuild = nowIso();
  db.pragma('foreign_keys = OFF');
  try {
    db.prepare('BEGIN IMMEDIATE').run();
    db.prepare(`
      CREATE TABLE categories_rebuild (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();
    db.prepare(`
      INSERT INTO categories_rebuild (id, user_id, name, type, created_at)
      SELECT
        id,
        user_id,
        name,
        CASE
          WHEN type IN ('income', 'expense') THEN type
          ELSE 'expense'
        END,
        COALESCE(
          NULLIF(TRIM(created_at), ''),
          ?
        )
      FROM categories
    `).run(tRebuild);
    db.prepare(`DROP TABLE categories`).run();
    db.prepare(`ALTER TABLE categories_rebuild RENAME TO categories`).run();
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type)`
    ).run();
    db.prepare('COMMIT').run();
  } catch (e) {
    try {
      db.prepare('ROLLBACK').run();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

const txColsCategory = db.prepare(`PRAGMA table_info(transactions)`).all();
const hasCategoryId = txColsCategory.some((c) => c && c.name === 'category_id');
if (!hasCategoryId) {
  db.prepare(`ALTER TABLE transactions ADD COLUMN category_id INTEGER`).run();
}

db.prepare(`
  CREATE TABLE IF NOT EXISTS hidden_user_categories (
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, category_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)`).run();

const walletColInfo = db.prepare(`PRAGMA table_info(wallets)`).all();
const walletColNames = new Set(
  walletColInfo.map((c) => c && c.name).filter(Boolean)
);
if (!walletColNames.has('color')) {
  db.prepare(`ALTER TABLE wallets ADD COLUMN color TEXT`).run();
}

const DEFAULT_WALLET_COLOR = '#10b981';
db.prepare(
  `UPDATE wallets SET color = ? WHERE color IS NULL OR TRIM(COALESCE(color, '')) = ''`
).run(DEFAULT_WALLET_COLOR);

const txColsWallet = db.prepare(`PRAGMA table_info(transactions)`).all();
const hasWalletId = txColsWallet.some((c) => c && c.name === 'wallet_id');
if (!hasWalletId) {
  db.prepare(`ALTER TABLE transactions ADD COLUMN wallet_id INTEGER`).run();
}

function normalizeWalletColorInput(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  return null;
}

function ensureDefaultWallet(userId) {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM wallets WHERE user_id = ?`).get(userId);
  if (!row || row.c === 0) {
    db.prepare(
      `INSERT INTO wallets (user_id, name, created_at, color) VALUES (?, ?, ?, ?)`
    ).run(userId, 'Principal', nowIso(), DEFAULT_WALLET_COLOR);
  }
}

const userIdsFromTx = db
  .prepare(`SELECT DISTINCT user_id FROM transactions WHERE user_id IS NOT NULL`)
  .all();
for (const r of userIdsFromTx) {
  if (r && r.user_id != null) ensureDefaultWallet(r.user_id);
}
const allUsers = db.prepare(`SELECT id FROM users`).all();
for (const r of allUsers) {
  if (r && r.id != null) ensureDefaultWallet(r.id);
}

db.prepare(`
  UPDATE transactions
  SET wallet_id = (
    SELECT w.id FROM wallets w WHERE w.user_id = transactions.user_id ORDER BY w.id LIMIT 1
  )
  WHERE user_id IS NOT NULL AND (wallet_id IS NULL OR wallet_id = 0)
`).run();

const DEFAULT_EXPENSE_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Educação',
  'Lazer',
  'Compras',
  'Contas e serviços',
  'Vestuário',
  'Cuidados pessoais',
  'Outros',
];

const DEFAULT_INCOME_CATEGORIES = [
  'Salário',
  'Freelance',
  'Investimentos',
  'Presentes / doações',
  'Reembolsos',
  'Outros',
];

const presetExistsStmt = db.prepare(
  `SELECT 1 AS x FROM categories WHERE user_id IS NULL AND type = ? AND name = ? LIMIT 1`
);
const insPresetCat = db.prepare(
  `INSERT INTO categories (user_id, name, type, created_at) VALUES (NULL, ?, ?, ?)`
);
const tPreset = nowIso();
for (const name of DEFAULT_EXPENSE_CATEGORIES) {
  if (!presetExistsStmt.get('expense', name)) {
    insPresetCat.run(name, 'expense', tPreset);
  }
}
for (const name of DEFAULT_INCOME_CATEGORIES) {
  if (!presetExistsStmt.get('income', name)) {
    insPresetCat.run(name, 'income', tPreset);
  }
}

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

// Servir os arquivos estáticos (index.html, main.js, etc.)
app.use(express.static(__dirname));

function mapRow(row) {
  return {
    id: row.id,
    desc: row.desc,
    amount: row.amount,
    type: row.type,
    date: row.date,
    note: row.note || '',
    createdAt: row.created_at,
    categoryId: row.category_id != null ? row.category_id : null,
    categoryName: row.category_name || '',
    walletId: row.wallet_id != null ? row.wallet_id : null,
    walletName: row.wallet_name || '',
  };
}

function authMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.session || '';
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });

  const row = db
    .prepare(
      `SELECT s.token, s.user_id, s.expires_at, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);

  if (!row) return res.status(401).json({ error: 'Sessão inválida.' });

  const exp = new Date(row.expires_at);
  if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return res.status(401).json({ error: 'Sessão expirada.' });
  }

  req.user = { id: row.user_id, username: row.username };
  next();
}

// Auth API
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const u = typeof username === 'string' ? username.trim() : '';
    const p = typeof password === 'string' ? password : '';

    if (!u || u.length < 3 || u.length > 32 || !/^[a-zA-Z0-9._-]+$/.test(u)) {
      return res.status(400).json({
        error: 'Usuário inválido. Use 3-32 caracteres (letras, números, . _ -).',
      });
    }
    if (!p || p.length < 6) {
      return res.status(400).json({ error: 'Senha inválida. Mínimo 6 caracteres.' });
    }

    const createdAt = nowIso();
    const passwordHash = hashPassword(p);

    const insert = db.prepare(
      `INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)`
    );

    let info;
    try {
      info = insert.run(u, passwordHash, createdAt);
    } catch (e) {
      if (String(e && e.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'Este usuário já existe.' });
      }
      throw e;
    }

    // cria sessão automaticamente ao cadastrar
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(); // 30 dias
    db.prepare(
      `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
    ).run(token, info.lastInsertRowid, createdAt, expiresAt);

    setCookie(res, 'session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    });

    ensureDefaultWallet(info.lastInsertRowid);

    res.status(201).json({ id: info.lastInsertRowid, username: u });
  } catch (error) {
    console.error('Erro ao cadastrar:', error);
    res.status(500).json({ error: 'Erro ao cadastrar.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const u = typeof username === 'string' ? username.trim() : '';
    const p = typeof password === 'string' ? password : '';

    if (!u || !p) return res.status(400).json({ error: 'Informe usuário e senha.' });

    const user = db
      .prepare(`SELECT id, username, password_hash FROM users WHERE username = ?`)
      .get(u);

    if (!user || !verifyPassword(p, user.password_hash)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const createdAt = nowIso();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(); // 30 dias
    db.prepare(
      `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
    ).run(token, user.id, createdAt, expiresAt);

    setCookie(res, 'session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    });

    res.json({ id: user.id, username: user.username });
  } catch (error) {
    console.error('Erro ao entrar:', error);
    res.status(500).json({ error: 'Erro ao entrar.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.session || '';
    if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    setCookie(res, 'session', '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 0,
    });
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao sair:', error);
    res.status(500).json({ error: 'Erro ao sair.' });
  }
});

// Categorias (pré-definidas + do usuário; sugeridas ocultas por usuário ficam fora da lista)
const listCategoriesStmt = db.prepare(`
  SELECT c.id, c.user_id, c.name, c.type, c.created_at
  FROM categories c
  LEFT JOIN hidden_user_categories h
    ON h.category_id = c.id AND h.user_id = ?
  WHERE (c.user_id IS NULL OR c.user_id = ?) AND h.category_id IS NULL
  ORDER BY c.type, CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END, c.name COLLATE NOCASE
`);

app.get('/api/categories', authMiddleware, (req, res) => {
  try {
    const rows = listCategoriesStmt.all(req.user.id, req.user.id);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        isPreset: r.user_id == null,
        createdAt: r.created_at,
      }))
    );
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Erro ao listar categorias.' });
  }
});

const insertCategoryStmt = db.prepare(`
  INSERT INTO categories (user_id, name, type, created_at)
  VALUES (?, ?, ?, ?)
`);

app.post('/api/categories', authMiddleware, (req, res) => {
  try {
    const { name, type } = req.body || {};
    const n = typeof name === 'string' ? name.trim() : '';
    if (!n || n.length > 64) {
      return res.status(400).json({ error: 'Nome da categoria inválido.' });
    }
    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({ error: 'Tipo de categoria inválido.' });
    }
    const dup = db
      .prepare(
        `SELECT id FROM categories WHERE user_id = ? AND type = ? AND LOWER(name) = LOWER(?)`
      )
      .get(req.user.id, type, n);
    if (dup) {
      return res.status(409).json({ error: 'Você já tem uma categoria com esse nome.' });
    }
    const createdAt = nowIso();
    const info = insertCategoryStmt.run(req.user.id, n, type, createdAt);
    const row = db
      .prepare(
        `SELECT id, user_id, name, type, created_at FROM categories WHERE id = ?`
      )
      .get(info.lastInsertRowid);
    res.status(201).json({
      id: row.id,
      name: row.name,
      type: row.type,
      isPreset: false,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

const deleteCategoryStmt = db.prepare(
  `DELETE FROM categories WHERE id = ? AND user_id = ?`
);

const hidePresetCategoryStmt = db.prepare(
  `INSERT OR IGNORE INTO hidden_user_categories (user_id, category_id) VALUES (?, ?)`
);

app.delete('/api/categories/:id', authMiddleware, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }
    const cat = db
      .prepare(`SELECT id, user_id FROM categories WHERE id = ?`)
      .get(id);
    if (!cat) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }
    if (cat.user_id != null && cat.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }
    if (cat.user_id == null) {
      hidePresetCategoryStmt.run(req.user.id, id);
      return res.status(204).end();
    }
    db.prepare(
      `UPDATE transactions SET category_id = NULL WHERE category_id = ? AND user_id = ?`
    ).run(id, req.user.id);
    const info = deleteCategoryStmt.run(id, req.user.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada.' });
    }
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao remover categoria:', error);
    res.status(500).json({ error: 'Erro ao remover categoria.' });
  }
});

app.get('/api/wallets', authMiddleware, (req, res) => {
  try {
    ensureDefaultWallet(req.user.id);
    const rows = db
      .prepare(
        `SELECT id, name, created_at, color FROM wallets WHERE user_id = ? ORDER BY id ASC`
      )
      .all(req.user.id);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        color: normalizeWalletColorInput(r.color) ?? DEFAULT_WALLET_COLOR,
      }))
    );
  } catch (error) {
    console.error('Erro ao listar carteiras:', error);
    res.status(500).json({ error: 'Erro ao listar carteiras.' });
  }
});

app.post('/api/wallets', authMiddleware, (req, res) => {
  try {
    const n = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!n || n.length > 64) {
      return res.status(400).json({ error: 'Nome da carteira inválido.' });
    }
    const color =
      normalizeWalletColorInput(req.body?.color) ?? DEFAULT_WALLET_COLOR;
    const createdAt = nowIso();
    const info = db
      .prepare(
        `INSERT INTO wallets (user_id, name, created_at, color) VALUES (?, ?, ?, ?)`
      )
      .run(req.user.id, n, createdAt, color);
    const newId = Number(info.lastInsertRowid);
    res.status(201).json({
      id: newId,
      name: n,
      createdAt: createdAt,
      color,
    });
  } catch (error) {
    console.error('Erro ao criar carteira:', error);
    res.status(500).json({ error: 'Erro ao criar carteira.' });
  }
});

app.patch('/api/wallets/:id', authMiddleware, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }
    const row = db
      .prepare(`SELECT id, name, color FROM wallets WHERE id = ? AND user_id = ?`)
      .get(id, req.user.id);
    if (!row) {
      return res.status(404).json({ error: 'Carteira não encontrada.' });
    }
    const body = req.body || {};
    let nextName = row.name;
    if (body.name != null) {
      const n = typeof body.name === 'string' ? body.name.trim() : '';
      if (!n || n.length > 64) {
        return res.status(400).json({ error: 'Nome da carteira inválido.' });
      }
      nextName = n;
    }
    let nextColor =
      normalizeWalletColorInput(row.color) ?? DEFAULT_WALLET_COLOR;
    if (body.color != null) {
      const c = normalizeWalletColorInput(body.color);
      if (c == null) {
        return res.status(400).json({ error: 'Cor inválida. Use #RRGGBB.' });
      }
      nextColor = c;
    }
    db.prepare(
      `UPDATE wallets SET name = ?, color = ? WHERE id = ? AND user_id = ?`
    ).run(nextName, nextColor, id, req.user.id);
    const out = db
      .prepare(
        `SELECT id, name, created_at, color FROM wallets WHERE id = ? AND user_id = ?`
      )
      .get(id, req.user.id);
    res.json({
      id: out.id,
      name: out.name,
      createdAt: out.created_at,
      color: normalizeWalletColorInput(out.color) ?? DEFAULT_WALLET_COLOR,
    });
  } catch (error) {
    console.error('Erro ao atualizar carteira:', error);
    res.status(500).json({ error: 'Erro ao atualizar carteira.' });
  }
});

app.delete('/api/wallets/:id', authMiddleware, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }
    const w = db
      .prepare(`SELECT id FROM wallets WHERE id = ? AND user_id = ?`)
      .get(id, req.user.id);
    if (!w) {
      return res.status(404).json({ error: 'Carteira não encontrada.' });
    }
    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM wallets WHERE user_id = ?`)
      .get(req.user.id);
    if (total && total.c <= 1) {
      return res
        .status(400)
        .json({ error: 'É necessário manter ao menos uma carteira.' });
    }
    const used = db
      .prepare(
        `SELECT COUNT(*) AS c FROM transactions WHERE user_id = ? AND wallet_id = ?`
      )
      .get(req.user.id, id);
    if (used && used.c > 0) {
      return res.status(409).json({
        error:
          'Há lançamentos nesta carteira. Altere-os ou exclua-os antes de remover.',
      });
    }
    db.prepare(`DELETE FROM wallets WHERE id = ? AND user_id = ?`).run(
      id,
      req.user.id
    );
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao remover carteira:', error);
    res.status(500).json({ error: 'Erro ao remover carteira.' });
  }
});

// Listar transações (do usuário logado)
const listStmt = db.prepare(`
  SELECT
    t.id,
    t.desc,
    t.amount,
    t.type,
    t.date,
    t.note,
    t.created_at,
    t.category_id,
    t.wallet_id,
    c.name AS category_name,
    w.name AS wallet_name
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN wallets w ON w.id = t.wallet_id AND w.user_id = t.user_id
  WHERE t.user_id = ?
  ORDER BY t.date DESC, t.created_at DESC, t.id DESC
`);

app.get('/api/transactions', authMiddleware, (req, res) => {
  try {
    const rows = listStmt.all(req.user.id);
    res.json(rows.map(mapRow));
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    res.status(500).json({ error: 'Erro ao listar transações.' });
  }
});

// Criar nova transação
const insertStmt = db.prepare(`
  INSERT INTO transactions (desc, amount, type, date, note, created_at, user_id, category_id, wallet_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getCategoryByIdStmt = db.prepare(
  `SELECT id, user_id, name, type FROM categories WHERE id = ?`
);

const categoryHiddenStmt = db.prepare(
  `SELECT 1 AS x FROM hidden_user_categories WHERE user_id = ? AND category_id = ? LIMIT 1`
);

const getWalletByIdStmt = db.prepare(
  `SELECT id, user_id, name FROM wallets WHERE id = ?`
);

function categorySelectableForUser(categoryId, userId) {
  const cat = getCategoryByIdStmt.get(categoryId);
  if (!cat) return false;
  if (cat.user_id === userId) return true;
  if (cat.user_id == null) {
    const hid = categoryHiddenStmt.get(userId, categoryId);
    return !hid;
  }
  return false;
}

app.post('/api/transactions', authMiddleware, (req, res) => {
  try {
    ensureDefaultWallet(req.user.id);

    const { desc, amount, type, date, note, categoryId, walletId } =
      req.body || {};

    if (
      typeof desc !== 'string' ||
      !desc.trim() ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      (type !== 'income' && type !== 'expense') ||
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return res.status(400).json({ error: 'Dados inválidos para criar transação.' });
    }

    let resolvedCategoryId = null;
    if (categoryId != null && categoryId !== '') {
      const cid = Number(categoryId);
      if (!Number.isInteger(cid) || cid <= 0) {
        return res.status(400).json({ error: 'Categoria inválida.' });
      }
      if (!categorySelectableForUser(cid, req.user.id)) {
        return res.status(400).json({ error: 'Categoria inválida para este tipo.' });
      }
      const cat = getCategoryByIdStmt.get(cid);
      if (!cat || cat.type !== type) {
        return res.status(400).json({ error: 'Categoria inválida para este tipo.' });
      }
      resolvedCategoryId = cid;
    }

    if (resolvedCategoryId == null) {
      return res
        .status(400)
        .json({ error: 'Selecione uma categoria para o lançamento.' });
    }

    let resolvedWalletId = null;
    if (walletId != null && walletId !== '') {
      const wid = Number(walletId);
      if (!Number.isInteger(wid) || wid <= 0) {
        return res.status(400).json({ error: 'Carteira inválida.' });
      }
      const wal = getWalletByIdStmt.get(wid);
      if (!wal || wal.user_id !== req.user.id) {
        return res.status(400).json({ error: 'Carteira inválida.' });
      }
      resolvedWalletId = wid;
    }
    if (resolvedWalletId == null) {
      return res.status(400).json({ error: 'Selecione uma carteira.' });
    }

    const createdAt = nowIso();

    const info = insertStmt.run(
      desc.trim(),
      amount,
      type,
      date,
      note ? String(note).trim() : null,
      createdAt,
      req.user.id,
      resolvedCategoryId,
      resolvedWalletId
    );

    const row = db
      .prepare(
        `SELECT
          t.id,
          t.desc,
          t.amount,
          t.type,
          t.date,
          t.note,
          t.created_at,
          t.category_id,
          t.wallet_id,
          c.name AS category_name,
          w.name AS wallet_name
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN wallets w ON w.id = t.wallet_id AND w.user_id = t.user_id
        WHERE t.id = ? AND t.user_id = ?`
      )
      .get(info.lastInsertRowid, req.user.id);

    res.status(201).json(mapRow(row));
  } catch (error) {
    console.error('Erro ao criar transação:', error);
    res.status(500).json({ error: 'Erro ao criar transação.' });
  }
});

// Remover transação
const deleteStmt = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?');

app.delete('/api/transactions/:id', authMiddleware, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const info = deleteStmt.run(id, req.user.id);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    res.status(204).end();
  } catch (error) {
    console.error('Erro ao remover transação:', error);
    res.status(500).json({ error: 'Erro ao remover transação.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});


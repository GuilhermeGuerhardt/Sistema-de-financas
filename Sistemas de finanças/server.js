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

// Listar transações (do usuário logado)
const listStmt = db.prepare(`
  SELECT id, desc, amount, type, date, note, created_at
  FROM transactions
  WHERE user_id = ?
  ORDER BY date DESC, created_at DESC, id DESC
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
  INSERT INTO transactions (desc, amount, type, date, note, created_at, user_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

app.post('/api/transactions', authMiddleware, (req, res) => {
  try {
    const { desc, amount, type, date, note } = req.body || {};

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

    const createdAt = nowIso();

    const info = insertStmt.run(
      desc.trim(),
      amount,
      type,
      date,
      note ? String(note).trim() : null,
      createdAt,
      req.user.id
    );

    const row = db
      .prepare(
        'SELECT id, desc, amount, type, date, note, created_at FROM transactions WHERE id = ? AND user_id = ?'
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


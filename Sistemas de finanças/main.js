document.addEventListener('DOMContentLoaded', () => {
  async function requireAuthOrRedirect() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    } catch {
      window.location.href = 'login.html';
      return false;
    }
  }

  const form = document.getElementById('form');
  const descInput = document.getElementById('desc');
  const amountInput = document.getElementById('amount');
  const typeSelect = document.getElementById('type');
  const dateInput = document.getElementById('date');
  const dateNativeInput = document.getElementById('date-native');
  const noteInput = document.getElementById('note');
  const formErrorEl = document.getElementById('form-error');
  const amountKeypadEl = document.getElementById('amount-keypad');
  const filterQueryInput = document.getElementById('filter-query');
  const filterMonthSelect = document.getElementById('filter-month');

  const incomeEl = document.getElementById('income');
  const expenseEl = document.getElementById('expense');
  const totalEl = document.getElementById('total');
  const totalCardEl = document.getElementById('total-card');
  const transactionListEl = document.getElementById('transaction-list');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewLancamentos = document.getElementById('view-lancamentos');
  const viewCategorias = document.getElementById('view-categorias');
  const viewCarteiras = document.getElementById('view-carteiras');
  const navDashboard = document.getElementById('nav-dashboard');
  const navLancamentos = document.getElementById('nav-lancamentos');
  const navCarteiras = document.getElementById('nav-carteiras');
  const navCategorias = document.getElementById('nav-categorias');
  const walletSelect = document.getElementById('wallet-id');
  const walletForm = document.getElementById('wallet-form');
  const walletNameInput = document.getElementById('wallet-name');
  const walletColorPicker = document.getElementById('wallet-color-picker');
  const walletColorPresetsEl = document.getElementById('wallet-color-presets');
  const walletListEl = document.getElementById('wallet-list');
  const walletFormErrorEl = document.getElementById('wallet-form-error');
  const btnVoltarDashboardWallet = document.getElementById('btn-voltar-dashboard-wallet');
  const categorySelect = document.getElementById('category-id');
  const categoryForm = document.getElementById('category-form');
  const catNameInput = document.getElementById('cat-name');
  const catTypeSelect = document.getElementById('cat-type');
  const categoryListEl = document.getElementById('category-list');
  const categoryFormErrorEl = document.getElementById('category-form-error');
  const btnVoltarDashboardCat = document.getElementById('btn-voltar-dashboard-cat');
  const btnIrLancamentos = document.getElementById('btn-ir-lancamentos');
  const btnVoltarDashboard = document.getElementById('btn-voltar-dashboard');
  const dashboardRecentList = document.getElementById('dashboard-recent-list');
  const btnSettings = document.getElementById('btn-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const themeOptions = document.querySelectorAll('[data-theme]');
  const btnLogout = document.getElementById('btn-logout');

  if (
    !form ||
    !descInput ||
    !amountInput ||
    !typeSelect ||
    !incomeEl ||
    !expenseEl ||
    !totalEl ||
    !totalCardEl ||
    !transactionListEl
  ) {
    console.error('Erro ao inicializar: elementos da página não encontrados.');
    return;
  }

  const API_BASE = '/api';
  const fetchOpts = { credentials: 'same-origin' };
  const transactions = [];
  const categories = [];
  const wallets = [];

  const DEFAULT_WALLET_COLOR = '#10b981';
  const WALLET_COLOR_PRESETS = [
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f97316',
    '#eab308',
    '#14b8a6',
    '#64748b',
  ];

  function normalizeHexColor(raw) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
    return null;
  }

  const filters = {
    query: '',
    month: '',
  };

  let amountBuffer = '';
  let dateBuffer = '';

  function syncAmountInput() {
    amountInput.value = amountBuffer;
  }

  function formatDateBuffer(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = [];

    if (digits.length >= 2) {
      parts.push(digits.slice(0, 2));
      if (digits.length >= 4) {
        parts.push(digits.slice(2, 4));
        if (digits.length > 4) {
          parts.push(digits.slice(4));
        }
      } else if (digits.length > 2) {
        parts.push(digits.slice(2));
      }
    } else if (digits.length > 0) {
      parts.push(digits);
    }

    return parts.join('/');
  }

  function syncDateInput() {
    dateInput.value = dateBuffer;
  }

  function parseDateString(value) {
    if (!value) return null;

    // aceita tanto dd/mm/aaaa quanto aaaa-mm-dd (para compatibilidade com dados antigos)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    }

    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function handleKeypadKey(key) {
    if (key === 'clear') {
      amountBuffer = '';
      syncAmountInput();
      return;
    }

    if (key === ',') {
      if (!amountBuffer.includes(',')) {
        amountBuffer = amountBuffer || '0';
        amountBuffer += ',';
      }
      syncAmountInput();
      return;
    }

    if (!/^\d$/.test(key)) {
      return;
    }

    amountBuffer += key;
    syncAmountInput();
  }

  if (amountKeypadEl) {
    amountKeypadEl.addEventListener('click', (event) => {
      const target = event.target;
      const button = target.closest('button[data-key]');
      if (!button) return;

      const key = button.getAttribute('data-key');
      if (!key) return;

      handleKeypadKey(key);

      if (formErrorEl) {
        formErrorEl.textContent = '';
        formErrorEl.classList.add('hidden');
      }
    });

    amountInput.addEventListener('focus', () => {
      amountKeypadEl.classList.remove('hidden');
    });

    amountInput.addEventListener('click', () => {
      amountKeypadEl.classList.remove('hidden');
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (
        target === amountInput ||
        amountKeypadEl.contains(target)
      ) {
        return;
      }

      amountKeypadEl.classList.add('hidden');
    });
  }

  function normalizeTransaction(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const amount = Number(raw.amount);
    if (!Number.isFinite(amount)) return null;

    if (raw.type !== 'income' && raw.type !== 'expense') return null;

    const categoryIdRaw = raw.categoryId != null ? raw.categoryId : raw.category_id;
    let categoryId = null;
    if (categoryIdRaw != null && categoryIdRaw !== '') {
      const n = Number(categoryIdRaw);
      if (Number.isInteger(n) && n > 0) categoryId = n;
    }

    return {
      id: raw.id,
      desc: String(raw.desc || '').trim(),
      amount,
      type: raw.type,
      date: raw.date || null,
      note: typeof raw.note === 'string' ? raw.note : '',
      createdAt: raw.createdAt || raw.created_at || Date.now(),
      categoryId,
      categoryName:
        typeof raw.categoryName === 'string'
          ? raw.categoryName
          : typeof raw.category_name === 'string'
            ? raw.category_name
            : '',
      walletId: (() => {
        const w = raw.walletId != null ? raw.walletId : raw.wallet_id;
        if (w == null || w === '') return null;
        const n = Number(w);
        return Number.isInteger(n) && n > 0 ? n : null;
      })(),
      walletName:
        typeof raw.walletName === 'string'
          ? raw.walletName
          : typeof raw.wallet_name === 'string'
            ? raw.wallet_name
            : '',
    };
  }

  function normalizeWallet(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;
    const color =
      normalizeHexColor(raw.color) ?? DEFAULT_WALLET_COLOR;
    return { id, name, color };
  }

  function normalizeCategory(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.type !== 'income' && raw.type !== 'expense') return null;
    const id = Number(raw.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const name = String(raw.name || '').trim();
    if (!name) return null;
    return {
      id,
      name,
      type: raw.type,
      isPreset: Boolean(raw.isPreset),
    };
  }

  function syncCategorySelectToType() {
    if (!categorySelect || !typeSelect) return;
    const t = typeSelect.value;
    categorySelect.innerHTML = '';

    if (!t) {
      categorySelect.disabled = true;
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Selecione o tipo primeiro';
      o.disabled = true;
      o.selected = true;
      categorySelect.appendChild(o);
      return;
    }

    categorySelect.disabled = false;

    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Selecione a categoria';
    ph.disabled = true;
    ph.selected = true;
    categorySelect.appendChild(ph);

    categories
      .filter((c) => c.type === t)
      .forEach((c) => {
        const o = document.createElement('option');
        o.value = String(c.id);
        o.textContent = c.name;
        categorySelect.appendChild(o);
      });
  }

  function renderCategoryList() {
    if (!categoryListEl) return;
    categoryListEl.innerHTML = '';

    const byType = { expense: [], income: [] };
    categories.forEach((c) => {
      if (byType[c.type]) byType[c.type].push(c);
    });

    const sections = [
      { type: 'expense', label: 'Despesas' },
      { type: 'income', label: 'Receitas' },
    ];

    sections.forEach(({ type: tp, label }) => {
      const heading = document.createElement('li');
      heading.className =
        'text-xs font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wide pt-3 first:pt-0 list-none';
      heading.textContent = label;
      categoryListEl.appendChild(heading);

      const list = byType[tp];
      if (list.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'text-sm text-zinc-500 dark:text-zinc-500 py-1';
        empty.textContent = 'Nenhuma categoria.';
        categoryListEl.appendChild(empty);
        return;
      }

      list.forEach((c) => {
        const li = document.createElement('li');
        li.className =
          'flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2';

        const left = document.createElement('div');
        left.className = 'flex items-center gap-2 min-w-0';
        const nameSpan = document.createElement('span');
        nameSpan.className =
          'text-sm text-zinc-800 dark:text-zinc-200 truncate';
        nameSpan.textContent = c.name;
        const tag = document.createElement('span');
        tag.className =
          'shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-500';
        tag.textContent = c.isPreset ? 'Sugerida' : 'Sua';
        left.appendChild(nameSpan);
        left.appendChild(tag);

        li.appendChild(left);

        const del = document.createElement('button');
        del.type = 'button';
        del.className =
          'shrink-0 p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 transition-colors';
        del.innerHTML = '<i class="ph ph-trash text-lg"></i>';
        del.addEventListener('click', async () => {
          const msg = c.isPreset
            ? `Ocultar a sugerida "${c.name}" só para você? Ela some da lista de novos lançamentos; o histórico antigo continua igual.`
            : `Remover "${c.name}"? Lançamentos que usavam essa categoria ficarão sem categoria.`;
          const ok = window.confirm(msg);
          if (!ok) return;
          try {
            const res = await fetch(
              `${API_BASE}/categories/${encodeURIComponent(c.id)}`,
              { method: 'DELETE', ...fetchOpts }
            );
            if (!res.ok && res.status !== 204) {
              throw new Error(`HTTP ${res.status}`);
            }
            await fetchCategories();
            await fetchTransactionsFromServer();
          } catch (e) {
            console.error(e);
            window.alert('Não foi possível remover a categoria.');
          }
        });
        li.appendChild(del);

        categoryListEl.appendChild(li);
      });
    });
  }

  function populateWalletSelect() {
    if (!walletSelect) return;
    const previous = walletSelect.value;
    walletSelect.innerHTML = '';
    if (wallets.length === 0) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Crie uma carteira na aba Carteiras';
      o.disabled = true;
      o.selected = true;
      walletSelect.appendChild(o);
      walletSelect.disabled = true;
      return;
    }
    walletSelect.disabled = false;
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Selecione a carteira';
    ph.disabled = true;
    ph.selected = true;
    walletSelect.appendChild(ph);
    wallets.forEach((w) => {
      const o = document.createElement('option');
      o.value = String(w.id);
      o.textContent = w.name;
      o.style.color = w.color || DEFAULT_WALLET_COLOR;
      walletSelect.appendChild(o);
    });
    if (previous && wallets.some((w) => String(w.id) === previous)) {
      walletSelect.value = previous;
    }
  }

  function renderWalletList() {
    if (!walletListEl) return;
    walletListEl.innerHTML = '';
    if (wallets.length === 0) {
      const li = document.createElement('li');
      li.className = 'text-sm text-zinc-500 dark:text-zinc-500 py-2';
      li.textContent = 'Nenhuma carteira cadastrada.';
      walletListEl.appendChild(li);
      return;
    }
    wallets.forEach((w) => {
      const li = document.createElement('li');
      li.className =
        'flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2';
      const left = document.createElement('div');
      left.className = 'flex items-center gap-2 min-w-0 flex-1';
      const dot = document.createElement('span');
      dot.className =
        'shrink-0 w-3 h-3 rounded-full ring-2 ring-zinc-200 dark:ring-zinc-700';
      dot.style.backgroundColor = w.color || DEFAULT_WALLET_COLOR;
      dot.title = 'Cor da carteira';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'text-sm text-zinc-800 dark:text-zinc-200 truncate';
      nameSpan.textContent = w.name;
      left.appendChild(dot);
      left.appendChild(nameSpan);
      const colorIn = document.createElement('input');
      colorIn.type = 'color';
      colorIn.value = w.color || DEFAULT_WALLET_COLOR;
      colorIn.title = 'Alterar cor';
      colorIn.className =
        'shrink-0 w-9 h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer p-0.5 bg-transparent';
      colorIn.addEventListener('change', async () => {
        const next = colorIn.value;
        if (normalizeHexColor(next) == null) return;
        try {
          const res = await fetch(
            `${API_BASE}/wallets/${encodeURIComponent(w.id)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ color: next }),
            }
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          dot.style.backgroundColor = next;
          w.color = next;
          populateWalletSelect();
        } catch (e) {
          console.error(e);
          colorIn.value = w.color || DEFAULT_WALLET_COLOR;
          window.alert(
            e && e.message
              ? String(e.message)
              : 'Não foi possível atualizar a cor.'
          );
        }
      });
      li.appendChild(left);
      li.appendChild(colorIn);
      const del = document.createElement('button');
      del.type = 'button';
      del.className =
        'shrink-0 p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 transition-colors';
      del.innerHTML = '<i class="ph ph-trash text-lg"></i>';
      del.title = 'Remover carteira';
      del.addEventListener('click', async () => {
        const ok = window.confirm(
          `Remover a carteira "${w.name}"? Só é possível se não houver lançamentos nela e se não for a única.`
        );
        if (!ok) return;
        try {
          const res = await fetch(
            `${API_BASE}/wallets/${encodeURIComponent(w.id)}`,
            { method: 'DELETE', ...fetchOpts }
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok && res.status !== 204) {
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          await fetchWallets();
        } catch (e) {
          console.error(e);
          window.alert(
            e && e.message
              ? String(e.message)
              : 'Não foi possível remover a carteira.'
          );
        }
      });
      li.appendChild(del);
      walletListEl.appendChild(li);
    });
  }

  function initWalletColorPresets() {
    if (!walletColorPresetsEl || !walletColorPicker) return;
    walletColorPresetsEl.innerHTML = '';
    WALLET_COLOR_PRESETS.forEach((hex) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className =
        'w-8 h-8 rounded-full ring-2 ring-zinc-200 dark:ring-zinc-700 hover:ring-emerald-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500';
      b.style.backgroundColor = hex;
      b.title = hex;
      b.addEventListener('click', () => {
        walletColorPicker.value = hex;
      });
      walletColorPresetsEl.appendChild(b);
    });
  }

  async function fetchWallets() {
    try {
      const response = await fetch(`${API_BASE}/wallets`, fetchOpts);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) return;
      const normalized = data
        .map(normalizeWallet)
        .filter((w) => w !== null);
      wallets.splice(0, wallets.length, ...normalized);
      populateWalletSelect();
      renderWalletList();
    } catch (error) {
      console.error('Não foi possível carregar carteiras.', error);
      if (walletSelect) {
        walletSelect.innerHTML = '';
        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'Erro ao carregar carteiras';
        o.disabled = true;
        o.selected = true;
        walletSelect.appendChild(o);
        walletSelect.disabled = true;
      }
    }
  }

  async function fetchCategories() {
    if (!categorySelect) return;
    try {
      const response = await fetch(`${API_BASE}/categories`, fetchOpts);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) return;
      const normalized = data
        .map(normalizeCategory)
        .filter((c) => c !== null);
      categories.splice(0, categories.length, ...normalized);
      renderCategoryList();
      syncCategorySelectToType();
    } catch (error) {
      console.error('Não foi possível carregar categorias.', error);
      categorySelect.innerHTML = '';
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Erro ao carregar categorias';
      o.disabled = true;
      o.selected = true;
      categorySelect.appendChild(o);
      categorySelect.disabled = true;
    }
  }

  async function fetchTransactionsFromServer() {
    try {
      const response = await fetch(`${API_BASE}/transactions`, fetchOpts);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) return;

      const normalized = data
        .map(normalizeTransaction)
        .filter((t) => t !== null);

      transactions.splice(0, transactions.length, ...normalized);
      updateSummary();
      renderTransactions();
      renderDashboardRecent();
    } catch (error) {
      console.error('Não foi possível carregar as transações do servidor.', error);
      transactionListEl.innerHTML = '';
      const li = document.createElement('li');
      li.className = 'text-zinc-500 dark:text-zinc-500 text-sm';
      li.textContent =
        'Erro ao carregar transações do servidor. Verifique se o backend está em execução.';
      transactionListEl.appendChild(li);
      if (dashboardRecentList) {
        dashboardRecentList.innerHTML = '';
        const err = document.createElement('li');
        err.className = 'text-zinc-500 dark:text-zinc-500 text-sm py-4 text-center';
        err.textContent = 'Não foi possível carregar.';
        dashboardRecentList.appendChild(err);
      }
    }
  }

  const formatCurrency = (value) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const dashboardCharts = [];
  const CHART_COLORS = [
    'rgba(52, 211, 153, 0.9)',
    'rgba(45, 212, 191, 0.9)',
    'rgba(56, 189, 248, 0.9)',
    'rgba(129, 140, 248, 0.9)',
    'rgba(167, 139, 250, 0.9)',
    'rgba(192, 132, 252, 0.9)',
    'rgba(232, 121, 249, 0.9)',
    'rgba(251, 113, 133, 0.9)',
    'rgba(251, 191, 36, 0.9)',
    'rgba(249, 115, 22, 0.9)',
    'rgba(148, 163, 184, 0.9)',
    'rgba(16, 185, 129, 0.75)',
  ];

  function destroyDashboardCharts() {
    while (dashboardCharts.length) {
      const c = dashboardCharts.pop();
      c.destroy();
    }
  }

  function chartTickColor() {
    return document.documentElement.classList.contains('dark')
      ? '#a1a1aa'
      : '#71717a';
  }

  function chartGridColor() {
    return document.documentElement.classList.contains('dark')
      ? 'rgba(63, 63, 70, 0.55)'
      : 'rgba(228, 228, 231, 0.9)';
  }

  function transactionMonthKey(t) {
    if (t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
      return t.date.slice(0, 7);
    }
    const d = t.date ? parseDateString(t.date) : new Date(t.createdAt);
    if (!d || Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function aggregateCategoryTotals(txType) {
    const map = new Map();
    transactions
      .filter((x) => x.type === txType)
      .forEach((x) => {
        const key =
          x.categoryName && String(x.categoryName).trim()
            ? String(x.categoryName).trim()
            : 'Sem categoria';
        map.set(key, (map.get(key) || 0) + x.amount);
      });
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const maxSlice = 12;
    if (entries.length <= maxSlice) {
      return {
        labels: entries.map((e) => e[0]),
        data: entries.map((e) => e[1]),
      };
    }
    const top = entries.slice(0, maxSlice - 1);
    const rest = entries.slice(maxSlice - 1).reduce((s, [, v]) => s + v, 0);
    return {
      labels: [...top.map((e) => e[0]), 'Outras'],
      data: [...top.map((e) => e[1]), rest],
    };
  }

  function doughnutColors(count) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(CHART_COLORS[i % CHART_COLORS.length]);
    }
    return out;
  }

  function updateDashboardCharts() {
    if (typeof Chart === 'undefined') return;
    destroyDashboardCharts();

    const tick = chartTickColor();
    const grid = chartGridColor();
    const legendLabels = { color: tick, boxWidth: 12, padding: 10, font: { size: 11 } };

    const tooltipCurrency = {
      callbacks: {
        label(ctx) {
          const v = ctx.raw;
          if (typeof v !== 'number') return ctx.label || '';
          const chartType = ctx.chart && ctx.chart.config ? ctx.chart.config.type : '';
          if (chartType === 'doughnut' || chartType === 'pie') {
            const ds = ctx.dataset.data;
            const total = Array.isArray(ds)
              ? ds.reduce((a, b) => a + b, 0)
              : 0;
            if (total > 0) {
              const pct = ((v / total) * 100).toFixed(1);
              return `${ctx.label}: ${formatCurrency(v)} (${pct}%)`;
            }
          }
          if (chartType === 'bar' && ctx.dataset && ctx.dataset.label) {
            return `${ctx.dataset.label}: ${formatCurrency(v)}`;
          }
          return `${ctx.label ? ctx.label + ': ' : ''}${formatCurrency(v)}`;
        },
      },
    };

    const income = transactions
      .filter((x) => x.type === 'income')
      .reduce((s, x) => s + x.amount, 0);
    const expense = transactions
      .filter((x) => x.type === 'expense')
      .reduce((s, x) => s + x.amount, 0);

    const ctxIe = document.getElementById('chart-income-expense');
    const emptyIe = document.getElementById('chart-income-expense-empty');
    if (ctxIe && emptyIe) {
      if (income <= 0 && expense <= 0) {
        ctxIe.classList.add('hidden');
        emptyIe.classList.remove('hidden');
      } else {
        ctxIe.classList.remove('hidden');
        emptyIe.classList.add('hidden');
        dashboardCharts.push(
          new Chart(ctxIe, {
            type: 'bar',
            data: {
              labels: ['Receitas', 'Despesas'],
              datasets: [
                {
                  data: [income, expense],
                  backgroundColor: [
                    'rgba(52, 211, 153, 0.85)',
                    'rgba(248, 113, 113, 0.85)',
                  ],
                  borderColor: ['rgb(16, 185, 129)', 'rgb(239, 68, 68)'],
                  borderWidth: 1,
                },
              ],
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: tooltipCurrency.callbacks },
              },
              scales: {
                x: {
                  ticks: { color: tick },
                  grid: { color: grid },
                },
                y: {
                  ticks: { color: tick },
                  grid: { display: false },
                },
              },
            },
          })
        );
      }
    }

    const expAgg = aggregateCategoryTotals('expense');
    const expSum = expAgg.data.reduce((a, b) => a + b, 0);
    const ctxEx = document.getElementById('chart-expense-by-category');
    const emptyEx = document.getElementById('chart-expense-by-category-empty');
    if (ctxEx && emptyEx) {
      if (expSum <= 0) {
        ctxEx.classList.add('hidden');
        emptyEx.classList.remove('hidden');
      } else {
        ctxEx.classList.remove('hidden');
        emptyEx.classList.add('hidden');
        dashboardCharts.push(
          new Chart(ctxEx, {
            type: 'doughnut',
            data: {
              labels: expAgg.labels,
              datasets: [
                {
                  data: expAgg.data,
                  backgroundColor: doughnutColors(expAgg.labels.length),
                  borderWidth: 1,
                  borderColor: document.documentElement.classList.contains('dark')
                    ? '#18181b'
                    : '#ffffff',
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: legendLabels },
                tooltip: tooltipCurrency,
              },
            },
          })
        );
      }
    }

    const incAgg = aggregateCategoryTotals('income');
    const incSum = incAgg.data.reduce((a, b) => a + b, 0);
    const ctxIn = document.getElementById('chart-income-by-category');
    const emptyIn = document.getElementById('chart-income-by-category-empty');
    if (ctxIn && emptyIn) {
      if (incSum <= 0) {
        ctxIn.classList.add('hidden');
        emptyIn.classList.remove('hidden');
      } else {
        ctxIn.classList.remove('hidden');
        emptyIn.classList.add('hidden');
        dashboardCharts.push(
          new Chart(ctxIn, {
            type: 'doughnut',
            data: {
              labels: incAgg.labels,
              datasets: [
                {
                  data: incAgg.data,
                  backgroundColor: doughnutColors(incAgg.labels.length),
                  borderWidth: 1,
                  borderColor: document.documentElement.classList.contains('dark')
                    ? '#18181b'
                    : '#ffffff',
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: legendLabels },
                tooltip: tooltipCurrency,
              },
            },
          })
        );
      }
    }

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', {
        month: 'short',
        year: 'numeric',
      });
      months.push({ key, label });
    }
    const incByM = months.map(() => 0);
    const expByM = months.map(() => 0);
    transactions.forEach((x) => {
      const mk = transactionMonthKey(x);
      if (!mk) return;
      const idx = months.findIndex((m) => m.key === mk);
      if (idx === -1) return;
      if (x.type === 'income') incByM[idx] += x.amount;
      else expByM[idx] += x.amount;
    });
    const anyMonthly =
      incByM.some((v) => v > 0) || expByM.some((v) => v > 0);
    const ctxM = document.getElementById('chart-monthly-flow');
    const emptyM = document.getElementById('chart-monthly-flow-empty');
    if (ctxM && emptyM) {
      if (!anyMonthly) {
        ctxM.classList.add('hidden');
        emptyM.classList.remove('hidden');
      } else {
        ctxM.classList.remove('hidden');
        emptyM.classList.add('hidden');
        dashboardCharts.push(
          new Chart(ctxM, {
            type: 'bar',
            data: {
              labels: months.map((m) => m.label),
              datasets: [
                {
                  label: 'Receitas',
                  data: incByM,
                  backgroundColor: 'rgba(52, 211, 153, 0.8)',
                  borderColor: 'rgb(16, 185, 129)',
                  borderWidth: 1,
                },
                {
                  label: 'Despesas',
                  data: expByM,
                  backgroundColor: 'rgba(248, 113, 113, 0.8)',
                  borderColor: 'rgb(239, 68, 68)',
                  borderWidth: 1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: legendLabels },
                tooltip: { callbacks: tooltipCurrency.callbacks },
              },
              scales: {
                x: {
                  ticks: { color: tick },
                  grid: { color: grid },
                },
                y: {
                  ticks: { color: tick },
                  grid: { color: grid },
                },
              },
            },
          })
        );
      }
    }
  }

  function renderTransactions() {
    transactionListEl.innerHTML = '';

    let visibleTransactions = [...transactions];

    if (filters.query) {
      const query = filters.query.toLowerCase();
      visibleTransactions = visibleTransactions.filter((t) =>
        t.desc.toLowerCase().includes(query)
      );
    }

    if (filters.month) {
      const monthNumber = Number(filters.month);
      visibleTransactions = visibleTransactions.filter((t) => {
        const baseDate = t.date
          ? parseDateString(t.date)
          : new Date(t.createdAt);
        if (Number.isNaN(baseDate.getTime())) return false;
        return baseDate.getMonth() + 1 === monthNumber;
      });
    }

    visibleTransactions.sort((a, b) => {
      const dateA = a.date ? parseDateString(a.date) : new Date(a.createdAt);
      const dateB = b.date ? parseDateString(b.date) : new Date(b.createdAt);
      return dateB - dateA;
    });

    if (visibleTransactions.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'text-zinc-500 dark:text-zinc-500 text-sm';
      emptyLi.textContent = 'Nenhuma transação encontrada para os filtros atuais.';
      transactionListEl.appendChild(emptyLi);
      return;
    }

    visibleTransactions.forEach((t) => {
      const li = document.createElement('li');
      li.className =
        'flex items-center justify-between bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3';

      const left = document.createElement('div');
      left.className = 'flex items-center gap-3';

      const icon = document.createElement('i');
      icon.className =
        'ph text-xl ' +
        (t.type === 'income'
          ? 'ph-arrow-circle-up text-emerald-500'
          : 'ph-arrow-circle-down text-red-500');

      const textWrapper = document.createElement('div');

      const descSpan = document.createElement('p');
      descSpan.className = 'text-sm font-medium text-zinc-800 dark:text-zinc-100';
      descSpan.textContent = t.desc;

      const metaSpan = document.createElement('p');
      metaSpan.className = 'text-xs text-zinc-500 dark:text-zinc-500';
      const baseDate = t.date
        ? parseDateString(t.date)
        : new Date(t.createdAt);
      const formattedDate = Number.isNaN(baseDate.getTime())
        ? ''
        : baseDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
      const typeLabel = t.type === 'income' ? 'Entrada' : 'Saída';
      const catPart =
        t.categoryName && String(t.categoryName).trim()
          ? ' • ' + String(t.categoryName).trim()
          : '';
      const walletPart =
        t.walletName && String(t.walletName).trim()
          ? ' • ' + String(t.walletName).trim()
          : '';
      metaSpan.textContent =
        typeLabel +
        catPart +
        walletPart +
        (formattedDate ? ' • ' + formattedDate : '');

      textWrapper.appendChild(descSpan);
      textWrapper.appendChild(metaSpan);

      if (t.note) {
        const noteSpan = document.createElement('p');
        noteSpan.className = 'text-xs text-zinc-500 dark:text-zinc-400 mt-0.5';
        noteSpan.textContent = t.note;
        textWrapper.appendChild(noteSpan);
      }

      left.appendChild(icon);
      left.appendChild(textWrapper);

      const right = document.createElement('div');
      right.className = 'flex items-center gap-3';

      const amountSpan = document.createElement('span');
      amountSpan.className =
        'font-mono text-sm ' +
        (t.type === 'income' ? 'text-emerald-400' : 'text-red-400');
      amountSpan.textContent =
        (t.type === 'expense' ? '- ' : '+ ') + formatCurrency(t.amount);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className =
        'p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-500 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 dark:hover:border-red-400 transition-colors';
      deleteBtn.innerHTML = '<i class="ph ph-trash text-lg"></i>';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = window.confirm(
          'Tem certeza que deseja remover esta transação?'
        );
        if (!confirmed) return;

        if (!t.id) {
          console.error('Transação sem ID não pode ser removida do servidor.');
          return;
        }

        try {
          const response = await fetch(
            `${API_BASE}/transactions/${encodeURIComponent(t.id)}`,
            { method: 'DELETE', ...fetchOpts }
          );

          if (!response.ok && response.status !== 204) {
            throw new Error(`HTTP ${response.status}`);
          }

          await fetchTransactionsFromServer();
        } catch (error) {
          console.error('Erro ao remover transação no servidor.', error);
          window.alert('Não foi possível remover a transação. Tente novamente.');
        }
      });

      right.appendChild(amountSpan);
      right.appendChild(deleteBtn);

      li.appendChild(left);
      li.appendChild(right);

      transactionListEl.appendChild(li);
    });
  }

  function updateSummary() {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const total = income - expense;

    incomeEl.textContent = formatCurrency(income);
    expenseEl.textContent = formatCurrency(expense);
    totalEl.textContent = formatCurrency(total);

    if (total < 0) {
      totalCardEl.classList.remove('bg-emerald-600', 'border-emerald-500');
      totalCardEl.classList.add('bg-red-600', 'border-red-500');
    } else {
      totalCardEl.classList.remove('bg-red-600', 'border-red-500');
      totalCardEl.classList.add('bg-emerald-600', 'border-emerald-500');
    }

    updateDashboardCharts();
  }

  function setNavTabActive(el, active) {
    if (!el) return;
    el.classList.toggle('bg-emerald-600', active);
    el.classList.toggle('text-white', active);
    el.classList.toggle('text-zinc-600', !active);
    el.classList.toggle('dark:text-zinc-400', !active);
  }

  function showView(viewName) {
    const isDashboard = viewName === 'dashboard';
    const isLancamentos = viewName === 'lancamentos';
    const isCarteiras = viewName === 'carteiras';
    const isCategorias = viewName === 'categorias';
    if (viewDashboard) viewDashboard.classList.toggle('hidden', !isDashboard);
    if (viewLancamentos) viewLancamentos.classList.toggle('hidden', !isLancamentos);
    if (viewCarteiras) viewCarteiras.classList.toggle('hidden', !isCarteiras);
    if (viewCategorias) viewCategorias.classList.toggle('hidden', !isCategorias);
    setNavTabActive(navDashboard, isDashboard);
    setNavTabActive(navLancamentos, isLancamentos);
    setNavTabActive(navCarteiras, isCarteiras);
    setNavTabActive(navCategorias, isCategorias);
  }

  function renderDashboardRecent() {
    if (!dashboardRecentList) return;
    const recent = [...transactions]
      .sort((a, b) => {
        const dateA = a.date ? parseDateString(a.date) : new Date(a.createdAt);
        const dateB = b.date ? parseDateString(b.date) : new Date(b.createdAt);
        return (dateB || 0) - (dateA || 0);
      })
      .slice(0, 8);
    dashboardRecentList.innerHTML = '';
    if (recent.length === 0) {
      const li = document.createElement('li');
      li.className = 'text-zinc-500 dark:text-zinc-500 text-sm py-4 text-center';
      li.textContent = 'Nenhum lançamento ainda. Vá em Lançamentos para registrar.';
      dashboardRecentList.appendChild(li);
      return;
    }
    recent.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5';
      const left = document.createElement('div');
      left.className = 'flex items-center gap-2';
      const icon = document.createElement('i');
      icon.className = 'ph text-lg ' + (t.type === 'income' ? 'ph-arrow-circle-up text-emerald-500' : 'ph-arrow-circle-down text-red-500');
      const text = document.createElement('span');
      text.className = 'text-sm text-zinc-800 dark:text-zinc-200';
      const cat =
        t.categoryName && t.categoryName.trim()
          ? ` · ${t.categoryName.trim()}`
          : '';
      const wal =
        t.walletName && t.walletName.trim()
          ? ` · ${t.walletName.trim()}`
          : '';
      text.textContent = t.desc + cat + wal;
      left.appendChild(icon);
      left.appendChild(text);
      const amountSpan = document.createElement('span');
      amountSpan.className = 'font-mono text-sm ' + (t.type === 'income' ? 'text-emerald-400' : 'text-red-400');
      amountSpan.textContent = (t.type === 'expense' ? '- ' : '+ ') + formatCurrency(t.amount);
      li.appendChild(left);
      li.appendChild(amountSpan);
      dashboardRecentList.appendChild(li);
    });
  }

  // filtros
  if (filterQueryInput) {
    filterQueryInput.addEventListener('input', (event) => {
      filters.query = event.target.value || '';
      renderTransactions();
    });
  }

  if (filterMonthSelect) {
    filterMonthSelect.addEventListener('change', (event) => {
      filters.month = event.target.value || '';
      renderTransactions();
    });
  }

  // data padrão: hoje
  if (dateInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateBuffer = `${day}/${month}/${year}`;
    syncDateInput();

    if (dateNativeInput) {
      dateNativeInput.value = `${year}-${month}-${day}`;

      dateNativeInput.addEventListener('change', (event) => {
        const iso = event.target.value;
        if (!iso) return;

        const [yyyy, mm, dd] = iso.split('-');
        if (!yyyy || !mm || !dd) return;

        dateBuffer = `${dd}/${mm}/${yyyy}`;
        syncDateInput();

        if (
          formErrorEl &&
          formErrorEl.textContent.includes('Data inválida')
        ) {
          formErrorEl.textContent = '';
          formErrorEl.classList.add('hidden');
        }
      });
    }

    dateInput.addEventListener('input', (event) => {
      dateBuffer = formatDateBuffer(event.target.value);
      syncDateInput();
    });

    dateInput.addEventListener('blur', () => {
      if (!dateBuffer) return;
      const parsed = parseDateString(dateBuffer);
      if (!parsed) {
        if (formErrorEl) {
          formErrorEl.textContent = 'Data inválida. Use o formato dd/mm/aaaa.';
          formErrorEl.classList.remove('hidden');
        }
      } else if (formErrorEl && formErrorEl.textContent.includes('Data inválida')) {
        formErrorEl.textContent = '';
        formErrorEl.classList.add('hidden');
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // garante que o buffer está em sincronia com o campo
    if (amountBuffer && amountInput.value !== amountBuffer) {
      syncAmountInput();
    } else if (!amountBuffer && amountInput.value) {
      amountBuffer = amountInput.value;
    }

    const desc = descInput.value.trim();
    const normalizedAmount = amountInput.value.replace(',', '.');
    const amount = Number(normalizedAmount);
    const type = typeSelect.value;
    const rawDateValue = dateInput ? dateInput.value : '';
    const dateObj = parseDateString(rawDateValue);
    const note = noteInput ? noteInput.value.trim() : '';

    if (
      !desc ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !dateObj ||
      (type !== 'income' && type !== 'expense')
    ) {
      if (formErrorEl) {
        formErrorEl.textContent =
          'Preencha descrição, data, valor maior que zero e selecione o tipo.';
        formErrorEl.classList.remove('hidden');
      } else {
        alert('Preencha uma descrição, uma data e um valor maior que zero.');
      }
      return;
    }

    let categoryId = null;
    if (categorySelect && !categorySelect.disabled) {
      const rawCat = categorySelect.value;
      if (rawCat !== '') {
        const n = Number(rawCat);
        if (Number.isInteger(n) && n > 0) categoryId = n;
      }
    }

    if (categoryId == null) {
      if (formErrorEl) {
        formErrorEl.textContent = 'Selecione uma categoria para o lançamento.';
        formErrorEl.classList.remove('hidden');
      } else {
        window.alert('Selecione uma categoria.');
      }
      return;
    }

    let walletId = null;
    if (walletSelect && !walletSelect.disabled) {
      const rawW = walletSelect.value;
      if (rawW !== '') {
        const n = Number(rawW);
        if (Number.isInteger(n) && n > 0) walletId = n;
      }
    }

    if (walletId == null) {
      if (formErrorEl) {
        formErrorEl.textContent = 'Selecione uma carteira.';
        formErrorEl.classList.remove('hidden');
      } else {
        window.alert('Selecione uma carteira.');
      }
      return;
    }

    if (formErrorEl) {
      formErrorEl.textContent = '';
      formErrorEl.classList.add('hidden');
    }

    const payload = {
      desc,
      amount,
      type,
      date: dateObj.toISOString().slice(0, 10),
      note,
      categoryId,
      walletId,
    };

    try {
      const response = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await fetchTransactionsFromServer();
    } catch (error) {
      console.error('Erro ao salvar transação no servidor.', error);
      if (formErrorEl) {
        formErrorEl.textContent =
          'Não foi possível salvar a transação. Verifique se o servidor está rodando e tente novamente.';
        formErrorEl.classList.remove('hidden');
      } else {
        window.alert(
          'Não foi possível salvar a transação. Verifique se o servidor está rodando e tente novamente.'
        );
      }
      return;
    }

    form.reset();
    typeSelect.value = '';
    syncCategorySelectToType();
    populateWalletSelect();
    descInput.focus();
    if (noteInput) {
      noteInput.value = '';
    }

    if (dateInput) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      dateBuffer = `${day}/${month}/${year}`;
      syncDateInput();

      if (dateNativeInput) {
        dateNativeInput.value = `${year}-${month}-${day}`;
      }
    }
  });

  // Configurações (engrenagem) e tema
  function applyTheme(theme) {
    const isDark = theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
    themeOptions.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    updateDashboardCharts();
  }

  function initTheme() {
    const saved = localStorage.getItem('theme') || 'auto';
    applyTheme(saved);
  }

  if (btnSettings && settingsPanel) {
    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsPanel.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });
    settingsPanel.addEventListener('click', (e) => e.stopPropagation());
  }

  themeOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      if (theme) applyTheme(theme);
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('theme') === 'auto') applyTheme('auto');
  });

  initTheme();

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch {}
      window.location.href = 'login.html';
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      syncCategorySelectToType();
    });
  }

  if (categoryForm && catNameInput && catTypeSelect) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (categoryFormErrorEl) {
        categoryFormErrorEl.textContent = '';
        categoryFormErrorEl.classList.add('hidden');
      }
      const name = catNameInput.value.trim();
      const type = catTypeSelect.value;
      if (!name) return;
      try {
        const res = await fetch(`${API_BASE}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name, type }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        catNameInput.value = '';
        await fetchCategories();
      } catch (err) {
        console.error(err);
        if (categoryFormErrorEl) {
          categoryFormErrorEl.textContent =
            err && err.message
              ? String(err.message)
              : 'Não foi possível salvar a categoria.';
          categoryFormErrorEl.classList.remove('hidden');
        }
      }
    });
  }

  initWalletColorPresets();

  if (walletForm && walletNameInput) {
    walletForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (walletFormErrorEl) {
        walletFormErrorEl.textContent = '';
        walletFormErrorEl.classList.add('hidden');
      }
      const name = walletNameInput.value.trim();
      if (!name) return;
      const rawColor = walletColorPicker ? walletColorPicker.value : '';
      const color =
        normalizeHexColor(rawColor) ?? DEFAULT_WALLET_COLOR;
      try {
        const res = await fetch(`${API_BASE}/wallets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name, color }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        walletNameInput.value = '';
        if (walletColorPicker) {
          walletColorPicker.value = DEFAULT_WALLET_COLOR;
        }
        await fetchWallets();
      } catch (err) {
        console.error(err);
        if (walletFormErrorEl) {
          walletFormErrorEl.textContent =
            err && err.message
              ? String(err.message)
              : 'Não foi possível salvar a carteira.';
          walletFormErrorEl.classList.remove('hidden');
        }
      }
    });
  }

  // Navegação entre Dashboard, Lançamentos, Carteiras e Categorias
  if (navDashboard) navDashboard.addEventListener('click', () => showView('dashboard'));
  if (navLancamentos) navLancamentos.addEventListener('click', () => showView('lancamentos'));
  if (navCarteiras) navCarteiras.addEventListener('click', () => showView('carteiras'));
  if (navCategorias) navCategorias.addEventListener('click', () => showView('categorias'));
  if (btnIrLancamentos) btnIrLancamentos.addEventListener('click', () => showView('lancamentos'));
  if (btnVoltarDashboard) btnVoltarDashboard.addEventListener('click', () => showView('dashboard'));
  if (btnVoltarDashboardCat) {
    btnVoltarDashboardCat.addEventListener('click', () => showView('dashboard'));
  }
  if (btnVoltarDashboardWallet) {
    btnVoltarDashboardWallet.addEventListener('click', () => showView('dashboard'));
  }

  // estado inicial: dashboard visível
  showView('dashboard');
  requireAuthOrRedirect().then(async (ok) => {
    if (ok) {
      await fetchWallets();
      await fetchCategories();
      await fetchTransactionsFromServer();
    }
  });
});


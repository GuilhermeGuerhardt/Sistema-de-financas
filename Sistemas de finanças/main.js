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
  const navDashboard = document.getElementById('nav-dashboard');
  const navLancamentos = document.getElementById('nav-lancamentos');
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
  const transactions = [];

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

    return {
      id: raw.id,
      desc: String(raw.desc || '').trim(),
      amount,
      type: raw.type,
      date: raw.date || null,
      note: typeof raw.note === 'string' ? raw.note : '',
      createdAt: raw.createdAt || raw.created_at || Date.now(),
    };
  }

  async function fetchTransactionsFromServer() {
    try {
      const response = await fetch(`${API_BASE}/transactions`);
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
    }
    if (dashboardRecentList) {
      dashboardRecentList.innerHTML = '';
      const err = document.createElement('li');
      err.className = 'text-zinc-500 dark:text-zinc-500 text-sm';
      err.textContent = 'Não foi possível carregar.';
      dashboardRecentList.appendChild(err);
    }
  }

  const formatCurrency = (value) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

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
      metaSpan.textContent =
        (t.type === 'income' ? 'Entrada' : 'Saída') +
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
            { method: 'DELETE' }
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
  }

  function showView(viewName) {
    const isDashboard = viewName === 'dashboard';
    if (viewDashboard) viewDashboard.classList.toggle('hidden', !isDashboard);
    if (viewLancamentos) viewLancamentos.classList.toggle('hidden', isDashboard);
    if (navDashboard) {
      navDashboard.classList.toggle('bg-emerald-600', isDashboard);
      navDashboard.classList.toggle('text-white', isDashboard);
      navDashboard.classList.toggle('text-zinc-600', !isDashboard);
      navDashboard.classList.toggle('dark:text-zinc-400', !isDashboard);
    }
    if (navLancamentos) {
      navLancamentos.classList.toggle('bg-emerald-600', !isDashboard);
      navLancamentos.classList.toggle('text-white', !isDashboard);
      navLancamentos.classList.toggle('text-zinc-600', isDashboard);
      navLancamentos.classList.toggle('dark:text-zinc-400', isDashboard);
    }
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
      text.textContent = t.desc;
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
    };

    try {
      const response = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Navegação entre Dashboard e Lançamentos
  if (navDashboard) navDashboard.addEventListener('click', () => showView('dashboard'));
  if (navLancamentos) navLancamentos.addEventListener('click', () => showView('lancamentos'));
  if (btnIrLancamentos) btnIrLancamentos.addEventListener('click', () => showView('lancamentos'));
  if (btnVoltarDashboard) btnVoltarDashboard.addEventListener('click', () => showView('dashboard'));

  // estado inicial: dashboard visível
  showView('dashboard');
  requireAuthOrRedirect().then((ok) => {
    if (ok) fetchTransactionsFromServer();
  });
});


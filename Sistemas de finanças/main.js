document.addEventListener('DOMContentLoaded', () => {
  const API_BASE =
    typeof window !== 'undefined' && window.__API_BASE__
      ? window.__API_BASE__
      : '/api';
  const fetchOpts = { credentials: 'include' };

  async function requireAuthOrRedirect() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, fetchOpts);
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
  const descSuggestionsEl = document.getElementById('desc-suggestions');
  const descSuggestionsDatalist = document.getElementById(
    'desc-suggestions-datalist'
  );
  const amountInput = document.getElementById('amount');
  const amountKeypadModal = document.getElementById('amount-keypad-modal');
  const amountKeypadClose = document.getElementById('amount-keypad-close');
  const amountKeypadOk = document.getElementById('amount-keypad-ok');
  const amountKeypadDisplay = document.getElementById('amount-keypad-display');
  const amountKeypadKeys = document.getElementById('amount-keypad-keys');
  const btnAmountKeypad = document.getElementById('btn-amount-keypad');
  const typeSelect = document.getElementById('type');
  const dateInput = document.getElementById('date');
  const dateNativeInput = document.getElementById('date-native');
  const noteInput = document.getElementById('note');
  const formErrorEl = document.getElementById('form-error');
  const btnFormMainLabel = document.getElementById('btn-form-main-label');
  const lancamentoStep2 = document.getElementById('lancamento-step-2');
  const parcelIntervalEl = document.getElementById('parcel-interval');
  const parcelCountEl = document.getElementById('parcel-count');
  const btnParcelVoltar = document.getElementById('btn-parcel-voltar');
  const btnParcelConfirm = document.getElementById('btn-parcel-confirm');
  const parcelErrorEl = document.getElementById('parcel-error');
  const filterQueryInput = document.getElementById('filter-query');
  const filterMonthSelect = document.getElementById('filter-month');

  const incomeEl = document.getElementById('income');
  const expenseEl = document.getElementById('expense');
  const totalEl = document.getElementById('total');
  const totalCardEl = document.getElementById('total-card');
  const transactionListEl = document.getElementById('transaction-list');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewLancamentos = document.getElementById('view-lancamentos');
  const lancTabNovo = document.getElementById('lanc-tab-novo');
  const lancTabExtrato = document.getElementById('lanc-tab-extrato');
  const lancPanelNovo = document.getElementById('lancamento-panel-novo');
  const lancPanelExtrato = document.getElementById('lancamento-panel-extrato');
  const viewCategorias = document.getElementById('view-categorias');
  const viewCarteiras = document.getElementById('view-carteiras');
  const viewConfiguracoes = document.getElementById('view-configuracoes');
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
  const themeOptions = document.querySelectorAll('[data-theme]');
  const btnVoltarDashboardConfig = document.getElementById(
    'btn-voltar-dashboard-config'
  );
  const btnLogout = document.getElementById('btn-logout');
  const settingsPasswordForm = document.getElementById(
    'settings-password-form'
  );
  const settingsPasswordError = document.getElementById(
    'settings-password-error'
  );
  const settingsPasswordSuccess = document.getElementById(
    'settings-password-success'
  );
  const settingsDeletePassword = document.getElementById(
    'settings-delete-password'
  );
  const btnDeleteAccount = document.getElementById('btn-delete-account');
  const settingsDeleteAccountError = document.getElementById(
    'settings-delete-account-error'
  );

  const coreUiMissing =
    !form ||
    !descInput ||
    !amountInput ||
    !typeSelect ||
    !incomeEl ||
    !expenseEl ||
    !totalEl ||
    !totalCardEl ||
    !transactionListEl;
  if (coreUiMissing) {
    console.error(
      'Aviso: alguns elementos do formulário de lançamentos não foram encontrados. O restante do app continua ativo.'
    );
  }

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

  const MAX_AMOUNT_INT_DIGITS = 12;

  let amountBuffer = '';
  /** Evita que o evento `input` sobrescreva o buffer ao definir o valor por código (alguns navegadores). */
  let amountInputProgrammatic = false;
  let dateBuffer = '';

  /** Normaliza texto colado/digitado antes de extrair dígitos (pt-BR e 1234.56 estilo Excel). */
  function normalizeAmountDisplayString(display) {
    if (!display) return '';
    let s = String(display).trim().replace(/\s/g, '');
    if (!s) return '';
    const commas = (s.match(/,/g) || []).length;
    const dots = (s.match(/\./g) || []).length;
    if (commas === 0 && dots === 1 && /^\d+\.\d+$/.test(s)) {
      const i = s.indexOf('.');
      const dec = s.slice(i + 1).replace(/\./g, '');
      // Só trate '.' como decimal se houver no máximo 2 dígitos após o ponto.
      // Ex.: "1234.56" => "1234,56", mas "1.234" => milhar (fica "1.234" e depois vira "1234" no parse).
      if (dec.length <= 2) {
        s = s.slice(0, i).replace(/\./g, '') + ',' + dec;
      }
    }
    return s;
  }

  /** Converte texto exibido (com ou sem pontos de milhar) para buffer interno: dígitos e no máx. uma vírgula decimal. */
  function parseDisplayToBuffer(display) {
    const normalized = normalizeAmountDisplayString(display);
    if (!normalized) return '';
    const lastComma = normalized.lastIndexOf(',');
    if (lastComma === -1) {
      const intOnly = normalized.replace(/\./g, '').replace(/\D/g, '');
      return intOnly.slice(0, MAX_AMOUNT_INT_DIGITS);
    }
    const intPart = normalized
      .slice(0, lastComma)
      .replace(/\./g, '')
      .replace(/\D/g, '');
    const decPart = normalized
      .slice(lastComma + 1)
      .replace(/\D/g, '')
      .slice(0, 2);
    const intS = intPart.slice(0, MAX_AMOUNT_INT_DIGITS);
    if (decPart === '') {
      return lastComma >= 0 ? intS + ',' : intS;
    }
    return intS + ',' + decPart;
  }

  /** Exibe o valor em pt-BR para o usuário: milhar com '.' e decimal com ','. */
  function formatAmountBufferForDisplay(buffer) {
    if (buffer === '' || buffer == null) return '';

    // Buffer interno usa vírgula como decimal (ex.: "1234,56") e não tem milhar.
    const s = String(buffer);
    const hasComma = s.includes(',');
    const parts = s.split(',');
    const intRaw = parts[0] || '';
    const decRaw = parts.length > 1 ? String(parts[1] ?? '') : '';

    const intDigits = intRaw.replace(/\D/g, '');
    const intToShow = intDigits === '' ? '0' : intDigits;
    const intFormatted = intToShow.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      '.'
    );

    if (!hasComma) return intFormatted;
    // Se o usuário digitou a vírgula mas ainda não colocou centavos, manter a vírgula no fim.
    if (decRaw === '') return `${intFormatted},`;
    return `${intFormatted},${decRaw}`;
  }

  function amountBufferToNumber(buffer) {
    if (!buffer || buffer === '') return NaN;
    const parts = buffer.split(',');
    const intPart = (parts[0] || '').replace(/\D/g, '');
    const decPart =
      parts.length > 1 ? String(parts[1] || '').replace(/\D/g, '').slice(0, 2) : '';
    if (!intPart && !decPart) return NaN;
    const intNum = intPart || '0';
    if (!decPart) return Number(intNum);
    return Number(`${intNum}.${decPart}`);
  }

  /** Converte buffer para sequência de dígitos em centavos (sem separadores). */
  function amountBufferToCentDigits(buffer) {
    const parsed = parseDisplayToBuffer(buffer);
    if (!parsed) return '';
    const parts = parsed.split(',');
    const intDigits = (parts[0] || '').replace(/\D/g, '');
    const decDigits = (parts.length > 1 ? String(parts[1] || '') : '')
      .replace(/\D/g, '')
      .slice(0, 2)
      .padEnd(2, '0');
    const combined = `${intDigits}${decDigits}`.replace(/^0+(?=\d)/, '');
    return combined;
  }

  /** Converte sequência de dígitos em centavos para buffer: 134598 => 1345,98. */
  function centDigitsToAmountBuffer(digitsRaw) {
    const digits = String(digitsRaw || '')
      .replace(/\D/g, '')
      .slice(0, MAX_AMOUNT_INT_DIGITS + 2);
    if (!digits) return '';

    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
    const decPart = padded.slice(-2);
    return `${intPart},${decPart}`;
  }

  /** Garante exatamente 2 casas decimais no buffer interno. */
  function ensureAmountBufferTwoDecimals(buffer) {
    const parsed = parseDisplayToBuffer(buffer);
    if (!parsed) return '';

    const parts = parsed.split(',');
    const intDigits = (parts[0] || '').replace(/\D/g, '').slice(0, MAX_AMOUNT_INT_DIGITS);
    const decDigits = (parts.length > 1 ? String(parts[1] || '') : '')
      .replace(/\D/g, '')
      .slice(0, 2)
      .padEnd(2, '0');

    return `${intDigits || '0'},${decDigits}`;
  }

  function syncAmountInput() {
    if (!amountInput) return;
    amountInputProgrammatic = true;
    amountInput.value = formatAmountBufferForDisplay(amountBuffer);
    queueMicrotask(() => {
      amountInputProgrammatic = false;
    });
  }

  /**
   * Formata o campo `#amount` enquanto o usuário digita,
   * preservando a posição do cursor (caret).
   */
  function syncAmountInputPreserveCursor(bufferBeforeCaret) {
    if (!amountInput) return;

    // `amountBuffer` já deve refletir o valor atual do campo.
    const formatted = formatAmountBufferForDisplay(amountBuffer);
    const formattedBeforeCaret = formatAmountBufferForDisplay(bufferBeforeCaret);
    const caretPos = Math.min(
      formattedBeforeCaret.length,
      typeof formatted === 'string' ? formatted.length : 0
    );

    amountInputProgrammatic = true;
    amountInput.value = formatted;
    try {
      amountInput.setSelectionRange(caretPos, caretPos);
    } catch {
      // Alguns inputs/tamanhos podem não permitir setSelectionRange.
    }
    queueMicrotask(() => {
      amountInputProgrammatic = false;
    });
  }

  function syncAmountKeypadDisplay() {
    if (!amountKeypadDisplay) return;
    const raw = formatAmountBufferForDisplay(amountBuffer);
    if (raw === '') {
      amountKeypadDisplay.textContent = '0';
      amountKeypadDisplay.classList.add('text-zinc-400', 'dark:text-zinc-500');
      amountKeypadDisplay.classList.remove('text-zinc-900', 'dark:text-zinc-50');
    } else {
      amountKeypadDisplay.textContent = raw;
      amountKeypadDisplay.classList.remove('text-zinc-400', 'dark:text-zinc-500');
      amountKeypadDisplay.classList.add('text-zinc-900', 'dark:text-zinc-50');
    }
  }

  function isAmountKeypadModalOpen() {
    return Boolean(amountKeypadModal && !amountKeypadModal.classList.contains('hidden'));
  }

  function positionAmountKeypadPanel() {
    if (!amountKeypadModal || !amountInput) return;
    const margin = 8;
    const rect = amountInput.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const modal = amountKeypadModal;
    const pw = modal.offsetWidth || 280;
    const ph = modal.offsetHeight || 400;
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(margin, Math.min(left, vw - pw - margin));
    let top = rect.bottom + margin;
    if (top + ph > vh - margin) {
      top = rect.top - ph - margin;
    }
    if (top < margin) {
      top = Math.max(margin, vh - ph - margin);
    }
    modal.style.left = `${Math.round(left)}px`;
    modal.style.top = `${Math.round(top)}px`;
  }

  function openAmountKeypadModal() {
    if (!amountKeypadModal || !amountInput) return;
    amountBuffer = parseDisplayToBuffer(amountInput.value);
    syncAmountInput();
    syncAmountKeypadDisplay();
    amountKeypadModal.classList.remove('hidden');
    if (btnAmountKeypad) {
      btnAmountKeypad.setAttribute('aria-expanded', 'true');
      btnAmountKeypad.classList.add(
        'border-emerald-400',
        'bg-emerald-50',
        'text-emerald-700',
        'dark:border-emerald-600',
        'dark:bg-emerald-950/40',
        'dark:text-emerald-400'
      );
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        positionAmountKeypadPanel();
        if (amountKeypadOk) amountKeypadOk.focus();
      });
    });
  }

  function closeAmountKeypadModal(options) {
    const focusDesc = options && options.focusDesc;
    if (!amountKeypadModal) return;
    amountKeypadModal.classList.add('hidden');
    amountBuffer = ensureAmountBufferTwoDecimals(amountBuffer);
    syncAmountInput();
    if (btnAmountKeypad) {
      btnAmountKeypad.setAttribute('aria-expanded', 'false');
      btnAmountKeypad.classList.remove(
        'border-emerald-400',
        'bg-emerald-50',
        'text-emerald-700',
        'dark:border-emerald-600',
        'dark:bg-emerald-950/40',
        'dark:text-emerald-400'
      );
    }
    if (focusDesc && descInput) {
      descInput.focus();
    }
  }

  function handleAmountKeypadKey(key) {
    if (key === 'clear') {
      amountBuffer = '';
      syncAmountInput();
      syncAmountKeypadDisplay();
      return;
    }
    if (key === ',') {
      // Em modo moeda automática, a vírgula é gerada automaticamente.
      syncAmountInput();
      syncAmountKeypadDisplay();
      return;
    }
    if (!/^\d$/.test(key)) {
      return;
    }

    const prevDigits = amountBufferToCentDigits(amountBuffer);
    const nextDigits = `${prevDigits}${key}`;
    if (nextDigits.length > MAX_AMOUNT_INT_DIGITS + 2) return;
    amountBuffer = centDigitsToAmountBuffer(nextDigits);

    syncAmountInput();
    syncAmountKeypadDisplay();
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
    if (!dateInput) return;
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

  if (amountKeypadKeys) {
    amountKeypadKeys.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-key]');
      if (!btn) return;
      const k = btn.getAttribute('data-key');
      if (k) handleAmountKeypadKey(k);
      if (formErrorEl) {
        formErrorEl.textContent = '';
        formErrorEl.classList.add('hidden');
      }
    });
  }
  if (btnAmountKeypad) {
    btnAmountKeypad.addEventListener('click', (event) => {
      event.stopPropagation();
      if (isAmountKeypadModalOpen()) {
        closeAmountKeypadModal();
      } else {
        openAmountKeypadModal();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!isAmountKeypadModalOpen()) return;
    const t = event.target;
    if (amountKeypadModal.contains(t)) return;
    if (btnAmountKeypad && btnAmountKeypad.contains(t)) return;
    closeAmountKeypadModal();
  });

  window.addEventListener('resize', () => {
    if (isAmountKeypadModalOpen()) positionAmountKeypadPanel();
  });
  window.addEventListener(
    'scroll',
    () => {
      if (isAmountKeypadModalOpen()) positionAmountKeypadPanel();
    },
    true
  );

  if (amountKeypadClose) {
    amountKeypadClose.addEventListener('click', () => closeAmountKeypadModal());
  }
  if (amountKeypadOk) {
    amountKeypadOk.addEventListener('click', () =>
      closeAmountKeypadModal({ focusDesc: true })
    );
  }

  document.addEventListener('keydown', (event) => {
    if (!isAmountKeypadModalOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeAmountKeypadModal();
      return;
    }

    const ae = document.activeElement;
    const inKeypad =
      ae instanceof Node && amountKeypadModal.contains(ae);
    /* Só intercepta números/atalhos quando o foco está no pop-up — senão bloqueia o campo valor e o resto do formulário */
    if (!inKeypad) return;

    if (event.key === 'Enter') {
      const t = event.target;
      if (t instanceof HTMLElement) {
        if (amountKeypadOk && t === amountKeypadOk) return;
        if (amountKeypadKeys && amountKeypadKeys.contains(t)) return;
        if (amountKeypadClose && t === amountKeypadClose) return;
      }
      event.preventDefault();
      closeAmountKeypadModal({ focusDesc: true });
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      const prevDigits = amountBufferToCentDigits(amountBuffer);
      if (prevDigits.length > 0) {
        const nextDigits = prevDigits.slice(0, -1);
        amountBuffer = centDigitsToAmountBuffer(nextDigits);
        syncAmountInput();
        syncAmountKeypadDisplay();
      }
      if (formErrorEl) {
        formErrorEl.textContent = '';
        formErrorEl.classList.add('hidden');
      }
      return;
    }

    if (
      event.key === ',' ||
      event.key === '.' ||
      event.code === 'NumpadDecimal'
    ) {
      event.preventDefault();
      handleAmountKeypadKey(',');
      if (formErrorEl) {
        formErrorEl.textContent = '';
        formErrorEl.classList.add('hidden');
      }
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      handleAmountKeypadKey(event.key);
      if (formErrorEl) {
        formErrorEl.textContent = '';
        formErrorEl.classList.add('hidden');
      }
    }
  });

  if (amountInput) {
    amountInput.addEventListener('keydown', (event) => {
      if (amountInputProgrammatic) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        const prevDigits = amountBufferToCentDigits(
          parseDisplayToBuffer(amountInput.value)
        );
        const nextDigits = `${prevDigits}${event.key}`;
        if (nextDigits.length > MAX_AMOUNT_INT_DIGITS + 2) return;
        amountBuffer = centDigitsToAmountBuffer(nextDigits);
        syncAmountInput();
        if (isAmountKeypadModalOpen()) syncAmountKeypadDisplay();
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        const prevDigits = amountBufferToCentDigits(
          parseDisplayToBuffer(amountInput.value)
        );
        const nextDigits = prevDigits.slice(0, -1);
        amountBuffer = centDigitsToAmountBuffer(nextDigits);
        syncAmountInput();
        if (isAmountKeypadModalOpen()) syncAmountKeypadDisplay();
        return;
      }

      if (
        event.key === ',' ||
        event.key === '.' ||
        event.code === 'NumpadDecimal'
      ) {
        event.preventDefault();
      }
    });

    amountInput.addEventListener('focus', () => {
      if (amountInputProgrammatic) return;
      amountBuffer = parseDisplayToBuffer(amountInput.value);
    });
    amountInput.addEventListener('input', () => {
      if (amountInputProgrammatic) return;

      // Preserve caret: calculamos o "estado" do valor só até o caret atual,
      // e depois formatamos o valor inteiro.
      const raw = amountInput.value;
      const caret = amountInput.selectionStart != null ? amountInput.selectionStart : raw.length;
      const rawBeforeCaret = raw.slice(0, caret);

      const digitsOnly = /^\d+$/.test(raw);
      const digitsBeforeCaretOnly = /^\d+$/.test(rawBeforeCaret);

      const bufferBeforeCaret = digitsBeforeCaretOnly
        ? centDigitsToAmountBuffer(rawBeforeCaret)
        : parseDisplayToBuffer(rawBeforeCaret);
      amountBuffer = digitsOnly
        ? centDigitsToAmountBuffer(raw)
        : parseDisplayToBuffer(raw);

      syncAmountInputPreserveCursor(bufferBeforeCaret);

      if (isAmountKeypadModalOpen()) syncAmountKeypadDisplay();
    });
    amountInput.addEventListener('blur', () => {
      if (amountInputProgrammatic) return;
      amountBuffer = parseDisplayToBuffer(amountInput.value);
      amountBuffer = ensureAmountBufferTwoDecimals(amountBuffer);
      syncAmountInput();
      if (isAmountKeypadModalOpen()) syncAmountKeypadDisplay();
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

  function getUniqueDescsForCategoryId(categoryIdNum) {
    if (!Number.isInteger(categoryIdNum) || categoryIdNum <= 0) return [];
    const seen = new Set();
    const out = [];
    for (const t of transactions) {
      const cid = t.categoryId != null ? Number(t.categoryId) : NaN;
      if (cid !== categoryIdNum) continue;
      const d = String(t.desc || '').trim();
      if (!d) continue;
      const key = d.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
    out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return out;
  }

  function renderDescSuggestions() {
    if (!descSuggestionsEl) return;
    if (descSuggestionsDatalist) descSuggestionsDatalist.innerHTML = '';
    descSuggestionsEl.innerHTML = '';
    if (!categorySelect || categorySelect.disabled) {
      descSuggestionsEl.classList.add('hidden');
      return;
    }
    const raw = categorySelect.value;
    if (!raw) {
      descSuggestionsEl.classList.add('hidden');
      return;
    }
    const id = Number(raw);
    const list = getUniqueDescsForCategoryId(id);
    if (descSuggestionsDatalist) {
      list.forEach((text) => {
        const opt = document.createElement('option');
        opt.value = text;
        descSuggestionsDatalist.appendChild(opt);
      });
    }
    if (list.length === 0) {
      descSuggestionsEl.classList.add('hidden');
      return;
    }
    descSuggestionsEl.classList.remove('hidden');
    const hint = document.createElement('p');
    hint.className =
      'mb-1.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400';
    hint.textContent =
      'Já usados nesta categoria — reutilize o mesmo nome em outro mês para manter tudo no mesmo grupo.';
    descSuggestionsEl.appendChild(hint);
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-wrap gap-1.5';
    list.forEach((text) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className =
        'max-w-full truncate rounded-lg border border-zinc-200 bg-white px-2 py-1 text-left text-xs text-zinc-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/40';
      b.textContent = text;
      b.title = text;
      b.addEventListener('click', () => {
        if (descInput) {
          descInput.value = text;
          descInput.focus();
        }
      });
      wrap.appendChild(b);
    });
    descSuggestionsEl.appendChild(wrap);
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
        'list-none pt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 first:pt-0';
      heading.textContent = label;
      categoryListEl.appendChild(heading);

      const list = byType[tp];
      if (list.length === 0) {
        const empty = document.createElement('li');
        empty.className =
          'rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400';
        empty.textContent = 'Nenhuma neste tipo.';
        categoryListEl.appendChild(empty);
        return;
      }

      list.forEach((c) => {
        const li = document.createElement('li');
        li.className =
          'flex items-center justify-between gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-emerald-200/80 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-emerald-900/50 sm:gap-3 sm:px-4';

        const left = document.createElement('div');
        left.className = 'flex min-w-0 items-center gap-2.5 sm:gap-3';
        const icon = document.createElement('i');
        icon.className =
          'ph shrink-0 text-lg ' +
          (c.type === 'income'
            ? 'ph-arrow-circle-up text-emerald-500'
            : 'ph-arrow-circle-down text-red-500');
        left.appendChild(icon);

        const textWrap = document.createElement('div');
        textWrap.className = 'min-w-0';
        const nameSpan = document.createElement('p');
        nameSpan.className =
          'truncate text-sm font-medium text-zinc-800 dark:text-zinc-100';
        nameSpan.textContent = c.name;
        const meta = document.createElement('p');
        meta.className = 'text-[10px] text-zinc-500 dark:text-zinc-500';
        meta.textContent = c.isPreset ? 'Sugerida do app' : 'Criada por você';
        textWrap.appendChild(nameSpan);
        textWrap.appendChild(meta);
        left.appendChild(textWrap);

        li.appendChild(left);

        const del = document.createElement('button');
        del.type = 'button';
        del.className =
          'shrink-0 rounded-lg border border-zinc-200 p-2 text-zinc-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-400';
        del.setAttribute('aria-label', 'Remover ou ocultar categoria');
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
      li.className =
        'rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400';
      li.textContent = 'Nenhuma carteira ainda. Crie uma acima.';
      walletListEl.appendChild(li);
      return;
    }
    wallets.forEach((w) => {
      const li = document.createElement('li');
      li.className =
        'flex items-center justify-between gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-emerald-200/80 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-emerald-900/50 sm:gap-3 sm:px-4';

      const left = document.createElement('div');
      left.className = 'flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3';

      const icon = document.createElement('i');
      const walletColor = w.color || DEFAULT_WALLET_COLOR;
      icon.className = 'ph ph-wallet shrink-0 text-xl';
      icon.style.color = walletColor;
      icon.setAttribute('aria-hidden', 'true');

      const textWrap = document.createElement('div');
      textWrap.className = 'min-w-0';
      const nameSpan = document.createElement('p');
      nameSpan.className =
        'truncate text-sm font-medium text-zinc-800 dark:text-zinc-100';
      nameSpan.textContent = w.name;
      const meta = document.createElement('p');
      meta.className = 'text-[10px] text-zinc-500 dark:text-zinc-500';
      meta.textContent = 'Cor no seletor · usada nos lançamentos';
      textWrap.appendChild(nameSpan);
      textWrap.appendChild(meta);

      left.appendChild(icon);
      left.appendChild(textWrap);

      const colorIn = document.createElement('input');
      colorIn.type = 'color';
      colorIn.value = w.color || DEFAULT_WALLET_COLOR;
      colorIn.title = 'Alterar cor';
      colorIn.className =
        'h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950';
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
          icon.style.color = next;
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

      const right = document.createElement('div');
      right.className = 'flex shrink-0 items-center gap-2';
      right.appendChild(colorIn);

      const del = document.createElement('button');
      del.type = 'button';
      del.className =
        'shrink-0 rounded-lg border border-zinc-200 p-2 text-zinc-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-400';
      del.setAttribute('aria-label', 'Remover carteira');
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
      right.appendChild(del);
      li.appendChild(left);
      li.appendChild(right);
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
        'h-7 w-7 shrink-0 rounded-full ring-2 ring-zinc-200 transition-shadow hover:ring-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:ring-zinc-600 sm:h-8 sm:w-8';
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
      renderDescSuggestions();
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
    if (!transactionListEl) return;
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
      renderDescSuggestions();
    } catch (error) {
      console.error('Não foi possível carregar as transações do servidor.', error);
      if (!transactionListEl) return;
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
    if (!transactionListEl) return;
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
      emptyLi.className =
        'rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400';
      emptyLi.textContent =
        'Nenhum lançamento com esses filtros. Ajuste a busca ou o mês.';
      transactionListEl.appendChild(emptyLi);
      return;
    }

    visibleTransactions.forEach((t) => {
      const li = document.createElement('li');
      li.className =
        'flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-emerald-200/80 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-emerald-900/50';

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
        'shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ' +
        (t.type === 'income'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400');
      amountSpan.textContent =
        (t.type === 'expense' ? '- ' : '+ ') + formatCurrency(t.amount);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className =
        'shrink-0 rounded-lg border border-zinc-200 p-2 text-zinc-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-400';
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
    if (!incomeEl || !expenseEl || !totalEl || !totalCardEl) return;
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

  const LANC_SUBTAB_BASE =
    'lanc-subtab flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm';

  function setLancamentoSubtab(tab) {
    const isNovo = tab === 'novo';
    if (lancPanelNovo) lancPanelNovo.classList.toggle('hidden', !isNovo);
    if (lancPanelExtrato) lancPanelExtrato.classList.toggle('hidden', isNovo);

    if (lancTabNovo) {
      lancTabNovo.setAttribute('aria-selected', isNovo ? 'true' : 'false');
      lancTabNovo.className = isNovo
        ? `${LANC_SUBTAB_BASE} border border-zinc-200 bg-white text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100`
        : `${LANC_SUBTAB_BASE} border border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700`;
      const ic = lancTabNovo.querySelector('i');
      if (ic) {
        ic.classList.toggle('text-emerald-600', isNovo);
        ic.classList.toggle('dark:text-emerald-400', isNovo);
        ic.classList.toggle('text-zinc-500', !isNovo);
        ic.classList.toggle('dark:text-zinc-500', !isNovo);
      }
    }
    if (lancTabExtrato) {
      lancTabExtrato.setAttribute('aria-selected', isNovo ? 'false' : 'true');
      lancTabExtrato.className = !isNovo
        ? `${LANC_SUBTAB_BASE} border border-zinc-200 bg-white text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100`
        : `${LANC_SUBTAB_BASE} border border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700`;
      const ic = lancTabExtrato.querySelector('i');
      if (ic) {
        ic.classList.toggle('text-emerald-600', !isNovo);
        ic.classList.toggle('dark:text-emerald-400', !isNovo);
        ic.classList.toggle('text-zinc-500', isNovo);
        ic.classList.toggle('dark:text-zinc-500', isNovo);
      }
    }
  }

  function showView(viewName) {
    const isDashboard = viewName === 'dashboard';
    const isLancamentos = viewName === 'lancamentos';
    const isCarteiras = viewName === 'carteiras';
    const isCategorias = viewName === 'categorias';
    const isConfiguracoes = viewName === 'configuracoes';
    if (viewDashboard) viewDashboard.classList.toggle('hidden', !isDashboard);
    if (viewLancamentos) viewLancamentos.classList.toggle('hidden', !isLancamentos);
    if (viewCarteiras) viewCarteiras.classList.toggle('hidden', !isCarteiras);
    if (viewCategorias) viewCategorias.classList.toggle('hidden', !isCategorias);
    if (viewConfiguracoes) {
      viewConfiguracoes.classList.toggle('hidden', !isConfiguracoes);
    }
    if (isConfiguracoes) {
      setNavTabActive(navDashboard, false);
      setNavTabActive(navLancamentos, false);
      setNavTabActive(navCarteiras, false);
      setNavTabActive(navCategorias, false);
    } else {
      setNavTabActive(navDashboard, isDashboard);
      setNavTabActive(navLancamentos, isLancamentos);
      setNavTabActive(navCarteiras, isCarteiras);
      setNavTabActive(navCategorias, isCategorias);
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

  if (!coreUiMissing && form) {
    function getLancamentoModo() {
      const el = document.querySelector(
        'input[name="lancamento-modo"]:checked'
      );
      return el && el.value === 'parcelado' ? 'parcelado' : 'unico';
    }

    function syncBtnFormMainLabel() {
      if (!btnFormMainLabel) return;
      btnFormMainLabel.textContent =
        getLancamentoModo() === 'parcelado'
          ? 'Continuar para parcelas'
          : 'Adicionar lançamento';
    }

    document.querySelectorAll('input[name="lancamento-modo"]').forEach((r) => {
      r.addEventListener('change', () => {
        syncBtnFormMainLabel();
        if (getLancamentoModo() === 'unico') {
          if (lancamentoStep2) lancamentoStep2.classList.add('hidden');
          form.classList.remove('hidden');
        }
      });
    });
    syncBtnFormMainLabel();

    function maxParcelForInterval(iv) {
      if (iv === 'daily') return 365;
      if (iv === 'monthly') return 120;
      if (iv === 'yearly') return 30;
      return 365;
    }

    function setSelectedParcelInterval(iv) {
      if (parcelIntervalEl) parcelIntervalEl.value = iv || '';
      document.querySelectorAll('.parcel-freq-btn').forEach((b) => {
        const on = Boolean(iv && b.dataset.parcelInterval === iv);
        b.classList.toggle('border-emerald-500', on);
        b.classList.toggle('border-zinc-200', !on);
        b.classList.toggle('dark:border-emerald-600', on);
        b.classList.toggle('dark:border-zinc-700', !on);
        b.classList.toggle('bg-white', !on);
        b.classList.toggle('bg-emerald-50', on);
        b.classList.toggle('dark:bg-zinc-900', !on);
        b.classList.toggle('dark:bg-emerald-950/40', on);
      });
      if (parcelCountEl && iv) {
        const m = maxParcelForInterval(iv);
        parcelCountEl.max = m;
        let n = Number(parcelCountEl.value);
        if (!Number.isInteger(n) || n < 2) n = 2;
        if (n > m) n = m;
        parcelCountEl.value = String(n);
      }
      if (btnParcelConfirm) {
        btnParcelConfirm.disabled = !iv;
      }
    }

    document.querySelectorAll('[data-parcel-interval]').forEach((b) => {
      b.addEventListener('click', () => {
        const iv = b.dataset.parcelInterval;
        if (iv) setSelectedParcelInterval(iv);
        if (parcelErrorEl) {
          parcelErrorEl.textContent = '';
          parcelErrorEl.classList.add('hidden');
        }
      });
    });

    function showParcelStepUI() {
      if (lancamentoStep2) lancamentoStep2.classList.remove('hidden');
      form.classList.add('hidden');
      setSelectedParcelInterval('');
    }

    function hideParcelStepUI() {
      if (lancamentoStep2) lancamentoStep2.classList.add('hidden');
      form.classList.remove('hidden');
      setSelectedParcelInterval('');
      if (parcelErrorEl) {
        parcelErrorEl.textContent = '';
        parcelErrorEl.classList.add('hidden');
      }
    }

    if (btnParcelVoltar) {
      btnParcelVoltar.addEventListener('click', () => hideParcelStepUI());
    }

    setSelectedParcelInterval('');

    function validateTransactionFields() {
      amountBuffer = parseDisplayToBuffer(amountInput.value);
      amountBuffer = ensureAmountBufferTwoDecimals(amountBuffer);
      syncAmountInput();
      const amount = amountBufferToNumber(amountBuffer);
      const desc = descInput.value.trim();
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
            'Preencha o nome do lançamento, data, valor maior que zero e selecione o tipo.';
          formErrorEl.classList.remove('hidden');
        } else {
          window.alert(
            'Preencha o nome do lançamento, a data e um valor maior que zero.'
          );
        }
        return null;
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
          formErrorEl.textContent =
            'Selecione uma categoria para o lançamento.';
          formErrorEl.classList.remove('hidden');
        } else {
          window.alert('Selecione uma categoria.');
        }
        return null;
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
        return null;
      }

      if (formErrorEl) {
        formErrorEl.textContent = '';
        formErrorEl.classList.add('hidden');
      }

      return {
        desc,
        amount,
        type,
        date: dateObj.toISOString().slice(0, 10),
        note,
        categoryId,
        walletId,
      };
    }

    function resetFormAfterSuccessfulSave() {
      form.reset();
      const unicoRadio = document.querySelector(
        'input[name="lancamento-modo"][value="unico"]'
      );
      if (unicoRadio) unicoRadio.checked = true;
      syncBtnFormMainLabel();
      hideParcelStepUI();
      if (isAmountKeypadModalOpen()) closeAmountKeypadModal();
      amountBuffer = '';
      syncAmountInput();
      typeSelect.value = '';
      syncCategorySelectToType();
      populateWalletSelect();
      renderDescSuggestions();
      if (typeSelect) typeSelect.focus();
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
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const base = validateTransactionFields();
      if (!base) return;

      if (getLancamentoModo() === 'parcelado') {
        showParcelStepUI();
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify(base),
        });

        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            body.error || `Não foi possível salvar (${response.status}).`
          );
        }

        await fetchTransactionsFromServer();
      } catch (error) {
        console.error('Erro ao salvar transação no servidor.', error);
        if (formErrorEl) {
          formErrorEl.textContent =
            error && error.message
              ? String(error.message)
              : 'Não foi possível salvar a transação. Verifique se o servidor está rodando e tente novamente.';
          formErrorEl.classList.remove('hidden');
        } else {
          window.alert(
            'Não foi possível salvar a transação. Verifique se o servidor está rodando e tente novamente.'
          );
        }
        return;
      }

      resetFormAfterSuccessfulSave();
    });

    if (btnParcelConfirm) {
      btnParcelConfirm.addEventListener('click', async () => {
        if (parcelErrorEl) {
          parcelErrorEl.textContent = '';
          parcelErrorEl.classList.add('hidden');
        }
        const base = validateTransactionFields();
        if (!base) {
          hideParcelStepUI();
          return;
        }
        const interval = parcelIntervalEl ? parcelIntervalEl.value : '';
        if (!interval) {
          if (parcelErrorEl) {
            parcelErrorEl.textContent =
              'Escolha se repete todo dia, todo mês ou todo ano.';
            parcelErrorEl.classList.remove('hidden');
          }
          return;
        }
        let count = parcelCountEl ? Number(parcelCountEl.value) : 2;
        if (!Number.isInteger(count) || count < 2) {
          if (parcelErrorEl) {
            parcelErrorEl.textContent = 'Informe pelo menos 2 parcelas.';
            parcelErrorEl.classList.remove('hidden');
          }
          return;
        }
        const maxC = maxParcelForInterval(interval);
        if (count > maxC) {
          count = maxC;
          if (parcelCountEl) parcelCountEl.value = String(maxC);
        }

        const payload = {
          ...base,
          recurrence: { interval, count },
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
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(
              body.error || `Não foi possível salvar (${response.status}).`
            );
          }
          await fetchTransactionsFromServer();
        } catch (error) {
          console.error(error);
          if (parcelErrorEl) {
            parcelErrorEl.textContent =
              error && error.message
                ? String(error.message)
                : 'Não foi possível registrar as parcelas.';
            parcelErrorEl.classList.remove('hidden');
          }
          return;
        }

        resetFormAfterSuccessfulSave();
      });
    }
  }

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

  if (btnSettings) {
    btnSettings.addEventListener('click', () => showView('configuracoes'));
  }
  if (btnVoltarDashboardConfig) {
    btnVoltarDashboardConfig.addEventListener('click', () =>
      showView('dashboard')
    );
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
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          ...fetchOpts,
        });
      } catch {}
      window.location.href = 'login.html';
    });
  }

  if (settingsPasswordForm) {
    settingsPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (settingsPasswordError) {
        settingsPasswordError.textContent = '';
        settingsPasswordError.classList.add('hidden');
      }
      if (settingsPasswordSuccess) {
        settingsPasswordSuccess.textContent = '';
        settingsPasswordSuccess.classList.add('hidden');
      }
      const current = document.getElementById('settings-current-password');
      const next = document.getElementById('settings-new-password');
      const confirm = document.getElementById('settings-confirm-password');
      const curVal = current ? String(current.value || '') : '';
      const newVal = next ? String(next.value || '') : '';
      const confVal = confirm ? String(confirm.value || '') : '';
      if (newVal !== confVal) {
        if (settingsPasswordError) {
          settingsPasswordError.textContent =
            'A confirmação não coincide com a nova senha.';
          settingsPasswordError.classList.remove('hidden');
        }
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/auth/password`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            currentPassword: curVal,
            newPassword: newVal,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        settingsPasswordForm.reset();
        if (settingsPasswordSuccess) {
          settingsPasswordSuccess.textContent = 'Senha atualizada com sucesso.';
          settingsPasswordSuccess.classList.remove('hidden');
        }
      } catch (err) {
        if (settingsPasswordError) {
          settingsPasswordError.textContent =
            err && err.message
              ? String(err.message)
              : 'Não foi possível alterar a senha.';
          settingsPasswordError.classList.remove('hidden');
        }
      }
    });
  }

  if (btnDeleteAccount && settingsDeletePassword) {
    btnDeleteAccount.addEventListener('click', async () => {
      if (settingsDeleteAccountError) {
        settingsDeleteAccountError.textContent = '';
        settingsDeleteAccountError.classList.add('hidden');
      }
      const pwd = String(settingsDeletePassword.value || '');
      if (!pwd) {
        if (settingsDeleteAccountError) {
          settingsDeleteAccountError.textContent =
            'Informe sua senha para excluir a conta.';
          settingsDeleteAccountError.classList.remove('hidden');
        }
        return;
      }
      const ok = window.confirm(
        'Tem certeza? Todos os seus dados serão apagados para sempre e não poderão ser recuperados.'
      );
      if (!ok) return;
      try {
        let res = await fetch(`${API_BASE}/auth/account`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ password: pwd }),
        });
        // Compatibilidade com ambientes que não encaminham método DELETE.
        if (res.status === 404) {
          res = await fetch(`${API_BASE}/auth/account/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: pwd }),
          });
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        window.location.href = 'login.html';
      } catch (err) {
        if (settingsDeleteAccountError) {
          settingsDeleteAccountError.textContent =
            err && err.message
              ? String(err.message)
              : 'Não foi possível excluir a conta.';
          settingsDeleteAccountError.classList.remove('hidden');
        }
      }
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      syncCategorySelectToType();
      renderDescSuggestions();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      renderDescSuggestions();
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
  if (navLancamentos) {
    navLancamentos.addEventListener('click', () => {
      showView('lancamentos');
      setLancamentoSubtab('novo');
    });
  }
  if (navCarteiras) navCarteiras.addEventListener('click', () => showView('carteiras'));
  if (navCategorias) navCategorias.addEventListener('click', () => showView('categorias'));
  if (btnIrLancamentos) {
    btnIrLancamentos.addEventListener('click', () => {
      showView('lancamentos');
      setLancamentoSubtab('extrato');
    });
  }
  if (lancTabNovo) lancTabNovo.addEventListener('click', () => setLancamentoSubtab('novo'));
  if (lancTabExtrato) lancTabExtrato.addEventListener('click', () => setLancamentoSubtab('extrato'));
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


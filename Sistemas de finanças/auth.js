document.addEventListener('DOMContentLoaded', () => {
  const API_BASE =
    typeof window !== 'undefined' && window.__API_BASE__
      ? window.__API_BASE__
      : '/api';
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const errorEl = document.getElementById('error');

  async function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  async function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  async function redirectToApp() {
    window.location.href = 'index.html';
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { response, data };
  }

  function connectionHelpMessage() {
    return (
      'Não foi possível conectar ao servidor. ' +
      'Inicie o programa (duplo clique em iniciar-financas.bat ou rode "npm start" na pasta do projeto) ' +
      'e abra no navegador: http://localhost:3000/register.html — não abra o arquivo HTML direto pelo Explorer.'
    );
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    await clearError();

    const username = String(document.getElementById('username')?.value || '').trim();
    const password = String(document.getElementById('password')?.value || '');

    if (!username || !password) {
      await showError('Informe usuário e senha.');
      return;
    }

    let response;
    let data;
    try {
      ({ response, data } = await postJson(`${API_BASE}/auth/login`, {
        username,
        password,
      }));
    } catch {
      await showError(connectionHelpMessage());
      return;
    }
    if (!response.ok) {
      await showError(
        (data && data.error) ||
          (response.status === 404
            ? 'Serviço de login não encontrado. Use http://localhost:3000 com o servidor rodando.'
            : 'Não foi possível entrar.')
      );
      return;
    }

    await redirectToApp();
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    await clearError();

    const username = String(document.getElementById('username')?.value || '').trim();
    const password = String(document.getElementById('password')?.value || '');

    if (!username || !password) {
      await showError('Informe usuário e senha.');
      return;
    }
    if (/\s/.test(username)) {
      await showError('O nome de usuário não pode conter espaços.');
      return;
    }
    if (
      username.length < 3 ||
      username.length > 32 ||
      !/^[a-zA-Z0-9._-]+$/.test(username)
    ) {
      await showError(
        'Usuário: use 3 a 32 caracteres, sem espaços (letras, números, . _ -).'
      );
      return;
    }
    if (password.length < 6) {
      await showError('Senha: mínimo 6 caracteres.');
      return;
    }

    let response;
    let data;
    try {
      ({ response, data } = await postJson(`${API_BASE}/auth/register`, {
        username,
        password,
      }));
    } catch {
      await showError(connectionHelpMessage());
      return;
    }
    if (!response.ok) {
      await showError(
        (data && data.error) ||
          (response.status === 404
            ? 'Cadastro não encontrado no servidor. Use http://localhost:3000/register.html com npm start rodando.'
            : 'Não foi possível cadastrar.')
      );
      return;
    }

    await redirectToApp();
  }

  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  if (passwordInput && togglePasswordBtn) {
    const icon = togglePasswordBtn.querySelector('i');
    togglePasswordBtn.addEventListener('click', () => {
      const show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      if (icon) {
        icon.classList.toggle('ph-eye', !show);
        icon.classList.toggle('ph-eye-slash', show);
      }
      const label = show ? 'Ocultar senha' : 'Mostrar senha';
      togglePasswordBtn.setAttribute('aria-label', label);
      togglePasswordBtn.setAttribute('title', label);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }

  // Se já estiver autenticado e abrir login/cadastro, manda pro app
  fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((me) => {
      if (me && me.id) redirectToApp();
    })
    .catch(() => {});
});


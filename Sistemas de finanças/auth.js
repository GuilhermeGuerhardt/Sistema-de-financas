document.addEventListener('DOMContentLoaded', () => {
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
      credentials: 'same-origin',
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { response, data };
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

    const { response, data } = await postJson('/api/auth/login', { username, password });
    if (!response.ok) {
      await showError((data && data.error) || 'Não foi possível entrar.');
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

    const { response, data } = await postJson('/api/auth/register', { username, password });
    if (!response.ok) {
      await showError((data && data.error) || 'Não foi possível cadastrar.');
      return;
    }

    await redirectToApp();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }

  // Se já estiver autenticado e abrir login/cadastro, manda pro app
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((me) => {
      if (me && me.id) redirectToApp();
    })
    .catch(() => {});
});


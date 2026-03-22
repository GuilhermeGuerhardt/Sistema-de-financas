/**
 * Base da API. Se você abrir o app por Live Server (porta 5500) ou Vite (5173),
 * aponta automaticamente para o Node em :3000. Sobrescreva com <meta name="api-base" content="http://host:porta/api">.
 */
(function () {
  function resolveApiBase() {
    const meta = document.querySelector('meta[name="api-base"]');
    const override = meta && meta.getAttribute('content');
    if (override && String(override).trim()) {
      return String(override).trim().replace(/\/+$/, '');
    }
    if (typeof window === 'undefined' || !window.location) return '/api';
    const { protocol, hostname, port } = window.location;
    if (protocol === 'file:') {
      return 'http://localhost:3000/api';
    }
    const p = port || '';
    if (
      ['5500', '5501', '5173', '8080', '4173', '1234', '4200', '3001'].includes(
        p
      )
    ) {
      return `${protocol}//${hostname}:3000/api`;
    }
    return `${window.location.origin}/api`;
  }
  window.__API_BASE__ = resolveApiBase();
})();

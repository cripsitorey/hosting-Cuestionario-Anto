// ============================================================
// StudyHub Auth - Pega esto en /assets/auth.js
// Luego incluye: <script src="../assets/auth.js"></script>
// en medicina/index.html e ingenieria/index.html
// ============================================================

const API_URL = 'https://colada.rondira.com'; 

const Auth = {
  getToken: () => localStorage.getItem('sh_token'),
  getUser: () => JSON.parse(localStorage.getItem('sh_user') || 'null'),
  isLoggedIn: () => !!localStorage.getItem('sh_token'),

  save: (token, user) => {
    localStorage.setItem('sh_token', token);
    localStorage.setItem('sh_user', JSON.stringify(user));
  },

  logout: () => {
    localStorage.removeItem('sh_token');
    localStorage.removeItem('sh_user');
    window.location.href = '/';
  },

  headers: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${Auth.getToken()}`
  }),

  // Verifica token con el servidor, si falla limpia y redirige
  async verify() {
    if (!Auth.isLoggedIn()) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, { headers: Auth.headers() });
      if (!res.ok) { Auth.logout(); return false; }
      return true;
    } catch {
      return false; // Sin conexión, permite acceso offline
    }
  },

  async login(email, password) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    Auth.save(data.token, data.user);
    return data.user;
  },

  async register(email, name, password) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async saveSession(module, filter, correct, total, categoryStats) {
    if (!Auth.isLoggedIn()) return;
    try {
      await fetch(`${API_URL}/api/progress`, {
        method: 'POST',
        headers: Auth.headers(),
        body: JSON.stringify({ module, filter, correct, total, category_stats: categoryStats })
      });
    } catch {
      console.warn('No se pudo guardar sesión, sin conexión');
    }
  }
};

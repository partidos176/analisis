import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '../firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Introduce email y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      let msg = 'Error al iniciar sesión. Inténtalo de nuevo.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email o contraseña incorrectos.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'El email no es válido.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Sin conexión. Comprueba tu red.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-logo">FT</div>
          <h1 className="login-title">
            FútbolTotal <span>Análisis</span>
          </h1>
          <p className="login-subtitle">Tagueo Táctico &amp; Scouting en Tiempo Real</p>
          <p style={{ color: '#ffffff', fontSize: '1.2rem', marginTop: '0.5rem' }}>hola</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label">
            Email
            <input
              type="email"
              className="input-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </label>

          <label className="login-label">
            Contraseña
            <input
              type="password"
              className="input-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-emerald login-submit" disabled={loading}>
            {loading ? 'Procesando…' : 'Entrar'}
          </button>
        </form>

        <p className="login-footnote">
          Acceso restringido. Solo usuarios autorizados.
        </p>

        <button
          type="button"
          onClick={() => window.open('https://partidos176.web.app/', '_blank')}
          style={{
            marginTop: '1rem',
            background: '#10b981',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1rem',
            padding: '0.6rem 1.5rem',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.05em'
          }}
        >
          ON
        </button>
      </div>
    </div>
  );
}
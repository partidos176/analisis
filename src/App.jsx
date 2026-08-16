import React, { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged, signOut, ref, set, push, onValue, update } from './firebase';
import Login from './components/Login';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [matchday, setMatchday] = useState('');
  const [saved, setSaved] = useState(false);
  const [matches, setMatches] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [activeTab, setActiveTab] = useState('acciones');
  const [tiroDerechaCount, setTiroDerechaCount] = useState(0);
  const [tiroIzquierdaCount, setTiroIzquierdaCount] = useState(0);
  const [tiroFrontalCount, setTiroFrontalCount] = useState(0);
  const [faltaDerechaCount, setFaltaDerechaCount] = useState(0);
  const [faltaIzquierdaCount, setFaltaIzquierdaCount] = useState(0);
  const [faltaFrontalCount, setFaltaFrontalCount] = useState(0);
  const [centroDerechaCount, setCentroDerechaCount] = useState(0);
  const [centroIzquierdaCount, setCentroIzquierdaCount] = useState(0);
  const [cornerIzquierdaCount, setCornerIzquierdaCount] = useState(0);
  const [cornerDerechaCount, setCornerDerechaCount] = useState(0);
  const [inicioPropioCount, setInicioPropioCount] = useState(0);
  const [inicioRivalCount, setInicioRivalCount] = useState(0);
  const [onRivalCount, setOnRivalCount] = useState(0);
  const [offRivalCount, setOffRivalCount] = useState(0);
  const [onNeutroCount, setOnNeutroCount] = useState(0);
  const [fueraCount, setFueraCount] = useState(0);
  const [blocajeCount, setBlocajeCount] = useState(0);
  const [despejeDefensaCount, setDespejeDefensaCount] = useState(0);
  const [despejePorteroCount, setDespejePorteroCount] = useState(0);
  const [golCount, setGolCount] = useState(0);
  const [penalCount, setPenalCount] = useState(0);
  const [penalFueraCount, setPenalFueraCount] = useState(0);
  const [saqueEsquinaFueraCount, setSaqueEsquinaFueraCount] = useState(0);
  const [infraccionCount, setInfraccionCount] = useState(0);
  const [ocasionCount, setOcasionCount] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [playerStatus, setPlayerStatus] = useState('titular');
  const [players, setPlayers] = useState(Array(23).fill({ name: 'JUAN', status: '-' }));
  const [alineacionError, setAlineacionError] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInterval, setTimerInterval] = useState(null);

  useEffect(() => {
    if (!user) return;
    const matchesRef = ref(db, 'matches');
    const unsubscribe = onValue(matchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setMatches(list);
      } else {
        setMatches([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleSaveMatch = async (e) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam || !matchday) return;
    try {
      const matchesRef = ref(db, 'matches');
      const newMatchRef = push(matchesRef);
      const newId = newMatchRef.key;
      await set(newMatchRef, {
        homeTeam,
        awayTeam,
        matchday: Number(matchday),
        homeScore: 0,
        awayScore: 0,
        createdAt: Date.now()
      });
      setHomeTeam('');
      setAwayTeam('');
      setMatchday('');
      setCurrentMatch({ id: newId, homeTeam, awayTeam, matchday: Number(matchday), homeScore: 0, awayScore: 0 });
      setActiveTab('alineacion');
    } catch (err) {
      console.error('Error guardando partido:', err);
    }
  };

  const handleEdit = (match) => {
    setEditingId(match.id);
    setHomeTeam(match.homeTeam);
    setAwayTeam(match.awayTeam);
    setMatchday(match.matchday);
  };

  const handleUpdateMatch = async (e) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam || !matchday || !editingId) return;
    try {
      await update(ref(db, `matches/${editingId}`), {
        homeTeam,
        awayTeam,
        matchday: Number(matchday)
      });
      setEditingId(null);
      setHomeTeam('');
      setAwayTeam('');
      setMatchday('');
    } catch (err) {
      console.error('Error actualizando partido:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setHomeTeam('');
    setAwayTeam('');
    setMatchday('');
  };

  const handleOpenMatch = (match) => {
    setCurrentMatch(match);
    setActiveTab('alineacion');
  };

  const handleBackToList = () => {
    setCurrentMatch(null);
  };

  const handleAceptar = () => {
    const titulares = players.filter(p => p.status === 'titular').length;
    if (titulares !== 11) {
      setAlineacionError(true);
      setTimeout(() => setAlineacionError(false), 3000);
      return;
    }
    setActiveTab('acciones');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePrimeraParte = () => {
    setTimerSeconds(0);
    setTimerRunning(true);
  };

  const handleSegundaParte = () => {
    setTimerRunning(true);
  };

  const handleFin = () => {
    setTimerRunning(false);
  };

  useEffect(() => {
    let interval = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-logo">FT</div>
            <h1 className="login-title">Cargando…</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Página del partido
  if (currentMatch) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0.6rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn-sm btn-secondary" onClick={handleBackToList} style={{ fontSize: '1rem' }}>←</button>
            <button
              onClick={() => setActiveTab('alineacion')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'alineacion' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'alineacion' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ALINEACION
            </button>
            <button
              onClick={() => setActiveTab('acciones')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'acciones' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'acciones' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ACCIONES
            </button>
            <button
              onClick={() => setActiveTab('finalizaciones')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'finalizaciones' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'finalizaciones' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              FINALIZACIONES
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {user.email}
            </span>
            <button className="btn-sm btn-secondary" onClick={handleLogout}>Salir</button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '800px' }}>
            {/* Info del partido */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2rem'
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38bdf8' }}>{currentMatch.homeTeam}</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#334155' }}>vs</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f87171' }}>{currentMatch.awayTeam}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', background: 'var(--bg-secondary)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
                JORNADA {currentMatch.matchday}
              </span>
              {activeTab === 'alineacion' && (
                <button
                  onClick={handleAceptar}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.8rem',
                    borderRadius: 'var(--radius-full)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  ACEPTAR
                </button>
              )}
              {activeTab === 'acciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1.8rem', color: '#38bdf8', background: 'var(--bg-secondary)', padding: '0.5rem 1.2rem', borderRadius: 'var(--radius-full)', textAlign: 'center' }}>
                    {formatTime(timerSeconds)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'stretch' }}>
                    <button
                      onClick={handlePrimeraParte}
                      style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.8rem',
                        borderRadius: 'var(--radius-full)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        minWidth: '80px',
                        textAlign: 'center',
                        flex: 1
                      }}
                    >
                      1ª PARTE
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'stretch' }}>
                    <button
                      onClick={handleSegundaParte}
                      style={{
                        background: '#7c3aed',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.8rem',
                        borderRadius: 'var(--radius-full)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        minWidth: '80px',
                        textAlign: 'center',
                        flex: 1
                      }}
                    >
                      2ª PARTE
                    </button>
                    <button
                      onClick={handleFin}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.8rem',
                        borderRadius: 'var(--radius-full)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        minWidth: '80px',
                        textAlign: 'center',
                        flex: 1
                      }}
                    >
                      FIN
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hoja en blanco para construir */}
            {activeTab === 'acciones' && (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '3rem',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'row',
                gap: '2rem'
              }}>
                {/* Columna izquierda - Botones de acción */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  marginLeft: '-2rem'
                }}>
                  <button
                    onClick={() => {
                      setTiroDerechaCount(tiroDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#eab308',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>TIRO DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#eab308',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {tiroDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setTiroIzquierdaCount(tiroIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#eab308',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>TIRO IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#eab308',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {tiroIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setTiroFrontalCount(tiroFrontalCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#eab308',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>TIRO FRONTAL</span>
                    <span style={{
                      background: '#000000',
                      color: '#eab308',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {tiroFrontalCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFaltaDerechaCount(faltaDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#3b82f6',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>FALTA DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#3b82f6',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {faltaDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFaltaIzquierdaCount(faltaIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#3b82f6',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>FALTA IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#3b82f6',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {faltaIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFaltaFrontalCount(faltaFrontalCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#3b82f6',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>FALTA FRONTAL</span>
                    <span style={{
                      background: '#000000',
                      color: '#3b82f6',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {faltaFrontalCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCentroDerechaCount(centroDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#22c55e',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>CENTRO DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#22c55e',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {centroDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCentroIzquierdaCount(centroIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#22c55e',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>CENTRO IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#22c55e',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {centroIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCornerIzquierdaCount(cornerIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ec4899',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>CORNER IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#ec4899',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {cornerIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCornerDerechaCount(cornerDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ec4899',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>CORNER DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#ec4899',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {cornerDerechaCount}
                    </span>
                  </button>
                </div>
                {/* Columna derecha - Botones RIVAL */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  marginLeft: '4rem'
                }}>
                  <button
                    onClick={() => {
                      setTiroDerechaCount(tiroDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#eab308',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL TIRO DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#eab308',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {tiroDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setTiroIzquierdaCount(tiroIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#eab308',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL TIRO IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#eab308',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {tiroIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setTiroFrontalCount(tiroFrontalCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#eab308',
                      color: '#000000',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL TIRO FRONTAL</span>
                    <span style={{
                      background: '#000000',
                      color: '#eab308',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {tiroFrontalCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFaltaDerechaCount(faltaDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#3b82f6',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL FALTA DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#3b82f6',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {faltaDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFaltaIzquierdaCount(faltaIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#3b82f6',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL FALTA IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#3b82f6',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {faltaIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setFaltaFrontalCount(faltaFrontalCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#3b82f6',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL FALTA FRONTAL</span>
                    <span style={{
                      background: '#000000',
                      color: '#3b82f6',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {faltaFrontalCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCentroDerechaCount(centroDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#22c55e',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL CENTRO DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#22c55e',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {centroDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCentroIzquierdaCount(centroIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#22c55e',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL CENTRO IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#22c55e',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {centroIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCornerIzquierdaCount(cornerIzquierdaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ec4899',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL CORNER IZQUIERDA</span>
                    <span style={{
                      background: '#000000',
                      color: '#ec4899',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {cornerIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCornerDerechaCount(cornerDerechaCount + 1);
                      setActiveTab('finalizaciones');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ec4899',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '250px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    <span>RIVAL CORNER DERECHA</span>
                    <span style={{
                      background: '#000000',
                      color: '#ec4899',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {cornerDerechaCount}
                    </span>
                  </button>
                </div>
                {/* Botones INICIO PROPIO e INICIO RIVAL */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  marginLeft: '0rem'
                }}>
                  <button
                    onClick={() => {
                      setInicioPropioCount(inicioPropioCount + 1);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '1rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '180px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      gap: '0.5rem'
                    }}
                  >
                    <span>INICIO PROPIO</span>
                    <span style={{
                      background: '#ffffff',
                      color: '#7c3aed',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {inicioPropioCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setInicioRivalCount(inicioRivalCount + 1);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '1rem 1.5rem',
                      borderRadius: '12px',
                      minWidth: '180px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      gap: '0.5rem'
                    }}
                  >
                    <span>INICIO RIVAL</span>
                    <span style={{
                      background: '#ffffff',
                      color: '#7c3aed',
                      fontWeight: 900,
                      fontSize: '1rem',
                      padding: '0.2rem 0.7rem',
                      borderRadius: '8px',
                      minWidth: '30px',
                      textAlign: 'center'
                    }}>
                      {inicioRivalCount}
                    </span>
                  </button>
                  <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <button
                        onClick={() => {
                          setOnRivalCount(onRivalCount + 1);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#dc2626',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          padding: '1rem',
                          borderRadius: '50%',
                          width: '75px',
                          height: '75px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          gap: '0.2rem',
                          cursor: 'pointer',
                          border: 'none'
                        }}
                      >
                        <span>ON</span>
                        <span>RIVAL</span>
                        <span style={{
                          background: '#ffffff',
                          color: '#dc2626',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '8px',
                          minWidth: '20px',
                          textAlign: 'center'
                        }}>
                          {onRivalCount}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setOnNeutroCount(onNeutroCount + 1);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#dc2626',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          padding: '1rem',
                          borderRadius: '50%',
                          width: '75px',
                          height: '75px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          gap: '0.2rem',
                          cursor: 'pointer',
                          border: 'none'
                        }}
                      >
                        <span>ON</span>
                        <span>NEUTRO</span>
                        <span style={{
                          background: '#ffffff',
                          color: '#dc2626',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '8px',
                          minWidth: '20px',
                          textAlign: 'center'
                        }}>
                          {onNeutroCount}
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setOffRivalCount(offRivalCount + 1);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#dc2626',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.8rem',
                        padding: '1rem',
                        borderRadius: '50%',
                        width: '75px',
                        height: '75px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        gap: '0.2rem',
                        cursor: 'pointer',
                        border: 'none'
                      }}
                    >
                      <span>OFF</span>
                      <span>RIVAL</span>
                      <span style={{
                        background: '#ffffff',
                        color: '#dc2626',
                        fontWeight: 900,
                        fontSize: '0.8rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '8px',
                        minWidth: '20px',
                        textAlign: 'center'
                      }}>
                        {offRivalCount}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'finalizaciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                  {/* Botón OCASION centrado arriba */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => { setOcasionCount(ocasionCount + 1); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f97316', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '250px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      <span>OCASION</span>
                      <span style={{ background: '#ffffff', color: '#f97316', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{ocasionCount}</span>
                    </button>
                  </div>
                  {/* Dos columnas debajo */}
                  <div style={{ display: 'flex', gap: '2rem' }}>
                    {/* Columna izquierda */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <button
                        onClick={() => { setFueraCount(fueraCount + 1); setActiveTab('acciones'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>FUERA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{fueraCount}</span>
                      </button>
                      <button
                        onClick={() => { setBlocajeCount(blocajeCount + 1); setActiveTab('acciones'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>BLOCAJE</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{blocajeCount}</span>
                      </button>
                      <button
                        onClick={() => { setDespejeDefensaCount(despejeDefensaCount + 1); setActiveTab('acciones'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>DESPEJE DEFENSA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{despejeDefensaCount}</span>
                      </button>
                      <button
                        onClick={() => { setDespejePorteroCount(despejePorteroCount + 1); setActiveTab('acciones'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>DESPEJE PORTERO</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{despejePorteroCount}</span>
                      </button>
                      <button
                        onClick={() => { setSaqueEsquinaFueraCount(saqueEsquinaFueraCount + 1); setActiveTab('acciones'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>SAQUE DE ESQUINA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{saqueEsquinaFueraCount}</span>
                      </button>
                    </div>
                    {/* Columna derecha */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <button
                        onClick={() => { setGolCount(golCount + 1); setActiveTab('alineacion'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>GOL</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{golCount}</span>
                      </button>
                      <button
                        onClick={() => { setPenalCount(penalCount + 1); setActiveTab('alineacion'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>PENAL + GOL</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{penalCount}</span>
                      </button>
                      <button
                        onClick={() => { setPenalFueraCount(penalFueraCount + 1); setActiveTab('acciones'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>PENAL + FUERA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{penalFueraCount}</span>
                      </button>
                      <button
                        onClick={() => { setInfraccionCount(infraccionCount + 1); setActiveTab('acciones'); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>INFRACCION</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{infraccionCount}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'alineacion' && (
                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                  {alineacionError && (
                    <div style={{
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: '#dc2626',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '1.5rem',
                      padding: '1.5rem 3rem',
                      borderRadius: '12px',
                      zIndex: 1000,
                      animation: 'blink 0.5s infinite'
                    }}>
                      ERROR DE ALINEACION
                    </div>
                  )}
                  {/* Columna izquierda */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {players.slice(0, 12).map((p, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', minWidth: '20px', textAlign: 'right' }}>{i + 1}</span>
                        <select
                          value={p.name}
                          onChange={(e) => {
                            const newPlayers = [...players];
                            newPlayers[i] = { ...newPlayers[i], name: e.target.value };
                            setPlayers(newPlayers);
                          }}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.6rem',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            flex: 1
                          }}
                        >
                          <option value="JUAN">JUAN</option>
                          <option value="PEDRO">PEDRO</option>
                          <option value="LUIS">LUIS</option>
                          <option value="MILLA">MILLA</option>
                          <option value="ALEXIS">ALEXIS</option>
                          <option value="ANTONIO">ANTONIO</option>
                        </select>
                        <select
                          value={p.status}
                          onChange={(e) => {
                            const newPlayers = [...players];
                            newPlayers[i] = { ...newPlayers[i], status: e.target.value };
                            setPlayers(newPlayers);
                          }}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.6rem',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            flex: 1
                          }}
                        >
                          <option value="-">-</option>
                          <option value="titular">TITULAR</option>
                          <option value="suplente">SUPLENTE</option>
                          <option value="lesion">LESION</option>
                          <option value="no convocado">NO CONVOCADO</option>
                          <option value="division honor">DIVISION HONOR</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  {/* Columna derecha */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {players.slice(12, 23).map((p, i) => (
                      <div key={i + 12} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', minWidth: '20px', textAlign: 'right' }}>{i + 13}</span>
                        <select
                          value={p.name}
                          onChange={(e) => {
                            const newPlayers = [...players];
                            newPlayers[i + 12] = { ...newPlayers[i + 12], name: e.target.value };
                            setPlayers(newPlayers);
                          }}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.6rem',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            flex: 1
                          }}
                        >
                          <option value="JUAN">JUAN</option>
                          <option value="PEDRO">PEDRO</option>
                          <option value="LUIS">LUIS</option>
                          <option value="MILLA">MILLA</option>
                          <option value="ALEXIS">ALEXIS</option>
                          <option value="ANTONIO">ANTONIO</option>
                        </select>
                        <select
                          value={p.status}
                          onChange={(e) => {
                            const newPlayers = [...players];
                            newPlayers[i + 12] = { ...newPlayers[i + 12], status: e.target.value };
                            setPlayers(newPlayers);
                          }}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.6rem',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            flex: 1
                          }}
                        >
                          <option value="-">-</option>
                          <option value="titular">TITULAR</option>
                          <option value="suplente">SUPLENTE</option>
                          <option value="lesion">LESION</option>
                          <option value="no convocado">NO CONVOCADO</option>
                          <option value="division honor">DIVISION HONOR</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </main>
      </div>
    );
  }

  // Test commit for Vercel deploy
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.6rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="brand-logo">FT</div>
          <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>FútbolTotal Análisis</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {user.email}
          </span>
          <button className="btn-sm btn-secondary" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>

          {/* Formulario */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center' }}>
              {editingId ? 'Editar Partido' : 'Nuevo Partido'}
            </h2>

            <form onSubmit={editingId ? handleUpdateMatch : handleSaveMatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Equipo Local
                <input
                  type="text"
                  className="input-control"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="Ej: Barcelona"
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Equipo Visitante
                <input
                  type="text"
                  className="input-control"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="Ej: Real Madrid"
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                JORNADA
                <input
                  type="number"
                  className="input-control"
                  value={matchday}
                  onChange={(e) => setMatchday(e.target.value)}
                  placeholder="Ej: 1"
                  min="1"
                  required
                />
              </label>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-emerald" style={{ flex: 1, justifyContent: 'center', padding: '0.6rem', fontWeight: 700 }}>
                  {editingId ? 'Actualizar' : 'Guardar Partido'}
                </button>
                {editingId && (
                  <button type="button" className="btn-secondary" onClick={handleCancelEdit} style={{ padding: '0.6rem 1rem', fontWeight: 700 }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de partidos */}
          {matches.length > 0 && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem' }}>Partidos guardados</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {matches.map((m) => (
                  <div key={m.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    gap: '1rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>{m.homeTeam}</span>
                      <span style={{ margin: '0 0.4rem', color: '#ffffff', fontWeight: 700 }}>vs</span>
                      <span style={{ fontWeight: 700, color: '#f87171' }}>{m.awayTeam}</span>
                      <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#ffffff', fontWeight: 600 }}>
                        J{m.matchday}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn-sm btn-primary" onClick={() => handleOpenMatch(m)}>
                        Abrir
                      </button>
                      <button className="btn-sm btn-secondary" onClick={() => handleEdit(m)}>
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

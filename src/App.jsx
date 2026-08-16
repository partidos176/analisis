import React, { useState, useEffect, useRef } from 'react';
import { auth, db, onAuthStateChanged, signOut, ref, set, push, onValue, update } from './firebase';
import Login from './components/Login';
import descargaImg from './descarga.png';

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
  const [rivalTiroDerechaCount, setRivalTiroDerechaCount] = useState(0);
  const [tiroIzquierdaCount, setTiroIzquierdaCount] = useState(0);
  const [tiroFrontalCount, setTiroFrontalCount] = useState(0);
  const [faltaDerechaCount, setFaltaDerechaCount] = useState(0);
  const [faltaIzquierdaCount, setFaltaIzquierdaCount] = useState(0);
  const [faltaFrontalCount, setFaltaFrontalCount] = useState(0);
  const [centroDerechaCount, setCentroDerechaCount] = useState(0);
  const [centroIzquierdaCount, setCentroIzquierdaCount] = useState(0);
  const [cornerIzquierdaCount, setCornerIzquierdaCount] = useState(0);
  const [cornerDerechaCount, setCornerDerechaCount] = useState(0);
  const [rivalTiroIzquierdaCount, setRivalTiroIzquierdaCount] = useState(0);
  const [rivalTiroFrontalCount, setRivalTiroFrontalCount] = useState(0);
  const [rivalFaltaDerechaCount, setRivalFaltaDerechaCount] = useState(0);
  const [rivalFaltaIzquierdaCount, setRivalFaltaIzquierdaCount] = useState(0);
  const [rivalFaltaFrontalCount, setRivalFaltaFrontalCount] = useState(0);
  const [rivalCentroDerechaCount, setRivalCentroDerechaCount] = useState(0);
  const [rivalCentroIzquierdaCount, setRivalCentroIzquierdaCount] = useState(0);
  const [rivalCornerIzquierdaCount, setRivalCornerIzquierdaCount] = useState(0);
  const [rivalCornerDerechaCount, setRivalCornerDerechaCount] = useState(0);
  const [inicioPropioCount, setInicioPropioCount] = useState(0);
  const [inicioRivalCount, setInicioRivalCount] = useState(0);
  const [onRivalCount, setOnRivalCount] = useState(0);
  const [offRivalCount, setOffRivalCount] = useState(0);
  const [onNeutroCount, setOnNeutroCount] = useState(0);
  const [offNeutroCount, setOffNeutroCount] = useState(0);
  const [fueraCount, setFueraCount] = useState(0);
  const [blocajeCount, setBlocajeCount] = useState(0);
  const [despejeDefensaCount, setDespejeDefensaCount] = useState(0);
  const [despejePorteroCount, setDespejePorteroCount] = useState(0);
  const [golCount, setGolCount] = useState(0);
  const [golRivalCount, setGolRivalCount] = useState(0);
  const [penalCount, setPenalCount] = useState(0);
  const [saqueEsquinaFueraCount, setSaqueEsquinaFueraCount] = useState(0);
  const [infraccionCount, setInfraccionCount] = useState(0);
  const [ocasionCount, setOcasionCount] = useState(0);
  const [golesList, setGolesList] = useState([]);
  const [fromRival, setFromRival] = useState(false);
  const [periodo, setPeriodo] = useState('1ª PARTE');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [playerStatus, setPlayerStatus] = useState('titular');
  const [players, setPlayers] = useState(Array(23).fill({ name: 'JUAN', status: '-' }));
  const [alineacionError, setAlineacionError] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInterval, setTimerInterval] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [contadorWarning, setContadorWarning] = useState(false);
  const [dataLoadedId, setDataLoadedId] = useState(null);

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
      resetMatchData();
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

  const resetMatchData = () => {
    setTiroDerechaCount(0);
    setRivalTiroDerechaCount(0);
    setTiroIzquierdaCount(0);
    setTiroFrontalCount(0);
    setFaltaDerechaCount(0);
    setFaltaIzquierdaCount(0);
    setFaltaFrontalCount(0);
    setCentroDerechaCount(0);
    setCentroIzquierdaCount(0);
    setCornerIzquierdaCount(0);
    setCornerDerechaCount(0);
    setRivalTiroIzquierdaCount(0);
    setRivalTiroFrontalCount(0);
    setRivalFaltaDerechaCount(0);
    setRivalFaltaIzquierdaCount(0);
    setRivalFaltaFrontalCount(0);
    setRivalCentroDerechaCount(0);
    setRivalCentroIzquierdaCount(0);
    setRivalCornerIzquierdaCount(0);
    setRivalCornerDerechaCount(0);
    setInicioPropioCount(0);
    setInicioRivalCount(0);
    setOnRivalCount(0);
    setOffRivalCount(0);
    setOnNeutroCount(0);
    setOffNeutroCount(0);
    setFueraCount(0);
    setBlocajeCount(0);
    setDespejeDefensaCount(0);
    setDespejePorteroCount(0);
    setGolCount(0);
    setGolRivalCount(0);
    setPenalCount(0);
    setSaqueEsquinaFueraCount(0);
    setInfraccionCount(0);
    setOcasionCount(0);
    setGolesList([]);
    setPlayers(Array(23).fill({ name: 'JUAN', status: '-' }));
    setTimerSeconds(0);
    setTimerRunning(false);
    setActionLog([]);
    setFromRival(false);
    setPeriodo('1ª PARTE');
  };

  const normalizeArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return Object.values(v);
  };

  const handleOpenMatch = async (match) => {
    setActiveTab('alineacion');
    resetMatchData();
    setTiroDerechaCount(match.tiroDerechaCount ?? 0);
    setRivalTiroDerechaCount(match.rivalTiroDerechaCount ?? 0);
    setTiroIzquierdaCount(match.tiroIzquierdaCount ?? 0);
    setTiroFrontalCount(match.tiroFrontalCount ?? 0);
    setFaltaDerechaCount(match.faltaDerechaCount ?? 0);
    setFaltaIzquierdaCount(match.faltaIzquierdaCount ?? 0);
    setFaltaFrontalCount(match.faltaFrontalCount ?? 0);
    setCentroDerechaCount(match.centroDerechaCount ?? 0);
    setCentroIzquierdaCount(match.centroIzquierdaCount ?? 0);
    setCornerIzquierdaCount(match.cornerIzquierdaCount ?? 0);
    setCornerDerechaCount(match.cornerDerechaCount ?? 0);
    setRivalTiroIzquierdaCount(match.rivalTiroIzquierdaCount ?? 0);
    setRivalTiroFrontalCount(match.rivalTiroFrontalCount ?? 0);
    setRivalFaltaDerechaCount(match.rivalFaltaDerechaCount ?? 0);
    setRivalFaltaIzquierdaCount(match.rivalFaltaIzquierdaCount ?? 0);
    setRivalFaltaFrontalCount(match.rivalFaltaFrontalCount ?? 0);
    setRivalCentroDerechaCount(match.rivalCentroDerechaCount ?? 0);
    setRivalCentroIzquierdaCount(match.rivalCentroIzquierdaCount ?? 0);
    setRivalCornerIzquierdaCount(match.rivalCornerIzquierdaCount ?? 0);
    setRivalCornerDerechaCount(match.rivalCornerDerechaCount ?? 0);
    setInicioPropioCount(match.inicioPropioCount ?? 0);
    setInicioRivalCount(match.inicioRivalCount ?? 0);
    setOnRivalCount(match.onRivalCount ?? 0);
    setOffRivalCount(match.offRivalCount ?? 0);
    setOnNeutroCount(match.onNeutroCount ?? 0);
    setOffNeutroCount(match.offNeutroCount ?? 0);
    setFueraCount(match.fueraCount ?? 0);
    setBlocajeCount(match.blocajeCount ?? 0);
    setDespejeDefensaCount(match.despejeDefensaCount ?? 0);
    setDespejePorteroCount(match.despejePorteroCount ?? 0);
    setGolCount(match.golCount ?? 0);
    setGolRivalCount(match.golRivalCount ?? 0);
    setPenalCount(match.penalCount ?? 0);
    setSaqueEsquinaFueraCount(match.saqueEsquinaFueraCount ?? 0);
    setInfraccionCount(match.infraccionCount ?? 0);
    setOcasionCount(match.ocasionCount ?? 0);
    setGolesList(normalizeArray(match.golesList));
    setPlayers(match.players ? normalizeArray(match.players) : Array(23).fill({ name: 'JUAN', status: '-' }));
    setTimerSeconds(match.timerSeconds ?? 0);
    setTimerRunning(match.timerRunning ?? false);
    setActionLog(normalizeArray(match.actionLog));
    setCurrentMatch(match);
  };

  const saveMatchData = async (id) => {
    const matchRef = ref(db, `matches/${id}`);
    await update(matchRef, {
      tiroDerechaCount,
      rivalTiroDerechaCount,
      tiroIzquierdaCount,
      tiroFrontalCount,
      faltaDerechaCount,
      faltaIzquierdaCount,
      faltaFrontalCount,
      centroDerechaCount,
      centroIzquierdaCount,
      cornerIzquierdaCount,
      cornerDerechaCount,
      rivalTiroIzquierdaCount,
      rivalTiroFrontalCount,
      rivalFaltaDerechaCount,
      rivalFaltaIzquierdaCount,
      rivalFaltaFrontalCount,
      rivalCentroDerechaCount,
      rivalCentroIzquierdaCount,
      rivalCornerIzquierdaCount,
      rivalCornerDerechaCount,
      inicioPropioCount,
      inicioRivalCount,
      onRivalCount,
      offRivalCount,
      onNeutroCount,
      offNeutroCount,
      fueraCount,
      blocajeCount,
      despejeDefensaCount,
      despejePorteroCount,
      golCount,
      golRivalCount,
      penalCount,
      saqueEsquinaFueraCount,
      infraccionCount,
      ocasionCount,
      golesList,
      players,
      timerSeconds,
      timerRunning,
      actionLog
    });
  };

  const handleBackToList = async () => {
    if (currentMatch) {
      try {
        await saveMatchData(currentMatch.id);
      } catch (err) {
        console.error('Error guardando datos del partido:', err);
      }
    }
    setCurrentMatch(null);
    resetMatchData();
  };

  useEffect(() => {
    if (!currentMatch) return;
saveMatchData(currentMatch.id).catch(err => console.error('Error auto-guardando datos del partido:', err));
  }, [currentMatch, tiroDerechaCount, rivalTiroDerechaCount, tiroIzquierdaCount, tiroFrontalCount, faltaDerechaCount, faltaIzquierdaCount, faltaFrontalCount, centroDerechaCount, centroIzquierdaCount, cornerIzquierdaCount, cornerDerechaCount, rivalTiroIzquierdaCount, rivalTiroFrontalCount, rivalFaltaDerechaCount, rivalFaltaIzquierdaCount, rivalFaltaFrontalCount, rivalCentroDerechaCount, rivalCentroIzquierdaCount, rivalCornerIzquierdaCount, rivalCornerDerechaCount, inicioPropioCount, inicioRivalCount, onRivalCount, offRivalCount, onNeutroCount, offNeutroCount, fueraCount, blocajeCount, despejeDefensaCount, despejePorteroCount, golCount, golRivalCount, penalCount, saqueEsquinaFueraCount, infraccionCount, ocasionCount, golesList, players, timerSeconds, timerRunning, actionLog]);

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

  const logAction = (name, type = 'accion') => {
    const isTimerButton = name === '1ª PARTE' || name === '2ª PARTE' || name === 'FIN';
    if (!timerRunning && !isTimerButton) {
      setContadorWarning(true);
      setTimeout(() => setContadorWarning(false), 2500);
      return false;
    }
    setActionLog(prev => [{ name, time: formatTime(timerSeconds), type }, ...prev]);
    return true;
  };

  const decrementCounter = (name) => {
    const map = {
      'TIRO DERECHA': setTiroDerechaCount,
      'TIRO IZQUIERDA': setTiroIzquierdaCount,
      'TIRO FRONTAL': setTiroFrontalCount,
      'FALTA DERECHA': setFaltaDerechaCount,
      'FALTA IZQUIERDA': setFaltaIzquierdaCount,
      'FALTA FRONTAL': setFaltaFrontalCount,
      'CENTRO DERECHA': setCentroDerechaCount,
      'CENTRO IZQUIERDA': setCentroIzquierdaCount,
      'CORNER IZQUIERDA': setCornerIzquierdaCount,
      'CORNER DERECHA': setCornerDerechaCount,
      'RIVAL TIRO DERECHA': setRivalTiroDerechaCount,
      'RIVAL TIRO IZQUIERDA': setRivalTiroIzquierdaCount,
      'RIVAL TIRO FRONTAL': setRivalTiroFrontalCount,
      'RIVAL FALTA DERECHA': setRivalFaltaDerechaCount,
      'RIVAL FALTA IZQUIERDA': setRivalFaltaIzquierdaCount,
      'RIVAL FALTA FRONTAL': setRivalFaltaFrontalCount,
      'RIVAL CENTRO DERECHA': setRivalCentroDerechaCount,
      'RIVAL CENTRO IZQUIERDA': setRivalCentroIzquierdaCount,
      'RIVAL CORNER IZQUIERDA': setRivalCornerIzquierdaCount,
      'RIVAL CORNER DERECHA': setRivalCornerDerechaCount,
      'INICIO PROPIO': setInicioPropioCount,
      'INICIO RIVAL': setInicioRivalCount,
      'ON RIVAL': setOnRivalCount,
      'ON NEUTRO': setOnNeutroCount,
      'OFF RIVAL': setOffRivalCount,
      'OFF NEUTRO': setOffNeutroCount,
      'OCASION': setOcasionCount,
      'FUERA': setFueraCount,
      'BLOCAJE': setBlocajeCount,
      'DESPEJE DEFENSA': setDespejeDefensaCount,
      'DESPEJE PORTERO': setDespejePorteroCount,
      'SAQUE DE ESQUINA': setSaqueEsquinaFueraCount,
      'GOL': setGolCount,
      'GOL RIVAL': setGolRivalCount,
      'PENAL + FUERA': setPenalCount,
      'INFRACCION': setInfraccionCount
    };
    const setter = map[name];
    if (setter) {
      setter(prev => Math.max(0, prev - 1));
    }
  };

  const handlePrimeraParte = () => {
    setPeriodo('1ª PARTE');
    setTimerSeconds(0);
    setTimerRunning(true);
    logAction('1ª PARTE');
  };

  const handleSegundaParte = () => {
    setPeriodo('2ª PARTE');
    setTimerRunning(true);
    logAction('2ª PARTE');
  };

  const handleFin = () => {
    setTimerRunning(false);
    logAction('FIN');
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
            <button
              onClick={() => setActiveTab('goles')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'goles' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'goles' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              GOLES
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
              {[currentMatch.homeTeam, currentMatch.awayTeam].map((team) => {
                const isTenerife = team && team.toUpperCase().includes('TENERIFE');
                return (
                  <div key={team} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: isTenerife ? '#38bdf8' : '#f87171' }}>{team}</span>
                    {isTenerife && (
                      <span style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 900, fontSize: '1.1rem', padding: '0.15rem 0.8rem', borderRadius: 'var(--radius-full)', minWidth: '36px', textAlign: 'center' }}>{golCount + penalCount}</span>
                    )}
                    {!isTenerife && (
                      <span style={{ background: '#f87171', color: '#0f172a', fontWeight: 900, fontSize: '1.1rem', padding: '0.15rem 0.8rem', borderRadius: 'var(--radius-full)', minWidth: '36px', textAlign: 'center' }}>{golRivalCount}</span>
                    )}
                  </div>
                );
              })}
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#334155' }}>vs</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', background: 'var(--bg-secondary)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
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
                {contadorWarning && (
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
                    INICIAR CONTADOR
                  </div>
                )}
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
                      if (logAction('TIRO DERECHA')) {
                        setFromRival(false);
                        setTiroDerechaCount(tiroDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('TIRO IZQUIERDA')) {
                        setFromRival(false);
                        setTiroIzquierdaCount(tiroIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('TIRO FRONTAL')) {
                        setFromRival(false);
                        setTiroFrontalCount(tiroFrontalCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('FALTA DERECHA')) {
                        setFromRival(false);
                        setFaltaDerechaCount(faltaDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('FALTA IZQUIERDA')) {
                        setFromRival(false);
                        setFaltaIzquierdaCount(faltaIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('FALTA FRONTAL')) {
                        setFromRival(false);
                        setFaltaFrontalCount(faltaFrontalCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('CENTRO DERECHA')) {
                        setFromRival(false);
                        setCentroDerechaCount(centroDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('CENTRO IZQUIERDA')) {
                        setFromRival(false);
                        setCentroIzquierdaCount(centroIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('CORNER IZQUIERDA')) {
                        setFromRival(false);
                        setCornerIzquierdaCount(cornerIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('CORNER DERECHA')) {
                        setFromRival(false);
                        setCornerDerechaCount(cornerDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      if (logAction('RIVAL TIRO DERECHA')) {
                        setFromRival(true);
                        setRivalTiroDerechaCount(rivalTiroDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalTiroDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL TIRO IZQUIERDA')) {
                        setFromRival(true);
                        setRivalTiroIzquierdaCount(rivalTiroIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalTiroIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL TIRO FRONTAL')) {
                        setFromRival(true);
                        setRivalTiroFrontalCount(rivalTiroFrontalCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalTiroFrontalCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL FALTA DERECHA')) {
                        setFromRival(true);
                        setRivalFaltaDerechaCount(rivalFaltaDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalFaltaDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL FALTA IZQUIERDA')) {
                        setFromRival(true);
                        setRivalFaltaIzquierdaCount(rivalFaltaIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalFaltaIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL FALTA FRONTAL')) {
                        setFromRival(true);
                        setRivalFaltaFrontalCount(rivalFaltaFrontalCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalFaltaFrontalCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL CENTRO DERECHA')) {
                        setFromRival(true);
                        setRivalCentroDerechaCount(rivalCentroDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalCentroDerechaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL CENTRO IZQUIERDA')) {
                        setFromRival(true);
                        setRivalCentroIzquierdaCount(rivalCentroIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalCentroIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL CORNER IZQUIERDA')) {
                        setFromRival(true);
                        setRivalCornerIzquierdaCount(rivalCornerIzquierdaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalCornerIzquierdaCount}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (logAction('RIVAL CORNER DERECHA')) {
                        setFromRival(true);
                        setRivalCornerDerechaCount(rivalCornerDerechaCount + 1);
                        setActiveTab('finalizaciones');
                      }
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
                      {rivalCornerDerechaCount}
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
                      if (logAction('INICIO PROPIO')) {
                        setInicioPropioCount(inicioPropioCount + 1);
                      }
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
                      if (logAction('INICIO RIVAL')) {
                        setFromRival(true);
                        setInicioRivalCount(inicioRivalCount + 1);
                      }
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
                          if (logAction('ON RIVAL')) {
                            setFromRival(true);
                            setOnRivalCount(onRivalCount + 1);
                          }
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
                          if (logAction('ON NEUTRO')) {
                            setOnNeutroCount(onNeutroCount + 1);
                          }
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <button
                        onClick={() => {
                          if (logAction('OFF RIVAL')) {
                            setFromRival(true);
                            setOffRivalCount(offRivalCount + 1);
                          }
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
                      <button
                        onClick={() => {
                          if (logAction('OFF NEUTRO')) {
                            setOffNeutroCount(offNeutroCount + 1);
                          }
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
                          {offNeutroCount}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                {/* Listado de acciones */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  minWidth: '280px'
                }}>
                  <button
                    onClick={() => {
                      if (actionLog.length === 0) return;
                      decrementCounter(actionLog[0].name);
                      setActionLog(actionLog.slice(1));
                    }}
                    title="Borrar primera acción"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#eab308',
                      borderRadius: '50%',
                      width: '48px',
                      height: '48px',
                      alignSelf: 'center',
                      cursor: 'pointer',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      overflow: 'hidden'
                    }}
                  >
                    <img
                      src={descargaImg}
                      alt="Vaciar listado"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  </button>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    maxHeight: '500px',
                    overflowY: 'auto',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem'
                  }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    Acciones
                  </span>
                  {actionLog.length === 0 && (
                    <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                      Sin acciones aún
                    </span>
                  )}
                  {actionLog.map((entry, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: entry.type === 'finalizacion' ? '0.2rem 0.6rem' : '0.4rem 0.8rem'
                    }}>
                      <span style={{ color: entry.name.includes('RIVAL') ? '#ef4444' : (entry.type === 'finalizacion' ? '#22c55e' : '#ffffff'), fontWeight: 700, fontSize: entry.type === 'finalizacion' ? '0.7rem' : '0.85rem', textTransform: 'uppercase' }}>
                        {entry.name}
                      </span>
                      {entry.type !== 'finalizacion' && (
                        <span style={{ fontFamily: 'var(--font-mono)', color: entry.name.includes('RIVAL') ? '#ef4444' : (entry.type === 'finalizacion' ? '#22c55e' : '#38bdf8'), fontWeight: 900, fontSize: entry.type === 'finalizacion' ? '0.75rem' : '0.9rem' }}>
                          {entry.time}
                        </span>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'finalizaciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                  {/* Botón OCASION centrado arriba */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => { if (logAction('OCASION', 'finalizacion')) setOcasionCount(ocasionCount + 1); }}
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
                        onClick={() => { if (logAction('FUERA', 'finalizacion')) { setFueraCount(fueraCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>FUERA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{fueraCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('BLOCAJE', 'finalizacion')) { setBlocajeCount(blocajeCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>BLOCAJE</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{blocajeCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('DESPEJE DEFENSA', 'finalizacion')) { setDespejeDefensaCount(despejeDefensaCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>DESPEJE DEFENSA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{despejeDefensaCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('DESPEJE PORTERO', 'finalizacion')) { setDespejePorteroCount(despejePorteroCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>DESPEJE PORTERO</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{despejePorteroCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('SAQUE DE ESQUINA', 'finalizacion')) { setSaqueEsquinaFueraCount(saqueEsquinaFueraCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>SAQUE DE ESQUINA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{saqueEsquinaFueraCount}</span>
                      </button>
                    </div>
                    {/* Columna derecha */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <button
                        onClick={() => { if (logAction('GOL', 'finalizacion')) { setGolCount(golCount + 1); setGolesList([...golesList, { name: '', tipo: '', name2: '', team: 'home', periodo, minuto: Math.floor(timerSeconds / 60) }]); setActiveTab('goles'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>GOL</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{golCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('GOL RIVAL', 'finalizacion')) { setGolRivalCount(golRivalCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ef4444', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>GOL RIVAL</span>
                        <span style={{ background: '#ffffff', color: '#ef4444', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{golRivalCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('PENAL + FUERA', 'finalizacion')) { setPenalCount(penalCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>PENAL + FUERA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{penalCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('PENAL + GOL', 'finalizacion')) { setPenalCount(penalCount + 1); setGolesList([...golesList, { name: '', tipo: 'PENAL', name2: '', team: 'home', periodo, minuto: Math.floor(timerSeconds / 60) }]); setActiveTab('goles'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>PENAL + GOL</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{penalCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('INFRACCION', 'finalizacion')) { setInfraccionCount(infraccionCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: '220px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>INFRACCION</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{infraccionCount}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'goles' && (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2rem',
                  minHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem'
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1.4rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                    GOLES
                  </span>
                  {/* TODOS LOS GOLES */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {golesList.length === 0 && (
                      <span style={{ color: '#475569', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin goles</span>
                    )}
                    {golesList.map((g, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.2rem' }}>GOLEADOR</span>
                          <select
                            value={g.name}
                            onChange={(e) => {
                              const newGoles = [...golesList];
                              newGoles[i] = { ...newGoles[i], name: e.target.value };
                              setGolesList(newGoles);
                              if (e.target.value && newGoles[i].tipo && newGoles[i].name2) { setActiveTab('acciones'); }
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
                            <option value="">-</option>
                            <option value="JUAN">JUAN</option>
                            <option value="PEDRO">PEDRO</option>
                            <option value="LUIS">LUIS</option>
                            <option value="MILLA">MILLA</option>
                            <option value="ALEXIS">ALEXIS</option>
                            <option value="ANTONIO">ANTONIO</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.2rem' }}>ACCION</span>
                          <select
                            value={g.tipo}
                            onChange={(e) => {
                              const newGoles = [...golesList];
                              newGoles[i] = { ...newGoles[i], tipo: e.target.value };
                              setGolesList(newGoles);
                              if (newGoles[i].name && e.target.value && newGoles[i].name2) { setActiveTab('acciones'); }
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
                            <option value="">-</option>
                            <option value="PIE">PIE</option>
                            <option value="CABEZA">CABEZA</option>
                            <option value="PENAL">PENAL</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.2rem' }}>ASISTENTE</span>
                          <select
                            value={g.name2}
                            onChange={(e) => {
                              const newGoles = [...golesList];
                              newGoles[i] = { ...newGoles[i], name2: e.target.value };
                              setGolesList(newGoles);
                              if (newGoles[i].name && newGoles[i].tipo && e.target.value) { setActiveTab('acciones'); }
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
                            <option value="">-</option>
                            <option value="JUAN">JUAN</option>
                            <option value="PEDRO">PEDRO</option>
                            <option value="LUIS">LUIS</option>
                            <option value="MILLA">MILLA</option>
                            <option value="ALEXIS">ALEXIS</option>
                            <option value="ANTONIO">ANTONIO</option>
                            <option value="SIN ASISTENCIA">SIN ASISTENCIA</option>
                          </select>
                        </div>
                        <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.8rem', minWidth: '48px', textAlign: 'center' }}>{g.minuto}'</span>
                        <button
                          onClick={() => {
                            const newGoles = golesList.filter((_, idx) => idx !== i);
                            setGolesList(newGoles);
                            if (g.team === 'away') {
                              setGolRivalCount(Math.max(0, golRivalCount - 1));
                            } else {
                              setGolCount(Math.max(0, golCount - 1));
                            }
                          }}
                          style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 900, fontSize: '0.9rem', padding: '0.4rem 0.6rem', cursor: 'pointer', minWidth: '30px', textAlign: 'center' }}
                        >X</button>
                      </div>
                    ))}
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
                {matches.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((m) => (
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

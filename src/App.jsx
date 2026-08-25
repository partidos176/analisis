import React, { useState, useEffect, useRef } from 'react';
import { auth, db, onAuthStateChanged, signOut, ref, set, push, onValue, update } from './firebase';
import Login from './components/Login';
import { loadFFmpeg, cutVideoSingle, cutVideoMultiple } from './ffmpegCut';
import descargaImg from './descarga.png';
import alexImg from './jugadores/alex.jpg';
import alvaroImg from './jugadores/alvaro.jpg';
import ancorImg from './jugadores/ancor.jpg';
import cardonaImg from './jugadores/cardona.jpg';
import daniImg from './jugadores/dani.jpg';
import davidImg from './jugadores/david.jpg';
import diegoImg from './jugadores/diego.jpg';
import emilianoImg from './jugadores/emiliano.jpg';
import hectorImg from './jugadores/hector.jpg';
import ismaImg from './jugadores/isma.jpg';
import jonasImg from './jugadores/jonas.jpg';
import jorgeImg from './jugadores/jorge.png';
import juandaImg from './jugadores/juanda.jpg';
import kevinImg from './jugadores/kevin.jpg';
import lucasImg from './jugadores/lucas.jpg';
import oscarImg from './jugadores/oscar.jpg';
import raveloImg from './jugadores/ravelo.jpg';
import santanaImg from './jugadores/santana.jpg';
import santosImg from './jugadores/santos.jpg';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

const jugadoresData = {
  ALEX: { foto: alexImg, pos1: 'CENTRAL' },
  ALVARO: { foto: alvaroImg },
  ANCOR: { foto: ancorImg, pos1: 'MEDIO CENTRO' },
  CARDONA: { foto: cardonaImg },
  CADETE: {},
  DANI: { foto: daniImg },
  DAVID: { foto: davidImg, pos1: 'MEDIO CENTRO' },
  DIEGO: { foto: diegoImg },
  EMILIANO: { foto: emilianoImg, pos1: 'PORTERO' },
  HECTOR: { foto: hectorImg, pos1: 'PORTERO' },
  ISMA: { foto: ismaImg, pos1: 'DELANTERO' },
  JONAS: { foto: jonasImg },
  JORGE: { foto: jorgeImg },
  JUANDA: { foto: juandaImg },
  KEVIN: { foto: kevinImg, pos1: 'CENTRAL' },
  LUCAS: { foto: lucasImg, pos1: 'CENTRAL' },
  OSCAR: { foto: oscarImg, pos1: 'LATERAL DERECHO' },
  RAVELO: { foto: raveloImg, pos1: 'LATERAL IZQUIERDO' },
  SANTANA: { foto: santanaImg, pos1: 'LATERAL IZQUIERDO' },
  SANTOS: { foto: santosImg }
};

const defaultPlayersList = () => {
  const roster = Object.keys(jugadoresData);
  return Array(23).fill(null).map((_, i) => ({ name: roster[i] || '', status: '-' }));
};

const playerOptions = ['ALEX', 'ALVARO', 'ANCOR', 'CARDONA', 'DANI', 'DAVID', 'DIEGO', 'EMILIANO', 'HECTOR', 'ISMA', 'JONAS', 'JORGE', 'JUANDA', 'KEVIN', 'LUCAS', 'OSCAR', 'RAVELO', 'SANTANA', 'SANTOS', 'CADETE'];

const tr_pathTrianguloRedondeado = (p1, p2, p3, radio) => {
  const v = [p1, p2, p3];
  const s = [];
  for (let i = 0; i < 3; i++) {
    const c = v[i];
    const a = v[(i + 2) % 3];
    const b = v[(i + 1) % 3];
    const la = Math.hypot(a.x - c.x, a.y - c.y);
    const lb = Math.hypot(b.x - c.x, b.y - c.y);
    const k = Math.min(radio, la / 2, lb / 2);
    const ua = { x: (a.x - c.x) / (la || 1), y: (a.y - c.y) / (la || 1) };
    const ub = { x: (b.x - c.x) / (lb || 1), y: (b.y - c.y) / (lb || 1) };
    s.push({ in: { x: c.x + ua.x * k, y: c.y + ua.y * k }, ctrl: c, out: { x: c.x + ub.x * k, y: c.y + ub.y * k } });
  }
  let d = `M ${s[0].in.x} ${s[0].in.y}`;
  for (let i = 0; i < 3; i++) {
    d += ` Q ${s[i].ctrl.x} ${s[i].ctrl.y} ${s[i].out.x} ${s[i].out.y}`;
    const nx = s[(i + 1) % 3];
    d += ` L ${nx.in.x} ${nx.in.y}`;
  }
  return d + ' Z';
};

const tr_puntoEnElipse = (el, dim, angGrados, factorE = 1) => {
  const erx = (el.rx ?? 0.08) * dim.w * factorE;
  const ery = (el.ry ?? 0.08) * dim.h * factorE;
  const rad = angGrados * Math.PI / 180;
  return { x: el.x * dim.w + Math.cos(rad) * erx, y: el.y * dim.h + Math.sin(rad) * ery };
};

const tr_interseccionLineaElipse = (de, hacia, dim) => {
  const dx = (hacia.x - de.x) * dim.w, dy = (hacia.y - de.y) * dim.h;
  const arx = (de.rx ?? 0.08) * dim.w, ary = (de.ry ?? 0.08) * dim.h;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001 || arx <= 0.001 || ary <= 0.001) return null;
  const t = 1 / Math.sqrt(Math.pow(dx / arx, 2) + Math.pow(dy / ary, 2));
  return { x: de.x * dim.w + dx * t, y: de.y * dim.h + dy * t };
};

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
  const [tiroAreaCount, setTiroAreaCount] = useState(0);
  const [rivalTiroDerechaCount, setRivalTiroDerechaCount] = useState(0);
  const [rivalTiroAreaCount, setRivalTiroAreaCount] = useState(0);
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
  const [perdidasCount, setPerdidasCount] = useState(0);
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
  const [golesRivalList, setGolesRivalList] = useState([]);
  const [fromRival, setFromRival] = useState(false);
  const [periodo, setPeriodo] = useState('1ª PARTE');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [playerStatus, setPlayerStatus] = useState('titular');
  const [players, setPlayers] = useState(defaultPlayersList());
  const [alineacionError, setAlineacionError] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInterval, setTimerInterval] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [sustituciones, setSustituciones] = useState([]);
  const [resumenFiltro, setResumenFiltro] = useState('PROPIO');
  const [contadorWarning, setContadorWarning] = useState(false);
  const [igualarAviso, setIgualarAviso] = useState(false);
  const [posesionMatchIds, setPosesionMatchIds] = useState([]);
  const [posesionDropdownOpen, setPosesionDropdownOpen] = useState(false);
  const [hiddenLines, setHiddenLines] = useState({});
  const [hiddenPoseRows, setHiddenPoseRows] = useState(new Set());

  useEffect(() => {
    if (!posesionDropdownOpen) return;
    const handler = () => setPosesionDropdownOpen(false);
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [posesionDropdownOpen]);
  const [dataLoadedId, setDataLoadedId] = useState(null);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoFileName, setVideoFileName] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoTimeOffset, setVideoTimeOffset] = useState(null);
  const [videoTimeOffset2, setVideoTimeOffset2] = useState(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const videoRef = useRef(null);
  const [corteSegundos, setCorteSegundos] = useState(15);
  const [filtroAccion, setFiltroAccion] = useState('');
  const [corteError, setCorteError] = useState('');
  const [cortandoTodos, setCortandoTodos] = useState(false);
  const SERVER_URL = 'http://localhost:3001';

  const [servidorCortesDisponible, setServidorCortesDisponible] = useState(null);
  const [accionSeleccionada, setAccionSeleccionada] = useState(null);
  const [corteInicio, setCorteInicio] = useState(0);
  const [corteFin, setCorteFin] = useState(15);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewNombres, setPreviewNombres] = useState([]);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const [ajusteAcciones, setAjusteAcciones] = useState({});
  const [ajusteAccionesFin, setAjusteAccionesFin] = useState({});
  const [previewAccion, setPreviewAccion] = useState(null);
  const [generandoAccion, setGenerandoAccion] = useState(null);
  const [progresoAccion, setProgresoAccion] = useState({});
  const [variosIndex, setVariosIndex] = useState(-1);
  const [variosBaseTimes, setVariosBaseTimes] = useState({});
  const [trackingMode, setTrackingMode] = useState(false);
  const [trackingModel, setTrackingModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [trailPoints, setTrailPoints] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const trailCanvasRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const trailStartRef = useRef(null);
  const lastDetectedRef = useRef(null);

  // Treatment app states (prefixed with tr_)
  const [tr_archivo, setTr_archivo] = useState(null);
  const [tr_videoUrl, setTr_videoUrl] = useState('');
  const [tr_isFullscreen, setTr_isFullscreen] = useState(false);
  const [tr_hoja, setTr_hoja] = useState('Presentación');
  const [tr_progreso, setTr_progreso] = useState(0);
  const [tr_duracion, setTr_duracion] = useState(0);
  const [tr_reproduciendo, setTr_reproduciendo] = useState(false);
  const [tr_capturas, setTr_capturas] = useState([]);
  const [tr_capturaSeleccionada, setTr_capturaSeleccionada] = useState(null);
  const [tr_capturaGuardada, setTr_capturaGuardada] = useState(null);
  const [tr_figuras, setTr_figuras] = useState([]);
  const [tr_figuraSeleccionada, setTr_figuraSeleccionada] = useState(null);
  const [tr_imgDim, setTr_imgDim] = useState(null);
  const [tr_clipActivo, setTr_clipActivo] = useState(null);
  const [tr_aviso, setTr_aviso] = useState(null);
  const [tr_exportando, setTr_exportando] = useState(false);
  const [tr_progresoVideo, setTr_progresoVideo] = useState(0);
  const [tr_abrirCarpetaAlOK, setTr_abrirCarpetaAlOK] = useState(false);
  const [tr_modoPolilinea, setTr_modoPolilinea] = useState(false);
  const [tr_puntosPolilinea, setTr_puntosPolilinea] = useState([]);
  const [tr_cortes, setTr_cortes] = useState([]);
  const [tr_modoCorte, setTr_modoCorte] = useState(false);
  const [tr_modoCirculoClick, setTr_modoCirculoClick] = useState(false);
  const [tr_modoFlechaClick, setTr_modoFlechaClick] = useState(false);
  const tr_flechaOrigenRef = useRef(null);
  const tr_elipsesSessionRef = useRef([]);
  const tr_videoRef = useRef(null);
  const tr_draggingRef = useRef(false);
  const tr_clipRef = useRef(null);
  const tr_clipTimerRef = useRef(null);
  const tr_prevTiempoRef = useRef(0);
  const tr_circuloAnimRef = useRef(null);
  const tr_lineaAnimRef = useRef(null);
  const tr_flechaAnimRef = useRef(null);
  const tr_triAnimRef = useRef(null);
  const tr_triAnimStartRef = useRef(0);
  const tr_triAnimPausedAtRef = useRef(0);
  const tr_triAnimElapsedRef = useRef(0);
  const tr_triAnimIdRef = useRef(null);
  const tr_circuitoAnimRef = useRef(null);
  const tr_svgRef = useRef(null);
  const tr_dragRef = useRef(null);

  const tr_colores = ['#38bdf8', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#facc15', '#ffffff'];
  const tr_hojas = ['Presentación', 'Edición'];

  useEffect(() => {
    fetch(SERVER_URL + '/api/cortar')
      .then(r => r.json())
      .then(d => setServidorCortesDisponible(d.ok === true))
      .catch(() => setServidorCortesDisponible(false));
  }, []);

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
    setGolesRivalList([]);
    setPlayers(defaultPlayersList());
    setTimerSeconds(0);
    setTimerRunning(false);
    setActionLog([]);
    setSustituciones([]);
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
    const logAcciones = {};
    normalizeArray(match.actionLog).forEach(e => {
      if (e && e.type === 'accion' && !['1ª PARTE', '2ª PARTE', 'FIN'].includes(e.name)) {
        logAcciones[e.name] = (logAcciones[e.name] || 0) + 1;
      }
    });
    setTiroDerechaCount(Math.max(match.tiroDerechaCount ?? 0, logAcciones['TIRO DERECHA'] || 0));
    setTiroAreaCount(Math.max(match.tiroAreaCount ?? 0, logAcciones['TIRO AREA'] || 0));
    setRivalTiroDerechaCount(Math.max(match.rivalTiroDerechaCount ?? 0, logAcciones['RIVAL TIRO DERECHA'] || 0));
    setRivalTiroAreaCount(Math.max(match.rivalTiroAreaCount ?? 0, logAcciones['RIVAL TIRO AREA'] || 0));
    setTiroIzquierdaCount(Math.max(match.tiroIzquierdaCount ?? 0, logAcciones['TIRO IZQUIERDA'] || 0));
    setTiroFrontalCount(Math.max(match.tiroFrontalCount ?? 0, logAcciones['TIRO FRONTAL'] || 0));
    setFaltaDerechaCount(Math.max(match.faltaDerechaCount ?? 0, logAcciones['FALTA DERECHA'] || 0));
    setFaltaIzquierdaCount(Math.max(match.faltaIzquierdaCount ?? 0, logAcciones['FALTA IZQUIERDA'] || 0));
    setFaltaFrontalCount(Math.max(match.faltaFrontalCount ?? 0, logAcciones['FALTA FRONTAL'] || 0));
    setCentroDerechaCount(Math.max(match.centroDerechaCount ?? 0, logAcciones['CENTRO DERECHA'] || 0));
    setCentroIzquierdaCount(Math.max(match.centroIzquierdaCount ?? 0, logAcciones['CENTRO IZQUIERDA'] || 0));
    setCornerIzquierdaCount(Math.max(match.cornerIzquierdaCount ?? 0, logAcciones['CORNER IZQUIERDA'] || 0));
    setCornerDerechaCount(Math.max(match.cornerDerechaCount ?? 0, logAcciones['CORNER DERECHA'] || 0));
    setRivalTiroIzquierdaCount(Math.max(match.rivalTiroIzquierdaCount ?? 0, logAcciones['RIVAL TIRO IZQUIERDA'] || 0));
    setRivalTiroFrontalCount(Math.max(match.rivalTiroFrontalCount ?? 0, logAcciones['RIVAL TIRO FRONTAL'] || 0));
    setRivalFaltaDerechaCount(Math.max(match.rivalFaltaDerechaCount ?? 0, logAcciones['RIVAL FALTA DERECHA'] || 0));
    setRivalFaltaIzquierdaCount(Math.max(match.rivalFaltaIzquierdaCount ?? 0, logAcciones['RIVAL FALTA IZQUIERDA'] || 0));
    setRivalFaltaFrontalCount(Math.max(match.rivalFaltaFrontalCount ?? 0, logAcciones['RIVAL FALTA FRONTAL'] || 0));
    setRivalCentroDerechaCount(Math.max(match.rivalCentroDerechaCount ?? 0, logAcciones['RIVAL CENTRO DERECHA'] || 0));
    setRivalCentroIzquierdaCount(Math.max(match.rivalCentroIzquierdaCount ?? 0, logAcciones['RIVAL CENTRO IZQUIERDA'] || 0));
    setRivalCornerIzquierdaCount(Math.max(match.rivalCornerIzquierdaCount ?? 0, logAcciones['RIVAL CORNER IZQUIERDA'] || 0));
    setRivalCornerDerechaCount(Math.max(match.rivalCornerDerechaCount ?? 0, logAcciones['RIVAL CORNER DERECHA'] || 0));
    setInicioPropioCount(Math.max(match.inicioPropioCount ?? 0, logAcciones['INICIO PROPIO'] || 0));
    setInicioRivalCount(Math.max(match.inicioRivalCount ?? 0, logAcciones['INICIO RIVAL'] || 0));
    setOnRivalCount(Math.max(match.onRivalCount ?? 0, logAcciones['ON RIVAL'] || 0));
    setOffRivalCount(Math.max(match.offRivalCount ?? 0, logAcciones['OFF RIVAL'] || 0));
    setOnNeutroCount(Math.max(match.onNeutroCount ?? 0, logAcciones['ON NEUTRO'] || 0, logAcciones['ON PROPIO'] || 0));
    setOffNeutroCount(Math.max(match.offNeutroCount ?? 0, logAcciones['OFF NEUTRO'] || 0, logAcciones['OFF PROPIO'] || 0));
    setPerdidasCount(Math.max(match.perdidasCount ?? 0, logAcciones['PÉRDIDAS'] || 0));
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
    setGolesRivalList(normalizeArray(match.golesRivalList));
    setPlayers(match.players ? normalizeArray(match.players) : defaultPlayersList());
    setTimerSeconds(match.timerSeconds ?? 0);
    setTimerRunning(match.timerRunning ?? false);
    setActionLog(normalizeArray(match.actionLog));
    setSustituciones(normalizeArray(match.sustituciones));
    setCurrentMatch(match);
  };

  const saveMatchData = async (id) => {
    const matchRef = ref(db, `matches/${id}`);
    await update(matchRef, {
      tiroDerechaCount,
      tiroAreaCount,
      rivalTiroDerechaCount,
      rivalTiroAreaCount,
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
      perdidasCount,
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
      golesRivalList,
      players,
      timerSeconds,
      timerRunning,
      actionLog,
      sustituciones
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
  }, [currentMatch, tiroDerechaCount, tiroAreaCount, rivalTiroDerechaCount, rivalTiroAreaCount, tiroIzquierdaCount, tiroFrontalCount, faltaDerechaCount, faltaIzquierdaCount, faltaFrontalCount, centroDerechaCount, centroIzquierdaCount, cornerIzquierdaCount, cornerDerechaCount, rivalTiroIzquierdaCount, rivalTiroFrontalCount, rivalFaltaDerechaCount, rivalFaltaIzquierdaCount, rivalFaltaFrontalCount, rivalCentroDerechaCount, rivalCentroIzquierdaCount, rivalCornerIzquierdaCount, rivalCornerDerechaCount, inicioPropioCount, inicioRivalCount, onRivalCount, offRivalCount, onNeutroCount, offNeutroCount, perdidasCount, fueraCount, blocajeCount, despejeDefensaCount, despejePorteroCount, golCount, golRivalCount, penalCount, saqueEsquinaFueraCount, infraccionCount, ocasionCount, golesList, golesRivalList, players, timerSeconds, timerRunning, actionLog, sustituciones]);

  const generarTodosLosCortes = async () => {
    if (!videoFile) {
      setCorteError('Selecciona primero el archivo de vídeo');
      return;
    }
    const excludedNames = ['1ª PARTE', '2ª PARTE', 'FIN'];
    const acciones = actionLog.filter(e => e && e.time && e.type !== 'finalizacion' && !excludedNames.includes(e.name) && (filtroAccion === '' || e.name === filtroAccion));
    if (acciones.length === 0) {
      setCorteError('No hay acciones registradas para cortar');
      return;
    }
    setCorteError('');
    setCortandoTodos(true);
    try {
      const base = videoFileName.replace(/\.[^.]+$/, '') || 'partido';
      const offsetSecs = videoTimeOffset2 != null ? Math.floor(videoTimeOffset2) : (videoTimeOffset != null ? Math.floor(videoTimeOffset) : 0);
      const cortes = acciones.map(e => {
        const parts = String(e.time).split(':').map(Number);
        const actionSecs = (parts[0] || 0) * 60 + (parts[1] || 0);
        const ajuste = ajusteAcciones[e.name + '_' + e.time] || 0;
        const ajusteFin = ajusteAccionesFin[e.name + '_' + e.time] || 0;
        const totalSecs = Math.max(0, actionSecs + offsetSecs + ajuste);
        const finSecs = totalSecs + 5 + ajusteFin;
        const duracion = Math.max(1, finSecs - totalSecs);
        const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const ss = String(totalSecs % 60).padStart(2, '0');
        const adjustedTime = `${mm}:${ss}`;
        return { time: adjustedTime, name: `${base}_corte_${adjustedTime}`, duracion: String(duracion) };
      });
      if (servidorCortesDisponible) {
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('cortes', JSON.stringify(cortes));
        const resp = await fetch(SERVER_URL + '/api/cortar', { method: 'POST', body: formData });
        if (!resp.ok) { const errData = await resp.json().catch(() => ({})); throw new Error(errData.error || 'Error en el servidor'); }
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/zip')) {
          const zipBlob = await resp.blob();
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${base}_cortes.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
        } else {
          const videoBlob = await resp.blob();
          const url = URL.createObjectURL(videoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = cortes[0].name + '.mp4';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
        }
      } else {
        const results = await cutVideoMultiple(videoFile, cortes, (p) => setCorteProgress(p));
        if (results.length === 1) {
          const url = URL.createObjectURL(results[0].blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = results[0].name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
        } else {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          for (const r of results) zip.file(r.name, r.blob);
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${base}_cortes.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
        }
      }
    } catch (err) {
      console.error('Error cortes:', err);
      setCorteError('Error: ' + (err.message || err));
    } finally {
      setCortandoTodos(false);
    }
  };

  const generarPreviewCorte = async () => {
    if (!videoFile) {
      setCorteError('Selecciona primero el archivo de vídeo');
      return;
    }
    const excludedNames = ['1ª PARTE', '2ª PARTE', 'FIN'];
    const acciones = actionLog.filter(e => e && e.time && e.type !== 'finalizacion' && !excludedNames.includes(e.name) && (filtroAccion === '' || e.name === filtroAccion));
    if (acciones.length === 0) {
      setCorteError('No hay acciones para generar');
      return;
    }
    setGenerandoPreview(true);
    setCorteError('');
    try {
      const base = videoFileName.replace(/\.[^.]+$/, '') || 'partido';
      const offsetSecs = videoTimeOffset2 != null ? Math.floor(videoTimeOffset2) : (videoTimeOffset != null ? Math.floor(videoTimeOffset) : 0);
      const cortes = acciones.map(e => {
        const parts = String(e.time).split(':').map(Number);
        const actionSecs = (parts[0] || 0) * 60 + (parts[1] || 0);
        const ajuste = ajusteAcciones[e.name + '_' + e.time] || 0;
        const ajusteFin = ajusteAccionesFin[e.name + '_' + e.time] || 0;
        const totalSecs = Math.max(0, actionSecs + offsetSecs - 2 + ajuste);
        const finSecs = totalSecs + 5 + ajusteFin;
        const duracion = Math.max(1, finSecs - totalSecs);
        const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const ss = String(totalSecs % 60).padStart(2, '0');
        const adjustedTime = `${mm}:${ss}`;
        return { time: adjustedTime, name: `${base}_corte_${adjustedTime}`, actionName: e.name, duracion: String(duracion) };
      });
      const nameCount = {};
      const nombres = cortes.map(c => {
        nameCount[c.actionName] = (nameCount[c.actionName] || 0) + 1;
        const count = nameCount[c.actionName];
        const total = acciones.filter(a => a.name === c.actionName).length;
        return total > 1 ? `${c.actionName} ${count}` : c.actionName;
      });
      const results = await cutVideoMultiple(videoFile, cortes);
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const r of results) zip.file(r.name, r.blob);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
      setPreviewVideoUrl(URL.createObjectURL(zipBlob));
      setPreviewNombres(nombres);
    } catch (err) {
      console.error('Error preview:', err);
      setCorteError('Error: ' + (err.message || err));
    } finally {
      setGenerandoPreview(false);
    }
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

  const parseTime = (str) => {
    const [m, s] = str.split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
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
      'TIRO AREA': setTiroAreaCount,
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
      'RIVAL TIRO AREA': setRivalTiroAreaCount,
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
      'ON PROPIO': setOnNeutroCount,
      'OFF RIVAL': setOffRivalCount,
      'OFF NEUTRO': setOffNeutroCount,
      'OFF PROPIO': setOffNeutroCount,
      'PÉRDIDAS': setPerdidasCount,
      'OCASION': setOcasionCount,
      'FUERA': setFueraCount,
      'BLOCAJE': setBlocajeCount,
      'DESPEJE DEFENSA': setDespejeDefensaCount,
      'DESPEJE PORTERO': setDespejePorteroCount,
      'SAQUE DE ESQUINA': setSaqueEsquinaFueraCount,
      'GOL': setGolCount,
      'GOL RIVAL': setGolRivalCount,
      'PENAL + FUERA': setPenalCount,
      'PENAL + GOL': setPenalCount,
      'PENAL + GOL RIVAL': setPenalCount,
      'INFRACCION': setInfraccionCount
    };
    const setter = map[name];
    if (setter) {
      setter(prev => Math.max(0, prev - 1));
    }
    if (name === 'GOL' || name === 'PENAL + GOL') {
      setGolesList(prev => prev.slice(0, -1));
    }
    if (name === 'GOL RIVAL' || name === 'PENAL + GOL RIVAL') {
      setGolesRivalList(prev => prev.slice(0, -1));
    }
    if (name === 'PENAL + GOL RIVAL') {
      setGolRivalCount(prev => Math.max(0, prev - 1));
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

  const handleResetContador = () => {
    setTimerSeconds(0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) v.play(); else v.pause();
        }
      }
      if (e.code === 'Home' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) v.currentTime = Math.max(0, v.currentTime - 5);
      }
      if (e.code === 'End' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
      }
      if (e.code === 'ArrowRight' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
      }
      if (e.code === 'ArrowLeft' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) v.currentTime = Math.max(0, v.currentTime - 5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const loadTrackingModel = async () => {
    if (trackingModel) return trackingModel;
    setModelLoading(true);
    try {
      await tf.ready();
      const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      setTrackingModel(model);
      setModelLoading(false);
      return model;
    } catch (e) {
      console.error('Error loading model:', e);
      setModelLoading(false);
      return null;
    }
  };

  const startTracking = async (clickX, clickY) => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { try { await video.play(); } catch (e) { /* noop */ } }
    const model = trackingModel || await loadTrackingModel();
    if (!model) return;
    const predictions = await model.detect(video);
    const persons = predictions.filter(p => p.class === 'person');
    if (persons.length === 0) { setTrackingMode(false); return; }
    let best = persons[0];
    let bestDist = Infinity;
    const videoRect = video.getBoundingClientRect();
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;
    const absX = clickX * scaleX;
    const absY = clickY * scaleY;
    for (const p of persons) {
      const cx = p.bbox[0] + p.bbox[2] / 2;
      const cy = p.bbox[1] + p.bbox[3] / 2;
      const dist = Math.sqrt((cx - absX) ** 2 + (cy - absY) ** 2);
      if (dist < bestDist) { bestDist = dist; best = p; }
    }
    const cx = best.bbox[0] + best.bbox[2] / 2;
    const cy = best.bbox[1] + best.bbox[3] / 2;
    setIsTracking(true);
    trailStartRef.current = Date.now();
    lastDetectedRef.current = { x: cx, y: cy, bbox: best.bbox };
    setTrailPoints([{ x: cx, y: cy, time: Date.now(), bbox: best.bbox }]);
    trackingIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused) { stopTracking(); return; }
      const preds = await model.detect(videoRef.current);
      const ps = preds.filter(p => p.class === 'person');
      if (ps.length === 0) return;
      const prev = lastDetectedRef.current;
      let closest = ps[0];
      let closestDist = Infinity;
      for (const p of ps) {
        const pcx = p.bbox[0] + p.bbox[2] / 2;
        const pcy = p.bbox[1] + p.bbox[3] / 2;
        const d = prev ? Math.sqrt((pcx - prev.x) ** 2 + (pcy - prev.y) ** 2) : 0;
        if (d < closestDist) { closestDist = d; closest = p; }
      }
      const ncx = closest.bbox[0] + closest.bbox[2] / 2;
      const ncy = closest.bbox[1] + closest.bbox[3] / 2;
      lastDetectedRef.current = { x: ncx, y: ncy, bbox: closest.bbox };
      setTrailPoints(prev => [...prev, { x: ncx, y: ncy, time: Date.now(), bbox: closest.bbox }]);
      if (Date.now() - trailStartRef.current >= 2000) stopTracking();
    }, 150);
  };

  const stopTracking = () => {
    if (trackingIntervalRef.current) { clearInterval(trackingIntervalRef.current); trackingIntervalRef.current = null; }
    setIsTracking(false);
  };

  useEffect(() => {
    const canvas = trailCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || trailPoints.length === 0) return;
    const ctx = canvas.getContext('2d');
    const draw = () => {
      const rect = video.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      if (trailPoints.length > 1) {
        for (let i = 1; i < trailPoints.length; i++) {
          const alpha = 0.3 + 0.7 * (i / trailPoints.length);
          ctx.beginPath();
          ctx.moveTo(trailPoints[i - 1].x * scaleX, trailPoints[i - 1].y * scaleY);
          ctx.lineTo(trailPoints[i].x * scaleX, trailPoints[i].y * scaleY);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 4;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
      const last = trailPoints[trailPoints.length - 1];
      if (last && last.bbox) {
        const bx = last.bbox[0] * scaleX;
        const by = last.bbox[1] * scaleY;
        const bw = last.bbox[2] * scaleX;
        const bh = last.bbox[3] * scaleY;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fillRect(bx, by, bw, bh);
      }
    };
    let animId;
    const loop = () => { draw(); animId = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [trailPoints]);

  useEffect(() => {
    return () => { if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current); };
  }, []);

  // Treatment app functions

  useEffect(() => () => { if (tr_clipTimerRef.current) clearTimeout(tr_clipTimerRef.current); }, []);

  useEffect(() => {
    const onFsChange = () => {
      const v = tr_videoRef.current;
      if (v && document.fullscreenElement === v) {
        document.exitFullscreen();
        const container = document.getElementById('tr-video-container');
        if (container) container.requestFullscreen();
        return;
      }
      if (!document.fullscreenElement) {
        setTr_isFullscreen(false);
        if (v) { v.style.maxHeight = '60vh'; v.style.borderRadius = '12px'; v.style.border = '1px solid #334155'; }
      } else {
        setTr_isFullscreen(true);
        if (v) { v.style.maxHeight = '100vh'; v.style.borderRadius = '0'; v.style.border = 'none'; }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Del') && tr_figuraSeleccionada) {
        setTr_figuras(prev => prev.filter(f => f.id !== tr_figuraSeleccionada));
        setTr_figuraSeleccionada(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tr_figuraSeleccionada]);

  const tr_handleFile = (e) => {
    const f = e.target.files[0] || null;
    if (tr_videoUrl) URL.revokeObjectURL(tr_videoUrl);
    setTr_archivo(f);
    setTr_videoUrl(f ? URL.createObjectURL(f) : '');
    setTr_progreso(0);
  };

  const tr_formatoTiempo = (s, dec = 2) => {
    const frac = (s % 1).toFixed(dec).slice(1);
    return `${String(Math.floor(s)).padStart(2, '0')}${frac}`;
  };

  const tr_periodo = 0;
  const tr_tActual = tr_videoRef.current ? tr_videoRef.current.currentTime : 0;
  const tr_inicioVentana = 0;
  const tr_finVentana = tr_duracion;
  const tr_span = tr_duracion || 1;

  const tr_totalDuracion = tr_duracion + tr_capturas.filter(c => c.videoUrl && c.insertarEn != null).reduce((sum, c) => sum + (c.duracion || 4), 0);

  const tr_togglePlay = () => {
    if (tr_clipActivo) {
      const c = tr_clipRef.current;
      const v = tr_videoRef.current;
      if (!c) { setTr_clipActivo(null); return; }
      if (c.paused) { c.play().catch(() => {}); if (v) v.play().catch(() => {}); }
      else { c.pause(); if (v) v.pause(); }
      return;
    }
    const v = tr_videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const tr_buscarEnTimeline = (e) => {
    const video = tr_videoRef.current;
    if (!video || !tr_duracion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const t = x * tr_duracion;
    if (tr_modoCorte) {
      const existe = tr_cortes.some(c => Math.abs(c - t) < 0.3);
      if (existe) return;
      setTr_cortes(prev => [...prev, t].sort((a, b) => a - b));
      setTr_aviso(`Corte en ${tr_formatoTiempo(t)}`);
      return;
    }
    setTr_clipActivo(null);
    if (tr_clipTimerRef.current) { clearTimeout(tr_clipTimerRef.current); tr_clipTimerRef.current = null; }
    tr_prevTiempoRef.current = t;
    video.currentTime = t;
    setTr_progreso(x);
  };

  const tr_exportarVideo = async () => {
    const original = tr_videoRef.current;
    if (!original || !tr_duracion) return;
    setTr_exportando(true);
    try {
      const w = original.videoWidth || 640;
      const h = original.videoHeight || 360;
      const clips = tr_capturas.filter(c => c.videoUrl && c.insertarEn != null).sort((a, b) => a.insertarEn - b.insertarEn);

      const tempImgDim = { w, h };

      const buildFiguresSvg = () => {
        if (tr_figuras.length === 0) return null;
        const parts = tr_figuras.map(f => tr_svgFigura(f, tempImgDim)).filter(Boolean);
        if (parts.length === 0) return null;
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
      };

      const svgUrl = buildFiguresSvg();
      let figuresImg = null;
      if (svgUrl) {
        figuresImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(svgUrl); resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); };
          img.src = svgUrl;
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      const orig = document.createElement('video');
      orig.muted = true;
      orig.playsInline = true;
      orig.preload = 'auto';
      orig.src = tr_videoUrl;

      await new Promise((res, rej) => { orig.onloadedmetadata = res; orig.onerror = rej; });

      const clipEls = clips.map(c => {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.src = c.videoUrl;
        return { c, v };
      });
      await Promise.all(clipEls.map(({ v }) => new Promise((res) => { v.onloadedmetadata = res; v.onerror = res; })));

      let activeClip = null;
      let clipStartTime = 0;
      let clipIdx = 0;
      let raf = 0;
      let terminado = false;

      const drawFrame = () => {
        ctx.drawImage(orig, 0, 0, w, h);
        if (activeClip) {
          ctx.drawImage(activeClip, 0, 0, w, h);
        }
        if (figuresImg) {
          ctx.drawImage(figuresImg, 0, 0, w, h);
        }
      };

      const terminar = async (error) => {
        if (terminado) return;
        terminado = true;
        cancelAnimationFrame(raf);
        try { rec.stop(); } catch (e) { /* noop */ }
        setTr_exportando(false);
        if (error) { setTr_aviso('Error al exportar el video'); return; }
        await new Promise(res => { rec.onstop = res; });
        const blob = new Blob(chunks, { type: mime });
        try {
          const resp = await fetch('/export-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: blob
          });
          const data = await resp.json();
          if (data.ok) {
            setTr_aviso(`Video exportado a C:\\Users\\uSer\\Videos\\${data.name}`);
            setTr_abrirCarpetaAlOK(true);
          } else {
            setTr_aviso(`Error al exportar: ${data.error || 'desconocido'}`);
          }
        } catch (e) {
          setTr_aviso('Error al exportar: ' + String(e));
        }
      };

      const loop = () => {
        const t = orig.currentTime;
        if (!activeClip && clipIdx < clipEls.length && t >= clipEls[clipIdx].c.insertarEn) {
          activeClip = clipEls[clipIdx].v;
          clipStartTime = t;
          activeClip.currentTime = 0;
          activeClip.play().catch(() => {});
        }
        if (activeClip && (t - clipStartTime) >= (clipEls[clipIdx].c.duracion || 4)) {
          activeClip.pause();
          activeClip = null;
          clipIdx++;
        }
        drawFrame();
        if (!terminado) raf = requestAnimationFrame(loop);
      };

      orig.addEventListener('ended', () => terminar(false));
      orig.addEventListener('error', () => terminar(true));

      rec.start(250);
      loop();
      await orig.play();
    } catch (e) {
      setTr_exportando(false);
      setTr_aviso('Error al exportar el video');
    }
  };

  const tr_capturarImagen = () => {
    const v = tr_videoRef.current;
    if (!v) return;
    v.pause();
    setTr_reproduciendo(false);
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setTr_capturas(prev => [...prev, { id: Date.now(), dataUrl: canvas.toDataURL('image/png'), tiempo: v.currentTime }]);
  };

  const tr_anadirTriangulo = () => {
    const id = Date.now();
    setTr_figuras(prev => [...prev, { id, tipo: 'triangulo', x: 0.5, y: 0.5, ancho: 0.06, alto: 0.35, color: '#f97316', opacidad: 0.7, crecimiento: 0 }]);
    setTr_figuraSeleccionada(id);
    if (tr_triAnimRef.current) cancelAnimationFrame(tr_triAnimRef.current);
    tr_triAnimIdRef.current = id;
    tr_triAnimElapsedRef.current = 0;
    tr_triAnimStartRef.current = performance.now();
    const paso = (t) => {
      const v = tr_videoRef.current;
      if (v && !v.paused) {
        tr_triAnimElapsedRef.current += (t - tr_triAnimStartRef.current);
      }
      tr_triAnimStartRef.current = t;
      const p = Math.min(1, tr_triAnimElapsedRef.current / 4000);
      const e = 1 - Math.pow(1 - p, 2.5);
      setTr_figuras(prev => prev.map(f => f.id === id ? { ...f, crecimiento: e } : f));
      if (p < 1) tr_triAnimRef.current = requestAnimationFrame(paso);
      else tr_triAnimRef.current = null;
    };
    tr_triAnimRef.current = requestAnimationFrame(paso);
  };

  const tr_actualizarFigura = (id, cambios) => {
    setTr_figuras(prev => prev.map(f => f.id === id ? { ...f, ...cambios } : f));
  };

  const tr_anadirCircuito = () => {
    const id = Date.now();
    const final = [{ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 }, { x: 0.8, y: 0.5 }];
    const cx = 0.5, cy = 0.5;
    setTr_figuras(prev => [...prev, { id, tipo: 'circuito', elipses: final.map(() => ({ x: cx, y: cy, rx: 0, ry: 0 })), color: '#38bdf8', opacidad: 1, grosor: 0.005 }]);
    setTr_figuraSeleccionada(id);
    if (tr_circuitoAnimRef.current) cancelAnimationFrame(tr_circuitoAnimRef.current);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = 1 - Math.pow(1 - p, 3);
      setTr_figuras(prev => prev.map(f => {
        if (f.id !== id) return f;
        return { ...f, elipses: final.map((fin, i) => ({ x: cx + (fin.x - cx) * e, y: cy + (fin.y - cy) * e, rx: 0.08 * e, ry: 0.08 * e })) };
      }));
      if (p < 1) tr_circuitoAnimRef.current = requestAnimationFrame(paso);
      else tr_circuitoAnimRef.current = null;
    };
    tr_circuitoAnimRef.current = requestAnimationFrame(paso);
  };

  const tr_anadirCirculo = () => {
    const id = Date.now();
    setTr_figuras(prev => [...prev, { id, tipo: 'circulo', x: 0.5, y: 0.5, ancho: 0.2, alto: 0.2, color: '#38bdf8', opacidad: 0.5, crecimiento: 0 }]);
    setTr_figuraSeleccionada(id);
  };

  const tr_anadirTexto = () => {
    const id = Date.now();
    setTr_figuras(prev => [...prev, { id, tipo: 'texto', x: 0.5, y: 0.5, fontSize: 0.06, color: '#ffffff', opacidad: 1, texto: 'Texto' }]);
    setTr_figuraSeleccionada(id);
  };

  const tr_anadirLinea = () => {
    const id = Date.now();
    const x1 = 0.3;
    const y1 = 0.5;
    const x2 = 0.7;
    const y2 = 0.5;
    setTr_figuras(prev => [...prev, { id, tipo: 'linea', x1, y1, x2: x1, y2: y1, color: '#38bdf8', opacidad: 1, grosor: 0.005 }]);
    setTr_figuraSeleccionada(id);
    if (tr_lineaAnimRef.current) cancelAnimationFrame(tr_lineaAnimRef.current);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = 1 - Math.pow(1 - p, 3);
      setTr_figuras(prev => prev.map(f => f.id === id ? { ...f, x2: x1 + (x2 - x1) * e, y2: y1 + (y2 - y1) * e } : f));
      if (p < 1) tr_lineaAnimRef.current = requestAnimationFrame(paso);
      else tr_lineaAnimRef.current = null;
    };
    tr_lineaAnimRef.current = requestAnimationFrame(paso);
  };

  const tr_anadirFlecha = () => {
    const id = Date.now();
    const x1 = 0.25;
    const y1 = 0.5;
    const x2 = 0.75;
    const y2 = 0.5;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    setTr_figuras(prev => [...prev, { id, tipo: 'flecha', x1, y1, x2, y2, cx, cy, color: '#38bdf8', opacidad: 1, grosor: 0.005, discontinuo: false, cabeza: 1, crecimiento: 0 }]);
    setTr_figuraSeleccionada(id);
    if (tr_flechaAnimRef.current) cancelAnimationFrame(tr_flechaAnimRef.current);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      const e = 1 - Math.pow(1 - p, 3);
      setTr_figuras(prev => prev.map(f => f.id === id ? { ...f, crecimiento: e } : f));
      if (p < 1) tr_flechaAnimRef.current = requestAnimationFrame(paso);
      else tr_flechaAnimRef.current = null;
    };
    tr_flechaAnimRef.current = requestAnimationFrame(paso);
  };

  const tr_anadirPolilinea = () => {
    if (tr_modoPolilinea) {
      if (tr_puntosPolilinea.length >= 2) {
        const id = Date.now();
        setTr_figuras(prev => [...prev, { id, tipo: 'polilinea', puntos: tr_puntosPolilinea, color: '#38bdf8', opacidad: 1, grosor: 0.006 }]);
        setTr_figuraSeleccionada(id);
      }
      setTr_modoPolilinea(false);
      setTr_puntosPolilinea([]);
    } else {
      setTr_modoPolilinea(true);
      setTr_puntosPolilinea([]);
      setTr_figuraSeleccionada(null);
    }
  };

  const tr_puntoImagen = (e) => {
    const svg = tr_svgRef.current;
    if (!svg || !tr_imgDim) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x / tr_imgDim.w, y: p.y / tr_imgDim.h };
  };

  const tr_svgFigura = (f, dim) => {
    const e = f.crecimiento ?? 1;
    if (e <= 0.001) return '';
    const d = (dim && dim.w != null) ? dim : tr_imgDim;
    const pat = f.rayado
      ? `<defs><pattern id="rayado-${f.id}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${f.color}" strokeWidth="4"/></pattern></defs>`
      : '';
    const fill = f.sinRelleno ? 'none' : (f.rayado ? `url(#rayado-${f.id})` : f.color);
    const op = (f.opacidad ?? 0.5) * (f.tipo === 'texto' ? e : 1);
    const common = `fill="${fill}" fill-opacity="${f.sinRelleno ? 0 : op}" stroke="${f.color}" stroke-opacity="${op}" stroke-width="2"`;

    if (f.tipo === 'polilinea') {
      const pts = f.puntos || [];
      if (pts.length === 0) return '';
      const grosor = (f.grosor || 0.006) * d.h;
      const radio = Math.max(5, grosor * 1.2);
      if (pts.length === 1) {
        return `<circle cx="${pts[0].x * d.w}" cy="${pts[0].y * d.h}" r="${radio * e}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" stroke="#ffffff" stroke-width="1"/>`;
      }
      const segLengths = [];
      let totalLen = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const segLen = Math.hypot((pts[i + 1].x - pts[i].x) * d.w, (pts[i + 1].y - pts[i].y) * d.h);
        segLengths.push(segLen);
        totalLen += segLen;
      }
      const targetLen = totalLen * e;
      let accum = 0;
      const activePts = [`${pts[0].x * d.w},${pts[0].y * d.h}`];
      const activeCircs = [`<circle cx="${pts[0].x * d.w}" cy="${pts[0].y * d.h}" r="${radio * Math.min(1, e * 3)}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" stroke="#ffffff" stroke-width="1"/>`];
      for (let i = 0; i < segLengths.length; i++) {
        const seg = segLengths[i];
        if (accum + seg <= targetLen) {
          accum += seg;
          activePts.push(`${pts[i + 1].x * d.w},${pts[i + 1].y * d.h}`);
          activeCircs.push(`<circle cx="${pts[i + 1].x * d.w}" cy="${pts[i + 1].y * d.h}" r="${radio * Math.min(1, Math.max(0, (e - accum / (totalLen || 1)) * 3 + 1))}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}" stroke="#ffffff" stroke-width="1"/>`);
        } else {
          const rem = targetLen - accum;
          const frac = seg > 0 ? rem / seg : 0;
          const curX = (pts[i].x + (pts[i + 1].x - pts[i].x) * frac) * d.w;
          const curY = (pts[i].y + (pts[i + 1].y - pts[i].y) * frac) * d.h;
          activePts.push(`${curX},${curY}`);
          break;
        }
      }
      const pol = activePts.length > 1 ? `<polyline points="${activePts.join(' ')}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
      return `${pol}${activeCircs.join('')}`;
    }

    if (f.tipo === 'circuito') {
      const elipses = f.elipses || [{ x: f.x1 ?? 0.2, y: f.y1 ?? 0.5, rx: f.rx1 ?? 0.08, ry: f.ry1 ?? 0.08 }, { x: f.x2 ?? 0.8, y: f.y2 ?? 0.5, rx: f.rx2 ?? 0.08, ry: f.ry2 ?? 0.08 }];
      const grosor = (f.grosor || 0.005) * d.h;
      let parts = '';
      for (let i = 1; i < elipses.length; i++) {
        const a = elipses[i - 1], b = elipses[i];
        const tramo = (f.tramos || [])[i - 1] || {};
        const pa = tramo.angA != null ? tr_puntoEnElipse(a, d, tramo.angA) : tr_interseccionLineaElipse(a, b, d);
        const pb = tramo.angB != null ? tr_puntoEnElipse(b, d, tramo.angB) : tr_interseccionLineaElipse(b, a, d);
        if (!pa || !pb) continue;
        const lineEndX = pa.x + (pb.x - pa.x) * e;
        const lineEndY = pa.y + (pb.y - pa.y) * e;
        parts += `<line x1="${pa.x}" y1="${pa.y}" x2="${lineEndX}" y2="${lineEndY}" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"/>`;
      }
      elipses.forEach(el => {
        const ex = el.x * d.w, ey = el.y * d.h;
        const erx = (el.rx ?? 0.08) * d.w * e, ery = (el.ry ?? 0.08) * d.h * e;
        const rot = el.rot ?? 270;
        const hueco = el.hueco ?? 110;
        if (erx > 0.001 && ery > 0.001) {
          const a1 = (rot + hueco / 2) * Math.PI / 180;
          const a2 = a1 + (360 - hueco) * Math.PI / 180;
          const x1 = ex + Math.cos(a1) * erx;
          const y1 = ey + Math.sin(a1) * ery;
          const x2 = ex + Math.cos(a2) * erx;
          const y2 = ey + Math.sin(a2) * ery;
          parts += `<path d="M ${x1} ${y1} A ${erx} ${ery} 0 ${360 - hueco > 180 ? 1 : 0} 1 ${x2} ${y2}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"/>`;
        }
      });
      return parts;
    }

    if (f.tipo === 'flecha') {
      const grosor = (f.grosor || 0.005) * d.h;
      const x1 = f.x1 * d.w;
      const y1 = f.y1 * d.h;
      const x2 = f.x2 * d.w;
      const y2 = f.y2 * d.h;
      const cx = (f.cx ?? (f.x1 + f.x2) / 2) * d.w;
      const cy = (f.cy ?? (f.y1 + f.y2) / 2) * d.h;

      const qcx = (1 - e) * x1 + e * cx;
      const qcy = (1 - e) * y1 + e * cy;
      const q1x = (1 - e) * (1 - e) * x1 + 2 * (1 - e) * e * cx + e * e * x2;
      const q1y = (1 - e) * (1 - e) * y1 + 2 * (1 - e) * e * cy + e * e * y2;

      let tx = (1 - e) * (cx - x1) + e * (x2 - cx);
      let ty = (1 - e) * (cy - y1) + e * (y2 - cy);
      if (Math.hypot(tx, ty) < 1e-6) {
        tx = x2 - x1;
        ty = y2 - y1;
      }
      const ang = Math.atan2(ty, tx);
      const headScale = Math.min(1, e * 2);
      const L = grosor * 6 * headScale * (f.cabeza ?? 1);
      const a = Math.PI / 6;
      const hx1 = q1x - L * Math.cos(ang - a);
      const hy1 = q1y - L * Math.sin(ang - a);
      const hx2 = q1x - L * Math.cos(ang + a);
      const hy2 = q1y - L * Math.sin(ang + a);
      const dash = f.discontinuo ? ` stroke-dasharray="${grosor * 3},${grosor * 2}"` : '';
      const pathStr = `<path d="M ${x1} ${y1} Q ${qcx} ${qcy} ${q1x} ${q1y}" fill="none" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${grosor}" stroke-linecap="round"${dash}/>`;
      const polyStr = (headScale > 0.05 && L > 0.5) ? `<polygon points="${q1x},${q1y} ${hx1},${hy1} ${hx2},${hy2}" fill="${f.color}" fill-opacity="${f.opacidad ?? 1}"/>` : '';
      return `${pathStr}${polyStr}`;
    }

    if (f.tipo === 'linea') {
      const x1 = f.x1 * d.w, y1 = f.y1 * d.h;
      const x2 = f.x2 * d.w, y2 = f.y2 * d.h;
      const endX = x1 + (x2 - x1) * e;
      const endY = y1 + (y2 - y1) * e;
      return `<line x1="${x1}" y1="${y1}" x2="${endX}" y2="${endY}" stroke="${f.color}" stroke-opacity="${f.opacidad ?? 1}" stroke-width="${(f.grosor || 0.005) * d.h}" stroke-linecap="round"/>`;
    }

    if (f.tipo === 'texto') {
      const x = f.x * d.w;
      const y = f.y * d.h;
      const tam = (f.fontSize || 0.06) * d.h;
      const txt = String(f.texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<text x="${x}" y="${y}" font-size="${tam}" fill="${f.color}" fill-opacity="${(f.opacidad ?? 1) * e}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">${txt}</text>`;
    }

    if (f.tipo === 'triangulo') {
      const x = f.x * d.w;
      const y = f.y * d.h;
      const ancho = f.ancho * d.w;
      const alto = f.alto * d.h;
      const yBase = y + alto / 2;
      const hh = alto * e;
      const hw = (ancho / 2) * e;
      const gradientId = `pilar_${f.id}`;
      const pd = tr_pathTrianguloRedondeado({ x, y: yBase - hh }, { x: x - hw, y: yBase }, { x: x + hw, y: yBase }, Math.min(ancho, alto) * 0.12);
      return `${pat}<defs><linearGradient id="${gradientId}" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="${f.color}" stop-opacity="${f.opacidad ?? 1}"/><stop offset="100%" stop-color="${f.color}" stop-opacity="${(f.opacidad ?? 1) * 0.35}"/></linearGradient></defs><path d="${pd}" fill="url(#${gradientId})" />`;
    }

    const cx = f.x * d.w;
    const cy = f.y * d.h;
    const rx = (f.ancho * d.w / 2) * e;
    const ry = (f.alto * d.h / 2) * e;
    if (rx <= 0.001 || ry <= 0.001) return '';
    return `${pat}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${common}/>`;
  };

  const tr_generarVideo = (svgFn, w, h, onProgress) => new Promise((resolve, reject) => {
    try {
      const totalFrames = 120;
      const frameDuration = 1000 / 30;
      const promises = [];
      for (let i = 0; i <= totalFrames; i++) {
        const t = Math.min(4000, i * 33);
        const svgStr = svgFn(t);
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        promises.push(new Promise((res) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); res(img); };
          img.onerror = () => { URL.revokeObjectURL(url); res(null); };
          img.src = url;
        }));
      }
      Promise.all(promises).then((frames) => {
        if (onProgress) onProgress(20);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(30);
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          if (onProgress) onProgress(100);
          resolve(URL.createObjectURL(new Blob(chunks, { type: mime })));
        };
        rec.onerror = reject;
        rec.start();
        let idx = 0;
        const drawNext = () => {
          if (idx < frames.length && frames[idx]) {
            ctx.drawImage(frames[idx], 0, 0, w, h);
          }
          idx++;
          if (onProgress && idx % 10 === 0) onProgress(20 + Math.round((idx / frames.length) * 80));
          if (idx < frames.length) {
            setTimeout(drawNext, frameDuration);
          } else {
            if (onProgress) onProgress(95);
            try { rec.stop(); } catch (e) { reject(e); }
          }
        };
        drawNext();
      }).catch(reject);
    } catch (e) {
      reject(e);
    }
  });

  const tr_animarElipses = async () => {
    if (!tr_capturaSeleccionada || !tr_imgDim || tr_figuras.length === 0) return;
    setTr_exportando(true);
    try {
      const w = tr_imgDim.w;
      const h = tr_imgDim.h;
      const totalFrames = 120;

      const frameImages = [];
      for (let i = 0; i <= totalFrames; i++) {
        const t = i / totalFrames;
        const p = Math.min(1, Math.max(0, (t * 4000 - 200) / 3600));
        const e = 1 - Math.pow(1 - p, 3);
        const figAnim = tr_figuras.map(f => ({ ...f, crecimiento: e }));
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image href="${tr_capturaSeleccionada.dataUrl}" width="${w}" height="${h}"/>${figAnim.map(f => tr_svgFigura(f, { w, h })).join('')}</svg>`;
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = await new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => { URL.revokeObjectURL(url); res(im); };
          im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('SVG load error')); };
          im.src = url;
        });
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0, w, h);
        frameImages.push(cx.getImageData(0, 0, w, h));
      }

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(0);
      const videoTrack = stream.getVideoTracks()[0];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `animacion.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setTr_exportando(false);
      };

      rec.start();
      const frameMs = 1000 / 30;
      let frameIdx = 0;

      const iv = setInterval(() => {
        if (frameIdx < frameImages.length) {
          ctx.putImageData(frameImages[frameIdx], 0, 0);
          videoTrack.requestFrame();
          frameIdx++;
        } else if (frameIdx === frameImages.length) {
          frameIdx++;
          ctx.putImageData(frameImages[frameImages.length - 1], 0, 0);
          videoTrack.requestFrame();
        } else {
          clearInterval(iv);
          ctx.putImageData(frameImages[frameImages.length - 1], 0, 0);
          videoTrack.requestFrame();
          setTimeout(() => {
            try { rec.stop(); } catch (e) { setTr_exportando(false); }
          }, 500);
        }
      }, frameMs);
      setTimeout(() => { try { if (rec.state === 'recording') rec.stop(); } catch (e) {} }, 15000);
    } catch (e) {
      setTr_exportando(false);
    }
  };

  const tr_guardarCaptura = async () => {
    if (!tr_capturaSeleccionada || !tr_imgDim || tr_exportando) return;
    setTr_exportando(true);
    setTr_progresoVideo(0);
    try {
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${tr_imgDim.w}" height="${tr_imgDim.h}" viewBox="0 0 ${tr_imgDim.w} ${tr_imgDim.h}"><image href="${tr_capturaSeleccionada.dataUrl}" width="${tr_imgDim.w}" height="${tr_imgDim.h}"/>${tr_figuras.map(f => tr_svgFigura(f, tr_imgDim)).join('')}</svg>`;
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = tr_imgDim.w;
      canvas.height = tr_imgDim.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const nueva = canvas.toDataURL('image/png');
      URL.revokeObjectURL(url);
      setTr_progresoVideo(10);
      let videoUrl = null;
      try {
        const svgFn = (t) => {
          const p = Math.min(1, Math.max(0, (t - 200) / 3600));
          const e = 1 - Math.pow(1 - p, 3);
          const figAnim = tr_figuras.map(f => ({ ...f, crecimiento: e }));
          return `<svg xmlns="http://www.w3.org/2000/svg" width="${tr_imgDim.w}" height="${tr_imgDim.h}" viewBox="0 0 ${tr_imgDim.w} ${tr_imgDim.h}"><image href="${tr_capturaSeleccionada.dataUrl}" width="${tr_imgDim.w}" height="${tr_imgDim.h}"/>${figAnim.map(f => tr_svgFigura(f, tr_imgDim)).join('')}</svg>`;
        };
        videoUrl = await tr_generarVideo(svgFn, tr_imgDim.w, tr_imgDim.h, (p) => setTr_progresoVideo(p));
      } catch (e) {
        console.error('Error al generar el video de la captura', e);
      }
      const nuevoId = Date.now() + Math.floor(Math.random() * 1000);
      setTr_capturas(prev => [...prev, { id: nuevoId, dataUrl: nueva, videoUrl, duracion: 4, figuras: tr_figuras, tiempo: tr_capturaSeleccionada.tiempo, insertarEn: null }]);
      setTr_capturaGuardada({ id: nuevoId, dataUrl: nueva, videoUrl });
    } catch (e) {
      console.error('Error al guardar la captura', e);
    } finally {
      setTr_exportando(false);
      setTr_progresoVideo(0);
    }
  };

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-logo">FT</div>
            <h1 className="login-title">Cargando</h1>
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
            <button className="btn-sm btn-secondary" onClick={handleBackToList} style={{ fontSize: '1.4rem', padding: '0.5rem 0.8rem' }}>&#8592;</button>
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
            <button
              onClick={() => setActiveTab('sustituciones')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'sustituciones' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'sustituciones' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              SUSTITUCIONES
            </button>
            <button
              onClick={() => setActiveTab('datos')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'datos' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'datos' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              DATOS
            </button>
            <button
              onClick={() => { setActiveTab('posesion'); setPosesionMatchIds(currentMatch?.id ? [currentMatch.id] : []); }}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'posesion' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'posesion' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              POSESION
            </button>
            <button
              onClick={() => setActiveTab('tiempojugado')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'tiempojugado' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'tiempojugado' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              TIEMPO JUGADO
            </button>
            <button
              onClick={() => setActiveTab('resumengoles')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'resumengoles' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'resumengoles' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              RESUMEN GOLES
            </button>
            <button
              onClick={() => setActiveTab('resumenacciones')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'resumenacciones' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'resumenacciones' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              RESUMEN ACCIONES
            </button>
            <button
              onClick={() => setActiveTab('jugadores')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'jugadores' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'jugadores' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              JUGADORES
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'videos' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'videos' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              VIDEOS
            </button>
            <button
              onClick={() => setActiveTab('presentacion')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'presentacion' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'presentacion' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              PRESENTACIÓN
            </button>
            <button
              onClick={() => setActiveTab('edicion')}
              style={{
                fontWeight: 800,
                fontSize: '1.15rem',
                color: activeTab === 'edicion' ? '#ffffff' : '#64748b',
                borderBottom: activeTab === 'edicion' ? '2px solid #ffffff' : '2px solid transparent',
                paddingBottom: '0.2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              EDICIÓN
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
              {activeTab !== 'resumengoles' && activeTab !== 'resumenacciones' && activeTab !== 'tiempojugado' && activeTab !== 'videos' && activeTab !== 'posesion' && activeTab !== 'jugadores' && activeTab !== 'presentacion' && activeTab !== 'edicion' && (
              <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: currentMatch.homeTeam && currentMatch.homeTeam.toUpperCase().includes('TENERIFE') ? '#38bdf8' : '#f87171' }}>{currentMatch.homeTeam}</span>
                {currentMatch.homeTeam && currentMatch.homeTeam.toUpperCase().includes('TENERIFE')
                  ? <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1.8rem', minWidth: '36px', textAlign: 'center' }}>{golesList.length}</span>
                  : <span style={{ color: '#f87171', fontWeight: 900, fontSize: '1.8rem', minWidth: '36px', textAlign: 'center' }}>{golesRivalList.length}</span>}
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff' }}>vs</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: currentMatch.awayTeam && currentMatch.awayTeam.toUpperCase().includes('TENERIFE') ? '#38bdf8' : '#f87171' }}>{currentMatch.awayTeam}</span>
                {currentMatch.awayTeam && currentMatch.awayTeam.toUpperCase().includes('TENERIFE')
                  ? <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1.8rem', minWidth: '36px', textAlign: 'center' }}>{golesList.length}</span>
                  : <span style={{ color: '#f87171', fontWeight: 900, fontSize: '1.8rem', minWidth: '36px', textAlign: 'center' }}>{golesRivalList.length}</span>}
              </div>
              </>
              )}
              <span style={{ fontSize: ['tiempojugado', 'resumengoles', 'resumenacciones', 'videos', 'posesion', 'jugadores', 'presentacion', 'edicion'].includes(activeTab) ? '1.8rem' : '1.2rem', fontWeight: 700, color: '#ffffff', background: 'var(--bg-secondary)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
                {activeTab === 'videos' ? 'CORTES DE VÍDEO' : activeTab === 'posesion' ? 'POSESIÓN' : activeTab === 'jugadores' ? 'JUGADORES' : activeTab === 'presentacion' ? 'PRESENTACIÓN' : activeTab === 'edicion' ? 'EDICIÓN' : `JORNADA ${currentMatch.matchday}`}
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
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'stretch' }}>
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
                    <button
                      onClick={handleResetContador}
                      style={{
                        background: '#64748b',
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
                      RESET
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
                      if (logAction('TIRO AREA')) {
                        setFromRival(false);
                        setTiroAreaCount(tiroAreaCount + 1);
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
                    <span>TIRO AREA</span>
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
                      {tiroAreaCount}
                    </span>
                  </button>
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
                      if (logAction('RIVAL TIRO AREA')) {
                        setFromRival(true);
                        setRivalTiroAreaCount(rivalTiroAreaCount + 1);
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
                    <span>RIVAL TIRO AREA</span>
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
                      {rivalTiroAreaCount}
                    </span>
                  </button>
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
                          if (onNeutroCount !== offNeutroCount) {
                            setIgualarAviso(true);
                            setTimeout(() => setIgualarAviso(false), 2500);
                            return;
                          }
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
                          background: '#6b7280',
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
                          color: '#6b7280',
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
                          if (onRivalCount !== offRivalCount) {
                            setIgualarAviso(true);
                            setTimeout(() => setIgualarAviso(false), 2500);
                            return;
                          }
                          if (logAction('ON PROPIO')) {
                            setOnNeutroCount(onNeutroCount + 1);
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f97316',
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
                        <span>PROPIO</span>
                        <span style={{
                          background: '#ffffff',
                          color: '#f97316',
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
                      <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => {
                          if (logAction('PÉRDIDAS')) {
                            setPerdidasCount(perdidasCount + 1);
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#ffffff',
                          color: '#334155',
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
                        <span>PÉRDIDAS</span>
                        <span style={{
                          background: '#334155',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '8px',
                          minWidth: '20px',
                          textAlign: 'center'
                        }}>
                          {perdidasCount}
                        </span>
                      </button>
                      {igualarAviso && (
                        <div style={{
                          position: 'absolute',
                          top: '5px',
                          right: '-80px',
                          background: '#dc2626',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.55rem',
                          width: '58px',
                          height: '58px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          lineHeight: '1.1',
                          padding: '4px',
                          zIndex: 10,
                          animation: 'blink 0.5s infinite'
                        }}>
                          IGUALAR CONTADOR
                        </div>
                      )}
                    </div>
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
                          background: '#6b7280',
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
                          color: '#6b7280',
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
                          if (logAction('OFF PROPIO')) {
                            setOffNeutroCount(offNeutroCount + 1);
                          }
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f97316',
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
                        <span>PROPIO</span>
                        <span style={{
                          background: '#ffffff',
                          color: '#f97316',
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
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        const data = { actionLog, matchName: currentMatch?.name || 'partido' };
                        const json = JSON.stringify(data, null, 2);
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `J${currentMatch?.matchday || '?'}_${currentMatch?.homeTeam || ''}_vs_${currentMatch?.awayTeam || ''}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                      Exportar
                    </button>
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.click();
                        input.onchange = () => {
                          const file = input.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            try {
                              const data = JSON.parse(reader.result);
                              if (data.actionLog) setActionLog(data.actionLog);
                            } catch (e) { /* noop */ }
                          };
                          reader.readAsText(file);
                        };
                      }}
                      style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                      Importar
                    </button>
                  </div>
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
            {activeTab === 'videos' && (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '3rem',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  {videoUrl && (
                    <div style={{ position: 'relative', width: '100%', maxWidth: '900px' }}>
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        onTimeUpdate={(e) => setVideoCurrentTime(e.target.currentTime)}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: 'auto',
                          borderRadius: '12px',
                          background: '#000000'
                        }}
                      />
                      <canvas
                        ref={trailCanvasRef}
                        onClick={(e) => {
                          if (!trackingMode) return;
                          const canvas = e.target;
                          const rect = canvas.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;
                          setTrackingMode(false);
                          startTracking(x, y);
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          borderRadius: '12px',
                          cursor: trackingMode ? 'crosshair' : 'default',
                          pointerEvents: trackingMode ? 'auto' : 'none'
                        }}
                      />
                      <div style={{ position: 'absolute', bottom: '32px', left: '50px', zIndex: 10, display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                          {(() => {
                            const offset = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0));
                            const adjusted = Math.max(0, Math.floor(videoCurrentTime - offset));
                            return Math.floor(adjusted / 60) + ':' + String(Math.floor(adjusted % 60)).padStart(2, '0');
                          })()}
                        </span>
                      </div>
                      <button
                        onClick={() => { if (videoRef.current) { videoRef.current.pause(); } setVideoUrl(null); setVideoFile(null); setVideoFileName(''); setVideoTimeOffset(null); setAccionSeleccionada(null); setPreviewVideoUrl(null); }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                      >×</button>
                    </div>
                  )}
                  {videoUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {videoTimeOffset === null && (
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              const t = videoRef.current.currentTime;
                              setVideoTimeOffset(t);
                            }
                          }}
                          style={{
                            background: '#f97316',
                            color: '#ffffff',
                            fontWeight: 900,
                            fontSize: '0.85rem',
                            padding: '0.6rem 1rem',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}
                        >
                          Sincroniza 1ª parte
                        </button>
                      )}
                      {videoTimeOffset !== null && (
                        <>
                          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                            Offset: {Math.floor(videoTimeOffset / 60)}:{String(Math.floor(videoTimeOffset % 60)).padStart(2, '0')}
                          </span>
                          <button
                            onClick={() => setVideoTimeOffset(null)}
                            style={{
                              background: '#ef4444',
                              color: '#ffffff',
                              fontWeight: 900,
                              fontSize: '0.85rem',
                              padding: '0.6rem 1rem',
                              borderRadius: '10px',
                              border: 'none',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}
                          >
                            Borrar sync 1ª
                          </button>
                        </>
                      )}
                      {videoTimeOffset !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {videoTimeOffset2 === null && (
                          <button
                            onClick={() => {
                              if (videoRef.current) {
                                const parte2 = actionLog.find(e => e && e.name === '2ª PARTE' && e.time);
                                if (parte2) {
                                  const parts = parte2.time.split(':').map(Number);
                                  const actionSecs = (parts[0] || 0) * 60 + (parts[1] || 0);
                                  const t = videoRef.current.currentTime;
                                  setVideoTimeOffset2(t - actionSecs);
                                } else {
                                  setCorteError('Pulsa primero el botón 2ª PARTE en el cronómetro');
                                  setTimeout(() => setCorteError(''), 3000);
                                }
                              }
                            }}
                            style={{
                              background: '#f97316',
                              color: '#ffffff',
                              fontWeight: 900,
                              fontSize: '0.85rem',
                              padding: '0.6rem 1rem',
                              borderRadius: '10px',
                              border: 'none',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}
                          >
                            Sincroniza 2ª parte
                          </button>
                          )}
                          {videoTimeOffset2 !== null && (
                            <>
                              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                                Offset: {Math.floor(videoTimeOffset2 / 60)}:{String(Math.floor(videoTimeOffset2 % 60)).padStart(2, '0')}
                              </span>
                              <button
                                onClick={() => setVideoTimeOffset2(null)}
                                style={{
                                  background: '#ef4444',
                                  color: '#ffffff',
                                  fontWeight: 900,
                                  fontSize: '0.85rem',
                                  padding: '0.6rem 1rem',
                                  borderRadius: '10px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}
                              >
                                Borrar sync 2ª
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <select
                    value={filtroAccion}
                    onChange={(e) => { const isSelectingVarios = e.target.value === '__varios__'; const wasVarios = filtroAccion === '__varios__'; setFiltroAccion(e.target.value); if (isSelectingVarios && !wasVarios) { const nextIdx = variosIndex + 1; setVariosIndex(nextIdx); const allActions = actionLog.filter(item => item && item.time && item.type !== 'finalizacion' && !['1ª PARTE', '2ª PARTE', 'FIN'].includes(item.name)).sort((a, b) => { const pa = String(a.time).split(':').map(Number); const pb = String(b.time).split(':').map(Number); return (pa[0] * 60 + pa[1]) - (pb[0] * 60 + pb[1]); }); if (nextIdx - 1 < allActions.length && videoRef.current) { const key = allActions[nextIdx - 1].name + '_' + allActions[nextIdx - 1].time; const offset = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0); setVariosBaseTimes(prev => Object.assign({}, prev, { [key]: Math.max(0, Math.floor(videoCurrentTime - offset) - 2) })); } } }}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ color: '#ffffff' }}>Todas las acciones</option>
                    <option value="__varios__" style={{ color: '#ef4444' }}>VARIOS</option>
                    {[...new Set(actionLog.filter(e => e && e.time && e.type !== 'finalizacion' && !['1ª PARTE', '2ª PARTE', 'FIN', 'ON PROPIO', 'OFF PROPIO', 'ON RIVAL', 'OFF RIVAL'].includes(e.name)).map(e => e.name))].map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {!videoUrl && (
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'var(--bg-secondary)',
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: '12px',
                      padding: '1.2rem 2rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      minWidth: '280px',
                      width: '100%',
                      maxWidth: '900px'
                    }}>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            if (videoUrl) URL.revokeObjectURL(videoUrl);
                            if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
                            setVideoFile(file);
                            setVideoFileName(file.name);
                            setVideoUrl(URL.createObjectURL(file));
                            setVideoTimeOffset(null);
                            setAccionSeleccionada(null);
                            setPreviewVideoUrl(null);
                            setPreviewNombres([]);
                            setCorteError('');
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {videoFileName ? 'Vídeo: ' + videoFileName : 'Seleccionar vídeo'}
                      </span>
                    </label>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                  {/* Columna izquierda - Tabla de acciones (oculta) */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      display: 'none',
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
                      Acciones ({actionLog.filter(e => e && e.time && e.type !== 'finalizacion' && !['1ª PARTE', '2ª PARTE', 'FIN', 'ON PROPIO', 'OFF PROPIO', 'ON RIVAL', 'OFF RIVAL'].includes(e.name) && (filtroAccion === '' || e.name === filtroAccion)).length})
                    </span>
                    {actionLog.length === 0 && (
                      <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                        Sin acciones aún
                      </span>
                    )}
                    {[...actionLog].reverse().filter(e => !['ON PROPIO', 'OFF PROPIO', 'ON RIVAL', 'OFF RIVAL'].includes(e.name)).map((entry, idx) => (
                      <div key={idx} onClick={() => {
                        if (entry.time && entry.type !== 'finalizacion' && videoRef.current && videoUrl) {
                          const parts = String(entry.time).split(':').map(Number);
                          const secs = (parts[0] || 0) * 60 + (parts[1] || 0);
                          const offset = videoTimeOffset2 != null ? Math.floor(videoTimeOffset2) : (videoTimeOffset2 != null ? Math.floor(videoTimeOffset2) : (videoTimeOffset != null ? Math.floor(videoTimeOffset) : 0));
                          const videoSecs = Math.max(0, secs + offset);
                          videoRef.current.currentTime = videoSecs;
                          setAccionSeleccionada(entry);
                          setCorteInicio(Math.max(0, videoSecs - Math.floor(corteSegundos / 2)));
                          setCorteFin(videoSecs + Math.ceil(corteSegundos / 2));
                        }
                      }} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: accionSeleccionada === entry ? 'var(--bg-primary)' : 'var(--bg-card)',
                        border: accionSeleccionada === entry ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: entry.type === 'finalizacion' ? '0.2rem 0.6rem' : '0.4rem 0.8rem',
                        cursor: entry.time && entry.type !== 'finalizacion' ? 'pointer' : 'default'
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
                    {/* Acciones seleccionadas por el filtro */}
                    {filtroAccion && (() => {
                      const excludedNames = ['1ª PARTE', '2ª PARTE', 'FIN'];
                      const allAccionesFiltradas = (filtroAccion === '__varios__'
                        ? actionLog.filter(e => e && e.time && e.type !== 'finalizacion' && !excludedNames.includes(e.name) && !['ON PROPIO', 'OFF PROPIO', 'ON RIVAL', 'OFF RIVAL'].includes(e.name))
                        : actionLog.filter(e => e && e.time && e.type !== 'finalizacion' && !excludedNames.includes(e.name) && e.name === filtroAccion && !['ON PROPIO', 'OFF PROPIO', 'ON RIVAL', 'OFF RIVAL'].includes(e.name))).sort((a, b) => {
                        const pa = String(a.time).split(':').map(Number);
                        const pb = String(b.time).split(':').map(Number);
                        return (pa[0] * 60 + pa[1]) - (pb[0] * 60 + pb[1]);
                      });
                      const accionesFiltradas = filtroAccion === '__varios__' ? allAccionesFiltradas.slice(0, variosIndex + 1) : allAccionesFiltradas;
                      if (accionesFiltradas.length === 0) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ color: filtroAccion === '__varios__' ? '#ef4444' : '#38bdf8', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {filtroAccion === '__varios__' ? 'VARIOS' : filtroAccion} — {accionesFiltradas.length} {accionesFiltradas.length === 1 ? 'acción' : 'acciones'}
                            </span>
                          </div>
                          {accionesFiltradas.map((e, idx) => {
                            const offset = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0);
                            const parts = String(e.time).split(':').map(Number);
                            const actionKey = e.name + '_' + e.time;
                            let baseTime;
                            if (filtroAccion === '__varios__') {
                              if (variosBaseTimes[actionKey] == null) {
                                baseTime = Math.max(0, Math.floor(videoCurrentTime - offset) - 2);
                                setVariosBaseTimes(prev => Object.assign({}, prev, { [actionKey]: baseTime }));
                              } else {
                                baseTime = variosBaseTimes[actionKey];
                              }
                            } else {
                              baseTime = (parts[0] || 0) * 60 + (parts[1] || 0);
                            }
                            const ajuste = ajusteAcciones[actionKey] || 0;
                            const ajusteFin = ajusteAccionesFin[actionKey] || 0;
                            const secs = Math.floor(baseTime + ajuste);
                            const finSecs = secs + 5 + Math.floor(ajusteFin);
                            const mm = String(Math.floor(Math.max(0, secs) / 60)).padStart(2, '0');
                            const ss = String(Math.max(0, secs) % 60).padStart(2, '0');
                            const finMm = String(Math.floor(Math.max(0, finSecs) / 60)).padStart(2, '0');
                            const finSs = String(Math.max(0, finSecs) % 60).padStart(2, '0');
                            const actionIdx = actionLog.findIndex(a => a === e);
                            let finalizacion = null;
                            for (let fi = actionIdx - 1; fi >= 0; fi--) {
                              if (actionLog[fi].type === 'finalizacion') { finalizacion = actionLog[fi]; break; }
                              if (actionLog[fi].type === 'accion') break;
                            }
                            return (
                            <React.Fragment key={idx}>
                            <div onClick={() => {
                              if (videoRef.current && e.time) {
                                if (filtroAccion === '__varios__') {
                                  const offset = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0);
                                  videoRef.current.currentTime = Math.max(0, secs + offset);
                                } else {
                                   const offsetSecs = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0);
                                   videoRef.current.currentTime = Math.max(0, secs + offsetSecs);
                                 }

                              }
                            }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', cursor: 'pointer', gap: '0.5rem' }}>
                              <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.7rem', fontFamily: 'var(--font-mono)', minWidth: '20px' }}>{idx + 1}</span>
                              <span style={{ color: filtroAccion === '__varios__' ? '#ef4444' : '#ffffff', fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>{filtroAccion === '__varios__' ? 'VARIOS ' + (idx + 1) : e.name}</span>
                              {finalizacion && filtroAccion !== '__varios__' && <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>({finalizacion.name})</span>}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {filtroAccion !== '__varios__' && <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase' }}>inicio</span>}
                                <button onClick={(ev) => {
                                  ev.stopPropagation();
                                  setAjusteAcciones(prev => {
                                    const newVal = (prev[actionKey] || 0) - 1;
                                    if (videoRef.current && e.time) {
                                      const baseParts = String(e.time).split(':').map(Number);
                                      const baseSecs = (baseParts[0] || 0) * 60 + (baseParts[1] || 0);
                                      const offsetSecs = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0);
                                      videoRef.current.currentTime = Math.max(0, baseSecs + offsetSecs + newVal);
                                    }
                                    return Object.assign({}, prev, { [actionKey]: newVal });
                                  });
                                }} style={{ background: '#1e293b', color: '#22c55e', border: '1px solid #334155', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                                <span style={{ color: '#22c55e', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', minWidth: '40px', textAlign: 'center' }}>{mm}:{ss}</span>
                                <button onClick={(ev) => {
                                  ev.stopPropagation();
                                  setAjusteAcciones(prev => {
                                    const newVal = (prev[actionKey] || 0) + 1;
                                    if (videoRef.current && e.time) {
                                      const baseParts = String(e.time).split(':').map(Number);
                                      const baseSecs = (baseParts[0] || 0) * 60 + (baseParts[1] || 0);
                                      const offsetSecs = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0);
                                      videoRef.current.currentTime = Math.max(0, baseSecs + offsetSecs + newVal);
                                    }
                                    return Object.assign({}, prev, { [actionKey]: newVal });
                                  });
                                }} style={{ background: '#1e293b', color: '#22c55e', border: '1px solid #334155', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase' }}>fin</span>
                                <button onClick={(ev) => {
                                  ev.stopPropagation();
                                  setAjusteAccionesFin(prev => {
                                    const newVal = (prev[actionKey] || 0) - 1;
                                    if (videoRef.current && e.time) {
                                      const baseParts = String(e.time).split(':').map(Number);
                                      const baseSecs = (baseParts[0] || 0) * 60 + (baseParts[1] || 0);
                                      const offsetSecs = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0);
                                      const inicioAjuste = ajusteAcciones[actionKey] || 0;
                                      videoRef.current.currentTime = Math.max(0, baseSecs + offsetSecs + inicioAjuste + 5 + newVal);
                                    }
                                    return Object.assign({}, prev, { [actionKey]: newVal });
                                  });
                                }} style={{ background: '#1e293b', color: '#ef4444', border: '1px solid #334155', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                                <span style={{ color: '#ef4444', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', minWidth: '40px', textAlign: 'center' }}>{finMm}:{finSs}</span>
                                <button onClick={(ev) => {
                                  ev.stopPropagation();
                                  setAjusteAccionesFin(prev => {
                                    const newVal = (prev[actionKey] || 0) + 1;
                                    if (videoRef.current && e.time) {
                                      const baseParts = String(e.time).split(':').map(Number);
                                      const baseSecs = (baseParts[0] || 0) * 60 + (baseParts[1] || 0);
                                      const offsetSecs = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0);
                                      const inicioAjuste = ajusteAcciones[actionKey] || 0;
                                      videoRef.current.currentTime = Math.max(0, baseSecs + offsetSecs + inicioAjuste + 5 + newVal);
                                    }
                                    return Object.assign({}, prev, { [actionKey]: newVal });
                                  });
                                }} style={{ background: '#1e293b', color: '#ef4444', border: '1px solid #334155', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                              </div>
                              <button onClick={(ev) => {
                                ev.stopPropagation();
                                if (!videoFile) { setCorteError('Selecciona primero el archivo de vídeo'); return; }
                                const offsetSecs = videoTimeOffset2 != null ? Math.floor(videoTimeOffset2) : (videoTimeOffset != null ? Math.floor(videoTimeOffset) : 0);
                                const parts = String(e.time).split(':').map(Number);
                                const actionSecs = (parts[0] || 0) * 60 + (parts[1] || 0);
                                const ajusteInicio = ajusteAcciones[actionKey] || 0;
                                const ajusteFinVal = ajusteAccionesFin[actionKey] || 0;
                                const totalSecs = Math.max(0, actionSecs + offsetSecs - 2 + ajusteInicio);
                                const finSecs = totalSecs + 5 + ajusteFinVal;
                                const duracion = Math.max(1, finSecs - totalSecs);
                                const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
                                const ss = String(totalSecs % 60).padStart(2, '0');
                                const adjustedTime = mm + ':' + ss;
                                setGenerandoAccion(actionKey);
                                setPreviewAccion(null);
                                const videoName = filtroAccion === '__varios__' ? 'VARIOS ' + (idx + 1) : (() => { const sameName = accionesFiltradas.filter(a => a.name === e.name); const correlative = sameName.indexOf(e) + 1; return sameName.length > 1 ? e.name + ' ' + correlative : e.name; })();
                                const doCut = async () => {
                                  if (servidorCortesDisponible) {
                                    return await new Promise((resolve, reject) => {
                                      const formData = new FormData();
                                      formData.append('video', videoFile);
                                      formData.append('cortes', JSON.stringify([{ time: adjustedTime, name: videoName, duracion: String(duracion) }]));
                                      const xhr = new XMLHttpRequest();
                                      xhr.open('POST', SERVER_URL + '/api/cortar');
                                      xhr.upload.onprogress = (ev) => {
                                        if (ev.lengthComputable) {
                                          setProgresoAccion(prev => ({ ...prev, [actionKey]: Math.round((ev.loaded / ev.total) * 90) }));
                                        }
                                      };
                                      xhr.onload = () => {
                                        setProgresoAccion(prev => ({ ...prev, [actionKey]: 95 }));
                                        if (xhr.status >= 200 && xhr.status < 300) {
                                          resolve(new Blob([xhr.response], { type: 'video/mp4' }));
                                        } else {
                                          try { const errData = JSON.parse(xhr.responseText); reject(new Error(errData.error || 'Error en el servidor')); } catch { reject(new Error('Error en el servidor')); }
                                        }
                                      };
                                      xhr.onerror = () => reject(new Error('No se pudo conectar al servidor'));
                                      xhr.responseType = 'blob';
                                      xhr.send(formData);
                                    });
                                  }
                                  return await cutVideoSingle(videoFile, adjustedTime, duracion, videoName, (p) => {
                                    setProgresoAccion(prev => ({ ...prev, [actionKey]: Math.round(p * 100) }));
                                  });
                                };
                                doCut().then(blob => {
                                  if (previewAccion && previewAccion.url) URL.revokeObjectURL(previewAccion.url);
                                  const url = URL.createObjectURL(blob);
                                  setPreviewAccion({ url: url, name: videoName, key: actionKey });
                                }).catch(err => { setCorteError(err.message || 'Error al generar el vídeo'); }).finally(() => { setGenerandoAccion(null); setProgresoAccion(prev => { const copy = Object.assign({}, prev); delete copy[actionKey]; return copy; }); });
                              }} style={{ background: '#eab308', color: '#000000', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{generandoAccion === actionKey ? (progresoAccion[actionKey] != null ? progresoAccion[actionKey] + '%' : '...') : 'Generar'}</button>
                              {filtroAccion === '__varios__' && <button onClick={(ev) => { ev.stopPropagation(); setVariosBaseTimes(prev => { const copy = Object.assign({}, prev); delete copy[e.name + '_' + e.time]; return copy; }); setVariosIndex(prev => Math.max(0, prev - 1)); setAccionSeleccionada(null); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>&#10005;</button>}
                            </div>
                            {previewAccion && previewAccion.key === actionKey && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3rem', marginTop: '0.3rem', paddingLeft: '0.5rem' }}>
                                <video
                                  src={previewAccion.url}
                                  controls
                                  style={{ display: 'block', width: '200px', borderRadius: '8px', background: '#000000' }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{previewAccion.name}</span>
                                  <a href={previewAccion.url} download={previewAccion.name + '.mp4'} style={{ background: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', textDecoration: 'none' }}>Descargar</a>
                                  <button onClick={() => { if (!previewAccion?.url) return; setTr_videoUrl(previewAccion.url); setTr_archivo({ name: previewAccion.name + '.mp4' }); setActiveTab('presentacion'); }} style={{ background: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase' }}>Cargar</button>
                                  <button onClick={() => { if (previewAccion && previewAccion.url) URL.revokeObjectURL(previewAccion.url); setPreviewAccion(null); }} style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase' }}>Borrar</button>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                          );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  {/* Vista previa del corte seleccionado */}
                  {accionSeleccionada && videoUrl && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {accionSeleccionada.name} — {accionSeleccionada.time}
                      </span>
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        onTimeUpdate={(e) => setVideoCurrentTime(e.target.currentTime)}
                        style={{
                          display: 'block',
                          width: '100%',
                          maxWidth: '800px',
                          borderRadius: '12px',
                          background: '#000000'
                        }}
                      />
                      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'center' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.4)', padding: '0.2rem 0.8rem', borderRadius: '6px' }}>
                          {(() => {
                            const offset = videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset2 != null ? videoTimeOffset2 : (videoTimeOffset != null ? videoTimeOffset : 0));
                            const adjusted = Math.max(0, Math.floor(videoCurrentTime - offset));
                            return Math.floor(adjusted / 60) + ':' + String(Math.floor(adjusted % 60)).padStart(2, '0');
                          })()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button onClick={() => {
                            const v = Math.max(0, corteInicio - 1);
                            setCorteInicio(v);
                            if (videoRef.current) videoRef.current.currentTime = v;
                          }} style={{ background: '#f97316', color: '#fff', fontWeight: 900, fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>-</button>
                          <span style={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                            Inicio: {Math.floor(corteInicio / 60)}:{String(corteInicio % 60).padStart(2, '0')}
                          </span>
                          <button onClick={() => {
                            const v = corteInicio + 1;
                            setCorteInicio(v);
                            if (videoRef.current) videoRef.current.currentTime = v;
                          }} style={{ background: '#22c55e', color: '#fff', fontWeight: 900, fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>+</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button onClick={() => {
                            const v = Math.max(corteInicio + 1, corteFin - 1);
                            setCorteFin(v);
                          }} style={{ background: '#f97316', color: '#fff', fontWeight: 900, fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>-</button>
                          <span style={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                            Fin: {Math.floor(corteFin / 60)}:{String(corteFin % 60).padStart(2, '0')}
                          </span>
                          <button onClick={() => {
                            setCorteFin(corteFin + 1);
                          }} style={{ background: '#22c55e', color: '#fff', fontWeight: 900, fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>+</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Columna derecha - Controles de vídeo */}
                  <div style={{
                    width: '100%',
                    maxWidth: '900px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.2rem'
                  }}>
                    {corteError && (
                      <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>
                        {corteError}
                      </span>
                    )}
                    {servidorCortesDisponible === false && (
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.8rem', textAlign: 'center' }}>
                        El servidor de cortes no está iniciado. Ejecuta "node server.js" en la carpeta del proyecto.
                      </span>
                    )}
                {cortandoTodos && (
                      <div style={{
                        width: '100%',
                        maxWidth: '300px',
                        height: '8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: '40%',
                          height: '100%',
                          background: '#22c55e',
                          borderRadius: '4px',
                          animation: 'barraProgreso 1.2s ease-in-out infinite'
                        }} />
                      </div>
                    )}
                  </div>
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
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#f97316', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      <span>OCASION</span>
                      <span style={{ background: '#ffffff', color: '#f97316', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{ocasionCount}</span>
                    </button>
                  </div>
                  {/* Dos columnas debajo */}
                  <div style={{ display: 'flex', gap: '2rem' }}>
                    {/* Columna izquierda */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                      <button
                        onClick={() => { if (logAction('FUERA', 'finalizacion')) { setFueraCount(fueraCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>FUERA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{fueraCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('BLOCAJE', 'finalizacion')) { setBlocajeCount(blocajeCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>BLOCAJE</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{blocajeCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('BLOCAJE', 'finalizacion')) { setBlocajeCount(blocajeCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>FINAL+BOCA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{blocajeCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('BLOCAJE', 'finalizacion')) { setBlocajeCount(blocajeCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>FINAL+DESP</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{blocajeCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('BLOCAJE', 'finalizacion')) { setBlocajeCount(blocajeCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>FINAL+FUERA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{blocajeCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('DESPEJE DEFENSA', 'finalizacion')) { setDespejeDefensaCount(despejeDefensaCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>DESPEJE DEFENSA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{despejeDefensaCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('DESPEJE PORTERO', 'finalizacion')) { setDespejePorteroCount(despejePorteroCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>DESPEJE PORTERO</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{despejePorteroCount}</span>
                      </button>
                    </div>
                    {/* Columna derecha */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                      <button
                        onClick={() => { if (logAction('GOL', 'finalizacion')) { setGolCount(golCount + 1); setGolesList([...golesList, { name: '', tipo: '', name2: '', accion: [...actionLog].find(e => e.type === 'accion') ? [...actionLog].find(e => e.type === 'accion').name : '', team: 'home', periodo, minuto: Math.floor(timerSeconds / 60) }]); setActiveTab('goles'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>GOL</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{golCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('GOL RIVAL', 'finalizacion')) { setGolRivalCount(golRivalCount + 1); setGolesRivalList([...golesRivalList, { periodo, minuto: Math.floor(timerSeconds / 60) }]); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#ef4444', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>GOL RIVAL</span>
                        <span style={{ background: '#ffffff', color: '#ef4444', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{golRivalCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('PENAL + GOL RIVAL', 'finalizacion')) { setPenalCount(penalCount + 1); setGolRivalCount(golRivalCount + 1); setGolesRivalList([...golesRivalList, { periodo, minuto: Math.floor(timerSeconds / 60), tipo: 'PENAL' }]); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#ef4444', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>PENAL + GOL RIVAL</span>
                        <span style={{ background: '#ffffff', color: '#ef4444', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{golRivalCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('PENAL + FUERA', 'finalizacion')) { setPenalCount(penalCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>PENAL + FUERA</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{penalCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('PENAL + GOL', 'finalizacion')) { setPenalCount(penalCount + 1); setGolesList([...golesList, { name: '', tipo: 'PENAL', name2: '', accion: 'PENAL', team: 'home', periodo, minuto: Math.floor(timerSeconds / 60) }]); setActiveTab('goles'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>PENAL + GOL</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{penalCount}</span>
                      </button>
                      <button
                        onClick={() => { if (logAction('INFRACCION', 'finalizacion')) { setInfraccionCount(infraccionCount + 1); setActiveTab('acciones'); } }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: '#16a34a', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', padding: '0.8rem 1.5rem', borderRadius: '12px', minWidth: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        <span>INFRACCION</span>
                        <span style={{ background: '#ffffff', color: '#16a34a', fontWeight: 900, fontSize: '1rem', padding: '0.2rem 0.7rem', borderRadius: '8px', minWidth: '30px', textAlign: 'center' }}>{infraccionCount}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'resumengoles' && (
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
                    RESUMEN GOLES
                  </span>
                  {(() => {
                    const stats = {};
                    const addGoal = (name, tipo) => {
                      if (!name) return;
                      if (!stats[name]) stats[name] = { total: 0, pie: 0, cabeza: 0, penal: 0 };
                      stats[name].total += 1;
                      if (tipo === 'PIE') stats[name].pie += 1;
                      else if (tipo === 'CABEZA') stats[name].cabeza += 1;
                      else if (tipo === 'PENAL') stats[name].penal += 1;
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      const gl = Array.isArray(m.golesList) ? m.golesList : (m.golesList ? Object.values(m.golesList) : []);
                      gl.forEach(g => { if (g && g.name) addGoal(g.name, g.tipo); });
                    });
                    golesList.forEach(g => { if (g && g.name) addGoal(g.name, g.tipo); });
                    const filas = Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
                    const asistStats = {};
                    const addAsist = (name2) => {
                      if (!name2 || name2.toUpperCase() === 'SIN ASISTENCIA') return;
                      asistStats[name2] = (asistStats[name2] || 0) + 1;
                    };
                    const contarAsist = (gl) => {
                      gl.forEach(g => { if (g && g.name2) addAsist(g.name2); });
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      const gl = Array.isArray(m.golesList) ? m.golesList : (m.golesList ? Object.values(m.golesList) : []);
                      contarAsist(gl);
                    });
                    contarAsist(golesList);
                    const filasAsist = Object.entries(asistStats).sort((a, b) => b[1] - a[1]);
                    let totalGoles = 0;
                    const periodos = [
                      { name: 'MIN. 0-15', desde: 0, hasta: 15 },
                      { name: 'MIN 16-30', desde: 16, hasta: 30 },
                      { name: 'MIN 31-45', desde: 31, hasta: 45 },
                      { name: 'MIN 46-60', desde: 46, hasta: 60 },
                      { name: 'MIN 61-75', desde: 61, hasta: 75 },
                      { name: 'MIN 76-90', desde: 76, hasta: 90 }
                    ];
                    const contarGoles = (gl) => {
                      gl.forEach(g => {
                        if (!g || !g.name) return;
                        totalGoles += 1;
                        const min = g.minuto || 0;
                        const p = periodos.find(p => min >= p.desde && min <= p.hasta) || periodos[periodos.length - 1];
                        p.goles = (p.goles || 0) + 1;
                      });
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      const gl = Array.isArray(m.golesList) ? m.golesList : (m.golesList ? Object.values(m.golesList) : []);
                      contarGoles(gl);
                    });
                    contarGoles(golesList);
                    const chartData = periodos.map(p => ({
                      name: p.name,
                      value: p.goles || 0,
                      pct: totalGoles > 0 ? ((p.goles || 0) / totalGoles) * 100 : 0
                    }));
                    let totalGolesRival = 0;
                    let sinMinutoRival = 0;
                    const periodosRival = periodos.map(p => ({ ...p, goles: 0 }));
                    const contarGolesRival = (gl) => {
                      gl.forEach(g => {
                        if (!g) return;
                        totalGolesRival += 1;
                        const min = g.minuto;
                        if (min === undefined || min === null) {
                          sinMinutoRival += 1;
                          return;
                        }
                        const p = periodosRival.find(p => min >= p.desde && min <= p.hasta) || periodosRival[periodosRival.length - 1];
                        p.goles = (p.goles || 0) + 1;
                      });
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      const gl = Array.isArray(m.golesRivalList) ? m.golesRivalList : (m.golesRivalList ? Object.values(m.golesRivalList) : []);
                      if (gl.length) {
                        contarGolesRival(gl);
                      } else if (m.golRivalCount) {
                        totalGolesRival += m.golRivalCount;
                        sinMinutoRival += m.golRivalCount;
                      }
                    });
                    const currentGl = Array.isArray(golesRivalList) ? golesRivalList : (golesRivalList ? Object.values(golesRivalList) : []);
                    if (currentGl.length) {
                      contarGolesRival(currentGl);
                    } else if (golRivalCount) {
                      totalGolesRival += golRivalCount;
                      sinMinutoRival += golRivalCount;
                    }
                    const chartDataRival = periodosRival
                      .map(p => ({
                        name: p.name,
                        value: p.goles || 0,
                        pct: totalGolesRival > 0 ? ((p.goles || 0) / totalGolesRival) * 100 : 0
                      }))
                      .filter(p => p.value > 0);
                    const COLORS = ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#94a3b8'];
                    const golesPorJornada = {};
                    const contarJornada = (gl, md) => {
                      const jornada = Number(md);
                      if (!gl || !jornada) return;
                      const n = gl.filter(g => g && g.name).length;
                      golesPorJornada[jornada] = (golesPorJornada[jornada] || 0) + n;
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      contarJornada(m.golesList, m.matchday);
                    });
                    if (currentMatch) contarJornada(golesList, currentMatch.matchday);
                    const rangoGoles = (a, b) => Object.entries(golesPorJornada).filter(([md]) => md >= a && md <= b).reduce((s, [, v]) => s + v, 0);
                    const tramos = [
                      { name: 'J1-J12', value: rangoGoles(1, 12) },
                      { name: 'J13-J24', value: rangoGoles(13, 24) },
                      { name: 'J25-J36', value: rangoGoles(25, 36) }
                    ];
                    const golesRivalTotal = matches.reduce((s, m) => {
                      if (currentMatch && m.id === currentMatch.id) return s;
                      return s + (m.golRivalCount ?? 0);
                    }, 0) + golRivalCount;
                    const golesRivalPorJornada = {};
                    const contarJornadaRival = (md, n) => {
                      const jornada = Number(md);
                      if (!jornada || !n) return;
                      golesRivalPorJornada[jornada] = (golesRivalPorJornada[jornada] || 0) + n;
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      contarJornadaRival(m.matchday, m.golRivalCount ?? 0);
                    });
                    if (currentMatch) contarJornadaRival(currentMatch.matchday, golRivalCount);
                    const rangoGolesRival = (a, b) => Object.entries(golesRivalPorJornada).filter(([md]) => md >= a && md <= b).reduce((s, [, v]) => s + v, 0);
                    const tramosRival = [
                      { name: 'J1-J12', value: rangoGolesRival(1, 12) },
                      { name: 'J13-J24', value: rangoGolesRival(13, 24) },
                      { name: 'J25-J36', value: rangoGolesRival(25, 36) }
                    ];
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '320px', overflowX: 'auto' }}>
                            <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>GOLES</span>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>JUGADOR</th>
                                  <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL</th>
                                  <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>PIE</th>
                                  <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>CABEZA</th>
                                  <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>PENAL</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filas.map(([n, s]) => (
                                  <tr key={n}>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 700 }}>{n}</td>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{s.total}</td>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{s.pie}</td>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{s.cabeza}</td>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{s.penal}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ minWidth: '320px', marginLeft: 'auto', overflowX: 'auto' }}>
                            <span style={{ color: '#f97316', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', display: 'block', marginBottom: '0.5rem', marginLeft: '-14rem' }}>ASISTENCIAS</span>
                            <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>JUGADOR</th>
                                  <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filasAsist.map(([n, v]) => (
                                  <tr key={n}>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}>{n}</td>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{v}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', alignItems: 'center' }}>
                        <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1, margin: 0, padding: 0 }}>GOLES A FAVOR</span>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-start', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4.5rem' }}>
                          <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr>
                                <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#eab308', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>JORNADAS</th>
                                <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#eab308', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>GOLES</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tramos.map((t) => (
                                <tr key={t.name}>
                                  <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.name}</td>
                                  <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{t.value}</td>
                                </tr>
                              ))}
                              <tr>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 900, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>TOTAL</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{tramos.reduce((s, t) => s + t.value, 0)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        {chartData.length > 0 && (
                          <div style={{ width: 'fit-content', display: 'flex', justifyContent: 'center' }}>
                            <PieChart width={600} height={480} margin={{ top: 50, right: 80, bottom: 20, left: 80 }}>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="30%"
                                outerRadius={90}
                                dataKey="value"
                                isAnimationActive={false}
                                labelLine={{ stroke: '#605E5C', strokeWidth: 1.5 }}
                                label={(props) => {
                                  if ((props.value || 0) === 0) return null;
                                  const pct = (props.percent || 0) * 100;
                                  const pctTxt = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2);
                                  return (
                                    <text
                                      x={props.x}
                                      y={props.y}
                                      dy={4}
                                      textAnchor={props.textAnchor}
                                      fill="#ffffff"
                                      fontSize={14}
                                      fontWeight={700}
                                      stroke="none"
                                    >
                                      {props.name}  {props.value} ({pctTxt}%)
                                    </text>
                                  );
                                }}
                              >
                                {chartData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </div>
                        )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1rem 2rem', marginTop: '-13rem' }}>
                          <span style={{ color: '#f87171', fontWeight: 900, fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>GOLES EN CONTRA</span>
                          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-10rem' }}>
                          <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr>
                                <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>JORNADAS</th>
                                <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>GOLES</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tramosRival.map((t) => (
                                <tr key={t.name}>
                                  <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}>{t.name}</td>
                                  <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#f87171', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{t.value}</td>
                                </tr>
                              ))}
                              <tr>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 900, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>TOTAL</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#f87171', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{tramosRival.reduce((s, t) => s + t.value, 0)}</td>
                              </tr>
                            </tbody>
                          </table>
                          </div>
                          {chartDataRival.length > 0 && (
                            <div style={{ width: 'fit-content', display: 'flex', justifyContent: 'center', marginLeft: '6rem' }}>
<PieChart width={520} height={460} margin={{ top: 40, right: 80, bottom: 60, left: 80 }}>
                                <Pie
                                  data={chartDataRival}
                                  cx="50%"
                                  cy="30%"
                                  outerRadius={90}
                                  dataKey="value"
                                  isAnimationActive={false}
                                  labelLine={{ stroke: '#605E5C', strokeWidth: 1.5 }}
                                  label={(props) => {
                                    if ((props.value || 0) === 0) return null;
                                    const pct = (props.percent || 0) * 100;
const pctTxt = pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2);
                                    return (
                                      <text
                                        x={props.x}
                                        y={props.y}
                                        dy={4}
                                        textAnchor={props.textAnchor}
                                        fill="#ffffff"
                                        fontSize={14}
                                        fontWeight={700}
                                        stroke="none"
                                      >
                                        {props.name}  {props.value} ({pctTxt}%)
                                      </text>
                                    );
                                  }}
                                >
                                  {chartDataRival.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </div>
                          )}
                          </div>
                        </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {activeTab === 'resumenacciones' && (
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
                    RESUMEN ACCIONES
                  </span>
                  {(() => {
                    const live = {
                      ocasionCount, fueraCount, blocajeCount, despejeDefensaCount, despejePorteroCount,
                      saqueEsquinaFueraCount, golCount, golRivalCount, penalCount, infraccionCount,
                      tiroDerechaCount, tiroIzquierdaCount, tiroFrontalCount,
                      faltaDerechaCount, faltaIzquierdaCount, faltaFrontalCount,
                      centroDerechaCount, centroIzquierdaCount,
                      cornerIzquierdaCount, cornerDerechaCount,
                      inicioPropioCount, inicioRivalCount,
                      onRivalCount, offRivalCount, onNeutroCount, offNeutroCount,
                      rivalTiroDerechaCount, rivalTiroIzquierdaCount, rivalTiroFrontalCount,
                      rivalFaltaDerechaCount, rivalFaltaIzquierdaCount, rivalFaltaFrontalCount,
                      rivalCentroDerechaCount, rivalCentroIzquierdaCount,
                      rivalCornerIzquierdaCount, rivalCornerDerechaCount
                    };
                    const grupos = [];
                    const totalPor = (key) => {
                      let t = (live[key] || 0);
                      matches.forEach(m => {
                        if (currentMatch && m.id === currentMatch.id) return;
                        t += (m[key] ?? 0);
                      });
                      return t;
                    };
                    const finalizacionesOrder = ['GOL', 'OCASION', 'FUERA', 'BLOCAJE', 'DESPEJE DEFENSA', 'DESPEJE PORTERO', 'SAQUE DE ESQUINA', 'PENAL + GOL', 'PENAL + FUERA', 'GOL RIVAL', 'INFRACCION'];
                    const accionesOrder = ['TIRO AREA', 'TIRO DERECHA', 'TIRO IZQUIERDA', 'TIRO FRONTAL', 'FALTA DERECHA', 'FALTA IZQUIERDA', 'FALTA FRONTAL', 'CENTRO DERECHA', 'CENTRO IZQUIERDA', 'CORNER IZQUIERDA', 'CORNER DERECHA', 'RIVAL TIRO DERECHA', 'RIVAL TIRO AREA', 'RIVAL TIRO IZQUIERDA', 'RIVAL TIRO FRONTAL', 'RIVAL FALTA DERECHA', 'RIVAL FALTA IZQUIERDA', 'RIVAL FALTA FRONTAL', 'RIVAL CENTRO DERECHA', 'RIVAL CENTRO IZQUIERDA', 'RIVAL CORNER IZQUIERDA', 'RIVAL CORNER DERECHA', 'INICIO PROPIO', 'INICIO RIVAL', 'ON RIVAL', 'OFF RIVAL', 'ON NEUTRO', 'ON PROPIO', 'OFF NEUTRO', 'OFF PROPIO', 'PÉRDIDAS'];
                    const cruce = {};
                    const cruceTotal = {};
                    const cruceRows = {};
                    finalizacionesOrder.forEach(f => { cruceTotal[f] = 0; });
                    const procesarLog = (al) => {
                      const logArr = Array.isArray(al) ? al : (al ? Object.values(al) : []);
                      const crono = [...logArr].reverse();
                      let ultimaAccion = '';
                      crono.forEach(entry => {
                        if (!entry) return;
                        if (entry.type === 'accion' && !['1ª PARTE', '2ª PARTE', 'FIN'].includes(entry.name)) {
                          ultimaAccion = entry.name;
                        } else if (entry.type === 'finalizacion') {
                          const acc = ultimaAccion || 'SIN ACCION';
                          cruce[acc] = cruce[acc] || {};
                          cruce[acc][entry.name] = (cruce[acc][entry.name] || 0) + 1;
                          cruceTotal[entry.name] = (cruceTotal[entry.name] || 0) + 1;
                          cruceRows[acc] = (cruceRows[acc] || 0) + 1;
                        }
                      });
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      procesarLog(m.actionLog);
                    });
                    procesarLog(actionLog);
                    const cruceAcciones = Object.keys(cruce).sort((a, b) => {
                      const ia = accionesOrder.indexOf(a);
                      const ib = accionesOrder.indexOf(b);
                      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
                    });
                    const cruceFinalizaciones = Object.keys(cruceTotal).filter(f => cruceTotal[f] > 0).sort((a, b) => {
                      const ia = finalizacionesOrder.indexOf(a);
                      const ib = finalizacionesOrder.indexOf(b);
                      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                    });
                    const cruceRivalAcciones = cruceAcciones.filter(a => a.startsWith('RIVAL '));
                    const crucePropiasAcciones = cruceAcciones.filter(a => !a.startsWith('RIVAL '));
                    const crucePropiasFinalizaciones = cruceFinalizaciones.filter(f => f !== 'GOL RIVAL' && f !== 'PENAL + GOL RIVAL' && crucePropiasAcciones.some(a => (cruce[a][f] || 0) > 0));
                    const cruceRivalFinalizaciones = cruceFinalizaciones.filter(f => f !== 'GOL' && f !== 'PENAL + GOL' && cruceRivalAcciones.some(a => (cruce[a][f] || 0) > 0));
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {crucePropiasAcciones.length > 0 && crucePropiasFinalizaciones.length > 0 && (
                          <div>
                            <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>TOTAL ACCIONES PROPIAS</span>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr>
                                    <th style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ACCION</th>
                                    {crucePropiasFinalizaciones.map(f => (
                                      <th key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{f}</th>
                                    ))}
                                    <th style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {crucePropiasAcciones.map(a => (
                                    <tr key={a}>
                                      <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}>{a}</td>
                                      {crucePropiasFinalizaciones.map(f => (
                                        <td key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: (cruce[a][f] || 0) > 0 ? '#39ff14' : '#475569', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{cruce[a][f] || ''}</td>
                                      ))}
                                      <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{cruceRows[a] || 0}</td>
                                    </tr>
                                  ))}
                                  <tr>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', color: '#ffffff', fontWeight: 900, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>TOTAL</td>
                                    {crucePropiasFinalizaciones.map(f => (
                                      <td key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{cruceTotal[f] || 0}</td>
                                    ))}
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{crucePropiasAcciones.reduce((s, a) => s + (cruceRows[a] || 0), 0)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {cruceRivalAcciones.length > 0 && cruceRivalFinalizaciones.length > 0 && (
                          <div>
                            <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>TOTAL ACCIONES RIVAL</span>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr>
                                    <th style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ACCION</th>
                                    {cruceRivalFinalizaciones.map(f => (
                                      <th key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{f}</th>
                                    ))}
                                    <th style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cruceRivalAcciones.map(a => (
                                    <tr key={a}>
                                      <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}>{a}</td>
                                      {cruceRivalFinalizaciones.map(f => (
                                        <td key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: (cruce[a][f] || 0) > 0 ? '#39ff14' : '#475569', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{cruce[a][f] || ''}</td>
                                      ))}
                                      <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{cruceRows[a] || 0}</td>
                                    </tr>
                                  ))}
                                  <tr>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', color: '#ffffff', fontWeight: 900, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>TOTAL</td>
                                    {cruceRivalFinalizaciones.map(f => (
                                      <td key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{cruceTotal[f] || 0}</td>
                                    ))}
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.3rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{cruceRivalAcciones.reduce((s, a) => s + (cruceRows[a] || 0), 0)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {grupos.map(([titulo, filasDef]) => (
                          <div key={titulo}>
                            <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>{titulo}</span>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                <thead>
                                  <tr>
                                    <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>ACCION</th>
                                    <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filasDef.map(([label, key]) => (
                                    <tr key={key}>
                                      <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</td>
                                      <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{totalPor(key)}</td>
                                    </tr>
                                  ))}
                                  <tr>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 900, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>TOTAL</td>
                                    <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{filasDef.reduce((s, [, key]) => s + totalPor(key), 0)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
              {activeTab === 'jugadores' && (
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
                  {(() => {
                    const nombres = new Set(Object.keys(jugadoresData));
                    const names = [...nombres];
                    const calcMatchMinutes = (pl, subs, durationSec) => {
                      const minutos = {};
                      const titular = {};
                      const suplente = {};
                      names.forEach(n => { minutos[n] = 0; titular[n] = 0; suplente[n] = 0; });
                      const subsSorted = (Array.isArray(subs) ? subs : (subs ? Object.values(subs) : [])).filter(s => s && s.sale && s.entra).sort((a, b) => (a.minuto || 0) - (b.minuto || 0));
                      names.forEach(n => {
                        const empiezaTitular = (Array.isArray(pl) ? pl : []).some(p => p && p.name === n && p.status === 'titular');
                        let entrySec = empiezaTitular ? 0 : null;
                        subsSorted.forEach(s => {
                          const subSec = (s.minuto || 0) * 60;
                          if (s.sale === n && entrySec !== null) {
                            const added = Math.max(0, subSec - entrySec);
                            minutos[n] += added;
                            if (empiezaTitular) titular[n] += added; else suplente[n] += added;
                            entrySec = null;
                          } else if (s.entra === n) {
                            entrySec = subSec;
                          }
                        });
                        if (entrySec !== null) {
                          const added = Math.max(0, (durationSec || 0) - entrySec);
                          minutos[n] += added;
                          if (empiezaTitular) titular[n] += added; else suplente[n] += added;
                        }
                      });
                      return { minutos, titular, suplente };
                    };
                    const totalMinutos = {};
                    const totalTitular = {};
                    const totalSuplente = {};
                    names.forEach(n => { totalMinutos[n] = 0; totalTitular[n] = 0; totalSuplente[n] = 0; });
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      const pl = Array.isArray(m.players) ? m.players : (m.players ? Object.values(m.players) : []);
                      const mMin = calcMatchMinutes(pl, m.sustituciones, m.timerSeconds || 0);
                      names.forEach(n => { totalMinutos[n] += mMin.minutos[n]; totalTitular[n] += mMin.titular[n]; totalSuplente[n] += mMin.suplente[n]; });
                    });
                    const liveMin = calcMatchMinutes(players, sustituciones, timerSeconds);
                    names.forEach(n => { totalMinutos[n] += liveMin.minutos[n]; totalTitular[n] += liveMin.titular[n]; totalSuplente[n] += liveMin.suplente[n]; });
                    const titularCount = {};
                    const suplenteCount = {};
                    const noConvocadoCount = {};
                    const lesionadoCount = {};
                    const divHonorCount = {};
                    names.forEach(n => { titularCount[n] = 0; suplenteCount[n] = 0; noConvocadoCount[n] = 0; lesionadoCount[n] = 0; divHonorCount[n] = 0; });
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      const pl = Array.isArray(m.players) ? m.players : (m.players ? Object.values(m.players) : []);
                      pl.forEach(p => {
                        if (p && p.name && p.status === 'titular') titularCount[p.name] += 1;
                        if (p && p.name && p.status === 'suplente') suplenteCount[p.name] += 1;
                        if (p && p.name && p.status === 'no convocado') noConvocadoCount[p.name] += 1;
                        if (p && p.name && p.status === 'lesion') lesionadoCount[p.name] += 1;
                        if (p && p.name && p.status === 'division honor') divHonorCount[p.name] += 1;
                      });
                    });
                    (Array.isArray(players) ? players : []).forEach(p => {
                      if (p && p.name && p.status === 'titular') titularCount[p.name] += 1;
                      if (p && p.name && p.status === 'suplente') suplenteCount[p.name] += 1;
                      if (p && p.name && p.status === 'no convocado') noConvocadoCount[p.name] += 1;
                      if (p && p.name && p.status === 'lesion') lesionadoCount[p.name] += 1;
                      if (p && p.name && p.status === 'division honor') divHonorCount[p.name] += 1;
                    });
                    const golCountPerPlayer = {};
                    const golPiePerPlayer = {};
                    const golCabezaPerPlayer = {};
                    const golPenalPerPlayer = {};
                    const asistPerPlayer = {};
                    names.forEach(n => { golCountPerPlayer[n] = 0; golPiePerPlayer[n] = 0; golCabezaPerPlayer[n] = 0; golPenalPerPlayer[n] = 0; asistPerPlayer[n] = 0; });
                    const contarGoles = (gl) => {
                      const arr = Array.isArray(gl) ? gl : (gl ? Object.values(gl) : []);
                      arr.forEach(g => {
                        if (g && g.name) {
                          golCountPerPlayer[g.name] += 1;
                          if ((g.tipo || '').toUpperCase() === 'PIE') golPiePerPlayer[g.name] += 1;
                          if ((g.tipo || '').toUpperCase() === 'CABEZA') golCabezaPerPlayer[g.name] += 1;
                          if ((g.tipo || '').toUpperCase() === 'PENAL') golPenalPerPlayer[g.name] += 1;
                        }
                        if (g && g.name2 && g.name2.toUpperCase() !== 'SIN ASISTENCIA') asistPerPlayer[g.name2] += 1;
                      });
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      contarGoles(m.golesList);
                    });
                    contarGoles(golesList);
                    const golesAccion = {};
                    const derivarAcciones = (al) => {
                      const logArr = Array.isArray(al) ? al : (al ? Object.values(al) : []);
                      const crono = [...logArr].reverse();
                      const res = [];
                      let ultimaAccion = '';
                      crono.forEach(entry => {
                        if (entry && entry.type === 'accion' && !['1ª PARTE', '2ª PARTE', 'FIN'].includes(entry.name)) {
                          ultimaAccion = entry.name;
                        } else if (entry && entry.name === 'GOL') {
                          res.push(ultimaAccion || 'GOL');
                        } else if (entry && entry.name === 'PENAL + GOL') {
                          res.push('PENAL');
                        }
                      });
                      return res;
                    };
                    const contarAccionGoles = (gl, al) => {
                      const arr = Array.isArray(gl) ? gl : (gl ? Object.values(gl) : []);
                      const acciones = derivarAcciones(al);
                      arr.forEach((g, idx) => {
                        if (g && g.name && g.name === jugadorSeleccionado) {
                          const accion = g.accion || acciones[idx] || '';
                          golesAccion[accion] = (golesAccion[accion] || 0) + 1;
                        }
                      });
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      contarAccionGoles(m.golesList, m.actionLog);
                    });
                    contarAccionGoles(golesList, actionLog);
                    const rivalGoalsWhilePlaying = {};
                    names.forEach(n => { rivalGoalsWhilePlaying[n] = 0; });
                    const contarRivalGoals = (m, subs) => {
                      if (!m) return;
                      const pl = Array.isArray(m.players) ? m.players : (m.players ? Object.values(m.players) : []);
                      const rgl = Array.isArray(m.golesRivalList) ? m.golesRivalList : (m.golesRivalList ? Object.values(m.golesRivalList) : []);
                      const subsArr = (Array.isArray(subs) ? subs : (subs ? Object.values(subs) : [])).filter(s => s && (s.sale || s.entra));
                      const matchEnd = Math.max(Math.floor((m.timerSeconds || 0) / 60), ...rgl.map(g => (g && g.minuto) || 0));
                      names.forEach(n => {
                        const p = pl.find(x => x && x.name === n);
                        if (!p) return;
                        let entry = null;
                        let exit = null;
                        if (p.status === 'titular') {
                          entry = 0;
                          const sale = subsArr.find(s => s.sale === n);
                          if (sale) exit = sale.minuto || 0;
                        } else if (p.status === 'suplente') {
                          const entra = subsArr.find(s => s.entra === n);
                          if (entra) {
                            entry = entra.minuto || 0;
                            const sale = subsArr.find(s => s.sale === n);
                            if (sale) exit = sale.minuto || 0;
                          }
                        }
                        if (entry === null) return;
                        const fin = exit === null ? matchEnd : exit;
                        rgl.forEach(g => {
                          if (g && g.minuto >= entry && g.minuto <= fin) rivalGoalsWhilePlaying[n] += 1;
                        });
                      });
                    };
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      contarRivalGoals(m, m.sustituciones);
                    });
                    contarRivalGoals({ players, golesRivalList, timerSeconds }, sustituciones);
                    return (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <select
                      value={jugadorSeleccionado}
                      onChange={(e) => setJugadorSeleccionado(e.target.value)}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        padding: '0.5rem 0.8rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        width: '150px',
                        marginTop: '-1.5rem'
                      }}
                    >
                      <option value="">-</option>
                      {names.sort().map((n) => (
                        <option key={n} value={n}>
                          {jugadoresData[n] && jugadoresData[n].foto && (
                            <img src={jugadoresData[n].foto} alt="" style={{ width: '20px', height: '26px', objectFit: 'cover', verticalAlign: 'middle', marginRight: '6px', borderRadius: '3px' }} />
                          )}
                          {n}
                        </option>
                      ))}
                    </select>
                    {jugadoresData[jugadorSeleccionado] && jugadoresData[jugadorSeleccionado].foto && (
                      <img
                        src={jugadoresData[jugadorSeleccionado].foto}
                        alt={jugadorSeleccionado}
                        style={{
                          width: '150px',
                          height: '200px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '2px solid var(--border-subtle)',
                          marginTop: '0.5rem'
                        }}
                      />
                    )}
                    {jugadoresData[jugadorSeleccionado] && jugadoresData[jugadorSeleccionado].pos1 && (
                      <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '150px', textAlign: 'center' }}>
                        {jugadoresData[jugadorSeleccionado].pos1}
                      </span>
                    )}
                    {jugadoresData[jugadorSeleccionado] && jugadoresData[jugadorSeleccionado].pos2 && (
                      <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '150px', textAlign: 'center' }}>
                        {jugadoresData[jugadorSeleccionado].pos2}
                      </span>
                    )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {jugadorSeleccionado && (
                      <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.3rem', fontFamily: 'var(--font-mono)' }}>
                        DISPUTA {formatTime(totalMinutos[jugadorSeleccionado] || 0)} MIN. = TITULAR {formatTime(totalTitular[jugadorSeleccionado] || 0)} + SUPLENTE {formatTime(totalSuplente[jugadorSeleccionado] || 0)}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {jugadorSeleccionado && (
                      <span style={{ color: '#e044a7', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        ASISTENCIAS: {asistPerPlayer[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado && jugadorSeleccionado !== 'EMILIANO' && jugadorSeleccionado !== 'HECTOR' && (
                      <span style={{ color: '#00bfff', fontWeight: 800, fontSize: '1.5rem', fontFamily: 'var(--font-mono)', marginLeft: '9rem' }}>
                        TOTAL DE GOLES: {golCountPerPlayer[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginLeft: '9rem' }}>
                    {jugadorSeleccionado && (
                      <span style={{ color: '#facc15', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)', marginLeft: '-9rem' }}>
                        TITULAR: {titularCount[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado && jugadorSeleccionado !== 'EMILIANO' && jugadorSeleccionado !== 'HECTOR' && (
                      <span style={{ color: '#00bfff', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)', marginLeft: '12rem' }}>
                        PIE: {golPiePerPlayer[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado && jugadorSeleccionado !== 'EMILIANO' && jugadorSeleccionado !== 'HECTOR' && (
                      <span style={{ color: '#00bfff', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        CABEZA: {golCabezaPerPlayer[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado && jugadorSeleccionado !== 'EMILIANO' && jugadorSeleccionado !== 'HECTOR' && (
                      <span style={{ color: '#00bfff', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        PENAL: {golPenalPerPlayer[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    </div>
                    {jugadorSeleccionado && (
                      <span style={{ color: '#facc15', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        SUPLENTE: {suplenteCount[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado && (
                      <span style={{ color: '#facc15', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        NO CONVOCADO: {noConvocadoCount[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado && (
                      <span style={{ color: '#facc15', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        LESIONADO: {lesionadoCount[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado && (
                      <span style={{ color: '#facc15', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        DIV. HONOR: {divHonorCount[jugadorSeleccionado] || 0}
                      </span>
                    )}
                    {jugadorSeleccionado === 'HECTOR' || jugadorSeleccionado === 'EMILIANO' ? (
                      <span style={{ color: '#ff4d4d', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        GOLES ENCAJADOS: {rivalGoalsWhilePlaying[jugadorSeleccionado] || 0}
                      </span>
                    ) : null}
                    {jugadorSeleccionado && jugadorSeleccionado !== 'HECTOR' && jugadorSeleccionado !== 'EMILIANO' && (
                      <table style={{ borderCollapse: 'collapse', marginTop: '1rem', fontFamily: 'var(--font-mono)' }}>
                        <thead>
                          <tr>
                            <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', color: '#00ff87', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'left' }}>ACCIÓN</th>
                            <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', color: '#00ff87', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>GOLES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(golesAccion).length === 0 ? (
                            <tr>
                              <td colSpan="2" style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', color: '#ffffff', fontSize: '0.9rem' }}>
                                -
                              </td>
                            </tr>
                          ) : (
                            Object.keys(golesAccion).sort().map(accion => (
                              <tr key={accion}>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', color: '#ffffff', fontSize: '0.9rem' }}>{accion}</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', color: '#ffffff', fontSize: '0.9rem', textAlign: 'center' }}>{golesAccion[accion]}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                    </div>
                    </div>
                  </div>
                    );
                  })()}
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
                            <option value="ALEX">ALEX</option>
                          <option value="ALVARO">ALVARO</option>
                          <option value="ANCOR">ANCOR</option>
                          <option value="CARDONA">CARDONA</option>
                          <option value="DANI">DANI</option>
                          <option value="DAVID">DAVID</option>
                          <option value="DIEGO">DIEGO</option>
                          <option value="EMILIANO">EMILIANO</option>
                          <option value="HECTOR">HECTOR</option>
                          <option value="ISMA">ISMA</option>
                          <option value="JONAS">JONAS</option>
                          <option value="JORGE">JORGE</option>
                          <option value="JUANDA">JUANDA</option>
                          <option value="KEVIN">KEVIN</option>
                          <option value="LUCAS">LUCAS</option>
                          <option value="OSCAR">OSCAR</option>
                          <option value="RAVELO">RAVELO</option>
                          <option value="SANTANA">SANTANA</option>
                          <option value="SANTOS">SANTOS</option>
                            <option value="CADETE">CADETE</option>
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
                            <option value="ALEX">ALEX</option>
                            <option value="ALVARO">ALVARO</option>
                            <option value="ANCOR">ANCOR</option>
                            <option value="CARDONA">CARDONA</option>
                            <option value="DANI">DANI</option>
                            <option value="DAVID">DAVID</option>
                            <option value="DIEGO">DIEGO</option>
                            <option value="EMILIANO">EMILIANO</option>
                            <option value="HECTOR">HECTOR</option>
                            <option value="ISMA">ISMA</option>
                            <option value="JONAS">JONAS</option>
                            <option value="JORGE">JORGE</option>
                            <option value="JUANDA">JUANDA</option>
                            <option value="KEVIN">KEVIN</option>
                            <option value="LUCAS">LUCAS</option>
                            <option value="OSCAR">OSCAR</option>
                            <option value="RAVELO">RAVELO</option>
                            <option value="SANTANA">SANTANA</option>
                            <option value="SANTOS">SANTOS</option>
                            <option value="CADETE">CADETE</option>
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
                              const rivalIdx = golesRivalList.findIndex(rg => rg.periodo === g.periodo && rg.minuto === g.minuto);
                              if (rivalIdx !== -1) {
                                setGolesRivalList(golesRivalList.filter((_, j) => j !== rivalIdx));
                              }
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
              {activeTab === 'sustituciones' && (
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
                    SUSTITUCIONES
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[0, 1, 2, 3, 4].map(row => (
                      <div key={row} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1rem', minWidth: '24px', textAlign: 'center' }}>{row + 1}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.2rem' }}>SALE</span>
                          <select
                            value={sustituciones[row]?.sale || ''}
                            onChange={(e) => {
                              const sale = e.target.value;
                              if (!sale) return;
                              setSustituciones(prev => {
                                const next = [...prev];
                                next[row] = { ...(next[row] || {}), sale, minuto: Math.floor(timerSeconds / 60), periodo };
                                return next;
                              });
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
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">-</option>
                            {[...new Set(players.filter(p => p.status === 'titular').map(p => p.name).filter(Boolean))].map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                        <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1rem' }}>por</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.2rem' }}>ENTRA</span>
                          <select
                            value={sustituciones[row]?.entra || ''}
                            onChange={(e) => {
                              const entra = e.target.value;
                              if (!entra) return;
                              setSustituciones(prev => {
                                const next = [...prev];
                                next[row] = { ...(next[row] || {}), entra };
                                return next;
                              });
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
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">-</option>
                            {[...new Set(players.filter(p => p.status === 'suplente').map(p => p.name).filter(Boolean))].map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '35px' }}>
                          <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center', marginBottom: '0.2rem' }}>MINUTO</span>
                          <input
                            type="number"
                            min="0"
                            value={sustituciones[row]?.minuto != null ? sustituciones[row].minuto : ''}
                            onChange={(e) => {
                              setSustituciones(prev => {
                                const next = [...prev];
                                next[row] = { ...(next[row] || {}), minuto: Number(e.target.value) };
                                return next;
                              });
                            }}
                            placeholder="-"
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '8px',
                              color: '#ffffff',
                              fontWeight: 900,
                              fontSize: '0.9rem',
                              padding: '0.4rem 0.6rem',
                              textAlign: 'center',
                              flex: 1
                            }}
                          />
                        </div>
                        <button
                          onClick={() => setSustituciones(prev => {
                            const next = [...prev];
                            next[row] = {};
                            return next;
                          })}
                          style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 900, fontSize: '0.9rem', padding: '0.4rem 0.6rem', cursor: 'pointer', minWidth: '30px', textAlign: 'center' }}
                        >X</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'datos' && (
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
                  {(() => {
                    const totalPosesion = timerSeconds;
                    const rivalPeriods = [];
                    let onRivalStart = null;
                    [...actionLog].reverse().forEach(entry => {
                      const secs = parseTime(entry.time);
                      if (entry.name === 'ON RIVAL') {
                        onRivalStart = { time: entry.time, secs };
                      } else if (entry.name === 'OFF RIVAL' && onRivalStart !== null) {
                        rivalPeriods.push({
                          start: onRivalStart.time,
                          end: entry.time,
                          secs: Math.max(0, secs - onRivalStart.secs)
                        });
                        onRivalStart = null;
                      }
                    });
                    const rivalPosesionSegundos = rivalPeriods.reduce((sum, p) => sum + p.secs, 0);
                    const pctOffRival = totalPosesion > 0 ? (rivalPosesionSegundos / totalPosesion) * 100 : 0;
                    const neutroPeriods = [];
                    let onNeutroStart = null;
                    [...actionLog].reverse().forEach(entry => {
                      const secs = parseTime(entry.time);
                      if (entry.name === 'ON NEUTRO' || entry.name === 'ON PROPIO') {
                        onNeutroStart = { time: entry.time, secs };
                      } else if ((entry.name === 'OFF NEUTRO' || entry.name === 'OFF PROPIO') && onNeutroStart !== null) {
                        neutroPeriods.push({
                          start: onNeutroStart.time,
                          end: entry.time,
                          secs: Math.max(0, secs - onNeutroStart.secs)
                        });
                        onNeutroStart = null;
                      }
                    });
                    const neutroPosesionSegundos = neutroPeriods.reduce((sum, p) => sum + p.secs, 0);
                    const pctOffNeutro = totalPosesion > 0 ? (neutroPosesionSegundos / totalPosesion) * 100 : 0;
                    const pctPropio = Math.max(0, 100 - pctOffRival - pctOffNeutro);
                    const fmt = (v) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
                    return null;
                  })()}
                  {(() => {
                    const acciones = [
                      'TIRO AREA', 'TIRO DERECHA', 'TIRO IZQUIERDA', 'TIRO FRONTAL',
                      'FALTA DERECHA', 'FALTA IZQUIERDA', 'FALTA FRONTAL',
                      'CENTRO DERECHA', 'CENTRO IZQUIERDA',
                      'CORNER IZQUIERDA', 'CORNER DERECHA',
                      'RIVAL TIRO DERECHA', 'RIVAL TIRO AREA', 'RIVAL TIRO IZQUIERDA', 'RIVAL TIRO FRONTAL',
                      'RIVAL FALTA DERECHA', 'RIVAL FALTA IZQUIERDA', 'RIVAL FALTA FRONTAL',
                      'RIVAL CENTRO DERECHA', 'RIVAL CENTRO IZQUIERDA',
                      'RIVAL CORNER IZQUIERDA', 'RIVAL CORNER DERECHA',
                      'INICIO PROPIO', 'INICIO RIVAL',
                      'ON RIVAL', 'ON NEUTRO', 'ON PROPIO', 'OFF RIVAL', 'OFF NEUTRO', 'OFF PROPIO', 'PÉRDIDAS'
                    ];
                    const finalizaciones = [
                      'OCASION', 'FUERA', 'BLOCAJE', 'DESPEJE DEFENSA', 'DESPEJE PORTERO',
                      'SAQUE DE ESQUINA', 'GOL', 'GOL RIVAL', 'PENAL + FUERA', 'PENAL + GOL', 'INFRACCION'
                    ];
                    const matriz = {};
                    acciones.forEach(a => matriz[a] = {});
                    finalizaciones.forEach(f => acciones.forEach(a => matriz[a][f] = 0));
                    let ultimaAccion = null;
                    [...actionLog].reverse().forEach(entry => {
                      if (entry.type === 'accion' && acciones.includes(entry.name)) {
                        ultimaAccion = entry.name;
                      } else if (entry.type === 'finalizacion' && finalizaciones.includes(entry.name) && ultimaAccion) {
                        matriz[ultimaAccion][entry.name] += 1;
                      }
                    });
                    const filas = acciones.filter(a => finalizaciones.some(f => matriz[a][f] > 0));
                    const cols = finalizaciones.filter(f => acciones.some(a => matriz[a][f] > 0));
                    if (filas.length === 0) {
                      return (
                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                          Sin datos aún
                        </span>
                      );
                    }
                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>ACCION</th>
                              {cols.map(f => (
                                <th key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>{f}</th>
                              ))}
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontWeight: 900, textTransform: 'uppercase' }}>TOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filas.map(a => (
                              <tr key={a}>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: a.includes('RIVAL') ? '#ef4444' : '#ffffff', fontWeight: 700 }}>{a}</td>
                                {cols.map(f => (
                                  <td key={f} style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: a.includes('RIVAL') ? '#ef4444' : '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{matriz[a][f] > 0 ? matriz[a][f] : ''}</td>
                                ))}
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900, background: 'rgba(56,189,248,0.08)' }}>{cols.reduce((sum, f) => sum + matriz[a][f], 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
              {activeTab === 'posesion' && (() => {
                const parseTime = (str) => { const p = String(str).split(':').map(Number); return (p[0]||0)*60+(p[1]||0); };

                const calcMatchPossession = (log) => {
                  if (!log || log.length === 0) return null;
                  const arr = normalizeArray(log);
                  const periods = [];
                  let periodStart = null;
                  [...arr].reverse().forEach(e => {
                    if (e && e.time && (e.name === '1ª PARTE' || e.name === '2ª PARTE')) { periodStart = e; }
                    else if (e && e.time && e.name === 'FIN' && periodStart) { periods.push({ start: periodStart, end: e }); periodStart = null; }
                  });
                  if (periodStart) { periods.push({ start: periodStart, end: null }); }
                  if (periods.length === 0) return null;
                  let totalOwn = 0, totalRival = 0, totalDur = 0;
                  const periodResults = periods.map(p => {
                    const startTime = parseTime(p.start.time);
                    const endTime = p.end ? parseTime(p.end.time) : null;
                    const totalSeconds = endTime !== null ? Math.max(1, endTime - startTime) : null;
                    const entries = arr.filter(e => e && e.time && (e.name === 'ON PROPIO' || e.name === 'OFF PROPIO' || e.name === 'ON RIVAL' || e.name === 'OFF RIVAL')).map(e => ({ ...e, secs: parseTime(e.time) })).filter(e => e.secs >= startTime && (endTime === null || e.secs <= endTime)).sort((a,b) => a.secs - b.secs);
                    let ownSecs = 0, rivalSecs = 0;
                    let onPropioStart = null, onRivalStart = null;
                    entries.forEach(e => {
                      if (e.name === 'ON PROPIO') { onPropioStart = e.secs; }
                      else if (e.name === 'OFF PROPIO' && onPropioStart !== null) { ownSecs += e.secs - onPropioStart; onPropioStart = null; }
                      else if (e.name === 'ON RIVAL') { onRivalStart = e.secs; }
                      else if (e.name === 'OFF RIVAL' && onRivalStart !== null) { rivalSecs += e.secs - onRivalStart; onRivalStart = null; }
                    });
                    if (onPropioStart !== null && endTime !== null) ownSecs += endTime - onPropioStart;
                    if (onRivalStart !== null && endTime !== null) rivalSecs += endTime - onRivalStart;
                    if (totalSeconds !== null) { totalOwn += ownSecs; totalRival += rivalSecs; totalDur += totalSeconds; }
                    return { ownSecs, rivalSecs, totalSeconds, startName: p.start.name };
                  });
                  return { periodResults, totalOwn, totalRival, totalDur };
                };

                const matchOptions = matches
                  .filter(m => m.matchday)
                  .map(m => {
                    const score = ` (${m.golCount ?? 0}-${m.golRivalCount ?? 0})`;
                    return { id: m.id, matchday: m.matchday, label: 'J' + m.matchday + ' — ' + (m.homeTeam || '') + ' vs ' + (m.awayTeam || '') + score };
                  })
                  .sort((a, b) => (a.matchday || 0) - (b.matchday || 0));

                const selectedIds = posesionMatchIds;

                const buildRowsForMatch = (m) => {
                  const log = m.id === currentMatch?.id ? actionLog : normalizeArray(m.actionLog || []);
                  const pds = [];
                  let ps = null;
                  [...log].reverse().forEach(e => {
                    if (e && e.time && (e.name === '1ª PARTE' || e.name === '2ª PARTE')) { ps = e; }
                    else if (e && e.time && e.name === 'FIN' && ps) { pds.push({ start: ps, end: e }); ps = null; }
                  });
                  if (ps) { pds.push({ start: ps, end: null }); }
                  const md = m.matchday || 0;
                  const teamInfo = (m.homeTeam || '') + ' vs ' + (m.awayTeam || '');
                  const score = ' (' + (m.golCount ?? 0) + '-' + (m.golRivalCount ?? 0) + ')';
                  const rws = pds.map(p => {
                    const startTime = parseTime(p.start.time);
                    const endTime = p.end ? parseTime(p.end.time) : timerSeconds;
                    const periodoTotal = Math.max(1, endTime - startTime);
                    const entries = log.filter(e => e && e.time && (e.name === 'ON PROPIO' || e.name === 'OFF PROPIO' || e.name === 'ON RIVAL' || e.name === 'OFF RIVAL')).map(e => ({ ...e, secs: parseTime(e.time) })).filter(e => e.secs >= startTime && e.secs <= endTime).sort((a,b) => a.secs - b.secs);
                    let ownSecs = 0, rivalSecs = 0, onPropioStart = null, onRivalStart = null;
                    entries.forEach(e => {
                      if (e.name === 'ON PROPIO') { onPropioStart = e.secs; }
                      else if (e.name === 'OFF PROPIO' && onPropioStart !== null) { ownSecs += e.secs - onPropioStart; onPropioStart = null; }
                      else if (e.name === 'ON RIVAL') { onRivalStart = e.secs; }
                      else if (e.name === 'OFF RIVAL' && onRivalStart !== null) { rivalSecs += e.secs - onRivalStart; onRivalStart = null; }
                    });
                    if (onPropioStart !== null) ownSecs += endTime - onPropioStart;
                    if (onRivalStart !== null) rivalSecs += endTime - onRivalStart;
                    const ownPct = Math.round((ownSecs / periodoTotal) * 100);
                    const rivalPct = Math.round((rivalSecs / periodoTotal) * 100);
                    const neutroPct = Math.round(Math.max(0, periodoTotal - ownSecs - rivalSecs) / periodoTotal * 100);
                    return { label: 'J' + md + ' — ' + p.start.name + ' — ' + teamInfo + score, ownPct: String(ownPct), rivalPct: String(rivalPct), neutroPct: String(neutroPct), ownSecs, rivalSecs, periodoTotal };
                  });
                  let tOwn = 0, tRiv = 0, tDur = 0;
                  rws.forEach(r => { tOwn += r.ownSecs; tRiv += r.rivalSecs; tDur += r.periodoTotal; });
                  const subtotal = { label: 'J' + md + ' — TOTAL — ' + teamInfo + score, ownPct: String(tDur > 0 ? Math.round((tOwn / tDur) * 100) : 0), rivalPct: String(tDur > 0 ? Math.round((tRiv / tDur) * 100) : 0), neutroPct: String(tDur > 0 ? Math.round(Math.max(0, tDur - tOwn - tRiv) / tDur * 100) : 0), ownSecs: tOwn, rivalSecs: tRiv, periodoTotal: tDur };
                  return { rows: rws, subtotal, matchday: md };
                };
                const allMatchData = selectedIds.map(id => { const m = matches.find(x => x.id === id); return m ? buildRowsForMatch(m) : null; }).filter(Boolean);
                let grandOwn = 0, grandRiv = 0, grandDur = 0;
                allMatchData.forEach(d => { grandOwn += d.subtotal.ownSecs; grandRiv += d.subtotal.rivalSecs; grandDur += d.subtotal.periodoTotal; });
                const grandTotal = { label: 'TOTAL GENERAL', ownPct: String(grandDur > 0 ? Math.round((grandOwn / grandDur) * 100) : 0), rivalPct: String(grandDur > 0 ? Math.round((grandRiv / grandDur) * 100) : 0), neutroPct: String(grandDur > 0 ? Math.round(Math.max(0, grandDur - grandOwn - grandRiv) / grandDur * 100) : 0) };
                const toggleMatch = (id) => { setPosesionMatchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
                const toggleAll = () => { if (posesionMatchIds.length === matchOptions.length) { setPosesionMatchIds([]); } else { setPosesionMatchIds(matchOptions.map(o => o.id)); } };
                const dropdownLabel = selectedIds.length === 0 ? 'Seleccionar jornada' : selectedIds.length === matchOptions.length ? 'Todas' : selectedIds.length + ' jornada' + (selectedIds.length > 1 ? 's' : '');
                return (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '2rem', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ width: '100%', maxWidth: '700px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(56,189,248,0.1)' }}>
                          <th style={{ border: '1px solid var(--border-subtle)', padding: '0.5rem 0.8rem', textAlign: 'left', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', position: 'relative' }}>
                            {matchOptions.length > 0 ? (
                              <div style={{ position: 'relative' }}>
                                <div
                                  onClick={() => setPosesionDropdownOpen(!posesionDropdownOpen)}
                                  style={{ background: 'transparent', color: '#ffffff', padding: '0.25rem 0.4rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', userSelect: 'none' }}
                                >
                                  {dropdownLabel} ▾
                                </div>
                                {posesionDropdownOpen && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, minWidth: '320px', background: '#2dd4bf', borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                                    <div
                                      onClick={(e) => { e.stopPropagation(); toggleAll(); }}
                                      style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#000000', fontWeight: 800, fontSize: '0.85rem', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(0,0,0,0.15)' }}
                                    >
                                      {posesionMatchIds.length === matchOptions.length ? 'Todas' : 'Seleccionar todas'}
                                    </div>
                                    {matchOptions.map(o => {
                                      const checked = selectedIds.includes(o.id);
                                      return (
                                      <div
                                        key={o.id}
                                        onClick={(e) => { e.stopPropagation(); toggleMatch(o.id); }}
                                        style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', color: checked ? '#ffffff' : '#000000', fontWeight: checked ? 800 : 600, fontSize: '0.85rem', background: checked ? 'rgba(255,255,255,0.2)' : 'transparent' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = checked ? 'rgba(255,255,255,0.2)' : 'transparent'; }}
                                      >
                                        {checked ? '\u2611' : '\u2610'} {o.label}
                                      </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : 'Período'}
                          </th>
                          <th style={{ border: '1px solid var(--border-subtle)', padding: '0.5rem 0.8rem', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: '#22c55e' }}>Propio</th>
                          <th style={{ border: '1px solid var(--border-subtle)', padding: '0.5rem 0.8rem', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444' }}>Rival</th>
                          <th style={{ border: '1px solid var(--border-subtle)', padding: '0.5rem 0.8rem', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: '#f59e0b' }}>Neutro</th>
                          <th style={{ border: '1px solid var(--border-subtle)', padding: '0.5rem 0.8rem', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: '#38bdf8' }}>Ver <button onClick={() => setHiddenPoseRows(new Set())} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ffffff', fontSize: '1rem', marginLeft: '0.3rem', verticalAlign: 'middle' }} title="Mostrar todas">&#8634;</button></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allMatchData.flatMap((d, mi) => [
                          ...d.rows.filter(r => !hiddenPoseRows.has(r.label)).map((r, ri) => (
                            <tr key={mi + '-' + ri} style={{ background: ri % 2 === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                              <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>{r.label}</td>
                              <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center', color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{r.ownPct}%</td>
                              <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center', color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{r.rivalPct}%</td>
                              <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center', color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{r.neutroPct}%</td>
                              <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center' }}>
                                <button onClick={() => setHiddenPoseRows(prev => { const s = new Set(prev); s.has(r.label) ? s.delete(r.label) : s.add(r.label); return s; })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ffffff', fontSize: '1.1rem' }} title="Ocultar/Mostrar">&#128065;</button>
                              </td>
                            </tr>
                          )), ...(!hiddenPoseRows.has(d.subtotal.label) ? [
                          <tr key={'sub-' + mi} style={{ background: 'rgba(56,189,248,0.12)' }}>
                            <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'left', color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>{d.subtotal.label}</td>
                            <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center', color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{d.subtotal.ownPct}%</td>
                            <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center', color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{d.subtotal.rivalPct}%</td>
                            <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center', color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{d.subtotal.neutroPct}%</td>
                            <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', textAlign: 'center' }}>
                              <button onClick={() => setHiddenPoseRows(prev => { const s = new Set(prev); s.has(d.subtotal.label) ? s.delete(d.subtotal.label) : s.add(d.subtotal.label); return s; })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ffffff', fontSize: '1.1rem' }} title="Ocultar/Mostrar">&#128065;</button>
                            </td>
                          </tr>
                          ] : [])
                        ])}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const chartData = matches
                      .filter(m => m.matchday)
                      .map(m => {
                        const d = buildRowsForMatch(m);
                        return d.rows.length > 0 ? { name: 'J' + m.matchday, Propio: parseInt(d.subtotal.ownPct), Rival: parseInt(d.subtotal.rivalPct), Neutro: parseInt(d.subtotal.neutroPct) } : null;
                      })
                      .filter(Boolean)
                      .sort((a, b) => (parseInt(a.name.slice(1)) || 0) - (parseInt(b.name.slice(1)) || 0));
                    return chartData.length > 0 ? (
                    <div style={{ width: '100%', maxWidth: '700px', height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                          <XAxis dataKey="name" tick={{ fill: '#ffffff', fontSize: 12 }} />
                          <YAxis tick={{ fill: '#ffffff', fontSize: 12 }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: '#ffffff' }} />
                          <Legend wrapperStyle={{ color: '#ffffff', cursor: 'pointer' }} onClick={(e) => { setHiddenLines(prev => ({ ...prev, [e.dataKey]: !prev[e.dataKey] })); }} />
                          <Line type="monotone" dataKey="Propio" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} hide={hiddenLines.Propio} onClick={() => setHiddenLines(prev => ({ ...prev, Propio: !prev.Propio }))} style={{ cursor: 'pointer' }} />
                          <Line type="monotone" dataKey="Rival" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} hide={hiddenLines.Rival} onClick={() => setHiddenLines(prev => ({ ...prev, Rival: !prev.Rival }))} style={{ cursor: 'pointer' }} />
                          <Line type="monotone" dataKey="Neutro" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} hide={hiddenLines.Neutro} onClick={() => setHiddenLines(prev => ({ ...prev, Neutro: !prev.Neutro }))} style={{ cursor: 'pointer' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    ) : null;
                  })()}
                </div>
                );
              })()}
              {activeTab === 'tiempojugado' && (
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
                  {(() => {
                    const names = [...new Set([...players.map(p => p.name).filter(Boolean), ...Object.keys(jugadoresData)])];
                    const calcMatchMinutes = (pl, subs, durationSec) => {
                      const minutos = {};
                      names.forEach(n => { minutos[n] = 0; });
                      const subsSorted = (Array.isArray(subs) ? subs : (subs ? Object.values(subs) : [])).filter(s => s && s.sale && s.entra).sort((a, b) => (a.minuto || 0) - (b.minuto || 0));
                      names.forEach(n => {
                        let entrySec = (Array.isArray(pl) ? pl : []).some(p => p && p.name === n && p.status === 'titular') ? 0 : null;
                        subsSorted.forEach(s => {
                          const subSec = (s.minuto || 0) * 60;
                          if (s.sale === n && entrySec !== null) {
                            minutos[n] += Math.max(0, subSec - entrySec);
                            entrySec = null;
                          } else if (s.entra === n) {
                            entrySec = subSec;
                          }
                        });
                        if (entrySec !== null) {
                          minutos[n] += Math.max(0, (durationSec || 0) - entrySec);
                        }
                      });
                      return minutos;
                    };
                    const totalMinutos = {};
                    names.forEach(n => totalMinutos[n] = 0);
                    matches.forEach(m => {
                      if (currentMatch && m.id === currentMatch.id) return;
                      const pl = Array.isArray(m.players) ? m.players : (m.players ? Object.values(m.players) : []);
                      const mMin = calcMatchMinutes(pl, m.sustituciones, m.timerSeconds || 0);
                      names.forEach(n => totalMinutos[n] += mMin[n]);
                    });
                    const liveMin = calcMatchMinutes(players, sustituciones, timerSeconds);
                    names.forEach(n => totalMinutos[n] += liveMin[n]);
                    const filas = Object.entries(totalMinutos).sort((a, b) => b[1] - a[1]);
                    const titularCount = {};
                    const suplenteCount = {};
                    const noConvocadoCount = {};
                    const lesionadoCount = {};
                    const divHonorCount = {};
                    names.forEach(n => { titularCount[n] = 0; suplenteCount[n] = 0; noConvocadoCount[n] = 0; lesionadoCount[n] = 0; divHonorCount[n] = 0; });
                    matches.forEach(m => {
                      const pl = Array.isArray(m.players) ? m.players : (m.players ? Object.values(m.players) : []);
                      const titulars = new Set(pl.filter(p => p && p.status === 'titular').map(p => p.name).filter(Boolean));
                      const suplentes = new Set(pl.filter(p => p && p.status === 'suplente').map(p => p.name).filter(Boolean));
                      const noConvocados = new Set(pl.filter(p => p && p.status === 'no convocado').map(p => p.name).filter(Boolean));
                      const lesionados = new Set(pl.filter(p => p && p.status === 'lesion').map(p => p.name).filter(Boolean));
                      const divHonor = new Set(pl.filter(p => p && p.status === 'division honor').map(p => p.name).filter(Boolean));
                      names.forEach(n => {
                        if (titulars.has(n)) titularCount[n] += 1;
                        if (suplentes.has(n)) suplenteCount[n] += 1;
                        if (noConvocados.has(n)) noConvocadoCount[n] += 1;
                        if (lesionados.has(n)) lesionadoCount[n] += 1;
                        if (divHonor.has(n)) divHonorCount[n] += 1;
                      });
                    });
                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'left', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>JUGADOR</th>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>TITULAR</th>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>SUPLENTE</th>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>NO CONVOCADO</th>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>LESIONADO</th>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>DIV. HONOR</th>
                              <th style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>MINUTOS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filas.map(([n, m]) => (
                              <tr key={n}>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', color: '#ffffff', fontWeight: 700 }}>{n}</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{titularCount[n]}</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{suplenteCount[n]}</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{noConvocadoCount[n]}</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{lesionadoCount[n]}</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{divHonorCount[n]}</td>
                                <td style={{ border: '1px solid var(--border-subtle)', padding: '0.4rem 0.5rem', textAlign: 'center', color: '#39ff14', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{formatTime(m)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
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
                          <option value="">-</option>
                          {playerOptions.filter(n => n === p.name || !players.some((q, qi) => qi !== i && q.name === n)).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
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
                          <option value="">-</option>
                          {playerOptions.filter(n => n === p.name || !players.some((q, qi) => qi !== i + 12 && q.name === n)).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
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
{activeTab === 'presentacion' && (
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1.5rem', padding: '2rem' }}>
          <div style={{ width: '100%', background: '#8b5cf6', color: '#ffffff', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 800, fontSize: '1rem', textAlign: 'center' }}>
            PRESENTACIÓN — {tr_archivo ? tr_archivo.name : 'Sin archivo'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '0.8rem 1.5rem', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#e2e8f0' }}>ARCHIVO:</span>
              <input
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={tr_handleFile}
              />
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#38bdf8', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tr_archivo ? tr_archivo.name : '-'}
              </span>
            </label>
            {tr_archivo && (
              <button
                onClick={() => {
                  if (tr_videoUrl) URL.revokeObjectURL(tr_videoUrl);
                  setTr_archivo(null);
                  setTr_videoUrl('');
                  setTr_progreso(0);
                }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.8rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              >
                ELIMINAR
              </button>
            )}
          </div>
          {tr_videoUrl && (
            <>
              <div id="tr-video-container" style={{ position: 'relative', maxWidth: '75%' }}>
                <video
                  ref={tr_videoRef}
                  muted
                  controls
                  controlsList="nofullscreen"
                  src={tr_videoUrl}
                  onClick={tr_togglePlay}
                  onPlay={() => setTr_reproduciendo(true)}
                  onPause={() => setTr_reproduciendo(false)}
                  onLoadedMetadata={(e) => setTr_duracion(e.currentTarget.duration || 0)}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    const d = v.duration || 0;
                    setTr_duracion(d);
                    const t = v.currentTime;
                    if (!tr_clipActivo && t > tr_prevTiempoRef.current) {
                      const cl = tr_capturas.find(c => c.videoUrl && c.insertarEn != null && tr_prevTiempoRef.current < c.insertarEn && t >= c.insertarEn);
                      if (cl) {
                        tr_prevTiempoRef.current = cl.insertarEn + (cl.duracion || 4);
                        v.pause();
                        setTr_clipActivo(cl);
                        setTr_reproduciendo(true);
                        return;
                      }
                    }
                    tr_prevTiempoRef.current = t;
                    setTr_progreso(d ? t / d : 0);
                  }}
                  onEnded={() => {
                    setTr_clipActivo(null);
                    setTr_reproduciendo(false);
                    setTr_progreso(1);
                    if (tr_clipTimerRef.current) { clearTimeout(tr_clipTimerRef.current); tr_clipTimerRef.current = null; }
                  }}
                  style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '12px', background: '#000000', border: '1px solid #334155' }}
                />
                <button
                  onClick={() => {
                    const container = document.getElementById('video-container');
                    if (!container) return;
                    if (!document.fullscreenElement) {
                      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
                    } else {
                      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
                    }
                  }}
                  title="Pantalla completa"
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#ffffff', fontSize: '0.85rem', zIndex: 3 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {tr_isFullscreen ? (
                      <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
                    ) : (
                      <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
                    )}
                  </svg>
                </button>
                {tr_clipActivo && tr_clipActivo.tr_videoUrl && (
                  <video
                    ref={(el) => {
                      tr_clipRef.current = el;
                      if (el) el.play().catch(() => {});
                    }}
                    src={tr_clipActivo.tr_videoUrl}
                    muted
                    autoPlay
                    playsInline
                    onClick={(e) => { e.stopPropagation(); tr_togglePlay(); }}
                    onEnded={() => {
                      const v = tr_videoRef.current;
                      if (v) v.play().catch(() => {});
                      setTr_clipActivo(null);
                      setTr_reproduciendo(true);
                    }}
                    title={`Clip 2s en ${tr_formatoTiempo(tr_clipActivo.insertarEn ?? 0)}`}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px', background: '#000000', border: '2px solid #16a34a', zIndex: 2, cursor: 'pointer' }}
                  />
                )}
              </div>
              <div style={{ width: '80%' }}>
                <div
                  onClick={tr_buscarEnTimeline}
                  onPointerDown={(e) => { tr_draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); tr_buscarEnTimeline(e); }}
                  onPointerMove={(e) => { if (tr_draggingRef.current) tr_buscarEnTimeline(e); }}
                  onPointerUp={() => { tr_draggingRef.current = false; }}
                  onPointerCancel={() => { tr_draggingRef.current = false; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    if (!id || !tr_duracion) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                    let nuevo = x * tr_duracion;
                    if (tr_cortes.length > 0) {
                      let minDist = Infinity;
                      let closest = nuevo;
                      for (const ct of tr_cortes) {
                        const d = Math.abs(nuevo - ct);
                        if (d < minDist) { minDist = d; closest = ct; }
                      }
                      if (minDist < tr_duracion * 0.05) nuevo = closest;
                    }
                    nuevo = Math.max(0, Math.min(tr_duracion, nuevo));
                    setTr_capturas(prev => prev.map(c => c.id === Number(id) ? { ...c, insertarEn: nuevo } : c));
                    setTr_aviso(`Clip colocado en ${tr_formatoTiempo(nuevo)}`);
                  }}
                  style={{ position: 'relative', height: '14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', cursor: 'pointer', touchAction: 'none' }}
                >
                  {tr_cortes.length > 0 && (() => {
                    const segColors = ['#1e3a5f', '#3b1f2b', '#1a3d2e', '#3d3a1a', '#2d1a4e', '#4a1a2d', '#1a3a4a', '#4a3a1a'];
                    const pts = [0, ...tr_cortes.map(c => c / tr_duracion), 1];
                    return pts.slice(0, -1).map((start, i) => {
                      const end = pts[i + 1];
                      return (
                        <div key={`seg-${i}`} style={{ position: 'absolute', top: 0, left: `${(start * 100).toFixed(2)}%`, height: '100%', width: `${((end - start) * 100).toFixed(2)}%`, background: segColors[i % segColors.length], borderRadius: i === 0 ? '7px 0 0 7px' : i === pts.length - 2 ? '0 7px 7px 0' : '0' }} />
                      );
                    });
                  })()}
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(100, Math.max(0, ((tr_tActual - tr_inicioVentana) / span) * 100)).toFixed(2)}%`, background: 'rgba(56,189,248,0.3)', borderRadius: '7px', transition: 'width 0.1s linear', zIndex: 1 }} />
                  {tr_cortes.map((ct, i) => {
                    const pos = ((ct - tr_inicioVentana) / span) * 100;
                    return (
                      <div
                        key={`corte-${i}`}
                        onClick={(e) => { e.stopPropagation(); setTr_cortes(prev => prev.filter((_, j) => j !== i)); setTr_aviso(`Corte en ${tr_formatoTiempo(ct)} eliminado`); }}
                        title={`Corte en ${tr_formatoTiempo(ct)} (click para eliminar)`}
                        style={{ position: 'absolute', top: '-2px', left: `${Math.min(100, Math.max(0, pos)).toFixed(2)}%`, transform: 'translateX(-50%)', width: '3px', height: 'calc(100% + 4px)', background: '#ef4444', borderRadius: '2px', cursor: 'pointer', zIndex: 10 }}
                      />
                    );
                  })}
                  <div style={{ position: 'absolute', top: '50%', left: `${Math.min(100, Math.max(0, ((tr_tActual - tr_inicioVentana) / span) * 100)).toFixed(2)}%`, transform: 'translate(-50%, -50%)', width: '16px', height: '16px', background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '50%', transition: 'left 0.1s linear', zIndex: 2 }} />
                </div>
                {tr_cortes.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                    {(() => {
                      const segColors = ['#1e3a5f', '#3b1f2b', '#1a3d2e', '#3d3a1a', '#2d1a4e', '#4a1a2d'];
                      const pts = [0, ...tr_cortes, tr_duracion];
                      return pts.slice(0, -1).map((start, i) => {
                        const end = pts[i + 1];
                        const dur = end - start;
                        return (
                          <div key={`label-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: segColors[i % segColors.length], borderRadius: '6px', padding: '2px 8px', fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#e2e8f0', border: '1px solid #475569' }}>
                            <span style={{ color: '#94a3b8' }}>P{i + 1}</span>
                            <span>{tr_formatoTiempo(start)} — {tr_formatoTiempo(end)}</span>
                            <span style={{ color: '#94a3b8' }}>({tr_formatoTiempo(dur)})</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>{tr_formatoTiempo(tr_videoRef.current ? tr_videoRef.current.currentTime : 0)}</span>
                  <span>{tr_formatoTiempo(tr_totalDuracion)}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    onClick={tr_togglePlay}
                    style={{ background: tr_reproduciendo ? '#f59e0b' : '#16a34a', border: 'none', borderRadius: '12px', padding: '0.7rem 1.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                  >
                    {tr_reproduciendo ? 'PAUSA' : 'PLAY'}
                  </button>
                  <button
                    onClick={tr_capturarImagen}
                    style={{ display: 'inline-flex', alignItems: 'center', background: '#8b5cf6', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', cursor: 'pointer' }}
                    title="Capturar imagen"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                </div>
                {tr_capturas.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
                    {tr_capturas.map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ position: 'relative' }}>
                          {c.videoUrl ? (
                            <video
                              src={c.videoUrl}
                              muted
                              controls
                              playsInline
                              preload="metadata"
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(c.id)); e.dataTransfer.effectAllowed = 'move'; }}
                              onClick={(e) => e.stopPropagation()}
                              title="Clip 2s (arrástralo a la línea de tiempo)"
                              style={{ width: '160px', borderRadius: '8px', border: '1px solid #16a34a', background: '#000000', cursor: 'grab' }}
                            />
                          ) : (
                            <img
                              src={c.dataUrl}
                              alt={`Captura ${i + 1}`}
                              onClick={() => {
                                setTr_figuras(c.figuras || []);
                                setTr_figuraSeleccionada(null);
                                setTr_capturaSeleccionada(c);
                                setTr_capturaGuardada(null);
                                setTr_imgDim(null);
                                setTr_hoja('Edición');
                              }}
                              style={{ width: '160px', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer' }}
                            />
                          )}
                          <button
                            onClick={() => setTr_capturas(prev => prev.filter(x => x.id !== c.id))}
                            title="Eliminar captura"
                            style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '0.9rem', lineHeight: '22px', textAlign: 'center', cursor: 'pointer', padding: '0' }}
                          >
                            ×
                          </button>
                        </div>
                        {c.videoUrl && (
                          <button
                            onClick={() => {
                              setTr_capturas(prev => prev.map(x => x.id === c.id ? { ...x, insertarEn: c.tiempo } : x));
                            }}
                            title={c.insertarEn != null ? 'Ya insertado en su punto' : 'Insertar video en el punto de su captura original'}
                            style={{ background: c.insertarEn != null ? '#16a34a' : '#0f172a', border: `1px solid #16a34a`, borderRadius: '8px', padding: '0.4rem 0.6rem', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: c.insertarEn != null ? '#ffffff' : '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}
                          >
                            {c.insertarEn != null ? 'Insertado' : 'Insertar'}
                          </button>
                        )}
                        <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>
                          {tr_formatoTiempo(c.tiempo)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
)}

{activeTab === 'edicion' && (
<div style={{ flex: 1, position: 'relative', display: 'flex' }}>
          {tr_capturaSeleccionada && (
            <div style={{ position: 'absolute', top: '1rem', right: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem', zIndex: 10 }}>
              <button
                onClick={() => { tr_guardarCaptura(); setTr_capturaSeleccionada(null); setTr_capturaGuardada(null); setTr_figuras([]); setTr_imgDim(null); setTr_figuraSeleccionada(null); }}
                style={{ background: '#dc2626', border: 'none', borderRadius: '12px', padding: '0.7rem 1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button
                onClick={tr_guardarCaptura}
                disabled={tr_exportando}
                style={{ background: '#16a34a', border: 'none', borderRadius: '12px', padding: '0.7rem 1.2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: tr_exportando ? 'wait' : 'pointer', opacity: tr_exportando ? 0.6 : 1 }}
              >
                {tr_exportando ? `${tr_tr_progresoVideo}%` : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>}
              </button>
              {tr_figuraSeleccionada && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  {tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.tipo === 'texto' && (
                    <input
                      value={tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.texto || ''}
                      onChange={(e) => tr_actualizarFigura(tr_figuraSeleccionada, { texto: e.target.value })}
                      placeholder="Escribe el texto"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '180px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.6rem', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#e2e8f0', outline: 'none' }}
                    />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', background: '#1e293b', padding: '0.6rem', borderRadius: '12px', border: '1px solid #334155' }}>
                    {tr_colores.map(c => (
                      <button
                        key={c}
                        onClick={() => tr_actualizarFigura(tr_figuraSeleccionada, { color: c })}
                        title={c}
                        style={{ width: '22px', height: '22px', background: c, borderRadius: '6px', border: tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.color === c ? '2px solid #ffffff' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                      />
                    ))}
                  </div>
                  {[ 'linea', 'flecha', 'polilinea', 'circuito'].includes(tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.tipo) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Grosor
                      </span>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={Math.round((tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.grosor ?? 0.005) * (tr_imgDim?.h || 500))}
                        onChange={(e) => tr_actualizarFigura(tr_figuraSeleccionada, { grosor: Number(e.target.value) / (tr_imgDim?.h || 500) })}
                        title="Grosor de la línea"
                        style={{ width: '120px', cursor: 'pointer' }}
                      />
                    </div>
                  ) : null}
                  {tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.tipo === 'flecha' && (
                    <button
                      onClick={() => tr_actualizarFigura(tr_figuraSeleccionada, { discontinuo: !tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.discontinuo })}
                      title="Continuidad de la flecha"
                      style={{ background: tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.discontinuo ? '#0ea5e9' : '#334155', border: 'none', borderRadius: '12px', padding: '0.5rem 0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                    >
                      {tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.discontinuo ? 'Continua' : 'Discontinua'}
                    </button>
                  )}
                  {!['texto', 'linea', 'flecha', 'polilinea', 'circuito'].includes(tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.tipo) && (
                  <button
                    onClick={() => tr_actualizarFigura(tr_figuraSeleccionada, { rayado: !tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.rayado })}
                    title="Rayas en diagonal"
                    style={{ background: tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.rayado ? '#0ea5e9' : '#334155', border: 'none', borderRadius: '12px', padding: '0.5rem 0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                  >
                    Rayas
                  </button>
                  )}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRight: '1px solid #1e293b' }}>
            <button
              onClick={tr_anadirTriangulo}
              title="Añadir triángulo"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round">
                <polygon points="12,3 22,20 2,20" />
              </svg>
            </button>
            <button
              onClick={tr_anadirCirculo}
              title="Añadir círculo"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
              </svg>
            </button>
            <button
              onClick={tr_anadirTexto}
              title="Añadir texto"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5">
                <polyline points="4,7 4,4 20,4 20,7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </button>
            <button
              onClick={tr_anadirLinea}
              title="Dibujar línea"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="20" x2="20" y2="4" />
              </svg>
            </button>
             <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (tr_modoCirculoClick) { setTr_modoCirculoClick(false); tr_elipsesSessionRef.current = []; }
                  setTr_aviso('');
                  tr_anadirFlecha();
                }}
                title="Añadir flecha"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="20" x2="19" y2="5" />
                  <polyline points="11,5 19,5 19,13" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (tr_modoCirculoClick) {
                    const pts = tr_elipsesSessionRef.current;
                    if (pts.length >= 2) {
                      setTr_figuras(prev => {
                        const sessionCircles = prev.filter(f => f.tipo === 'circulo' && f.sinRelleno && pts.some(p => Math.abs(f.x - p.x) < 0.02 && Math.abs(f.y - p.y) < 0.02));
                        const sessionIds = sessionCircles.map(f => f.id);
                        const elipses = pts.map((p, i) => {
                          const original = sessionCircles[i] || {};
                          return { x: p.x, y: p.y, rx: (original.ancho || 0.04) / 2, ry: (original.alto || 0.025) / 2 };
                        });
                        const id = Date.now();
                        const circuito = { id, tipo: 'circuito', elipses, color: '#38bdf8', opacidad: 1, grosor: 0.003, crecimiento: 0 };
                        if (tr_circuitoAnimRef.current) cancelAnimationFrame(tr_circuitoAnimRef.current);
                        const t0 = performance.now();
                        const paso = (t) => {
                          const pp = Math.min(1, (t - t0) / 1000);
                          const e = 1 - Math.pow(1 - pp, 3);
                          setTr_figuras(curr => curr.map(f => f.id === id ? { ...f, crecimiento: e } : f));
                          if (pp < 1) tr_circuitoAnimRef.current = requestAnimationFrame(paso);
                          else tr_circuitoAnimRef.current = null;
                        };
                        tr_circuitoAnimRef.current = requestAnimationFrame(paso);
                        return [...prev.filter(f => !sessionIds.includes(f.id)), circuito];
                      });
                    } else if (pts.length === 1) {
                      setTr_figuras(prev => prev.filter(f => !(f.tipo === 'circulo' && f.sinRelleno && pts.some(p => Math.abs(f.x - p.x) < 0.02 && Math.abs(f.y - p.y) < 0.02))));
                    }
                    tr_elipsesSessionRef.current = [];
                    setTr_aviso('');
                  } else {
                    tr_elipsesSessionRef.current = [];
                    setTr_aviso('');
                  }
                  setTr_modoCirculoClick(prev => !prev);
                }}
               title={tr_modoCirculoClick ? 'Desactivar y unir elipses' : 'Colocar elipses con click'}
               style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: tr_modoCirculoClick ? '#16a34a' : '#0ea5e9', border: 'none', borderRadius: '12px', padding: '0.7rem', cursor: 'pointer' }}
             >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="12" x2="16" y2="12" />
                <circle cx="8" cy="12" r="4.5" />
                <circle cx="16" cy="12" r="4.5" />
              </svg>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={tr_figuraSeleccionada ? Math.round((tr_figuras.find(f => f.id === tr_figuraSeleccionada)?.opacidad ?? 0.5) * 100) : 50}
              onChange={(e) => { if (tr_figuraSeleccionada) tr_actualizarFigura(tr_figuraSeleccionada, { opacidad: Number(e.target.value) / 100 }); }}
              disabled={!tr_figuraSeleccionada}
              title="Opacidad"
              style={{ width: '120px', cursor: 'pointer' }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => {
            if (tr_modoFlechaClick) {
              const p = tr_puntoImagen(e);
              if (p) {
                if (!tr_flechaOrigenRef.current) {
                  tr_flechaOrigenRef.current = { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
                  setTr_aviso('Ahora click para colocar la punta');
                } else {
                  const x1 = tr_flechaOrigenRef.current.x;
                  const y1 = tr_flechaOrigenRef.current.y;
                  const x2 = Math.min(1, Math.max(0, p.x));
                  const y2 = Math.min(1, Math.max(0, p.y));
                  const cx = (x1 + x2) / 2;
                  const cy = (y1 + y2) / 2;
                  const id = Date.now();
                  setTr_figuras(prev => [...prev, { id, tipo: 'flecha', x1, y1, x2, y2, cx, cy, color: '#38bdf8', opacidad: 1, grosor: 0.005, discontinuo: false, cabeza: 1, crecimiento: 0 }]);
                  setTr_figuraSeleccionada(id);
                  tr_flechaOrigenRef.current = null;
                  setTr_aviso('');
                  if (tr_flechaAnimRef.current) cancelAnimationFrame(tr_flechaAnimRef.current);
                  const t0 = performance.now();
                  const paso = (t) => {
                    const pp = Math.min(1, (t - t0) / 1000);
                    const e = 1 - Math.pow(1 - pp, 3);
                    setTr_figuras(prev => prev.map(f => f.id === id ? { ...f, crecimiento: e } : f));
                    if (pp < 1) tr_flechaAnimRef.current = requestAnimationFrame(paso);
                    else tr_flechaAnimRef.current = null;
                  };
                  tr_flechaAnimRef.current = requestAnimationFrame(paso);
                }
              }
              return;
            }
            if (tr_modoCirculoClick) {
              const p = tr_puntoImagen(e);
              if (p) {
                const id = Date.now();
                setTr_figuras(prev => [...prev, { id, tipo: 'circulo', x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)), ancho: 0.04, alto: 0.025, color: '#38bdf8', opacidad: 0, crecimiento: 1, sinRelleno: true }]);
                setTr_figuraSeleccionada(id);
                tr_elipsesSessionRef.current.push({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) });
              }
              return;
            }
            if (tr_modoPolilinea) {
              const p = tr_puntoImagen(e);
              if (p) setTr_puntosPolilinea(prev => [...prev, { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) }]);
            } else {
              setTr_figuraSeleccionada(null);
            }
          }}>
            {tr_capturaSeleccionada ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }} onClick={() => setTr_figuraSeleccionada(null)}>
                  <img
                    src={tr_capturaSeleccionada.dataUrl}
                    alt="Captura en edición"
                    onLoad={(e) => setTr_imgDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: '92vh', borderRadius: '12px', border: '1px solid #334155' }}
                  />
                  {tr_imgDim && (
                    <svg
                      ref={tr_svgRef}
                      viewBox={`0 0 ${tr_imgDim.w} ${tr_imgDim.h}`}
                      onPointerMove={(e) => {
                        const d = tr_dragRef.current;
                        if (!d) return;
                        const p = tr_puntoImagen(e);
                        if (!p) return;
                        if (d.tipo === 'mover') {
                          if (d.tipoFig === 'polilinea') {
                            const dx = p.x - d.px;
                            const dy = p.y - d.py;
                            tr_actualizarFigura(d.id, { puntos: (d.puntos || []).map(pt => ({ x: pt.x + dx, y: pt.y + dy })) });
                          } else if (d.tipoFig === 'linea' || d.tipoFig === 'flecha') {
                            const dx = p.x - d.px;
                            const dy = p.y - d.py;
                            const up = { x1: d.x1 + dx, y1: d.y1 + dy, x2: d.x2 + dx, y2: d.y2 + dy };
                            if (d.cx != null) { up.cx = d.cx + dx; up.cy = d.cy + dy; }
                            tr_actualizarFigura(d.id, up);
                          } else if (d.tipoFig === 'circuito') {
                            const dx = p.x - d.px;
                            const dy = p.y - d.py;
                            const elipses = (d.elipses || []).map(el => ({ ...el, x: el.x + dx, y: el.y + dy }));
                            tr_actualizarFigura(d.id, { elipses });
                          } else {
                            tr_actualizarFigura(d.id, { x: d.ox + (p.x - d.px), y: d.oy + (p.y - d.py) });
                          }
                        } else if (d.tipo === 'polilineaPunto') {
                          tr_actualizarFigura(d.id, { puntos: (d.puntos || []).map((pt, i) => i === d.indice ? { x: p.x, y: p.y } : pt) });
                        } else if (d.tipo === 'circuitoPunto') {
                          const elipses = (tr_figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => i === d.indice ? { ...el, x: p.x, y: p.y } : el);
                          tr_actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoRadioX') {
                          const elipses = (tr_figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => i === d.indice ? { ...el, rx: Math.max(0.01, Math.abs(p.x - el.x)) } : el);
                          tr_actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoRadioY') {
                          const elipses = (tr_figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => i === d.indice ? { ...el, ry: Math.max(0.01, Math.abs(p.y - el.y)) } : el);
                          tr_actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoRot') {
                          const elipses = (tr_figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => {
                            if (i !== d.indice) return el;
                            const ang = Math.atan2((p.y - el.y) * tr_imgDim.h, (p.x - el.x) * tr_imgDim.w) * 180 / Math.PI;
                            return { ...el, rot: ((ang - (el.hueco ?? 110) / 2) % 360 + 360) % 360 };
                          });
                          tr_actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoHueco') {
                          const elipses = (tr_figuras.find(f => f.id === d.id)?.elipses || []).map((el, i) => {
                            if (i !== d.indice) return el;
                            const ang = (Math.atan2((p.y - el.y) * tr_imgDim.h, (p.x - el.x) * tr_imgDim.w) * 180 / Math.PI + 360) % 360;
                            let dif = ((ang - (el.rot ?? 270)) % 360 + 360) % 360;
                            if (dif > 180) dif -= 360;
                            return { ...el, hueco: Math.max(8, Math.min(340, Math.abs(dif) * 2)) };
                          });
                          tr_actualizarFigura(d.id, { elipses });
                        } else if (d.tipo === 'circuitoTramoA' || d.tipo === 'circuitoTramoB') {
                          const fig = tr_figuras.find(f => f.id === d.id);
                          const a = fig?.elipses?.[d.indice];
                          const b = fig?.elipses?.[d.indice + 1];
                          if (fig && a && b) {
                            const ref = d.tipo === 'circuitoTramoA' ? a : b;
                            const ang = (Math.atan2((p.y - ref.y) * tr_imgDim.h, (p.x - ref.x) * tr_imgDim.w) * 180 / Math.PI + 360) % 360;
                            const tramos = [...(fig.tramos || [])];
                            while (tramos.length < fig.elipses.length - 1) tramos.push({});
                            tramos[d.indice] = { ...(tramos[d.indice] || {}), [d.tipo === 'circuitoTramoA' ? 'angA' : 'angB']: ang };
                            tr_actualizarFigura(d.id, { tramos });
                          }
                        } else if (d.tipo === 'lineaPunto') {
                          if (d.cual === 'p1') {
                            tr_actualizarFigura(d.id, { x1: p.x, y1: p.y, cx: d.cx + (p.x - d.px), cy: d.cy + (p.y - d.py) });
                          } else {
                            tr_actualizarFigura(d.id, { x2: p.x, y2: p.y, cx: d.cx + (p.x - d.px), cy: d.cy + (p.y - d.py) });
                          }
                        } else if (d.tipo === 'flechaCurva') {
                          tr_actualizarFigura(d.id, { cx: p.x, cy: p.y });
                        } else if (d.tipo === 'resize') {
                          if (d.tipoFig === 'texto') {
                            tr_actualizarFigura(d.id, { fontSize: Math.max(0.01, d.tamInicial + (p.y - d.py) * 2) });
                          } else {
                            tr_actualizarFigura(d.id, { ancho: Math.max(0.02, Math.abs(p.x - d.fx) * 2), alto: Math.max(0.02, Math.abs(p.y - d.fy) * 2) });
                          }
                        }
                      }}
                      onPointerUp={() => { tr_dragRef.current = null; }}
                      onPointerCancel={() => { tr_dragRef.current = null; }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    >
                      <defs>
                        {tr_figuras.filter(f => f.rayado).map(f => (
                          <pattern key={f.id} id={`rayado-${f.id}`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="7" stroke={f.color} strokeWidth="4" />
                          </pattern>
                        ))}
                      </defs>
                      {tr_figuras.map(f => {
                        const x = f.x * tr_imgDim.w;
                        const y = f.y * tr_imgDim.h;
                        const ancho = f.ancho * tr_imgDim.w;
                        const alto = f.alto * tr_imgDim.h;
                        const sel = tr_figuraSeleccionada === f.id;
                        const shapeProps = {
                          fill: f.rayado ? `url(#rayado-${f.id})` : f.color,
                          fillOpacity: f.opacidad ?? 0.5,
                          stroke: f.color,
                          strokeWidth: sel ? 3 : 2,
                          style: { pointerEvents: 'all', cursor: 'move' },
                          onClick: (e) => { e.stopPropagation(); setTr_figuraSeleccionada(f.id); },
                          onPointerDown: (e) => {
                            if (tr_circuloAnimRef.current) { cancelAnimationFrame(tr_circuloAnimRef.current); tr_circuloAnimRef.current = null; }
                            if (tr_lineaAnimRef.current) { cancelAnimationFrame(tr_lineaAnimRef.current); tr_lineaAnimRef.current = null; }
                            if (tr_flechaAnimRef.current) { cancelAnimationFrame(tr_flechaAnimRef.current); tr_flechaAnimRef.current = null; if (f.tipo === 'flecha') tr_actualizarFigura(f.id, { cabeza: 1 }); }
                            if (tr_triAnimRef.current) { cancelAnimationFrame(tr_triAnimRef.current); tr_triAnimRef.current = null; if (f.tipo === 'triangulo') tr_actualizarFigura(f.id, { crecimiento: 1 }); }
                            if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                            setTr_figuraSeleccionada(f.id);
                            const p = tr_puntoImagen(e);
                            if (!p) return;
                            tr_dragRef.current = { tipo: 'mover', id: f.id, ox: f.x, oy: f.y, px: p.x, py: p.y, tipoFig: f.tipo, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2, cx: f.cx, cy: f.cy, puntos: f.puntos, elipses: f.elipses };
                            e.currentTarget.setPointerCapture(e.pointerId);
                          },
                        };
const shape = f.tipo === 'triangulo'
                          ? <path {...shapeProps} d={tr_pathTrianguloRedondeado({ x, y: y - alto / 2 }, { x: x - ancho / 2, y: y + alto / 2 }, { x: x + ancho / 2, y: y + alto / 2 }, Math.min(ancho, alto) * 0.12)} />
                          : f.tipo === 'circulo'
                            ? <ellipse {...shapeProps} cx={x} cy={y} rx={ancho / 2} ry={alto / 2} />
                            : f.tipo === 'linea'
                              ? <line
                                  x1={f.x1 * tr_imgDim.w}
                                  y1={f.y1 * tr_imgDim.h}
                                  x2={f.x2 * tr_imgDim.w}
                                  y2={f.y2 * tr_imgDim.h}
                                  stroke={f.color}
                                  strokeOpacity={f.opacidad ?? 1}
                                  strokeWidth={(f.grosor || 0.005) * tr_imgDim.h}
                                  strokeLinecap="round"
                                  style={{ pointerEvents: 'all', cursor: 'move' }}
                                  onClick={shapeProps.onClick}
                                  onPointerDown={shapeProps.onPointerDown}
                                />
                              : f.tipo === 'flecha'
                                ? (() => {
                                    const px1 = f.x1 * tr_imgDim.w;
                                    const py1 = f.y1 * tr_imgDim.h;
                                    const px2 = f.x2 * tr_imgDim.w;
                                    const py2 = f.y2 * tr_imgDim.h;
                                    const pcx = f.cx * tr_imgDim.w;
                                    const pcy = f.cy * tr_imgDim.h;
                                    const grosorPx = (f.grosor || 0.005) * tr_imgDim.h;
                                    const ang = Math.atan2(py2 - pcy, px2 - pcx);
                                    const L = grosorPx * 6 * (f.cabeza ?? 1);
                                    const a = Math.PI / 6;
                                    const hx1 = px2 - L * Math.cos(ang - a);
                                    const hy1 = py2 - L * Math.sin(ang - a);
                                    const hx2 = px2 - L * Math.cos(ang + a);
                                    const hy2 = py2 - L * Math.sin(ang + a);
                                    return (
                                      <g style={{ pointerEvents: 'all', cursor: 'move' }} onClick={shapeProps.onClick} onPointerDown={shapeProps.onPointerDown}>
                                        <path
                                          d={`M ${px1} ${py1} Q ${pcx} ${pcy} ${px2} ${py2}`}
                                          fill="none"
                                          stroke={f.color}
                                          strokeOpacity={f.opacidad ?? 1}
                                          strokeWidth={grosorPx}
                                          strokeLinecap="round"
                                          strokeDasharray={f.discontinuo ? `${grosorPx * 3}, ${grosorPx * 2}` : undefined}
                                        />
                                        <polygon points={`${px2},${py2} ${hx1},${hy1} ${hx2},${hy2}`} fill={f.color} fillOpacity={f.opacidad ?? 1} />
                                      </g>
                                    );
                                  })()
: f.tipo === 'circuito'
                                ? (() => {
                                    const elipses = f.elipses || [{x:f.x1??0.2,y:f.y1??0.5,rx:f.rx1??0.08,ry:f.ry1??0.08},{x:f.x2??0.8,y:f.y2??0.5,rx:f.rx2??0.08,ry:f.ry2??0.08}];
                                    const grosorPx = (f.grosor || 0.005) * tr_imgDim.h;
                                    return (
                                      <g style={{ pointerEvents: 'all', cursor: 'move' }} onClick={shapeProps.onClick} onPointerDown={shapeProps.onPointerDown}>
                                        {elipses.map((el, i) => {
                                          if (i === 0) return null;
                                          const a = elipses[i - 1], b = el;
                                          const tramo = (f.tramos || [])[i - 1] || {};
                                          const pa = tramo.angA != null ? tr_puntoEnElipse(a, tr_imgDim, tramo.angA) : tr_interseccionLineaElipse(a, b, tr_imgDim);
                                          const pb = tramo.angB != null ? tr_puntoEnElipse(b, tr_imgDim, tramo.angB) : tr_interseccionLineaElipse(b, a, tr_imgDim);
                                          if (!pa || !pb) return null;
                                          return <line key={`l${i}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={f.color} strokeOpacity={f.opacidad ?? 1} strokeWidth={grosorPx} strokeLinecap="round" />;
                                        })}
                                        {elipses.map((el, i) => {
                                          const erx = (el.rx ?? 0.08) * tr_imgDim.w;
                                          const ery = (el.ry ?? 0.08) * tr_imgDim.h;
                                          if (erx <= 0 || ery <= 0) return null;
                                          const rot = el.rot ?? 270;
                                          const hueco = el.hueco ?? 110;
                                          const a1 = (rot + hueco / 2) * Math.PI / 180;
                                          const a2 = a1 + (360 - hueco) * Math.PI / 180;
                                          const ax = el.x * tr_imgDim.w + Math.cos(a1) * erx;
                                          const ay = el.y * tr_imgDim.h + Math.sin(a1) * ery;
                                          const bx = el.x * tr_imgDim.w + Math.cos(a2) * erx;
                                          const by = el.y * tr_imgDim.h + Math.sin(a2) * ery;
                                          return <path key={i} d={`M ${ax} ${ay} A ${erx} ${ery} 0 ${360 - hueco > 180 ? 1 : 0} 1 ${bx} ${by}`} fill="none" stroke={f.color} strokeOpacity={f.opacidad ?? 1} strokeWidth={grosorPx} strokeLinecap="round" />;
                                        })}
                                      </g>
                                    );
                                  })()
                              : f.tipo === 'polilinea'
                                ? (() => {
                                    const pts = f.puntos || [];
                                    const grosorPx = (f.grosor || 0.006) * tr_imgDim.h;
                                    const radio = Math.max(5, grosorPx * 1.2);
                                    return (
                                      <g style={{ pointerEvents: 'all', cursor: 'move' }} onClick={shapeProps.onClick} onPointerDown={shapeProps.onPointerDown}>
                                        {pts.length > 1 && (
                                          <polyline
                                            points={pts.map(p => `${p.x * tr_imgDim.w},${p.y * tr_imgDim.h}`).join(' ')}
                                            fill="none"
                                            stroke={f.color}
                                            strokeOpacity={f.opacidad ?? 1}
                                            strokeWidth={grosorPx}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        )}
                                        {pts.map((p, i) => (
                                          <circle key={i} cx={p.x * tr_imgDim.w} cy={p.y * tr_imgDim.h} r={radio} fill={f.color} fillOpacity={f.opacidad ?? 1} stroke="#ffffff" strokeWidth={sel ? 2 : 1} />
                                        ))}
                                      </g>
                                    );
                                  })()
                              : <text
                                  x={x}
                                  y={y}
                                  fontSize={(f.fontSize || 0.06) * tr_imgDim.h}
                                  fill={f.color}
                                  fillOpacity={f.opacidad ?? 1}
                                  stroke={sel ? '#0ea5e9' : 'none'}
                                  strokeWidth={sel ? 1 : 0}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  style={{ pointerEvents: 'all', cursor: 'move', userSelect: 'none' }}
                                  onClick={shapeProps.onClick}
                                  onPointerDown={shapeProps.onPointerDown}
                                >
                                  {f.texto || ''}
                                </text>;
                        const tamTxt = (f.fontSize || 0.06) * tr_imgDim.h;
                        const anchoTxt = Math.max(60, (f.texto || 'Texto').length * tamTxt * 0.6);
                        return (
                          <g key={f.id}>
                            {shape}
                            {sel && (f.tipo === 'linea' || f.tipo === 'flecha' ? (
                              <>
                                <circle
                                  cx={f.x1 * tr_imgDim.w}
                                  cy={f.y1 * tr_imgDim.h}
                                  r={8}
                                  fill="#ffffff"
                                  stroke="#0ea5e9"
                                  strokeWidth="2"
                                  style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => {
                                    setTr_figuraSeleccionada(f.id);
                                    if (tr_lineaAnimRef.current) { cancelAnimationFrame(tr_lineaAnimRef.current); tr_lineaAnimRef.current = null; }
                                    if (tr_flechaAnimRef.current) { cancelAnimationFrame(tr_flechaAnimRef.current); tr_flechaAnimRef.current = null; tr_actualizarFigura(f.id, { cabeza: 1 }); }
                                    const p = tr_puntoImagen(e);
                                    if (!p) return;
                                    tr_dragRef.current = { tipo: 'lineaPunto', id: f.id, cual: 'p1', cx: f.cx, cy: f.cy, px: p.x, py: p.y };
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                  }}
                                />
                                <circle
                                  cx={f.x2 * tr_imgDim.w}
                                  cy={f.y2 * tr_imgDim.h}
                                  r={8}
                                  fill="#ffffff"
                                  stroke="#0ea5e9"
                                  strokeWidth="2"
                                  style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => {
                                    setTr_figuraSeleccionada(f.id);
                                    if (tr_lineaAnimRef.current) { cancelAnimationFrame(tr_lineaAnimRef.current); tr_lineaAnimRef.current = null; }
                                    if (tr_flechaAnimRef.current) { cancelAnimationFrame(tr_flechaAnimRef.current); tr_flechaAnimRef.current = null; tr_actualizarFigura(f.id, { cabeza: 1 }); }
                                    const p = tr_puntoImagen(e);
                                    if (!p) return;
                                    tr_dragRef.current = { tipo: 'lineaPunto', id: f.id, cual: 'p2', cx: f.cx, cy: f.cy, px: p.x, py: p.y };
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                  }}
                                />
                                {f.tipo === 'flecha' && (
                                  <circle
                                    cx={f.cx * tr_imgDim.w}
                                    cy={f.cy * tr_imgDim.h}
                                    r={8}
                                    fill="#facc15"
                                    stroke="#0ea5e9"
                                    strokeWidth="2"
                                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                                    title="Arrastra para curvar la flecha"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => {
                                      setTr_figuraSeleccionada(f.id);
                                      if (tr_flechaAnimRef.current) { cancelAnimationFrame(tr_flechaAnimRef.current); tr_flechaAnimRef.current = null; tr_actualizarFigura(f.id, { cabeza: 1 }); }
                                      const p = tr_puntoImagen(e);
                                      if (!p) return;
                                      tr_dragRef.current = { tipo: 'flechaCurva', id: f.id };
                                      e.currentTarget.setPointerCapture(e.pointerId);
                                    }}
                                  />
                                )}
                              </>
                            ) : f.tipo === 'polilinea' ? (
                              <>
                                {(f.puntos || []).map((p, i) => (
                                  <circle
                                    key={i}
                                    cx={p.x * tr_imgDim.w}
                                    cy={p.y * tr_imgDim.h}
                                    r={8}
                                    fill="#ffffff"
                                    stroke="#0ea5e9"
                                    strokeWidth="2"
                                    style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => {
                                      setTr_figuraSeleccionada(f.id);
                                      const pp = tr_puntoImagen(e);
                                      if (!pp) return;
                                      tr_dragRef.current = { tipo: 'polilineaPunto', id: f.id, indice: i, puntos: f.puntos };
                                      e.currentTarget.setPointerCapture(e.pointerId);
                                    }}
                                  />
                                ))}
                              </>
                            ) : f.tipo === 'circuito' ? (
                              <>
                                {(f.elipses || []).map((el, i) => (
                                  <g key={i}>
                                    <circle
                                      cx={el.x * tr_imgDim.w}
                                      cy={el.y * tr_imgDim.h}
                                      r={7}
                                      fill="#ffffff"
                                      stroke="#0ea5e9"
                                      strokeWidth="2"
                                      style={{ pointerEvents: 'all', cursor: 'move' }}
                                      title={`Mover aro ${i + 1}`}
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => {
                                        setTr_figuraSeleccionada(f.id);
                                        if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                                        const p = tr_puntoImagen(e);
                                        if (!p) return;
                                        tr_dragRef.current = { tipo: 'circuitoPunto', id: f.id, indice: i };
                                        e.currentTarget.setPointerCapture(e.pointerId);
                                      }}
                                    />
                                    <circle
                                      cx={(el.x + (el.rx ?? 0.08)) * tr_imgDim.w}
                                      cy={el.y * tr_imgDim.h}
                                      r={6}
                                      fill="#facc15"
                                      stroke="#0ea5e9"
                                      strokeWidth="2"
                                      style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
                                      title={`Ancho aro ${i + 1}`}
                                      onClick={(e) => e.stopPropagation()}
                                      onPointerDown={(e) => {
                                        setTr_figuraSeleccionada(f.id);
                                        if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                                        const p = tr_puntoImagen(e);
                                        if (!p) return;
                                        tr_dragRef.current = { tipo: 'circuitoRadioX', id: f.id, indice: i };
                                        e.currentTarget.setPointerCapture(e.pointerId);
                                      }}
                                    />
                                     <circle
                                       cx={el.x * tr_imgDim.w}
                                       cy={(el.y + (el.ry ?? 0.08)) * tr_imgDim.h}
                                       r={6}
                                       fill="#fb923c"
                                       stroke="#0ea5e9"
                                       strokeWidth="2"
                                       style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
                                       title={`Alto aro ${i + 1}`}
                                       onClick={(e) => e.stopPropagation()}
                                       onPointerDown={(e) => {
                                         setTr_figuraSeleccionada(f.id);
                                         if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                                         const p = tr_puntoImagen(e);
                                         if (!p) return;
                                         tr_dragRef.current = { tipo: 'circuitoRadioY', id: f.id, indice: i };
                                         e.currentTarget.setPointerCapture(e.pointerId);
                                       }}
                                     />
                                     <circle
                                       cx={(el.x + Math.cos(((el.rot ?? 270) + (el.hueco ?? 110) / 2) * Math.PI / 180) * (el.rx ?? 0.08)) * tr_imgDim.w}
                                       cy={(el.y + Math.sin(((el.rot ?? 270) + (el.hueco ?? 110) / 2) * Math.PI / 180) * (el.ry ?? 0.08)) * tr_imgDim.h}
                                       r={6}
                                       fill="#f472b6"
                                       stroke="#0ea5e9"
                                       strokeWidth="2"
                                       style={{ pointerEvents: 'all', cursor: 'grab' }}
                                       title={`Girar aro ${i + 1}`}
                                       onClick={(e) => e.stopPropagation()}
                                       onPointerDown={(e) => {
                                         setTr_figuraSeleccionada(f.id);
                                         if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                                         const p = tr_puntoImagen(e);
                                         if (!p) return;
                                         tr_dragRef.current = { tipo: 'circuitoRot', id: f.id, indice: i };
                                         e.currentTarget.setPointerCapture(e.pointerId);
                                       }}
                                     />
                                     <circle
                                       cx={(el.x + Math.cos((el.rot ?? 270) * Math.PI / 180) * (el.rx ?? 0.08) * 1.35) * tr_imgDim.w}
                                       cy={(el.y + Math.sin((el.rot ?? 270) * Math.PI / 180) * (el.ry ?? 0.08) * 1.35) * tr_imgDim.h}
                                       r={6}
                                       fill="#a3e635"
                                       stroke="#0ea5e9"
                                       strokeWidth="2"
                                       style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                                       title={`Hueco aro ${i + 1}`}
                                       onClick={(e) => e.stopPropagation()}
                                       onPointerDown={(e) => {
                                         setTr_figuraSeleccionada(f.id);
                                         if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                                         const p = tr_puntoImagen(e);
                                         if (!p) return;
                                         tr_dragRef.current = { tipo: 'circuitoHueco', id: f.id, indice: i };
                                         e.currentTarget.setPointerCapture(e.pointerId);
                                       }}
                                     />
                                     {i < (f.elipses || []).length - 1 && (() => {
                                       const b = f.elipses[i + 1];
                                       const tramo = (f.tramos || [])[i] || {};
                                       const pa = tramo.angA != null ? tr_puntoEnElipse(el, tr_imgDim, tramo.angA) : tr_interseccionLineaElipse(el, b, tr_imgDim);
                                       const pb = tramo.angB != null ? tr_puntoEnElipse(b, tr_imgDim, tramo.angB) : tr_interseccionLineaElipse(b, el, tr_imgDim);
                                       if (!pa || !pb) return null;
                                       return (
                                         <>
                                           <circle
                                             cx={pa.x}
                                             cy={pa.y}
                                             r={5}
                                             fill="#2dd4bf"
                                             stroke="#0ea5e9"
                                             strokeWidth="2"
                                             style={{ pointerEvents: 'all', cursor: 'move' }}
                                             title={`Salida del tramo ${i + 1} hacia el aro ${i + 2} (doble clic: automático)`}
                                             onClick={(e) => e.stopPropagation()}
                                             onDoubleClick={(e) => { e.stopPropagation(); tr_actualizarFigura(f.id, { tramos: (tr_figuras.find(ff => ff.id === f.id)?.tramos || []).map((t, j) => j === i ? { ...t, angA: undefined } : t) }); }}
                                             onPointerDown={(e) => {
                                               setTr_figuraSeleccionada(f.id);
                                               if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                                               const p = tr_puntoImagen(e);
                                               if (!p) return;
                                               tr_dragRef.current = { tipo: 'circuitoTramoA', id: f.id, indice: i };
                                               e.currentTarget.setPointerCapture(e.pointerId);
                                             }}
                                           />
                                           <circle
                                             cx={pb.x}
                                             cy={pb.y}
                                             r={5}
                                             fill="#818cf8"
                                             stroke="#0ea5e9"
                                             strokeWidth="2"
                                             style={{ pointerEvents: 'all', cursor: 'move' }}
                                             title={`Entrada del tramo ${i + 1} en el aro ${i + 2} (doble clic: automático)`}
                                             onClick={(e) => e.stopPropagation()}
                                             onDoubleClick={(e) => { e.stopPropagation(); tr_actualizarFigura(f.id, { tramos: (tr_figuras.find(ff => ff.id === f.id)?.tramos || []).map((t, j) => j === i ? { ...t, angB: undefined } : t) }); }}
                                             onPointerDown={(e) => {
                                               setTr_figuraSeleccionada(f.id);
                                               if (tr_circuitoAnimRef.current) { cancelAnimationFrame(tr_circuitoAnimRef.current); tr_circuitoAnimRef.current = null; }
                                               const p = tr_puntoImagen(e);
                                               if (!p) return;
                                               tr_dragRef.current = { tipo: 'circuitoTramoB', id: f.id, indice: i };
                                               e.currentTarget.setPointerCapture(e.pointerId);
                                             }}
                                           />
                                         </>
                                       );
                                     })()}
                                   </g>
                                 ))}
                              </>
                            ) : (
                              <circle
                                cx={f.tipo === 'texto' ? x + anchoTxt / 2 : x + ancho / 2}
                                cy={f.tipo === 'texto' ? y + tamTxt / 2 : y + alto / 2}
                                r={Math.max(8, (f.tipo === 'texto' ? anchoTxt : ancho) * 0.06)}
                                fill="#ffffff"
                                stroke="#0ea5e9"
                                strokeWidth="2"
                                style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => {
                                  if (tr_circuloAnimRef.current) { cancelAnimationFrame(tr_circuloAnimRef.current); tr_circuloAnimRef.current = null; }
                                  if (tr_triAnimRef.current) { cancelAnimationFrame(tr_triAnimRef.current); tr_triAnimRef.current = null; if (f.tipo === 'triangulo') tr_actualizarFigura(f.id, { crecimiento: 1 }); }
                                  setTr_figuraSeleccionada(f.id);
                                  const p = tr_puntoImagen(e);
                                  if (!p) return;
                                  tr_dragRef.current = { tipo: 'resize', id: f.id, fx: f.x, fy: f.y, tipoFig: f.tipo, tamInicial: f.fontSize || 0.06, py: p.y };
                                  e.currentTarget.setPointerCapture(e.pointerId);
                                }}
                              />
                            ))}
                          </g>
                        );
                      })}
                      {tr_modoPolilinea && tr_puntosPolilinea.length > 0 && (
                        <g style={{ pointerEvents: 'none' }}>
                          {tr_puntosPolilinea.length > 1 && (
                            <polyline points={tr_puntosPolilinea.map(p => `${p.x * tr_imgDim.w},${p.y * tr_imgDim.h}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
                          )}
                          {tr_puntosPolilinea.map((p, i) => (
                            <circle key={i} cx={p.x * tr_imgDim.w} cy={p.y * tr_imgDim.h} r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                          ))}
                        </g>
                      )}
                    </svg>
                  )}
                </div>
                {tr_capturaGuardada && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      {tr_capturaGuardada.tr_videoUrl ? (
                        <video
                          src={tr_capturaGuardada.tr_videoUrl}
                          muted
                          controls
                          playsInline
                          onClick={(e) => {
                            const v = e.currentTarget;
                            if (v.paused) v.play(); else v.pause();
                          }}
                          style={{ width: '320px', borderRadius: '8px', border: '2px solid #16a34a', background: '#000000', cursor: 'pointer' }}
                        />
                      ) : (
                        <img
                          src={tr_capturaGuardada.dataUrl}
                          alt="Captura guardada"
                          style={{ width: '160px', borderRadius: '8px', border: '2px solid #16a34a' }}
                        />
                      )}
                      <button
                        onClick={() => {
                          setTr_capturas(prev => prev.filter(x => x.id !== tr_capturaGuardada.id));
                          setTr_capturaGuardada(null);
                        }}
                        title="Borrar el video modificado"
                        style={{ position: 'absolute', top: '4px', right: '4px', width: '24px', height: '24px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 900, fontSize: '1rem', lineHeight: '24px', textAlign: 'center', cursor: 'pointer', padding: '0' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
                <span style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8' }}>
                    Captura {tr_formatoTiempo(tr_capturaSeleccionada.tiempo)}
                  </span>
                </div>
              </div>
            ) : (
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#94a3b8' }}>Edición</span>
            )}
          </div>
        </div>
 )}

{tr_aviso && (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1.4rem 1.8rem', maxWidth: '340px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>{tr_aviso}</p>
      <button
        onClick={() => {
          if (tr_abrirCarpetaAlOK) {
            setTr_abrirCarpetaAlOK(false);
            try { fetch('/abrir-carpeta'); } catch (e) { /* noop */ }
          }
          setTr_aviso(null);
        }}
        style={{ marginTop: '1rem', background: '#16a34a', border: 'none', borderRadius: '8px', padding: '0.5rem 2rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
      >
        OK
      </button>
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
                      <span style={{ marginLeft: '0.75rem', fontFamily: 'var(--font-mono)', color: '#ffffff', fontWeight: 900, fontSize: '1.1rem' }}>
                        J{m.matchday}
                      </span>
                      <span style={{ marginLeft: '1.5rem', fontFamily: 'var(--font-mono)', color: '#ffffff', fontWeight: 900, fontSize: '1.1rem' }}>
                        {m.golCount || 0} - {m.golRivalCount || 0}
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

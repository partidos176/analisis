import React, { useState, useEffect, useRef } from 'react';
import { auth, db, onAuthStateChanged, signOut, ref, set, push, onValue, update } from './firebase';
import Login from './components/Login';
import TratamientoApp from './TratamientoApp';
import { loadFFmpeg, cutVideoSingle, cutVideoMultiple, isBrowserCutSupported } from './ffmpegCut';
import { compositeVideoWithOverlay } from './compositeVideo';
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

const LEGACY_NAME_MAP = { 'JUAN': 'JUANDA', 'PEDRO': 'CADETE', 'JUAN ': 'JUANDA' };
const normalizePlayerName = (raw) => {
  if (!raw) return '';
  const n = String(raw).trim().toUpperCase();
  return LEGACY_NAME_MAP[n] || n;
};

const dedupePlayers = (list) => {
  const seen = new Set();
  return list.map(p => {
    if (!p || !p.name) return p;
    const norm = normalizePlayerName(p.name);
    if (!norm) return { ...p, name: '' };
    if (seen.has(norm)) return { ...p, name: '', status: '-' };
    seen.add(norm);
    if (norm !== p.name) return { ...p, name: norm };
    return p;
  });
};

// Firebase Realtime Database no acepta `undefined` ni arrays dispersos en `update`.
// Convertimos `undefined` -> null y los arrays dispersos a arrays densos/objetos.
const sanitizeForFirebase = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return Array.from(value).map(sanitizeForFirebase);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = sanitizeForFirebase(value[key]);
    }
    return out;
  }
  return value;
};

const defaultPlayersList = () => {
  const roster = Object.keys(jugadoresData);
  return Array(23).fill(null).map((_, i) => ({ name: roster[i] || '', status: '-' }));
};

const playerOptions = ['ALEX', 'ALVARO', 'ANCOR', 'CARDONA', 'DANI', 'DAVID', 'DIEGO', 'EMILIANO', 'HECTOR', 'ISMA', 'JONAS', 'JORGE', 'JUANDA', 'KEVIN', 'LUCAS', 'OSCAR', 'RAVELO', 'SANTANA', 'SANTOS', 'CADETE'];

const FORMACION_11 = [
  { x: 50, y: 10 },
  { x: 15, y: 28 },
  { x: 38, y: 28 },
  { x: 62, y: 28 },
  { x: 85, y: 28 },
  { x: 22, y: 52 },
  { x: 50, y: 52 },
  { x: 78, y: 52 },
  { x: 20, y: 78 },
  { x: 50, y: 85 },
  { x: 80, y: 78 },
];

const matchTabs = [
  { id: 'alineacion', label: 'ALINEACION' },
  { id: 'acciones', label: 'ACCIONES' },
  { id: 'finalizaciones', label: 'FINALIZACIONES' },
  { id: 'goles', label: 'GOLES' },
  { id: 'sustituciones', label: 'SUSTITUCIONES' },
  { id: 'datos', label: 'DATOS' },
  { id: 'posesion', label: 'POSESION' },
  { id: 'tiempojugado', label: 'TOTAL JUGADO' },
  { id: 'resumengoles', label: 'TOTAL GOLES' },
  { id: 'resumenacciones', label: 'TOTAL ACCIONES' },
  { id: 'jugadores', label: 'JUGADORES' },
  { id: 'videos', label: 'VIDEOS' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState('menu');

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
  const [menuJugadorIdx, setMenuJugadorIdx] = useState(null);
  const [draggingMapIdx, setDraggingMapIdx] = useState(null);
  const campoRef = useRef(null);
  const dragMovedRefGlobal = useRef(false);
  const undoSnapshotRef = useRef(null);
  const prevPlayersRef = useRef(players);
  const isUndoingRef = useRef(false);
  const [, forceHistUpdate] = useState(0);
  useEffect(() => {
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      prevPlayersRef.current = JSON.parse(JSON.stringify(players));
      return;
    }
    if (JSON.stringify(prevPlayersRef.current) === JSON.stringify(players)) return;
    undoSnapshotRef.current = JSON.parse(JSON.stringify(prevPlayersRef.current));
    prevPlayersRef.current = JSON.parse(JSON.stringify(players));
    forceHistUpdate(v => v + 1);
  }, [players]);
  const handleUndoPlayers = () => {
    if (!undoSnapshotRef.current) return;
    const prev = undoSnapshotRef.current;
    undoSnapshotRef.current = null;
    isUndoingRef.current = true;
    setPlayers(prev);
    forceHistUpdate(v => v + 1);
  };
  useEffect(() => {
    // limpia deshacer al cambiar de partido
    undoSnapshotRef.current = null;
    prevPlayersRef.current = JSON.parse(JSON.stringify(players));
    forceHistUpdate(v => v + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch?.id]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && activeTab === 'alineacion' && currentMatch && undoSnapshotRef.current) {
        e.preventDefault();
        const prev = undoSnapshotRef.current;
        undoSnapshotRef.current = null;
        isUndoingRef.current = true;
        setPlayers(prev);
        forceHistUpdate(v => v + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab, currentMatch]);
  useEffect(() => {
    if (draggingMapIdx == null) return;
    const handleMove = (e) => {
      const rect = campoRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      const nx = Math.max(6, Math.min(94, x));
      const ny = Math.max(6, Math.min(94, y));
      dragMovedRefGlobal.current = true;
      setPlayers(prev => {
        const copy = [...prev];
        if (copy[draggingMapIdx]) copy[draggingMapIdx] = { ...copy[draggingMapIdx], mapX: nx, mapY: ny };
        return copy;
      });
    };
    const handleUp = () => {
      setDraggingMapIdx(null);
      setTimeout(() => { dragMovedRefGlobal.current = false; }, 80);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [draggingMapIdx]);
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
  const [saveError, setSaveError] = useState('');
  const [alineacionGuardado, setAlineacionGuardado] = useState(false);
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
  const BUILD_SERVER_URL = import.meta.env.VITE_CORTES_SERVER_URL || '';
  const [customServerUrl, setCustomServerUrl] = useState(() => {
    try { return localStorage.getItem('ft_custom_server_url') || ''; } catch { return ''; }
  });
  const [resolvedServerUrl, setResolvedServerUrl] = useState('');
  const SERVER_URL = resolvedServerUrl;

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
  const [videoParaTratamiento, setVideoParaTratamiento] = useState(null);
  const [generandoAccion, setGenerandoAccion] = useState(null);
  const [progresoAccion, setProgresoAccion] = useState({});
  const [trailPointsPorCorte, setTrailPointsPorCorte] = useState({});
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

  const checkServerStatus = async () => {
    const urls = [customServerUrl, 'http://localhost:3001', BUILD_SERVER_URL].filter(Boolean);
    for (const url of urls) {
      try {
        const r = await fetch(url + '/api/cortar');
        const d = await r.json();
        if (d.ok === true) {
          setResolvedServerUrl(url);
          setServidorCortesDisponible(true);
          return;
        }
      } catch {}
    }
    setServidorCortesDisponible(false);
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, [customServerUrl]);

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

  const applyMatchData = (match, keepCurrent = false) => {
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
    {
      let rawPlayers = match.players ? normalizeArray(match.players) : defaultPlayersList();
      // normaliza nombres legacy (JUAN->JUANDA), trim, upper
      rawPlayers = rawPlayers.map(p => p && p.name ? { ...p, name: normalizePlayerName(p.name) } : p);
      // rellena a 23 y dedup
      while (rawPlayers.length < 23) rawPlayers.push({ name: '', status: '-' });
      rawPlayers = dedupePlayers(rawPlayers).slice(0, 23);
      setPlayers(rawPlayers);
    }
    setTimerSeconds(match.timerSeconds ?? 0);
    setTimerRunning(match.timerRunning ?? false);
    setActionLog(normalizeArray(match.actionLog));
    setSustituciones(normalizeArray(match.sustituciones));
    if (!keepCurrent) setCurrentMatch(match);
  };

  const handleOpenMatch = async (match) => {
    setActiveTab('alineacion');
    applyMatchData(match, false);
  };

  const saveMatchData = async (id) => {
    if (!id) return;
    const payload = sanitizeForFirebase({
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
    try {
      const matchRef = ref(db, `matches/${id}`);
      await update(matchRef, payload);
      setSaveError('');
    } catch (err) {
      console.error('Error guardando datos del partido:', err);
      setSaveError('No se pudieron guardar los datos: ' + (err && err.message ? err.message : err));
    }
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
    saveMatchData(currentMatch.id);
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
      const tryServerBatch = async () => {
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
      };
      if (servidorCortesDisponible) {
        try {
          await tryServerBatch();
          return;
        } catch (serverErr) {
          console.warn('Servidor falló, reintentando...', serverErr.message);
          await new Promise(r => setTimeout(r, 2000));
          try {
            await tryServerBatch();
            return;
          } catch (serverErr2) {
            console.warn('Servidor no disponible, reintentando una vez más...', serverErr2.message);
            setServidorCortesDisponible(false);
            await new Promise(r => setTimeout(r, 3000));
            checkServerStatus();
            try {
              await tryServerBatch();
              return;
            } catch (serverErr3) {
              setServidorCortesDisponible(false);
            }
          }
        }
      }
      if (!isBrowserCutSupported(videoFile)) {
        setCorteError('Servidor no detectado, reintentando conexión...');
        checkServerStatus();
        await new Promise(r => setTimeout(r, 2000));
        try {
          await tryServerBatch();
          return;
        } catch (finalErr) {
          throw new Error('El archivo supera los 4 GB y el servidor de cortes no está disponible. Comprime el vídeo en la pestaña de vídeo o inicia el servidor con: node server.js');
        }
      }
      {
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
    setTrailPoints([{ x: cx, y: cy, time: Date.now(), videoTime: videoRef.current ? videoRef.current.currentTime : 0, bbox: best.bbox }]);
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
      setTrailPoints(prev => [...prev, { x: ncx, y: ncy, time: Date.now(), videoTime: videoRef.current ? videoRef.current.currentTime : 0, bbox: closest.bbox }]);
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

  // Menú principal con 2 opciones
  if (vista === 'menu') {
    const opciones = [
      { id: 'analisis', titulo: 'ANÁLISIS', descripcion: '', color: '#0284c7' },
      { id: 'tratamiento', titulo: 'EDICIÓN', descripcion: '', color: '#8b5cf6' }
    ];
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
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '2rem' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            {opciones.map((op) => (
              <button
                key={op.id}
                onClick={() => setVista(op.id)}
                style={{
                  width: '360px',
                  padding: '3.5rem 2.5rem',
                  background: '#facc15',
                  border: `2px solid ${op.color}`,
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'transform 0.15s ease'
                }}
              >
                <span style={{
                  fontWeight: 900,
                  fontSize: '2.6rem',
                  color: op.id === 'tratamiento' ? '#ffffff' : '#ffffff',
                  background: 'transparent',
                  padding: '0.8rem 1.8rem',
                  borderRadius: '12px',
                  letterSpacing: '0.04em',
                  textAlign: 'center',
                  width: '100%'
                }}>
                  {op.titulo}
                </span>
                <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem' }}>{op.descripcion}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Tratamiento de dibujos (app copiado literal)
  if (vista === 'tratamiento') {
    return (
      <>
        <button
          onClick={() => setVista('menu')}
          title="Volver al menú"
          style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 1000, background: '#0284c7', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}
        >
          &#8592; MENÚ
        </button>
        <TratamientoApp videoInicial={videoParaTratamiento} />
      </>
    );
  }

  // Página del partido
  if (currentMatch) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="app-header">
          <button className="btn-sm btn-secondary app-back-btn" onClick={handleBackToList}>&#8592;</button>
          <nav className="app-tabs">
            {matchTabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => {
                  if (tab.id === 'posesion') setPosesionMatchIds(currentMatch?.id ? [currentMatch.id] : []);
                  setActiveTab(tab.id);
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="app-header-actions">
            <button className="btn-sm btn-secondary" onClick={() => setVista('tratamiento')}>Tratamiento Dibujos</button>
            <button className="btn-sm btn-secondary" onClick={handleLogout}>Salir</button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: activeTab === 'alineacion' ? '980px' : '800px' }}>
            {saveError && (
              <div style={{
                background: '#dc2626',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.9rem',
                padding: '0.7rem 1rem',
                borderRadius: '10px',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span>{saveError}</span>
                <button onClick={() => setSaveError('')} style={{ background: 'transparent', border: 'none', color: '#ffffff', fontWeight: 900, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
            )}
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
              {activeTab !== 'resumengoles' && activeTab !== 'resumenacciones' && activeTab !== 'tiempojugado' && activeTab !== 'videos' && activeTab !== 'posesion' && activeTab !== 'jugadores' && (
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
              <span style={{ fontSize: ['tiempojugado', 'resumengoles', 'resumenacciones', 'videos', 'posesion', 'jugadores'].includes(activeTab) ? '1.8rem' : '1.2rem', fontWeight: 700, color: '#ffffff', background: 'var(--bg-secondary)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
                {activeTab === 'videos' ? 'CORTES DE VÍDEO' : activeTab === 'posesion' ? 'POSESIÓN' : activeTab === 'jugadores' ? 'JUGADORES' : `JORNADA ${currentMatch.matchday}`}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <button
                      onClick={async () => {
                        if (!currentMatch) { alert('No hay partido abierto para guardar'); return; }
                        try {
                          await saveMatchData(currentMatch.id);
                          const XLSX = await import('xlsx');
                            const resumen = {
                              matchday: currentMatch.matchday,
                              homeTeam: currentMatch.homeTeam,
                              awayTeam: currentMatch.awayTeam,
                              tiroDerechaCount, tiroAreaCount, rivalTiroDerechaCount, rivalTiroAreaCount,
                              tiroIzquierdaCount, tiroFrontalCount, faltaDerechaCount, faltaIzquierdaCount, faltaFrontalCount,
                              centroDerechaCount, centroIzquierdaCount, cornerIzquierdaCount, cornerDerechaCount,
                              rivalTiroIzquierdaCount, rivalTiroFrontalCount, rivalFaltaDerechaCount, rivalFaltaIzquierdaCount,
                              rivalFaltaFrontalCount, rivalCentroDerechaCount, rivalCentroIzquierdaCount, rivalCornerIzquierdaCount, rivalCornerDerechaCount,
                              inicioPropioCount, inicioRivalCount, onRivalCount, offRivalCount, onNeutroCount, offNeutroCount, perdidasCount,
                              fueraCount, blocajeCount, despejeDefensaCount, despejePorteroCount, golCount, golRivalCount, penalCount,
                              saqueEsquinaFueraCount, infraccionCount, ocasionCount, timerSeconds
                            };
                            const wb = XLSX.utils.book_new();
                            const wsResumen = XLSX.utils.json_to_sheet(Object.entries(resumen).map(([k, v]) => ({ CAMPO: k, VALOR: v })));
                            XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
                            const wsJugadores = XLSX.utils.json_to_sheet(players.map(p => ({ nombre: p.name, estado: p.status, mapX: p.mapX, mapY: p.mapY })));
                            XLSX.utils.book_append_sheet(wb, wsJugadores, 'Jugadores');
                            const wsAcciones = XLSX.utils.json_to_sheet(actionLog.map(e => ({ tiempo: e.time, nombre: e.name, tipo: e.type })));
                            XLSX.utils.book_append_sheet(wb, wsAcciones, 'Acciones');
                            const wsGoles = XLSX.utils.json_to_sheet([...golesList.map(g => ({ equipo: 'PROPIO', ...g })), ...golesRivalList.map(g => ({ equipo: 'RIVAL', ...g }))]);
                            XLSX.utils.book_append_sheet(wb, wsGoles, 'Goles');
                            const wsSust = XLSX.utils.json_to_sheet((sustituciones || []).map(s => ({ minuto: s.minuto, entra: s.entra, sale: s.sale })));
                            XLSX.utils.book_append_sheet(wb, wsSust, 'Sustituciones');
                            const logPos = actionLog.map(e => ({ ...e, secs: parseTime(e.time) })).filter(e => e.secs >= 0);
                            const pdsPos = [];
                            let psPos = null;
                            [...logPos].reverse().forEach(e => {
                              if (e.name === '1ª PARTE' || e.name === '2ª PARTE') { psPos = e; }
                              else if (e.name === 'FIN' && psPos) { pdsPos.push({ start: psPos, end: e }); psPos = null; }
                            });
                            if (psPos) pdsPos.push({ start: psPos, end: null });
                            const posRows = pdsPos.map(p => {
                              const startT = parseTime(p.start.time);
                              const endT = p.end ? parseTime(p.end.time) : timerSeconds;
                              const total = Math.max(1, endT - startT);
                              const entries = logPos.filter(e => e.secs >= startT && e.secs <= endT && (e.name === 'ON PROPIO' || e.name === 'OFF PROPIO' || e.name === 'ON RIVAL' || e.name === 'OFF RIVAL')).sort((a, b) => a.secs - b.secs);
                              let ownSecs = 0, rivalSecs = 0, opStart = null, orStart = null;
                              entries.forEach(e => {
                                if (e.name === 'ON PROPIO') opStart = e.secs;
                                else if (e.name === 'OFF PROPIO' && opStart !== null) { ownSecs += e.secs - opStart; opStart = null; }
                                else if (e.name === 'ON RIVAL') orStart = e.secs;
                                else if (e.name === 'OFF RIVAL' && orStart !== null) { rivalSecs += e.secs - orStart; orStart = null; }
                              });
                              if (opStart !== null) ownSecs += endT - opStart;
                              if (orStart !== null) rivalSecs += endT - orStart;
                              const neutroSecs = Math.max(0, total - ownSecs - rivalSecs);
                              const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
                              return { periodo: p.start.name, propio: fmt(ownSecs) + ' (' + Math.round((ownSecs / total) * 100) + '%)', rival: fmt(rivalSecs) + ' (' + Math.round((rivalSecs / total) * 100) + '%)', neutro: fmt(neutroSecs) + ' (' + Math.round((neutroSecs / total) * 100) + '%)' };
                            });
                            const wsPos = XLSX.utils.json_to_sheet(posRows.length ? posRows : [{ periodo: 'SIN DATOS', propio: '', rival: '', neutro: '' }]);
                            XLSX.utils.book_append_sheet(wb, wsPos, 'Posesion');
                            const accionesDatos = ['TIRO AREA','TIRO DERECHA','TIRO IZQUIERDA','TIRO FRONTAL','FALTA DERECHA','FALTA IZQUIERDA','FALTA FRONTAL','CENTRO DERECHA','CENTRO IZQUIERDA','CORNER IZQUIERDA','CORNER DERECHA','RIVAL TIRO DERECHA','RIVAL TIRO AREA','RIVAL TIRO IZQUIERDA','RIVAL TIRO FRONTAL','RIVAL FALTA DERECHA','RIVAL FALTA IZQUIERDA','RIVAL FALTA FRONTAL','RIVAL CENTRO DERECHA','RIVAL CENTRO IZQUIERDA','RIVAL CORNER IZQUIERDA','RIVAL CORNER DERECHA','INICIO PROPIO','INICIO RIVAL','ON RIVAL','ON NEUTRO','ON PROPIO','OFF RIVAL','OFF NEUTRO','OFF PROPIO','PÉRDIDAS'];
                            const finalizacionesDatos = ['OCASION','FUERA','BLOCAJE','DESPEJE DEFENSA','DESPEJE PORTERO','SAQUE DE ESQUINA','GOL','GOL RIVAL','PENAL + FUERA','PENAL + GOL','INFRACCION'];
                            const matrizDatos = {};
                            accionesDatos.forEach(a => { matrizDatos[a] = {}; finalizacionesDatos.forEach(f => { matrizDatos[a][f] = 0; }); });
                            let ultimaAccion = null;
                            [...actionLog].reverse().forEach(entry => {
                              if (entry.type === 'accion' && accionesDatos.includes(entry.name)) ultimaAccion = entry.name;
                              else if (entry.type === 'finalizacion' && finalizacionesDatos.includes(entry.name) && ultimaAccion) { matrizDatos[ultimaAccion][entry.name] += 1; }
                            });
                            const filasDatos = accionesDatos.filter(a => finalizacionesDatos.some(f => matrizDatos[a][f] > 0));
                            const colsDatos = finalizacionesDatos.filter(f => accionesDatos.some(a => matrizDatos[a][f] > 0));
                            const datosRows = filasDatos.map(a => ({ ACCION: a, ...Object.fromEntries(colsDatos.map(f => [f, matrizDatos[a][f] || ''])), TOTAL: colsDatos.reduce((s, f) => s + matrizDatos[a][f], 0) }));
                            const wsDatos = XLSX.utils.json_to_sheet(datosRows.length ? datosRows : [{ ACCION: 'SIN DATOS' }]);
                            XLSX.utils.book_append_sheet(wb, wsDatos, 'Datos');
                            const rawData = { ...resumen, players, actionLog, golesList, golesRivalList, sustituciones, timerSeconds, timerRunning };
                            const wsRaw = XLSX.utils.aoa_to_sheet([['DATOS'], [JSON.stringify(rawData)]]);
                            XLSX.utils.book_append_sheet(wb, wsRaw, 'RAW');
                            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                            const blob = new Blob([wbout], { type: 'application/octet-stream' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `J${currentMatch.matchday || '?'}_${currentMatch.homeTeam || ''}_vs_${currentMatch.awayTeam || ''}_datos.xlsx`;
                            a.click();
                            URL.revokeObjectURL(url);
                            alert('Partido guardado y archivo Excel generado');
                          } catch (err) {
                            alert('Error al guardar: ' + (err?.message || err));
                          }
                        }}
                        style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '6px', padding: '0.5rem 1.2rem', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '0.04em' }}>
                        GUARDAR
                      </button>
                      <button
                        onClick={() => {
                          if (!currentMatch) { alert('Abre primero el partido donde quieres importar los datos'); return; }
                          const inp = document.createElement('input');
                          inp.type = 'file';
                          inp.accept = '.xlsx,.xls';
                          inp.onchange = async () => {
                            const file = inp.files[0];
                            if (!file) return;
                            try {
                              const XLSX = await import('xlsx');
                              const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                              const rawWs = wb.Sheets['RAW'];
                              if (!rawWs) { alert('Este Excel no fue generado por "Guardar" (falta hoja RAW)'); return; }
                              const rawText = XLSX.utils.sheet_to_json(rawWs, { header: 1 })[1]?.[0];
                              const data = JSON.parse(rawText);
                              applyMatchData(data, true);
                              alert('Datos importados en el partido actual. Pulsa GUARDAR para conservarlos.');
                            } catch (err) {
                              alert('Error al importar Excel: ' + (err?.message || err));
                            }
                          };
                          inp.click();
                        }}
                        style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.2rem', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '0.04em' }}>
                        IMPORTAR EXCEL
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
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, zIndex: 10 }}
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
                  {videoFile && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', width: '100%', maxWidth: '900px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Servidor:</span>
                        <input
                          type="text"
                          placeholder="Auto: localhost:3001"
                          value={customServerUrl}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            setCustomServerUrl(v);
                            try { localStorage.setItem('ft_custom_server_url', v); } catch {}
                            checkServerStatus();
                          }}
                          style={{
                            flex: 1,
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-secondary)',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        />
                        <span style={{
                          color: servidorCortesDisponible === true ? '#22c55e' : servidorCortesDisponible === false ? '#ef4444' : '#94a3b8',
                          fontWeight: 700,
                          fontSize: '0.7rem'
                        }}>
                          {servidorCortesDisponible === true ? '● Conectado' : servidorCortesDisponible === false ? '● Sin servidor' : '● ...'}
                        </span>
                        {resolvedServerUrl && (
                          <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.6rem', fontFamily: 'var(--font-mono)' }}>
                            {resolvedServerUrl}
                          </span>
                        )}
                      </div>
                    </div>
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
                                setProgresoAccion(prev => ({ ...prev, [actionKey]: 0 }));
                                setPreviewAccion(null);
                                const trailSnapshot = trailPoints.map(p => ({ ...p }));
                                const videoTimeSnapshot = videoRef.current ? videoRef.current.currentTime : 0;
                                const videoTimeOffsetSnapshot = videoTimeOffset;
                                const videoName = filtroAccion === '__varios__' ? 'VARIOS ' + (idx + 1) : (() => { const sameName = accionesFiltradas.filter(a => a.name === e.name); const correlative = sameName.indexOf(e) + 1; return sameName.length > 1 ? e.name + ' ' + correlative : e.name; })();
                                const doCut = async () => {
                                  const tryServer = async () => {
                                    return await new Promise((resolve, reject) => {
                                      let serverProgressInterval = null;
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
                                        if (serverProgressInterval) clearInterval(serverProgressInterval);
                                        setProgresoAccion(prev => ({ ...prev, [actionKey]: 95 }));
                                        if (xhr.status >= 200 && xhr.status < 300) {
                                          resolve(new Blob([xhr.response], { type: 'video/mp4' }));
                                        } else {
                                          try { const errData = JSON.parse(xhr.responseText); reject(new Error(errData.error || 'Error en el servidor')); } catch { reject(new Error('Error en el servidor')); }
                                        }
                                      };
                                      xhr.onerror = () => {
                                        if (serverProgressInterval) clearInterval(serverProgressInterval);
                                        reject(new Error('No se pudo conectar al servidor'));
                                      };
                                      xhr.responseType = 'blob';
                                      xhr.send(formData);
                                      serverProgressInterval = setInterval(() => {
                                        setProgresoAccion(prev => {
                                          const cur = prev[actionKey] || 90;
                                          if (cur < 98) return { ...prev, [actionKey]: cur + 1 };
                                          return prev;
                                        });
                                      }, 2000);
                                    });
                                  };
                                  if (servidorCortesDisponible) {
                                    try {
                                      return await tryServer();
                                    } catch (serverErr) {
                                      console.warn('Servidor falló, reintentando...', serverErr.message);
                                      await new Promise(r => setTimeout(r, 2000));
                                      try {
                                        return await tryServer();
                                      } catch (serverErr2) {
                                        console.warn('Servidor no disponible, reintentando una vez más...', serverErr2.message);
                                        setServidorCortesDisponible(false);
                                        await new Promise(r => setTimeout(r, 3000));
                                        checkServerStatus();
                                        try {
                                          return await tryServer();
                                        } catch (serverErr3) {
                                          setServidorCortesDisponible(false);
                                        }
                                      }
                                    }
                                  }
                                  if (!isBrowserCutSupported(videoFile)) {
                                    setCorteError('Servidor no detectado, reintentando conexión...');
                                    checkServerStatus();
                                    await new Promise(r => setTimeout(r, 2000));
                                    try {
                                      return await tryServer();
                                    } catch (finalErr) {
                                      throw new Error('El archivo supera los 4 GB y el servidor de cortes no está disponible. Comprime el vídeo en la pestaña de vídeo o inicia el servidor con: node server.js');
                                    }
                                  }
                                  return await cutVideoSingle(videoFile, adjustedTime, duracion, videoName, (p) => {
                                    setProgresoAccion(prev => ({ ...prev, [actionKey]: Math.round(p * 100) }));
                                  });
                                };
                                doCut().then(blob => {
                                  if (previewAccion && previewAccion.url) URL.revokeObjectURL(previewAccion.url);
                                  const url = URL.createObjectURL(blob);
                                  setPreviewAccion({ url: url, name: videoName, key: actionKey, blob: blob });
                                  setTrailPointsPorCorte(prev => ({ ...prev, [actionKey]: { points: trailSnapshot, videoTimeOffset: videoTimeSnapshot, cutStartSecs: totalSecs, duration: duracion } }));
                                }).catch(err => { setCorteError(err.message || 'Error al generar el vídeo'); }).finally(() => { setGenerandoAccion(null); setProgresoAccion(prev => { const copy = Object.assign({}, prev); delete copy[actionKey]; return copy; }); });
                              }} style={{ background: generandoAccion === actionKey ? `linear-gradient(90deg, #16a34a ${(progresoAccion[actionKey] || 0)}%, #eab308 ${(progresoAccion[actionKey] || 0)}%)` : '#eab308', color: '#000000', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap', minWidth: '70px', textAlign: 'center' }}>{generandoAccion === actionKey ? (progresoAccion[actionKey] != null ? progresoAccion[actionKey] + '%' : '...') : 'Generar'}</button>
                              {filtroAccion === '__varios__' && <button onClick={(ev) => { ev.stopPropagation(); setVariosBaseTimes(prev => { const copy = Object.assign({}, prev); delete copy[e.name + '_' + e.time]; return copy; }); setVariosIndex(prev => Math.max(0, prev - 1)); setAccionSeleccionada(null); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>&#10005;</button>}
                            </div>
                            {previewAccion && previewAccion.key === actionKey && (
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.3rem', paddingLeft: '0.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{previewAccion.name}</span>
                                  <video
                                    src={previewAccion.url}
                                    controls
                                    style={{ display: 'block', width: '260px', borderRadius: '8px', background: '#000000' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1.5rem' }}>
                                  <button onClick={async () => {
                                    if (!previewAccion || !previewAccion.blob) return;
                                    const trailData = trailPointsPorCorte[previewAccion.key];
                                    console.log('[DEBUG Descargar] trailData:', trailData);
                                    console.log('[DEBUG Descargar] all trailPointsPorCorte keys:', Object.keys(trailPointsPorCorte));
                                    console.log('[DEBUG Descargar] previewAccion.key:', previewAccion.key);
                                    console.log('[DEBUG Descargar] blob size:', previewAccion.blob.size, 'type:', previewAccion.blob.type);
                                    let blob = previewAccion.blob;
                                    if (trailData && trailData.points && trailData.points.length >= 2) {
                                      console.log('[DEBUG Descargar] Componiendo con', trailData.points.length, 'trail points, cutStartSecs:', trailData.cutStartSecs, 'duration:', trailData.duration);
                                      console.log('[DEBUG Descargar] Primeros 3 points:', trailData.points.slice(0, 3));
                                      try {
                                        blob = await compositeVideoWithOverlay(previewAccion.blob, trailData);
                                        console.log('[DEBUG Descargar] Composición OK, blob size:', blob.size, 'type:', blob.type);
                                      } catch (e) { console.error('Composición fallida, descargando sin overlay:', e); }
                                    } else {
                                      console.log('[DEBUG Descargar] Sin trail data suficiente, descargando raw');
                                    }
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = previewAccion.name + (blob.type.includes('webm') ? '.webm' : '.mp4');
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    setTimeout(() => URL.revokeObjectURL(url), 3000);
                                  }} style={{ background: '#22c55e', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.7rem 1.3rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Descargar</button>
                                  <button onClick={() => { if (previewAccion && previewAccion.url) URL.revokeObjectURL(previewAccion.url); setPreviewAccion(null); }} style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.7rem 1.3rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Borrar</button>
                                  <button onClick={() => {
                                    if (!previewAccion || !previewAccion.blob) return;
                                    setVideoParaTratamiento(previewAccion.blob);
                                    setVista('tratamiento');
                                  }} style={{ background: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.7rem 1.3rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Editar</button>
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
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.8rem', textAlign: 'center', maxWidth: '100%' }}>
                        Sin servidor de cortes. Introduce la URL del servidor arriba para procesar vídeos grandes.
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL ACCIONES PROPIAS</span>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button onClick={async () => { const XLSX=await import('xlsx'); const headers=['ACCION',...crucePropiasFinalizaciones,'TOTAL']; const rows=crucePropiasAcciones.map(a=>[a,...crucePropiasFinalizaciones.map(f=>cruce[a][f]||''),cruceRows[a]||0]); rows.push(['TOTAL',...crucePropiasFinalizaciones.map(f=>cruceTotal[f]||0),crucePropiasAcciones.reduce((s,a)=>s+(cruceRows[a]||0),0)]); const ws=XLSX.utils.aoa_to_sheet([headers,...rows]); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Propias'); const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'}); const blob=new Blob([wbout],{type:'application/octet-stream'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='total_acciones_propias.xlsx'; a.click(); URL.revokeObjectURL(url); }} style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:'6px', padding:'0.25rem 0.6rem', fontWeight:800, fontSize:'0.65rem', cursor:'pointer' }}>Exportar Excel</button>
                                <button onClick={() => { const inp=document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls,.csv,.json'; inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); if(f.name.endsWith('.xlsx')||f.name.endsWith('.xls')){ r.onload=async()=>{ try{ const XLSX=await import('xlsx'); const wb=XLSX.read(r.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const data=XLSX.utils.sheet_to_json(ws,{header:1}); console.log('Importadas propias xlsx',data); alert('Importado Excel: '+f.name+' ('+data.length+' filas)'); }catch(err){ alert('Error al importar: '+err.message); } }; r.readAsArrayBuffer(f); } else { r.onload=()=>{ try{ const t=r.result; if(f.name.endsWith('.json')){ const d=JSON.parse(t); console.log('Importadas propias',d);} else { alert('Importado: '+f.name+' ('+t.length+' bytes)'); } }catch(err){ alert('Error al importar: '+err.message); } }; r.readAsText(f); } }; inp.click(); }} style={{ background:'#f97316', color:'#fff', border:'none', borderRadius:'6px', padding:'0.25rem 0.6rem', fontWeight:800, fontSize:'0.65rem', cursor:'pointer' }}>Importar Excel</button>
                              </div>
                            </div>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL ACCIONES RIVAL</span>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button onClick={async () => { const XLSX=await import('xlsx'); const headers=['ACCION',...cruceRivalFinalizaciones,'TOTAL']; const rows=cruceRivalAcciones.map(a=>[a,...cruceRivalFinalizaciones.map(f=>cruce[a][f]||''),cruceRows[a]||0]); rows.push(['TOTAL',...cruceRivalFinalizaciones.map(f=>cruceTotal[f]||0),cruceRivalAcciones.reduce((s,a)=>s+(cruceRows[a]||0),0)]); const ws=XLSX.utils.aoa_to_sheet([headers,...rows]); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Rival'); const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'}); const blob=new Blob([wbout],{type:'application/octet-stream'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='total_acciones_rival.xlsx'; a.click(); URL.revokeObjectURL(url); }} style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:'6px', padding:'0.25rem 0.6rem', fontWeight:800, fontSize:'0.65rem', cursor:'pointer' }}>Exportar Excel</button>
                                <button onClick={() => { const inp=document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls,.csv,.json'; inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); if(f.name.endsWith('.xlsx')||f.name.endsWith('.xls')){ r.onload=async()=>{ try{ const XLSX=await import('xlsx'); const wb=XLSX.read(r.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const data=XLSX.utils.sheet_to_json(ws,{header:1}); console.log('Importadas rival xlsx',data); alert('Importado Excel: '+f.name+' ('+data.length+' filas)'); }catch(err){ alert('Error al importar: '+err.message); } }; r.readAsArrayBuffer(f); } else { r.onload=()=>{ try{ const t=r.result; if(f.name.endsWith('.json')){ const d=JSON.parse(t); console.log('Importadas rival',d);} else { alert('Importado: '+f.name+' ('+t.length+' bytes)'); } }catch(err){ alert('Error al importar: '+err.message); } }; r.readAsText(f); } }; inp.click(); }} style={{ background:'#f97316', color:'#fff', border:'none', borderRadius:'6px', padding:'0.25rem 0.6rem', fontWeight:800, fontSize:'0.65rem', cursor:'pointer' }}>Importar Excel</button>
                              </div>
                            </div>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{titulo}</span>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button onClick={async () => { const XLSX=await import('xlsx'); const headers=['ACCION','TOTAL']; const rows=filasDef.map(([label,key])=>[label,totalPor(key)]); rows.push(['TOTAL',filasDef.reduce((s,[,key])=>s+totalPor(key),0)]); const ws=XLSX.utils.aoa_to_sheet([headers,...rows]); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,titulo.slice(0,31)); const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'}); const blob=new Blob([wbout],{type:'application/octet-stream'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=titulo.replace(/\s+/g,'_').toLowerCase()+'.xlsx'; a.click(); URL.revokeObjectURL(url); }} style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:'6px', padding:'0.25rem 0.6rem', fontWeight:800, fontSize:'0.65rem', cursor:'pointer' }}>Exportar Excel</button>
                                <button onClick={() => { const inp=document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls,.csv,.json'; inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); if(f.name.endsWith('.xlsx')||f.name.endsWith('.xls')){ r.onload=async()=>{ try{ const XLSX=await import('xlsx'); const wb=XLSX.read(r.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const data=XLSX.utils.sheet_to_json(ws,{header:1}); console.log('Importado grupo xlsx',data); alert('Importado Excel: '+f.name+' ('+data.length+' filas)'); }catch(err){ alert('Error: '+err.message); } }; r.readAsArrayBuffer(f); } else { r.onload=()=>{ try{ const t=r.result; alert('Importado: '+f.name+' ('+t.length+' bytes)'); }catch(err){ alert('Error: '+err.message); } }; r.readAsText(f); } }; inp.click(); }} style={{ background:'#f97316', color:'#fff', border:'none', borderRadius:'6px', padding:'0.25rem 0.6rem', fontWeight:800, fontSize:'0.65rem', cursor:'pointer' }}>Importar Excel</button>
                              </div>
                            </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={async () => {
                        if (!currentMatch) { alert('No hay partido abierto para guardar'); return; }
                        await saveMatchData(currentMatch.id);
                        setAlineacionGuardado(true);
                        setTimeout(() => setAlineacionGuardado(false), 2000);
                      }}
                      style={{
                        background: alineacionGuardado ? '#16a34a' : '#0284c7',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        padding: '0.5rem 1.4rem',
                        borderRadius: 'var(--radius-full)',
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {alineacionGuardado ? 'GUARDADO ✓' : 'GUARDAR'}
                    </button>
                  </div>
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


                  {/* === MAPA DE CAMPO === */}
                  {(() => {
                    const titulares = players.map((p, idx) => ({ ...p, idx })).filter(p => p.name && p.status === 'titular');
                    const suplentes = players.map((p, idx) => ({ ...p, idx })).filter(p => p.name && p.status === 'suplente');
                    const noConvocados = players.map((p, idx) => ({ ...p, idx })).filter(p => p.name && p.status === 'no convocado');
                    const lesionados = players.map((p, idx) => ({ ...p, idx })).filter(p => p.name && p.status === 'lesion');
                    const divisionHonor = players.map((p, idx) => ({ ...p, idx })).filter(p => p.name && p.status === 'division honor');
                    const handleDragStart = (e, idx) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      e.dataTransfer.effectAllowed = 'move';
                    };
                    const handleFieldDrop = (e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData('text/plain');
                      if (raw.startsWith('free:')) {
                        const n = raw.slice(5);
                        const rect = campoRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        const nx = Math.max(6, Math.min(94, x));
                        const ny = Math.max(6, Math.min(94, y));
                        const emptyIdx = players.findIndex(q => !q.name);
                        if (emptyIdx === -1) return;
                        if (titulares.length >= 11) return;
                        setPlayers(prev => {
                          const copy = [...prev];
                          copy[emptyIdx] = { ...copy[emptyIdx], name: n, status: 'titular', mapX: nx, mapY: ny };
                          return copy;
                        });
                        return;
                      }
                      const idx = raw !== '' ? parseInt(raw, 10) : NaN;
                      if (Number.isNaN(idx) || idx < 0 || idx >= players.length) return;
                      const rect = campoRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      const nx = Math.max(6, Math.min(94, x));
                      const ny = Math.max(6, Math.min(94, y));
                      setPlayers(prev => {
                        const copy = [...prev];
                        const cur = copy[idx];
                        if (!cur || !cur.name) return prev;
                        if (cur.status === 'titular' && titulares.length <= 11) {
                          copy[idx] = { ...cur, mapX: nx, mapY: ny };
                          return copy;
                        }
                        if (titulares.filter(t => t.idx !== idx).length >= 11) {
                          copy[idx] = { ...cur, status: 'suplente' };
                          return copy;
                        }
                        copy[idx] = { ...cur, status: 'titular', mapX: nx, mapY: ny };
                        return copy;
                      });
                    };
                    const handleZoneDrop = (e, targetStatus) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const raw = e.dataTransfer.getData('text/plain');
                      if (!raw) return;
                      if (raw.startsWith('free:')) {
                        const n = raw.slice(5);
                        if (targetStatus === 'titular' && titulares.length >= 11) {
                          // si campo lleno, manda a suplente
                          targetStatus = 'suplente';
                        }
                        const emptyIdx = players.findIndex(q => !q.name);
                        if (emptyIdx === -1) return;
                        setPlayers(prev => {
                          const copy = [...prev];
                          copy[emptyIdx] = { ...copy[emptyIdx], name: n, status: targetStatus };
                          if (targetStatus === 'titular') {
                            const rect = campoRef.current?.getBoundingClientRect();
                            let nx = 50, ny = 50;
                            if (rect) {
                              nx = Math.max(6, Math.min(94, ((e.clientX - rect.left) / rect.width) * 100));
                              ny = Math.max(6, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100));
                            }
                            copy[emptyIdx].mapX = nx;
                            copy[emptyIdx].mapY = ny;
                          }
                          return copy;
                        });
                        return;
                      }
                      const idx = parseInt(raw, 10);
                      if (Number.isNaN(idx) || idx < 0 || idx >= players.length) return;
                      if (targetStatus === 'titular') {
                        const rect = campoRef.current?.getBoundingClientRect();
                        let nx = 50, ny = 50;
                        if (rect) {
                          nx = Math.max(6, Math.min(94, ((e.clientX - rect.left) / rect.width) * 100));
                          ny = Math.max(6, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100));
                        }
                        setPlayers(prev => {
                          const copy = [...prev];
                          const cur = copy[idx];
                          if (!cur || !cur.name) return prev;
                          if (titulares.filter(t => t.idx !== idx).length >= 11) {
                            copy[idx] = { ...cur, status: 'suplente' };
                            return copy;
                          }
                          copy[idx] = { ...cur, status: 'titular', mapX: nx, mapY: ny };
                          return copy;
                        });
                        return;
                      }
                      setPlayers(prev => {
                        const copy = [...prev];
                        const cur = copy[idx];
                        if (!cur || !cur.name) return prev;
                        copy[idx] = { ...cur, status: targetStatus };
                        return copy;
                      });
                    };
                    const handleBenchDrop = (e) => handleZoneDrop(e, 'suplente');
                    const removePlayer = (realIdx) => {
                      if (realIdx == null) return;
                      setPlayers(prev => {
                        const copy = [...prev];
                        const cur = copy[realIdx];
                        if (!cur || !cur.name) return prev;
                        copy[realIdx] = { ...cur, status: '-', mapX: undefined, mapY: undefined };
                        return copy;
                      });
                    };
                    const XBtn = ({ idx }) => (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); removePlayer(idx); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        title="Quitar (volver a posición original)"
                        style={{
                          position: 'absolute',
                          top: -5,
                          right: -5,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: '2px solid #ef4444',
                          background: '#0f172a',
                          color: '#ef4444',
                          fontWeight: 900,
                          fontSize: 12,
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 6,
                          padding: 0
                        }}
                      >×</button>
                    );
                    const circulo = (p, size = 56, extraStyle = {}) => {
                      const foto = jugadoresData[p.name]?.foto;
                      const isNoConvocado = p.status === 'no convocado';
                      return (
                        <div
                          key={p.idx ?? p.name}
                          draggable={!!p.name && p.status !== 'no convocado'}
                          onDragStart={(e) => handleDragStart(e, p.idx)}
                          onClick={() => {
                            if (!p.name) return;
                            const realIdx = p.idx;
                            if (realIdx == null) return;
                            setPlayers(prev => {
                              const copy = [...prev];
                              const cur = copy[realIdx];
                              let next = 'titular';
                              if (cur.status === 'titular') next = 'suplente';
                              else if (cur.status === 'suplente') next = '-';
                              else if (cur.status === 'no convocado') next = '-';
                              else {
                                const titCount = copy.filter(q => q.status === 'titular').length;
                                next = titCount < 11 ? 'titular' : 'suplente';
                              }
                              copy[realIdx] = { ...cur, status: next };
                              return copy;
                            });
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const realIdx = p.idx;
                            if (realIdx == null) return;
                            setPlayers(prev => {
                              const copy = [...prev];
                              const cur = copy[realIdx];
                              if (cur.status === 'no convocado') copy[realIdx] = { ...cur, status: '-' };
                              else copy[realIdx] = { ...cur, status: 'no convocado' };
                              return copy;
                            });
                          }}
                          title={`${p.name} — ${p.status} (arrastra al campo/banquillo · click: titular↔suplente, doble click: no convocado)`}
                          style={{
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            border: `3px solid ${p.status === 'titular' ? '#38bdf8' : p.status === 'suplente' ? '#f59e0b' : p.status === 'no convocado' ? '#000000' : '#334155'}`,
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: p.status === 'no convocado' ? 'pointer' : 'grab',
                            flexShrink: 0,
                            background: '#0f172a',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                            ...extraStyle
                          }}
                        >
                          {foto ? (
                            <img src={foto} alt={p.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: isNoConvocado ? 'grayscale(1) brightness(0.35)' : 'none' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.3, color: '#94a3b8' }}>{p.name?.slice(0, 2)}</div>
                          )}
                          {isNoConvocado && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: '#ffffff', fontWeight: 900, fontSize: size * 0.18, letterSpacing: '0.04em' }}>NO</span>
                            </div>
                          )}
                           <div style={{ position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)', background: p.status === 'titular' ? '#38bdf8' : p.status === 'suplente' ? '#f59e0b' : '#334155', color: '#0f172a',                             fontWeight: 900, fontSize: Math.max(10, size * 0.22), padding: '0 4px', borderRadius: 4, whiteSpace: 'nowrap', lineHeight: 1.1, maxWidth: size + 10, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                           {!!p.name && <XBtn idx={p.idx} />}
                         </div>
                       );
                     };

                    const handleCampoClick = (e) => {
                      if (draggingMapIdx != null) return;
                      if (dragMovedRefGlobal.current) return;
                      const titularesCount = titulares.length;
                      if (titularesCount >= 11) return;
                      const idxDisponible = players.findIndex(p => p.name && (p.status === '-' || p.status === 'division honor' || p.status === 'lesion' || !p.status));
                      if (idxDisponible === -1) return;
                      const rect = campoRef.current?.getBoundingClientRect();
                      let pos = null;
                      if (rect) {
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        pos = { x: Math.max(8, Math.min(92, x)), y: Math.max(8, Math.min(92, y)) };
                      }
                      setPlayers(prev => {
                        const copy = [...prev];
                        copy[idxDisponible] = { ...copy[idxDisponible], status: 'titular', mapX: pos?.x, mapY: pos?.y };
                        return copy;
                      });
                      };

                    const opcionesEstado = [
                      { id: 'titular', label: 'TITULAR', color: '#38bdf8' },
                      { id: 'suplente', label: 'SUPLENTE', color: '#f59e0b' },
                      { id: 'lesion', label: 'LESION', color: '#ef4444' },
                      { id: 'no convocado', label: 'NO CONVOCADO', color: '#000000' },
                      { id: 'division honor', label: 'DIV. HONOR', color: '#8b5cf6' },
                    ];
                    const aplicarEstado = (idx, status) => {
                      setPlayers(prev => {
                        const copy = [...prev];
                        const cur = copy[idx];
                        if (!cur || !cur.name) return prev;
                        if (status === 'titular') {
                          const titCount = copy.filter(q => q.status === 'titular').length;
                          copy[idx] = { ...cur, status: 'titular' };
                          if (cur.mapX == null) {
                            const pos = FORMACION_11[titCount] || { x: 50, y: 50 };
                            copy[idx].mapX = pos.x;
                            copy[idx].mapY = pos.y;
                          }
                        } else {
                          copy[idx] = { ...cur, status, mapX: undefined, mapY: undefined };
                        }
                        return copy;
                      });
                      setMenuJugadorIdx(null);
                    };

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem' }}>


                        <div className="mapa-tactico-layout" style={{ display: 'flex', gap: '1rem', alignItems: 'stretch', flexWrap: 'wrap', flexDirection: 'column' }}>
                          {/* Campo - realista 105×68 horizontal, ocupa todo el ancho */}
                          <div
                            ref={campoRef}
                            className="mapa-campo"
                            onClick={handleCampoClick}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                            onDrop={handleFieldDrop}
                            style={{
                              flex: '0 0 auto',
                              width: '100%',
                              maxWidth: '100%',
                              alignSelf: 'stretch',
                              height: '680px',
                              background: '#1a7a33',
                              borderRadius: 12,
                              border: '2px solid #ffffff',
                              position: 'relative',
                              overflow: 'hidden',
                              cursor: titulares.length < 11 ? 'crosshair' : 'default',
                              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.3)',
                              userSelect: 'none',
                              touchAction: 'none'
                            }}
                          >
                            {/* Césped rayado */}
                            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.07) 0 18px, transparent 18px 36px)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 45%, transparent 55%, rgba(0,0,0,0.08) 100%)', pointerEvents: 'none' }} />
                            {/* SVG líneas reglamentarias - vertical 68×105 realista */}
                            <svg viewBox="0 0 68 105" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                              {/* Borde exterior */}
                              <rect x="0.7" y="0.7" width="66.6" height="103.6" fill="none" stroke="white" strokeWidth="0.7" />
                              {/* Línea media */}
                              <line x1="0.7" y1="52.5" x2="67.3" y2="52.5" stroke="white" strokeWidth="0.7" />
                              {/* Círculo central r=9.15 */}
                              <circle cx="34" cy="52.5" r="9.15" fill="none" stroke="white" strokeWidth="0.7" />
                              <circle cx="34" cy="52.5" r="0.7" fill="white" />
                              {/* Área penal superior (propia) - 16.5 profundidad, 40.3 ancho */}
                              <rect x="13.85" y="0.7" width="40.3" height="16.5" fill="none" stroke="white" strokeWidth="0.7" />
                              {/* Área de meta superior - 5.5 profundidad, 18.32 ancho */}
                              <rect x="24.84" y="0.7" width="18.32" height="5.5" fill="none" stroke="white" strokeWidth="0.7" />
                              {/* Punto penal superior 11m */}
                              <circle cx="34" cy="11" r="0.7" fill="white" />
                              {/* Semicírculo penal superior - arco hacia el centro */}
                              <path d="M 26.69 17.2 A 9.15 9.15 0 0 0 41.31 17.2" fill="none" stroke="white" strokeWidth="0.7" />
                              {/* Portería superior */}
                              <rect x="30.1" y="-0.5" width="7.8" height="1.2" fill="none" stroke="white" strokeWidth="0.7" />
                              {/* Área penal inferior (rival) */}
                              <rect x="13.85" y="87.8" width="40.3" height="16.5" fill="none" stroke="white" strokeWidth="0.7" />
                              <rect x="24.84" y="98.8" width="18.32" height="5.5" fill="none" stroke="white" strokeWidth="0.7" />
                              <circle cx="34" cy="94" r="0.7" fill="white" />
                              <path d="M 26.69 87.8 A 9.15 9.15 0 0 1 41.31 87.8" fill="none" stroke="white" strokeWidth="0.7" />
                              <rect x="30.1" y="104.3" width="7.8" height="1.2" fill="none" stroke="white" strokeWidth="0.7" />
                              {/* Esquinas r=1 */}
                              <path d="M 1.7 0.7 A 1 1 0 0 1 0.7 1.7" fill="none" stroke="white" strokeWidth="0.7" />
                              <path d="M 66.3 0.7 A 1 1 0 0 0 67.3 1.7" fill="none" stroke="white" strokeWidth="0.7" />
                              <path d="M 67.3 103.3 A 1 1 0 0 0 66.3 104.3" fill="none" stroke="white" strokeWidth="0.7" />
                              <path d="M 0.7 103.3 A 1 1 0 0 1 1.7 104.3" fill="none" stroke="white" strokeWidth="0.7" />
                            </svg>

                            {titulares.length === 0 && (
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                <span style={{ background: 'rgba(0,0,0,0.35)', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', padding: '0.35rem 0.7rem', borderRadius: 999, backdropFilter: 'blur(2px)' }}>Haz click para agregar titulares (click en hueco del campo)</span>
                              </div>
                            )}

                            {titulares.map((p, i) => {
                              const def = FORMACION_11[i] || { x: 50, y: 50 };
                              const x = p.mapX ?? def.x;
                              const y = p.mapY ?? def.y;
                              const foto = jugadoresData[p.name]?.foto;
                              const isNoConvocado = p.status === 'no convocado';
                              return (
                                <div
                                  key={p.idx}
                                  onClick={(e) => {
                                    if (dragMovedRefGlobal.current) return;
                                    e.stopPropagation();
                                    setPlayers(prev => {
                                      const copy = [...prev];
                                      const cur = copy[p.idx];
                                      if (cur.status === 'titular') {
                                        copy[p.idx] = { ...cur, status: '-', mapX: undefined, mapY: undefined };
                                      }
                                      return copy;
                                    });
                                  }}
                                  onDoubleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPlayers(prev => {
                                      const copy = [...prev];
                                      const cur = copy[p.idx];
                                      copy[p.idx] = { ...cur, status: cur.status === 'no convocado' ? '-' : 'no convocado' };
                                      return copy;
                                    });
                                  }}
                                  draggable={!isNoConvocado}
                                  onDragStart={(e) => handleDragStart(e, p.idx)}
                                  onDragEnd={() => setDraggingMapIdx(null)}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    dragMovedRefGlobal.current = false;
                                    setDraggingMapIdx(p.idx);
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    dragMovedRefGlobal.current = false;
                                    setDraggingMapIdx(p.idx);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    left: `${x}%`,
                                    top: `${y}%`,
                                    transform: 'translate(-50%, -50%)',
                                     width: 100,
                                    height: 100,
                                    borderRadius: '50%',
                                    border: `3px solid ${isNoConvocado ? '#000000' : '#38bdf8'}`,
                                    overflow: 'hidden',
                                    background: '#0f172a',
                                    cursor: draggingMapIdx === p.idx ? 'grabbing' : 'grab',
                                    boxShadow: draggingMapIdx === p.idx ? '0 6px 18px rgba(0,0,0,0.5)' : '0 2px 10px rgba(0,0,0,0.4)',
                                    zIndex: draggingMapIdx === p.idx ? 10 : 2,
                                    touchAction: 'none',
                                    userSelect: 'none'
                                  }}
                                  title={`${p.name} — arrastra libremente por el campo o al banquillo · click: quitar (vuelve a la plantilla) · doble click: no convocado`}
                                >
                                  {foto ? <img src={foto} alt={p.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: isNoConvocado ? 'grayscale(1) brightness(0.35)' : 'none' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#94a3b8' }}>{p.name.slice(0, 2)}</div>}
                                  {isNoConvocado && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />}
                                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: isNoConvocado ? 'rgba(0,0,0,0.75)' : 'rgba(56,189,248,0.95)', color: isNoConvocado ? '#ffffff' : '#0f172a', fontWeight: 900, fontSize: 13, textAlign: 'center', padding: '1px 0', letterSpacing: '0.02em', lineHeight: 1.1 }}>{p.name}</div>
                                   {!!p.name && <XBtn idx={p.idx} />}
                                 </div>
                              );
                            })}
                          </div>

                          {/* Columna derecha: zonas + plantilla (a la derecha del campo) */}
                          <div className="mapa-derecha" style={{ flex: '1 1 20%', minWidth: 170, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                            {/* Lateral - 4 zonas apiladas */}
                            <div className="mapa-lateral" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', width: '100%' }}>
                            {[
                              { id: 'suplente', label: 'SUPLENTES', color: '#f59e0b', list: suplentes, max: '12', empty: 'Arrastra aquí' },
                              { id: 'no convocado', label: 'NO CONVOCADO', color: '#000000', list: noConvocados, max: '', empty: 'Arrastra aquí' },
                              { id: 'lesion', label: 'LESIÓN', color: '#ef4444', list: lesionados, max: '', empty: 'Arrastra aquí' },
                              { id: 'division honor', label: 'DIVISIÓN HONOR', color: '#8b5cf6', list: divisionHonor, max: '', empty: 'Arrastra aquí' },
                            ].map(z => (
                              <div
                                key={z.id}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                onDrop={(e) => handleZoneDrop(e, z.id)}
                                style={{
                                  background: 'var(--bg-secondary)',
                                  border: `2px dashed ${z.color}66`,
                                  borderRadius: 12,
                                  padding: '0.5rem 0.4rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.4rem',
                                  alignItems: 'center',
                                  minHeight: 92,
                                  transition: 'border-color 0.15s'
                                }}
                              >
                                <span style={{ fontWeight: 900, fontSize: '0.62rem', color: z.color === '#000000' ? '#94a3b8' : z.color, letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: 'center' }}>{z.label} {z.max ? `· ${z.list.length}/${z.max}` : `· ${z.list.length}`}</span>
                                <div style={{ width: '100%', height: 1, background: 'var(--border-subtle)', opacity: 0.6 }} />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'center', width: '100%', minHeight: 40, alignContent: 'flex-start' }}>
                                  {z.list.length === 0 ? (
                                    <span style={{ color: '#64748b', fontWeight: 700, fontSize: '0.6rem', textAlign: 'center', padding: '0.5rem 0', width: '100%', border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>{z.empty}</span>
                                  ) : z.list.map(p => circulo(p, 76))}
                                </div>
                              </div>
                            ))}
                          </div>

                        {/* Plantilla completa */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', order: -1 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                             {players.filter(p => p.name && p.status === '-').map(p => {
                              const idx = players.indexOf(p);
                              const foto = jugadoresData[p.name]?.foto;
                              const isTit = p.status === 'titular';
                              const isSup = p.status === 'suplente';
                              const isNo = p.status === 'no convocado';
                              const menuAbierto = menuJugadorIdx === idx;
                              return (
                                <div key={p.name + '_' + idx} style={{ position: 'relative' }}>
                                  <div
                                  onClick={() => setMenuJugadorIdx(prev => prev === idx ? null : idx)}
                                  onDoubleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPlayers(prev => {
                                      const copy = [...prev];
                                      const cur = copy[idx];
                                      copy[idx] = { ...cur, status: cur.status === 'no convocado' ? '-' : 'no convocado' };
                                      return copy;
                                    });
                                  }}
                                  draggable={!!p.name && !isNo}
                                  onDragStart={(e) => handleDragStart(e, idx)}
                                  title={`${p.name} — click para elegir estado (titular, suplente, lesión, no convocado, Div. Honor)`}
                                   style={{
                                    width: 90,
                                    height: 90,
                                    borderRadius: '50%',
                                    border: `3px solid ${isTit ? '#38bdf8' : isSup ? '#f59e0b' : isNo ? '#000000' : '#334155'}`,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    background: '#0f172a',
                                    boxShadow: isTit || isSup ? '0 2px 8px rgba(0,0,0,0.35)' : 'none'
                                  }}
                                >
                                  {foto ? <img src={foto} alt={p.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: isNo ? 'grayscale(1) brightness(0.32)' : 'none' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#94a3b8' }}>{p.name.slice(0, 2)}</div>}
                                  {isNo && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#ffffff', fontWeight: 900, fontSize: 10 }}>NO</span></div>}
                                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: isTit ? '#38bdf8' : isSup ? '#f59e0b' : isNo ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.88)', color: isTit || isSup ? '#0f172a' : '#ffffff', fontWeight: 900, fontSize: 11, textAlign: 'center', padding: '1px 0', lineHeight: 1 }}>{p.name.slice(0, 12)}</div>
                                  <XBtn idx={idx} />
                                 </div>
                                 {menuAbierto && (
                                   <>
                                     <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuJugadorIdx(null)} />
                                     <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.5)', minWidth: 140 }}>
                                       {opcionesEstado.map(o => (
                                         <button key={o.id} onClick={() => aplicarEstado(idx, o.id)} style={{ background: o.color, color: o.color === '#000000' ? '#ffffff' : '#0f172a', border: 'none', borderRadius: 6, padding: '0.35rem 0.6rem', fontWeight: 900, fontSize: '0.7rem', cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{o.label}</button>
                                       ))}
                                     </div>
                                   </>
                                 )}
                                </div>
                              );
                            })}
                            {/* Huecos vacíos para agregar nuevos nombres */}
                            {playerOptions.filter(n => !players.some(q => q.name === n)).map(n => {
                              const foto = jugadoresData[n]?.foto;
                              return (
                                <div
                                  key={'free_' + n}
                                  draggable
                                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'free:' + n); e.dataTransfer.effectAllowed = 'move'; }}
                                  onClick={() => {
                                    const emptyIdx = players.findIndex(q => !q.name);
                                    if (emptyIdx === -1) return;
                                    const titCount = players.filter(q => q.status === 'titular').length;
                                    setPlayers(prev => {
                                      const copy = [...prev];
                                      copy[emptyIdx] = { ...copy[emptyIdx], name: n, status: titCount < 11 ? 'titular' : 'suplente', mapX: titCount < 11 ? (FORMACION_11[titCount]?.x) : undefined, mapY: titCount < 11 ? (FORMACION_11[titCount]?.y) : undefined };
                                      return copy;
                                    });
                                  }}
                                   title={`Arrastra o click para agregar ${n} al equipo`}
                                   style={{ width: 90, height: 90, borderRadius: '50%', border: '2px dashed #334155', overflow: 'hidden', position: 'relative', cursor: 'grab', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                   {foto ? <img src={foto} alt={n} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} /> : null}
                                   <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(15,23,42,0.88)', color: '#ffffff', fontWeight: 900, fontSize: 7.5, textAlign: 'center', padding: '1px 0' }}>{n.slice(0, 10)}</div>
                                </div>
                              );
                            })}
                          </div>
                          {players.filter(p => p.status === 'no convocado').length > 0 && (
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>No convocados aparecen en negro. Doble click de nuevo para quitar el efecto.</span>
                          )}
                        </div>
                        </div>
                      </div>
                      </div>
                    );
                  })()}
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
          <button className="btn-sm btn-secondary" onClick={() => setVista('tratamiento')}>Tratamiento Dibujos</button>
          <button className="btn-sm btn-secondary" onClick={() => setVista('menu')}>Menú</button>
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

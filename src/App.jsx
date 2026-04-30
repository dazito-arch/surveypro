import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Settings, BarChart3, ChevronLeft, CheckCircle2, AlertCircle, Loader2, Sparkles, Bot, Plus, Trash2, ListPlus, Home, LogOut, User as UserIcon, Link as LinkIcon, Edit3 } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAGBGtUFqPtei2bwOFr70Q1kwqeisgK0g0",
  authDomain: "surveypro-e8112.firebaseapp.com",
  projectId: "surveypro-e8112",
  storageBucket: "surveypro-e8112.firebasestorage.app",
  messagingSenderId: "881792421261",
  appId: "1:881792421261:web:32995dbfdfcea0a81941c4",
  measurementId: "G-FY62MTZSXS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'surveypro-app';

// --- CONSTANTES ---
const RATING_OPTIONS = [
  { value: 1, emoji: '😡', label: 'Muy Malo', color: 'bg-red-100 text-red-600 border-red-200' },
  { value: 2, emoji: '🙁', label: 'Malo', color: 'bg-orange-100 text-orange-600 border-orange-200' },
  { value: 3, emoji: '😐', label: 'Regular', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 4, emoji: '🙂', label: 'Bueno', color: 'bg-green-100 text-green-600 border-green-200' },
  { value: 5, emoji: '🤩', label: 'Excelente', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [route, setRoute] = useState('home'); // home | login | admin | builder | stats | survey
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  
  // Datos Globales
  const [campaigns, setCampaigns] = useState([]);
  const [responses, setResponses] = useState([]);

  // --- INICIALIZACIÓN Y AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth); // Inicio base para leer datos públicos
        }
      } catch (err) {
        console.error("Error inicial de auth:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!user) return;
    
    // Cargar Campañas
    const campsRef = collection(db, 'artifacts', appId, 'public', 'data', 'campaigns');
    const unsubCamps = onSnapshot(campsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCampaigns(data.sort((a, b) => b.createdAt - a.createdAt));
    }, console.error);

    // Cargar Respuestas
    const respsRef = collection(db, 'artifacts', appId, 'public', 'data', 'responses');
    const unsubResps = onSnapshot(respsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setResponses(data);
    }, console.error);

    return () => {
      unsubCamps();
      unsubResps();
    };
  }, [user]);

  // --- API GEMINI ---
  const callGeminiAPI = async (prompt) => {
    const apiKey = ""; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // --- COMPONENTES DE VISTA ---

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-200">
      {/* Navegación Superior (Solo visible fuera del modo encuesta pública) */}
      {route !== 'survey' && (
        <nav className="bg-white border-b border-slate-200 p-4 shadow-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <button onClick={() => setRoute('home')} className="flex items-center gap-2 font-bold text-xl text-blue-600 hover:text-blue-700 transition-colors">
              <CheckCircle2 className="w-6 h-6" />
              <span>SurveyPro</span>
            </button>
            <div className="flex items-center gap-4">
              {!user || user.isAnonymous ? (
                <button onClick={() => setRoute('login')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700 transition-colors">
                  <UserIcon className="w-4 h-4" /> Acceso Admin
                </button>
              ) : (
                <div className="flex items-center gap-4">
                  <button onClick={() => setRoute('admin')} className="font-medium text-slate-600 hover:text-blue-600">Mi Panel</button>
                  <button onClick={() => { signOut(auth); setRoute('home'); }} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">
                    <LogOut className="w-4 h-4" /> Salir
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* ENRUTADOR PRINCIPAL */}
      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {route === 'home' && <HomeView campaigns={campaigns} setRoute={setRoute} setSelectedCampaignId={setSelectedCampaignId} />}
        {route === 'login' && <AuthView setRoute={setRoute} />}
        {route === 'admin' && <AdminDashboard user={user} campaigns={campaigns} responses={responses} setRoute={setRoute} setSelectedCampaignId={setSelectedCampaignId} />}
        {route === 'builder' && <CampaignBuilder user={user} setRoute={setRoute} appId={appId} />}
        {route === 'stats' && <StatsView campaignId={selectedCampaignId} campaigns={campaigns} responses={responses} callGeminiAPI={callGeminiAPI} setRoute={setRoute} />}
        {route === 'globalStats' && <GlobalStatsView user={user} campaigns={campaigns} responses={responses} callGeminiAPI={callGeminiAPI} setRoute={setRoute} />}
      </main>

      {/* VISTA A PANTALLA COMPLETA (ENCUESTA) */}
      {route === 'survey' && <SurveyRunner campaignId={selectedCampaignId} campaigns={campaigns} appId={appId} setRoute={setRoute} user={user} />}
    </div>
  );
}

// ============================================================================
// 1. VISTA DE INICIO (HOME)
// ============================================================================
function HomeView({ campaigns, setRoute, setSelectedCampaignId }) {
  // Solo mostramos campañas activas para simular que un cliente entra a probar
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center animate-in fade-in">
      <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
        Mide la satisfacción <br className="hidden md:block" /> con precisión.
      </h1>
      <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
        Plataforma inteligente para crear encuestas dinámicas, gestionar múltiples campañas y obtener insights potenciados por Inteligencia Artificial.
      </p>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-2xl text-left">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-green-500" />
          Encuestas Disponibles (Modo Demo)
        </h2>
        {activeCampaigns.length === 0 ? (
          <p className="text-slate-500 italic">No hay campañas activas en este momento. Ingresa como Admin para crear una.</p>
        ) : (
          <div className="grid gap-4">
            {activeCampaigns.map(camp => (
              <div key={camp.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{camp.title}</h3>
                  <p className="text-slate-500 text-sm">{camp.questions?.length || 0} preguntas</p>
                </div>
                <button 
                  onClick={() => { setSelectedCampaignId(camp.id); setRoute('survey'); }}
                  className="mt-3 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium shadow-sm transition-colors w-full sm:w-auto"
                >
                  Probar Encuesta
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. VISTA DE AUTENTICACIÓN (LOGIN/REGISTER)
// ============================================================================
function AuthView({ setRoute }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = getAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setRoute('admin');
    } catch (err) {
      setError(err.message.includes('auth/') ? 'Credenciales inválidas o correo en uso.' : 'Ocurrió un error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-8">
      <h2 className="text-3xl font-bold text-center mb-2">{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
      <p className="text-slate-500 text-center mb-8">Gestione sus propias campañas de encuestas</p>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold flex justify-center mt-2 transition-colors disabled:bg-slate-400">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Entrar' : 'Registrarse')}
        </button>
      </form>

      <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center mt-6 text-sm text-blue-600 hover:underline font-medium">
        {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
      </button>
    </div>
  );
}

// ============================================================================
// 3. PANEL DE ADMINISTRADOR (DASHBOARD)
// ============================================================================
function AdminDashboard({ user, campaigns, responses, setRoute, setSelectedCampaignId }) {
  if (!user || user.isAnonymous) return <AuthView setRoute={setRoute} />;

  // Filtrar solo las campañas del usuario actual
  const myCampaigns = campaigns.filter(c => c.ownerId === user.uid);

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Mis Campañas</h1>
          <p className="text-slate-500">Administra tus encuestas y analiza resultados</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => setRoute('globalStats')} disabled={myCampaigns.length === 0} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-xl font-bold shadow-sm transition-colors disabled:opacity-50">
            <BarChart3 className="w-5 h-5" /> Global
          </button>
          <button onClick={() => setRoute('builder')} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold shadow-sm transition-colors">
            <Plus className="w-5 h-5" /> Nueva Campaña
          </button>
        </div>
      </div>

      {myCampaigns.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ListPlus className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">Aún no tienes campañas</h3>
          <p className="text-slate-500 mb-6">Crea tu primera campaña para empezar a medir la satisfacción de tus clientes.</p>
          <button onClick={() => setRoute('builder')} className="text-blue-600 font-medium hover:underline">Crear ahora →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myCampaigns.map(camp => {
            const campResponses = responses.filter(r => r.campaignId === camp.id);
            return (
              <div key={camp.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-xl text-slate-800 line-clamp-2">{camp.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${camp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {camp.status === 'active' ? 'Activa' : 'Pausada'}
                  </span>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <BarChart3 className="w-4 h-4" /> {campResponses.length} Respuestas
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <ListPlus className="w-4 h-4" /> {camp.questions?.length || 0} Preguntas
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                  <button 
                    onClick={() => { setSelectedCampaignId(camp.id); setRoute('stats'); }}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ver Estadísticas
                  </button>
                  <button 
                    onClick={() => { setSelectedCampaignId(camp.id); setRoute('survey'); }}
                    title="Probar/Ver URL"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    <LinkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. CREADOR DE CAMPAÑAS (BUILDER)
// ============================================================================
function CampaignBuilder({ user, setRoute, appId }) {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    { id: 'q_1', type: 'rating', title: '¿Qué te pareció nuestro servicio?' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const addQuestion = (type) => {
    const newQ = { id: `q_${Date.now()}`, type, title: 'Nueva pregunta...' };
    if (type === 'choice') newQ.options = ['Opción 1', 'Opción 2'];
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (index, field, value) => {
    const newQ = [...questions];
    newQ[index][field] = value;
    setQuestions(newQ);
  };

  const updateOption = (qIndex, optIndex, value) => {
    const newQ = [...questions];
    newQ[qIndex].options[optIndex] = value;
    setQuestions(newQ);
  };

  const updateCondition = (index, field, value) => {
    const newQ = [...questions];
    if (!newQ[index].condition) {
      // Default condition
      newQ[index].condition = { dependsOnId: questions[index - 1]?.id || questions[0].id, operator: '==', value: '' };
    }
    newQ[index].condition[field] = value;
    setQuestions(newQ);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() || questions.length === 0) return alert('Pon un título y al menos 1 pregunta.');
    setIsSaving(true);
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'campaigns'), {
        ownerId: user.uid,
        title,
        questions,
        status: 'active',
        createdAt: Date.now()
      });
      setRoute('admin');
    } catch (error) {
      console.error(error);
      alert('Error guardando campaña');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-3xl font-bold">Crear Nueva Campaña</h1>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 mb-6">
        <label className="block font-bold text-slate-800 mb-2">Nombre de la Campaña</label>
        <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Encuesta Sucursal Centro" className="w-full text-xl font-medium px-4 py-3 border-b-2 border-slate-200 focus:border-blue-500 outline-none bg-transparent transition-colors mb-4" />
      </div>

      <div className="space-y-6 mb-8">
        {questions.map((q, index) => (
          <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative group transition-all">
            <button onClick={() => removeQuestion(index)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-5 h-5" /></button>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {q.type === 'rating' ? 'Caritas (1-5)' : q.type === 'choice' ? 'Opción Múltiple' : 'Texto Abierto'}
              </span>
            </div>

            <input type="text" value={q.title} onChange={e => updateQuestion(index, 'title', e.target.value)} className="w-full text-lg font-bold text-slate-800 border-b border-dashed border-slate-300 pb-2 mb-4 focus:border-blue-500 outline-none" />

            {q.type === 'choice' && (
              <div className="space-y-2 ml-4">
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>
                    <input type="text" value={opt} onChange={e => updateOption(index, optIdx, e.target.value)} className="flex-1 py-1 outline-none text-slate-600 focus:text-blue-600" />
                  </div>
                ))}
                <button onClick={() => updateQuestion(index, 'options', [...q.options, `Opción ${q.options.length + 1}`])} className="text-sm text-blue-600 font-medium hover:underline mt-2">+ Añadir opción</button>
              </div>
            )}

            {/* --- SECCIÓN DE LÓGICA CONDICIONAL --- */}
            {index > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-xl">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={!!q.condition} 
                    onChange={e => {
                      if (e.target.checked) {
                        updateCondition(index, 'dependsOnId', questions[index - 1].id);
                      } else {
                        const newQ = [...questions];
                        delete newQ[index].condition;
                        setQuestions(newQ);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  Mostrar esta pregunta solo si se cumple una condición
                </label>

                {q.condition && (() => {
                  const depQ = questions.find(prev => prev.id === q.condition.dependsOnId) || questions[0];
                  return (
                    <div className="flex flex-col sm:flex-row gap-3 mt-4 animate-in fade-in">
                      <select 
                        value={q.condition.dependsOnId}
                        onChange={e => updateCondition(index, 'dependsOnId', e.target.value)}
                        className="flex-1 p-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500"
                      >
                        {questions.slice(0, index).map(prevQ => (
                          <option key={prevQ.id} value={prevQ.id}>Resp. a: {prevQ.title || 'Sin título'}</option>
                        ))}
                      </select>

                      <select
                        value={q.condition.operator}
                        onChange={e => updateCondition(index, 'operator', e.target.value)}
                        className="p-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="==">es igual a</option>
                        {depQ.type === 'rating' && <option value="<=">es menor o igual a</option>}
                        {depQ.type === 'rating' && <option value=">=">es mayor o igual a</option>}
                      </select>

                      {depQ.type === 'rating' ? (
                        <select
                          value={q.condition.value}
                          onChange={e => updateCondition(index, 'value', parseInt(e.target.value))}
                          className="p-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="">Selecciona...</option>
                          {RATING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>)}
                        </select>
                      ) : depQ.type === 'choice' ? (
                        <select
                          value={q.condition.value}
                          onChange={e => updateCondition(index, 'value', e.target.value)}
                          className="p-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="">Selecciona...</option>
                          {depQ.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          placeholder="Respuesta exacta..."
                          value={q.condition.value}
                          onChange={e => updateCondition(index, 'value', e.target.value)}
                          className="p-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-slate-100 p-6 rounded-2xl border border-dashed border-slate-300 text-center mb-12">
        <p className="font-medium text-slate-600 mb-4">Añadir nueva pregunta</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => addQuestion('rating')} className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl font-medium shadow-sm transition-colors">🙂 Caritas</button>
          <button onClick={() => addQuestion('choice')} className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl font-medium shadow-sm transition-colors">🔘 Opciones</button>
          <button onClick={() => addQuestion('text')} className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl font-medium shadow-sm transition-colors">📝 Texto Libre</button>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-6">
        <button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-md transition-all flex items-center gap-2">
          {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />} Guardar Campaña
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 5. MOTOR DE ENCUESTAS (VISTA PARA EL CLIENTE FINAL)
// ============================================================================
function SurveyRunner({ campaignId, campaigns, appId, setRoute, user }) {
  const campaign = campaigns.find(c => c.id === campaignId);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  if (!campaign) return <div className="p-8 text-center"><p>Campaña no encontrada.</p><button onClick={() => setRoute('home')} className="mt-4 text-blue-600">Volver</button></div>;

  const questions = campaign.questions || [];
  const currentQ = questions[currentStep];

  // Función para evaluar cuál es la siguiente pregunta visible
  const getNextIndex = (currentIndex, currentAnswers) => {
    for (let i = currentIndex + 1; i < questions.length; i++) {
      const q = questions[i];
      
      // Si no tiene condición, es visible
      if (!q.condition) return i;

      // Evaluar la condición
      const ans = currentAnswers[q.condition.dependsOnId];
      if (ans === undefined || ans === '') continue; // Condición no cumplida porque no hay respuesta

      const val = q.condition.value;
      if (q.condition.operator === '==' && ans == val) return i;
      if (q.condition.operator === '<=' && ans <= val) return i;
      if (q.condition.operator === '>=' && ans >= val) return i;
    }
    return -1; // Fin de la encuesta
  };

  const handleAnswer = (val) => {
    const newAnswers = { ...answers, [currentQ.id]: val };
    setAnswers(newAnswers);
    
    // Auto-avanzar si no es de texto libre
    if (currentQ.type !== 'text') {
      setTimeout(() => {
        const nextIdx = getNextIndex(currentStep, newAnswers);
        if (nextIdx !== -1) {
          setCurrentStep(nextIdx);
        } else {
          handleSubmit(newAnswers);
        }
      }, 400); // Pequeña demora para que vea la selección
    }
  };

  const handleNextText = () => {
    const nextIdx = getNextIndex(currentStep, answers);
    if (nextIdx !== -1) {
      setCurrentStep(nextIdx);
    } else {
      handleSubmit(answers);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setIsSubmitting(true);
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'responses'), {
        campaignId,
        answers: finalAnswers,
        timestamp: Date.now()
      });
      setIsFinished(true);
      // Opcional: auto-recargar la encuesta para el siguiente cliente en modo Kiosko
      setTimeout(() => {
        setAnswers({});
        setCurrentStep(0);
        setIsFinished(false);
      }, 5000);
    } catch (e) {
      console.error(e);
      alert("Error al enviar la respuesta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="bg-green-100 p-6 rounded-full mb-6 animate-in zoom-in">
          <CheckCircle2 className="w-24 h-24 text-green-600" />
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">¡Muchas Gracias!</h2>
        <p className="text-xl text-slate-600">Tus respuestas han sido guardadas.</p>
        
        {/* Botón para salir del modo encuesta (útil si estás probando) */}
        <button onClick={() => setRoute(user?.isAnonymous ? 'home' : 'admin')} className="mt-12 text-slate-400 hover:text-slate-600">Salir de la vista de encuesta</button>
      </div>
    );
  }

  // Calculamos progreso aproximado (basado en el índice actual)
  const progress = ((currentStep) / questions.length) * 100;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 relative">
      {/* Barra de progreso */}
      <div className="fixed top-0 left-0 right-0 h-2 bg-slate-200 z-50">
        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Botón Salir (Solo para testeo, en un kiosko real se quitaría) */}
      <button onClick={() => setRoute(user?.isAnonymous ? 'home' : 'admin')} className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors z-40">
         <Settings className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-right-8" key={currentStep}>
        
        <span className="text-blue-600 font-bold tracking-widest text-sm mb-4 uppercase">Pregunta {currentStep + 1} de {questions.length}</span>
        <h1 className="text-3xl md:text-5xl font-bold text-slate-800 mb-12 text-center leading-tight">
          {currentQ?.title}
        </h1>

        {/* Tipo: RATING */}
        {currentQ?.type === 'rating' && (
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 w-full">
            {RATING_OPTIONS.map((opt) => {
              const isSelected = answers[currentQ.id] === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  disabled={isSubmitting}
                  className={`flex flex-col items-center p-6 md:p-8 rounded-3xl border-4 transition-all transform hover:scale-105 active:scale-95 shadow-sm 
                    ${isSelected ? `border-blue-500 ${opt.color} scale-105` : `border-transparent bg-white hover:bg-slate-50`}`}
                >
                  <span className="text-6xl md:text-8xl mb-4 select-none">{opt.emoji}</span>
                  <span className={`text-base md:text-xl font-bold ${isSelected ? 'text-inherit' : 'text-slate-600'}`}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tipo: CHOICE */}
        {currentQ?.type === 'choice' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
            {currentQ.options?.map((opt, i) => {
              const isSelected = answers[currentQ.id] === opt;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  disabled={isSubmitting}
                  className={`py-6 px-8 rounded-2xl text-xl font-medium transition-all shadow-sm border-2 
                    ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'}`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )}

        {/* Tipo: TEXT */}
        {currentQ?.type === 'text' && (
          <div className="w-full max-w-2xl flex flex-col items-end">
            <textarea
              autoFocus
              rows={4}
              value={answers[currentQ.id] || ''}
              onChange={e => setAnswers(prev => ({...prev, [currentQ.id]: e.target.value}))}
              placeholder="Escribe tu respuesta aquí..."
              className="w-full p-6 text-xl rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none resize-none mb-6 shadow-sm"
            />
            <button 
              onClick={handleNextText} 
              disabled={isSubmitting}
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors shadow-md"
            >
              {getNextIndex(currentStep, answers) !== -1 ? 'Siguiente Pregunta' : 'Finalizar Encuesta'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ============================================================================
// 6. PANEL DE ESTADÍSTICAS Y AI (STATS VIEW)
// ============================================================================
function StatsView({ campaignId, campaigns, responses, callGeminiAPI, setRoute }) {
  const campaign = campaigns.find(c => c.id === campaignId);
  const campResponses = responses.filter(r => r.campaignId === campaignId);
  
  const [aiInsight, setAiInsight] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!campaign) return null;

  // Lógica para Generar Insights Generales de toda la campaña
  const handleGenerateAI = async () => {
    setIsGenerating(true);
    // Extraer datos relevantes para la IA
    const summary = campResponses.map(r => r.answers);
    const prompt = `Analiza los siguientes datos de una encuesta llamada "${campaign.title}". Las preguntas eran: ${JSON.stringify(campaign.questions.map(q=>q.title))}. Las respuestas recopiladas son: ${JSON.stringify(summary)}. 
    Dame un resumen ejecutivo de 1 párrafo destacando lo más positivo y lo más negativo, seguido de 3 viñetas concretas de acción para mejorar. Responde en español y usa formato markdown simple.`;
    
    const res = await callGeminiAPI(prompt);
    if(res) setAiInsight(res);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{campaign.title}</h1>
          <p className="text-slate-500">Reporte de Resultados • {campResponses.length} respuestas totales</p>
        </div>
      </div>

      {/* Sección AI */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-1 shadow-md">
          <div className="bg-white rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-indigo-500" />
                <h2 className="text-2xl font-bold text-slate-800">Consultor AI de Campaña</h2>
              </div>
              <p className="text-slate-600">Deja que Gemini analice todas las respuestas complejas, cruce los datos y te dé un diagnóstico accionable en segundos.</p>
            </div>
            <button 
              onClick={handleGenerateAI}
              disabled={isGenerating || campResponses.length === 0}
              className="whitespace-nowrap flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin"/> Procesando...</> : <><Bot className="w-5 h-5"/> Analizar Campaña Completa</>}
            </button>
          </div>
        </div>

        {aiInsight && (
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-2xl p-6 md:p-8 shadow-sm">
            <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><Bot className="w-5 h-5"/> Diagnóstico Inteligente</h3>
            <div className="prose prose-indigo max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
              {aiInsight.split('**').map((chunk, i) => i % 2 === 1 ? <strong key={i}>{chunk}</strong> : chunk)}
            </div>
          </div>
        )}
      </div>

      {/* Desglose por pregunta */}
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Desglose por Pregunta</h2>
      {campaign.questions?.map((q, idx) => {
        
        // Calcular estadísticas básicas si es rating o choice
        let stats = {};
        if (q.type === 'rating' || q.type === 'choice') {
           campResponses.forEach(r => {
             const val = r.answers[q.id];
             if(val) stats[val] = (stats[val] || 0) + 1;
           });
        }

        return (
          <div key={q.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4"><span className="text-blue-500 mr-2">Q{idx+1}.</span> {q.title}</h3>
            
            {q.type === 'rating' && (
              <div className="space-y-3">
                {[5,4,3,2,1].map(r => {
                   const count = stats[r] || 0;
                   const pct = campResponses.length ? (count/campResponses.length)*100 : 0;
                   const opt = RATING_OPTIONS.find(o=>o.value===r);
                   return (
                     <div key={r} className="flex items-center gap-4">
                       <span className="text-2xl w-8 text-center">{opt.emoji}</span>
                       <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                         <div className={`h-full ${r>=4?'bg-green-500':r===3?'bg-yellow-400':'bg-red-500'}`} style={{width: `${pct}%`}}></div>
                       </div>
                       <span className="w-16 text-right font-bold text-sm text-slate-600">{count} votos</span>
                     </div>
                   );
                })}
              </div>
            )}

            {q.type === 'choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {q.options?.map(opt => {
                   const count = stats[opt] || 0;
                   return (
                     <div key={opt} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex justify-between items-center">
                       <span className="font-medium text-slate-700">{opt}</span>
                       <span className="bg-white px-3 py-1 rounded-lg text-sm font-bold shadow-sm">{count}</span>
                     </div>
                   )
                })}
              </div>
            )}

            {q.type === 'text' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {campResponses.filter(r => r.answers[q.id]).length === 0 && <p className="text-slate-400 italic text-sm">No hay respuestas escritas aún.</p>}
                {campResponses.filter(r => r.answers[q.id]).map((r, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-xl text-slate-700 text-sm border border-slate-100">
                    "{r.answers[q.id]}"
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}

// ============================================================================
// 7. PANEL DE ESTADÍSTICAS GLOBALES (GLOBAL STATS VIEW)
// ============================================================================
function GlobalStatsView({ user, campaigns, responses, callGeminiAPI, setRoute }) {
  const [aiInsight, setAiInsight] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const myCampaigns = campaigns.filter(c => c.ownerId === user.uid);
  const myResponses = responses.filter(r => myCampaigns.some(c => c.id === r.campaignId));

  // Calcular estadísticas globales
  let totalRatingSum = 0;
  let totalRatingCount = 0;
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  myResponses.forEach(res => {
    const camp = myCampaigns.find(c => c.id === res.campaignId);
    if (camp && camp.questions) {
      camp.questions.forEach(q => {
        // Solo promediamos las preguntas de tipo 'rating' (caritas)
        if (q.type === 'rating' && res.answers[q.id]) {
          totalRatingSum += res.answers[q.id];
          totalRatingCount++;
          ratingCounts[res.answers[q.id]] = (ratingCounts[res.answers[q.id]] || 0) + 1;
        }
      });
    }
  });

  const avgRating = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(1) : 0;

  // Generar Insights Globales
  const handleGenerateGlobalAI = async () => {
    setIsGenerating(true);
    
    // Le pasamos un resumen compacto a la IA para no saturarla con datos crudos
    const summary = {
      total_campañas: myCampaigns.length,
      total_respuestas: myResponses.length,
      promedio_satisfaccion_global: avgRating,
      distribucion_calificaciones: ratingCounts
    };

    const prompt = `Actúa como un director de operaciones. Analiza las métricas globales de satisfacción de todas las sucursales/campañas de mi empresa: ${JSON.stringify(summary)}. 
    Dame un diagnóstico general de la salud del negocio en 2 oraciones, y luego enumera 3 estrategias clave a nivel macro para mantener o mejorar este promedio de satisfacción. Responde en español y usa formato markdown simple.`;
    
    const res = await callGeminiAPI(prompt);
    if (res) setAiInsight(res);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Estadísticas Globales</h1>
          <p className="text-slate-500">Resumen consolidado de todas tus campañas</p>
        </div>
      </div>

      {/* Tarjetas de Resumen Global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
          <div className="p-4 bg-blue-50 rounded-xl">
            <ListPlus className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Campañas Activas</p>
            <p className="text-3xl font-bold text-slate-800">{myCampaigns.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
          <div className="p-4 bg-indigo-50 rounded-xl">
            <BarChart3 className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Total Respuestas</p>
            <p className="text-3xl font-bold text-slate-800">{myResponses.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
          <div className={`p-4 rounded-xl ${avgRating >= 4 ? 'bg-green-50 text-green-600' : avgRating >= 3 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
            <span className="text-3xl">{avgRating >= 4 ? '🤩' : avgRating >= 3 ? '😐' : '🙁'}</span>
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Promedio Global</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-slate-800">{avgRating}</p>
              <span className="text-slate-500 font-medium">/ 5.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección AI Global */}
      <div className="mb-8">
        <div className="bg-slate-900 rounded-2xl p-1 shadow-md">
          <div className="bg-white rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-slate-800" />
                <h2 className="text-2xl font-bold text-slate-800">Directorio de Inteligencia (Macro)</h2>
              </div>
              <p className="text-slate-600">Analiza la tendencia general de tu negocio en todas tus sucursales y puntos de contacto.</p>
            </div>
            <button 
              onClick={handleGenerateGlobalAI}
              disabled={isGenerating || myResponses.length === 0}
              className="whitespace-nowrap flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin"/> Procesando...</> : <><Bot className="w-5 h-5"/> Análisis Global AI</>}
            </button>
          </div>
        </div>

        {aiInsight && (
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Bot className="w-5 h-5"/> Estrategia Global</h3>
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
              {aiInsight.split('**').map((chunk, i) => i % 2 === 1 ? <strong key={i}>{chunk}</strong> : chunk)}
            </div>
          </div>
        )}
      </div>

      {/* Distribución Global de Calificaciones */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Distribución Global de Calificaciones</h3>
        <div className="space-y-4">
          {[5,4,3,2,1].map(r => {
              const count = ratingCounts[r] || 0;
              const pct = totalRatingCount ? (count / totalRatingCount) * 100 : 0;
              const opt = RATING_OPTIONS.find(o => o.value === r);
              return (
                <div key={r} className="flex items-center gap-4">
                  <span className="text-2xl w-8 text-center">{opt.emoji}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${r >= 4 ? 'bg-green-500' : r === 3 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="w-20 text-right font-bold text-sm text-slate-600">{count} votos</span>
                </div>
              );
          })}
        </div>
      </div>

    </div>
  );
}
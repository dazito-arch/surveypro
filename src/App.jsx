import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Settings, BarChart3, ChevronLeft, CheckCircle2, AlertCircle, Loader2, Sparkles, Bot, Plus, Trash2, ListPlus, Home, LogOut, User as UserIcon, Link as LinkIcon, Edit3, Copy, Check, Eye, Building2, Store, Users, Image as ImageIcon, Palette, ShieldCheck, Lock, Info } from 'lucide-react';

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

const ROLES = {
  ADMIN: { label: 'Administrador', desc: 'Acceso total: crear, editar, borrar y gestionar equipo.' },
  MANAGER: { label: 'Gerente', desc: 'Puede crear y editar campañas, pero no borrarlas ni gestionar equipo.' },
  ANALYST: { label: 'Analista', desc: 'Solo puede ver estadísticas y resultados. Sin edición.' }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [route, setRoute] = useState('home'); 
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null); 
  const [editingCampaign, setEditingCampaign] = useState(null); 
  
  // Datos Globales
  const [campaigns, setCampaigns] = useState([]);
  const [responses, setResponses] = useState([]);
  const [companies, setCompanies] = useState([]); 
  const [teamMembers, setTeamMembers] = useState([]);
  const [isCampaignsLoaded, setIsCampaignsLoaded] = useState(false);

  // --- LÓGICA DE ESPACIOS DE TRABAJO (WORKSPACES) ---
  
  // 1. Determinar el dueño del espacio de trabajo actual
  const activeOwnerId = useMemo(() => {
    if (!user) return null;
    // Buscamos si el usuario actual fue invitado por alguien más
    if (user.email) {
      const memberRecord = teamMembers.find(m => m.email && m.email.toLowerCase() === user.email.toLowerCase());
      if (memberRecord) return memberRecord.ownerId; // Usa el entorno del invitador
    }
    return user.uid; // Si no es invitado, él es el dueño de su propio entorno
  }, [user, teamMembers]);

  // 2. Filtrar globalmente todos los datos para que pertenezcan solo a este espacio
  const workspaceCampaigns = useMemo(() => campaigns.filter(c => c.ownerId === activeOwnerId), [campaigns, activeOwnerId]);
  const workspaceCompanies = useMemo(() => companies.filter(c => c.ownerId === activeOwnerId), [companies, activeOwnerId]);
  const workspaceTeam = useMemo(() => teamMembers.filter(m => m.ownerId === activeOwnerId), [teamMembers, activeOwnerId]);
  const workspaceResponses = useMemo(() => responses.filter(r => workspaceCampaigns.some(c => c.id === r.campaignId)), [responses, workspaceCampaigns]);

  // --- LÓGICA DE PERMISOS ---
  const userRole = useMemo(() => {
    if (!user) return null;
    if (user.email) {
      const member = teamMembers.find(m => m.email && m.email.toLowerCase() === user.email.toLowerCase());
      if (member) return member.role;
    }
    return 'ADMIN'; 
  }, [user, teamMembers]);

  const can = (action) => {
    if (userRole === 'ADMIN') return true;
    if (userRole === 'MANAGER') return ['VIEW_STATS', 'CREATE_CAMPAIGN', 'EDIT_CAMPAIGN', 'VIEW_GLOBAL'].includes(action);
    if (userRole === 'ANALYST') return ['VIEW_STATS', 'VIEW_GLOBAL'].includes(action);
    return false;
  };

  // --- LLAMADA API GEMINI ---
  const callGeminiAPI = async (prompt, systemInstruction = "Eres un consultor experto en experiencia del cliente.") => {
    // ⚠️ ATENCIÓN: Pega tu API Key de Google aquí para que funcione en tu web real
    const apiKey = ""; 
    
    if (!apiKey) return "⚠️ Falta la API Key de Gemini. Debes generar una en Google AI Studio y colocarla en el código.";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } };
    const delays = [1000, 2000, 4000];

    for (let i = 0; i <= delays.length; i++) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        throw new Error('Respuesta vacía');
      } catch (err) {
        if (i === delays.length) return "⚠️ Error de conexión con la Inteligencia Artificial. Por favor, intenta de nuevo más tarde.";
        await new Promise(res => setTimeout(res, delays[i]));
      }
    }
  };

  // --- DETECTAR ENLACE PÚBLICO ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const surveyIdUrl = params.get('survey');
    const branchIdUrl = params.get('branch');
    
    if (surveyIdUrl) {
      setSelectedCampaignId(surveyIdUrl);
      if (branchIdUrl) setSelectedBranchId(branchIdUrl);
      setRoute('survey');
    }
  }, []);

  // --- INICIALIZACIÓN Y AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Error inicial de auth:", err); }
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
    
    // Cargamos todos los datos sin importar si es anónimo para evitar errores de sincronización de equipo
    const campsRef = collection(db, 'artifacts', appId, 'public', 'data', 'campaigns');
    const unsubCamps = onSnapshot(campsRef, (snapshot) => {
      setCampaigns(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
      setIsCampaignsLoaded(true);
    }, console.error);

    const compsRef = collection(db, 'artifacts', appId, 'public', 'data', 'companies');
    const unsubComps = onSnapshot(compsRef, (snapshot) => setCompanies(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);

    const respsRef = collection(db, 'artifacts', appId, 'public', 'data', 'responses');
    const unsubResps = onSnapshot(respsRef, (snapshot) => setResponses(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'team_members');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => setTeamMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);

    return () => { unsubComps(); unsubCamps(); unsubResps(); unsubUsers(); };
  }, [user]);

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {route !== 'survey' && (
        <nav className="bg-white border-b border-slate-200 p-4 shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <button onClick={() => { window.history.pushState({}, '', window.location.pathname); setRoute('home'); }} className="flex items-center gap-2 font-bold text-xl text-blue-600">
              <CheckCircle2 className="w-6 h-6" /> <span>SurveyPro</span>
            </button>
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
              {!user || user.isAnonymous ? (
                <button onClick={() => setRoute('login')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700 transition-colors whitespace-nowrap">
                  <UserIcon className="w-4 h-4" /> Acceso Admin
                </button>
              ) : (
                <div className="flex items-center gap-1 md:gap-4">
                  {can('ADMIN') && <button onClick={() => setRoute('users')} className="flex items-center gap-1 font-medium text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg whitespace-nowrap"><Users className="w-4 h-4" /> Equipo</button>}
                  {can('ADMIN') && <button onClick={() => setRoute('orgs')} className="flex items-center gap-1 font-medium text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg whitespace-nowrap"><Building2 className="w-4 h-4" /> Empresas</button>}
                  <button onClick={() => setRoute('admin')} className="font-medium text-slate-600 hover:text-blue-600 px-3 py-1.5 whitespace-nowrap">Campañas</button>
                  <button onClick={() => { signOut(auth); setRoute('home'); }} className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors ml-2"><LogOut className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className={route === 'survey' ? '' : "max-w-7xl mx-auto p-4 md:p-8"}>
        {route === 'home' && <HomeView campaigns={campaigns} setRoute={setRoute} setSelectedCampaignId={setSelectedCampaignId} />}
        {route === 'login' && <AuthView setRoute={setRoute} />}
        {route === 'admin' && <AdminDashboard user={user} teamMembers={teamMembers} can={can} campaigns={workspaceCampaigns} responses={workspaceResponses} companies={workspaceCompanies} setRoute={setRoute} setSelectedCampaignId={setSelectedCampaignId} setEditingCampaign={setEditingCampaign} appId={appId} />}
        {route === 'orgs' && can('ADMIN') && <OrgManager activeOwnerId={activeOwnerId} companies={workspaceCompanies} setRoute={setRoute} appId={appId} />}
        {route === 'users' && can('ADMIN') && <UserManager activeOwnerId={activeOwnerId} teamMembers={workspaceTeam} setRoute={setRoute} appId={appId} />}
        {route === 'builder' && can('CREATE_CAMPAIGN') && <CampaignBuilder activeOwnerId={activeOwnerId} companies={workspaceCompanies} setRoute={setRoute} appId={appId} editingCampaign={editingCampaign} />}
        {route === 'stats' && <StatsView campaignId={selectedCampaignId} campaigns={workspaceCampaigns} responses={workspaceResponses} callGeminiAPI={callGeminiAPI} setRoute={setRoute} />}
        {route === 'globalStats' && <GlobalStatsView campaigns={workspaceCampaigns} responses={workspaceResponses} callGeminiAPI={callGeminiAPI} setRoute={setRoute} />}
      </main>

      {route === 'survey' && <SurveyRunner campaignId={selectedCampaignId} branchId={selectedBranchId} campaigns={campaigns} appId={appId} setRoute={setRoute} user={user} isCampaignsLoaded={isCampaignsLoaded} callGeminiAPI={callGeminiAPI} />}
    </div>
  );
}

// --- VISTAS AUXILIARES ---

function HomeView({ campaigns, setRoute, setSelectedCampaignId }) {
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center animate-in fade-in">
      <h1 className="text-4xl md:text-7xl font-black text-slate-900 mb-6 tracking-tighter">Feedback Inteligente.</h1>
      <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto font-medium">Plataforma corporativa para la medición de satisfacción en tiempo real.</p>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 w-full max-w-2xl text-left">
        <h2 className="text-xl font-bold mb-6">Encuestas de Prueba</h2>
        {activeCampaigns.length === 0 ? <p className="text-slate-400 italic">No hay campañas configuradas.</p> : (
          <div className="grid gap-4">
            {activeCampaigns.map(camp => (
              <div key={camp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all">
                <div className="flex items-center gap-4">
                   {camp.logoUrl && <img src={camp.logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-xl bg-white p-2 shadow-sm" />}
                   <div><h3 className="font-bold text-slate-800">{camp.title}</h3><p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{camp.questions?.length || 0} Preguntas</p></div>
                </div>
                <button onClick={() => { setSelectedCampaignId(camp.id); setRoute('survey'); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-lg active:scale-95">Abrir</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuthView({ setRoute }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (isRecovering) { await sendPasswordResetEmail(auth, email); setMessage('Correo enviado con éxito.'); setTimeout(() => setIsRecovering(false), 5000); }
      else if (isLogin) { await signInWithEmailAndPassword(auth, email, password); setRoute('admin'); }
      else { await createUserWithEmailAndPassword(auth, email, password); setRoute('admin'); }
    } catch (err) { setError('Credenciales inválidas o error de conexión.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 animate-in zoom-in-95">
      <div className="flex justify-center mb-8"><div className="p-4 bg-blue-50 rounded-full text-blue-600"><Lock className="w-10 h-10" /></div></div>
      <h2 className="text-3xl font-black text-center mb-8 tracking-tight">{isRecovering ? 'Recuperar' : (isLogin ? 'Bienvenido' : 'Registrar Empresa')}</h2>
      {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> {error}</div>}
      {message && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-2xl text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {message}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Correo corporativo" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-medium" />
        {!isRecovering && <input type="password" placeholder="Contraseña" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-medium" />}
        <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-[2rem] font-black shadow-xl transition-all active:scale-95 disabled:opacity-50">
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (isRecovering ? 'Enviar Enlace' : (isLogin ? 'Entrar' : 'Comenzar'))}
        </button>
      </form>
      <div className="text-center mt-8 flex flex-col gap-3">
        <button onClick={() => { setIsLogin(!isLogin); setIsRecovering(false); }} className="text-sm text-blue-600 font-black hover:underline underline-offset-4">{isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button>
        {isLogin && !isRecovering && <button onClick={() => setIsRecovering(true)} className="text-xs text-slate-400 font-bold hover:text-blue-500">¿Olvidaste tu contraseña?</button>}
      </div>
    </div>
  );
}

function UserManager({ activeOwnerId, teamMembers, setRoute, appId }) {
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('ANALYST');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'team_members'), {
        ownerId: activeOwnerId, name: newUserName.trim(), email: newUserEmail.trim(), role: newUserRole, createdAt: Date.now()
      });
      setNewUserName(''); setNewUserEmail('');
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('¿Eliminar acceso a este usuario?')) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team_members', id)); } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => setRoute('admin')} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200"><ChevronLeft className="w-6 h-6" /></button>
        <div><h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestión de Equipo</h1><p className="text-slate-500 font-medium">Controla quién puede acceder a tus datos.</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h2 className="text-xl font-black mb-6">Nuevo Miembro</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <input placeholder="Nombre completo" value={newUserName} onChange={e => setNewUserName(e.target.value)} required className="w-full px-5 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none text-sm font-medium" />
              <input type="email" placeholder="usuario@empresa.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required className="w-full px-5 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none text-sm font-medium" />
              <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="w-full px-5 py-3 rounded-xl border-2 border-slate-50 outline-none text-sm font-bold bg-white">
                {Object.entries(ROLES).map(([key, role]) => <option key={key} value={key}>{role.label}</option>)}
              </select>
              <button type="submit" disabled={isSaving} className="w-full bg-slate-900 text-white rounded-xl font-black py-4 shadow-lg hover:bg-black transition-all">Invitar</button>
            </form>
          </div>
          <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl">
             <h3 className="font-black text-lg mb-4 flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> Permisos: {ROLES[newUserRole].label}</h3>
             <p className="text-blue-100 text-sm leading-relaxed">{ROLES[newUserRole].desc}</p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
            {teamMembers.length === 0 ? <p className="p-20 text-center text-slate-400 font-medium italic">No has añadido colaboradores todavía.</p> : (
              <div className="divide-y divide-slate-100">
                {teamMembers.map(member => (
                  <div key={member.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-lg">{member.name.charAt(0)}</div>
                      <div><p className="font-black text-slate-800">{member.name}</p><p className="text-xs text-slate-400 font-bold">{member.email}</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${member.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : member.role === 'MANAGER' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{ROLES[member.role]?.label || 'Miembro'}</span>
                      <button onClick={() => handleDeleteUser(member.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrgManager({ activeOwnerId, companies, setRoute, appId }) {
  const [newCompName, setNewCompName] = useState('');
  const [newBranchNames, setNewBranchNames] = useState({});
  const [isSavingComp, setIsSavingComp] = useState(false);

  const handleCreateCompany = async (e) => {
    e.preventDefault(); if (!newCompName.trim()) return;
    setIsSavingComp(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companies'), { ownerId: activeOwnerId, name: newCompName.trim(), branches: [], createdAt: Date.now() });
      setNewCompName('');
    } catch (err) { console.error(err); } finally { setIsSavingComp(false); }
  };

  const handleCreateBranch = async (compId) => {
    const name = newBranchNames[compId]; if (!name?.trim()) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companies', compId), { branches: arrayUnion({ id: `b_${Date.now()}`, name: name.trim() }) });
      setNewBranchNames({ ...newBranchNames, [compId]: '' });
    } catch (err) { console.error(err); }
  };

  const handleDeleteBranch = async (compId, branch) => {
    if (!window.confirm('¿Eliminar sucursal?')) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companies', compId), { branches: arrayRemove(branch) });
  };

  const handleDeleteCompany = async (id) => {
    if (!window.confirm('¿Borrar empresa?')) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companies', id));
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => setRoute('admin')} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Empresas</h1>
      </div>
      <form onSubmit={handleCreateCompany} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 flex gap-4 mb-10 shadow-sm">
        <input placeholder="Nombre de la nueva Organización..." value={newCompName} onChange={e => setNewCompName(e.target.value)} required className="flex-1 px-6 py-4 border-2 border-slate-50 rounded-2xl outline-none focus:border-blue-500 font-bold" />
        <button type="submit" disabled={isSavingComp} className="bg-slate-900 text-white px-10 rounded-2xl font-black hover:bg-black transition-all">Crear</button>
      </form>
      <div className="space-y-6">
        {companies.map(comp => (
          <div key={comp.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 relative group shadow-sm transition-all hover:scale-[1.01]">
            <button onClick={() => handleDeleteCompany(comp.id)} className="absolute top-8 right-8 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-6 h-6" /></button>
            <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3"><Building2 className="w-7 h-7 text-blue-600" /> {comp.name}</h3>
            <div className="ml-2 border-l-4 border-slate-50 pl-8 space-y-4">
              <div className="space-y-2">
                {(Array.isArray(comp.branches) ? comp.branches : []).map(b => (
                  <div key={b.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="font-bold text-slate-700">{b.name}</span>
                    <button onClick={() => handleDeleteBranch(comp.id, b)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 max-w-md pt-2">
                <input placeholder="Añadir sucursal..." value={newBranchNames[comp.id] || ''} onChange={e => setNewBranchNames({ ...newBranchNames, [comp.id]: e.target.value })} className="flex-1 px-4 py-2 text-sm border-2 border-slate-50 rounded-xl outline-none focus:border-blue-500 font-medium" />
                <button onClick={() => handleCreateBranch(comp.id)} className="bg-blue-600 text-white px-5 rounded-xl font-black">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard({ user, teamMembers, can, campaigns, responses, companies, setRoute, setSelectedCampaignId, setEditingCampaign, appId }) {
  const [copiedId, setCopiedId] = useState(null);
  if (!user || user.isAnonymous) return <AuthView setRoute={setRoute} />;

  // Identificar si está operando bajo un entorno invitado
  const isCollaborator = user.email && teamMembers.find(m => m.email?.toLowerCase() === user.email.toLowerCase());

  const handleCopyLink = (campaignId, branchId = null) => {
    const url = `${window.location.origin}${window.location.pathname}?survey=${campaignId}${branchId ? `&branch=${branchId}` : ''}`;
    try {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed'; // Evita el salto de scroll al seleccionar
      el.style.top = '0';
      el.style.left = '0';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(`${campaignId}-${branchId || 'main'}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error("Error al copiar:", err); }
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm('¿Borrar campaña definitivamente?')) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'campaigns', id));
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-3">Panel Administrativo</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            Control central de encuestas. 
            {isCollaborator && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase">Modo Colaborador</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('ADMIN') && <button onClick={() => setRoute('users')} className="px-5 py-3 bg-white border-2 border-slate-100 rounded-[1.5rem] font-black text-xs hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Users className="w-4 h-4 text-blue-500" /> EQUIPO</button>}
          {can('ADMIN') && <button onClick={() => setRoute('orgs')} className="px-5 py-3 bg-white border-2 border-slate-100 rounded-[1.5rem] font-black text-xs hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Building2 className="w-4 h-4 text-blue-500" /> EMPRESAS</button>}
          <button onClick={() => setRoute('globalStats')} className="px-5 py-3 bg-white border-2 border-slate-100 rounded-[1.5rem] font-black text-xs hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><BarChart3 className="w-4 h-4 text-blue-500" /> GLOBAL</button>
          {can('CREATE_CAMPAIGN') && <button onClick={() => { setEditingCampaign(null); setRoute('builder'); }} className="px-6 py-3 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">+ NUEVA</button>}
        </div>
      </div>
      
      {campaigns.length === 0 ? (
         <div className="bg-white p-20 rounded-[3rem] border-4 border-dashed border-slate-100 text-center flex flex-col items-center">
            <Bot className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-xl font-bold text-slate-400">No hay campañas configuradas.</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {campaigns.map(camp => {
            const count = responses.filter(r => r.campaignId === camp.id).length;
            const parentComp = companies.find(c => c.id === camp.companyId);
            return (
              <div key={camp.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm relative group flex flex-col h-full hover:shadow-2xl transition-all">
                <div className="absolute top-6 right-8 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {can('EDIT_CAMPAIGN') && <button onClick={() => { setEditingCampaign(camp); setRoute('builder'); }} className="p-2.5 bg-white shadow-xl text-slate-400 hover:text-blue-600 rounded-xl border border-slate-50"><Edit3 className="w-4 h-4" /></button>}
                  {can('ADMIN') && <button onClick={() => handleDeleteCampaign(camp.id)} className="p-2.5 bg-white shadow-xl text-slate-400 hover:text-red-600 rounded-xl border border-slate-50"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="flex items-center gap-4 mb-6 pr-16">
                  {camp.logoUrl ? <img src={camp.logoUrl} className="w-14 h-14 object-contain rounded-2xl bg-slate-50 p-2 shadow-sm shrink-0" /> : <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-300 shrink-0" style={{backgroundColor: camp.bgColor}}><ImageIcon className="w-6 h-6" /></div>}
                  <div><h3 className="font-black text-lg line-clamp-1 leading-tight">{camp.title}</h3><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{parentComp?.name || 'Global'}</p></div>
                </div>
                <div className="flex gap-4 text-xs font-bold text-slate-400 mb-8 uppercase tracking-tighter"><span>{count} Feedbacks</span> • <span>{camp.questions?.length} Preguntas</span></div>
                <div className="space-y-2 mb-8 flex-1 overflow-y-auto max-h-48 pr-2 no-scrollbar">
                  {(Array.isArray(camp.branchIds) ? camp.branchIds : []).map(bId => {
                    const b = parentComp?.branches?.find(br => br.id === bId);
                    const cid = `${camp.id}-${bId}`;
                    return (
                      <div key={bId} className="flex items-center justify-between text-[11px] bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:bg-white transition-all">
                        <span className="truncate flex-1 pr-2 font-black text-slate-600">{b?.name || 'Punto de venta'}</span>
                        <button onClick={() => handleCopyLink(camp.id, bId)} className="text-blue-600 font-black flex items-center gap-1">
                          {copiedId === cid ? <><Check className="w-3 h-3"/> LISTO</> : <><LinkIcon className="w-3 h-3"/> COPIAR</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-auto flex gap-3">
                  <button onClick={() => { setSelectedCampaignId(camp.id); setRoute('stats'); }} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black tracking-widest hover:bg-black shadow-lg">DATOS</button>
                  <button onClick={() => { setSelectedCampaignId(camp.id); setRoute('survey'); }} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors"><Eye className="w-5 h-5 text-slate-600" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CampaignBuilder({ activeOwnerId, companies, setRoute, appId, editingCampaign }) {
  const [title, setTitle] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bgColor, setBgColor] = useState('#f8fafc');
  const [companyId, setCompanyId] = useState('');
  const [branchIds, setBranchIds] = useState([]);
  const [questions, setQuestions] = useState([{ id: 'q_1', type: 'rating', title: '¿Cómo calificarías nuestro servicio hoy?' }]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingCampaign) {
      setTitle(editingCampaign.title || ''); setLogoUrl(editingCampaign.logoUrl || '');
      setBgColor(editingCampaign.bgColor || '#f8fafc'); setCompanyId(editingCampaign.companyId || '');
      setBranchIds(editingCampaign.branchIds || []); setQuestions(editingCampaign.questions || []);
    }
  }, [editingCampaign]);

  const addQuestion = (type) => {
    const q = { id: `q_${Date.now()}`, type, title: 'Nueva pregunta...' };
    if (type === 'choice') q.options = ['Excelente', 'Bueno', 'Mejorable'];
    setQuestions([...questions, q]);
  };

  const handleSave = async () => {
    if (!title.trim() || !companyId || branchIds.length === 0) return alert('Completa los campos obligatorios.');
    setIsSaving(true);
    try {
      const payload = { ownerId: activeOwnerId, title, logoUrl, bgColor, companyId, branchIds, questions, status: 'active', updatedAt: Date.now() };
      if (editingCampaign) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'campaigns', editingCampaign.id), payload);
      else { payload.createdAt = Date.now(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'campaigns'), payload); }
      setRoute('admin');
    } catch (e) { alert("Error al guardar."); } finally { setIsSaving(false); }
  };

  const selectedComp = companies.find(c => c.id === companyId);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in pb-24">
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => setRoute('admin')} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-4xl font-black tracking-tight">{editingCampaign ? 'Editar Encuesta' : 'Diseño Inteligente'}</h1>
      </div>
      <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-50 mb-10 space-y-10 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre de Campaña</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-lg" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Logo URL</label>
            <div className="flex gap-4"><input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-medium" />{logoUrl && <img src={logoUrl} className="w-14 h-14 object-contain rounded-2xl bg-slate-50 p-2 border shadow-sm" />}</div></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estilo de Fondo</label>
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl"><input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-14 h-14 rounded-xl cursor-pointer border-0" /><input value={bgColor} readOnly className="flex-1 bg-white px-4 py-2 rounded-xl text-xs font-mono font-black" /></div></div>
          </div>
          <div className="space-y-6">
            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Organización</label>
            <select value={companyId} onChange={e => { setCompanyId(e.target.value); setBranchIds([]); }} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-black text-lg">
              <option value="">Seleccionar...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
            {selectedComp && (
              <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 max-h-56 overflow-y-auto no-scrollbar shadow-inner">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Sucursales Disponibles</p>
                <div className="space-y-3">
                  {(Array.isArray(selectedComp.branches) ? selectedComp.branches : []).map(b => (
                    <label key={b.id} className="flex items-center gap-4 cursor-pointer p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-400 transition-colors font-bold text-sm text-slate-700">
                      <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => setBranchIds(prev => prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id])} className="w-6 h-6 rounded-lg text-blue-600 border-2 border-slate-200" /> {b.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-6 mb-12">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-8"><span className="text-[9px] font-black px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg tracking-widest uppercase">{q.type}</span><button onClick={() => setQuestions(questions.filter((_, i) => i !== idx))} className="text-slate-200 hover:text-red-500 p-2"><Trash2 className="w-6 h-6" /></button></div>
            <input value={q.title} onChange={e => { const n = [...questions]; n[idx].title = e.target.value; setQuestions(n); }} className="w-full font-black text-3xl outline-none border-b-4 border-slate-50 focus:border-blue-50 pb-6 mb-8 transition-colors" />
            {q.type === 'choice' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {q.options?.map((opt, oIdx) => (
                  <div key={oIdx} className="flex gap-2 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100"><input value={opt} onChange={e => { const n = [...questions]; n[idx].options[oIdx] = e.target.value; setQuestions(n); }} className="flex-1 bg-transparent font-bold text-slate-700 outline-none" /><button onClick={() => { const n = [...questions]; n[idx].options.splice(oIdx, 1); setQuestions(n); }} className="text-slate-300 hover:text-red-500 font-black">×</button></div>
                ))}
                <button onClick={() => { const n = [...questions]; n[idx].options = [...(n[idx].options||[]), 'Nueva Opción']; setQuestions(n); }} className="flex items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-blue-600 hover:border-blue-400 transition-all uppercase tracking-widest">+ OPCIÓN</button>
              </div>
            )}
            {idx > 0 && (
              <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <label className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer mb-4"><input type="checkbox" checked={!!q.condition} onChange={e => { if(e.target.checked) { const n=[...questions]; n[idx].condition={dependsOnId:questions[idx-1].id, operator:'==', value:''}; setQuestions(n); } else { const n=[...questions]; delete n[idx].condition; setQuestions(n); } }} className="w-5 h-5 rounded-lg border-2 border-slate-200" /> Habilitar Salto Condicional</label>
                {q.condition && (
                   <div className="flex flex-wrap gap-4 animate-in slide-in-from-top-2">
                      <select value={q.condition.dependsOnId} onChange={e => { const n=[...questions]; n[idx].condition.dependsOnId=e.target.value; setQuestions(n); }} className="text-xs p-3 border-2 border-slate-100 rounded-xl bg-white outline-none font-bold">{questions.slice(0, idx).map(pq => <option key={pq.id} value={pq.id}>SI EN: {pq.title.substring(0,30)}...</option>)}</select>
                      <select value={q.condition.operator} onChange={e => { const n=[...questions]; n[idx].condition.operator=e.target.value; setQuestions(n); }} className="text-xs p-3 border-2 border-slate-100 rounded-xl bg-white outline-none font-bold"><option value="==">ES IGUAL A</option><option value="<=">MENOR O IGUAL</option><option value=">=">MAYOR O IGUAL</option></select>
                      <input value={q.condition.value} onChange={e => { const n=[...questions]; n[idx].condition.value=e.target.value; setQuestions(n); }} placeholder="Valor (Ej: 2)" className="text-xs p-3 border-2 border-slate-100 rounded-xl bg-white outline-none font-black w-24" />
                   </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-4 justify-center py-10 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
          <button onClick={() => addQuestion('rating')} className="px-8 py-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs text-slate-600 hover:border-blue-500 shadow-sm transition-all active:scale-95">😡 CARITAS</button>
          <button onClick={() => addQuestion('choice')} className="px-8 py-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs text-slate-600 hover:border-blue-500 shadow-sm transition-all active:scale-95">🔘 OPCIONES</button>
          <button onClick={() => addQuestion('text')} className="px-8 py-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-xs text-slate-600 hover:border-blue-500 shadow-sm transition-all active:scale-95">📝 TEXTO</button>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-8 bg-white/90 backdrop-blur-xl border-t-2 border-slate-50 flex justify-center z-50">
        <button onClick={handleSave} disabled={isSaving} className="max-w-xl w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-xl shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all flex justify-center items-center gap-4 active:scale-95">
          {isSaving ? <Loader2 className="w-8 h-8 animate-spin" /> : <CheckCircle2 className="w-8 h-8" />} {editingCampaign ? 'GUARDAR CAMBIOS' : 'PUBLICAR SISTEMA'}
        </button>
      </div>
    </div>
  );
}

function SurveyRunner({ campaignId, branchId, campaigns, appId, setRoute, user, isCampaignsLoaded, callGeminiAPI }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [aiThanks, setAiThanks] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  if (!isCampaignsLoaded) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 animate-spin text-blue-500" /></div>;
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return <div className="text-center p-20 flex flex-col items-center h-screen justify-center"><AlertCircle className="w-16 h-16 text-red-500 mb-6" /><h1 className="text-4xl font-black tracking-tight">Encuesta no disponible</h1><button onClick={() => { window.history.pushState({}, '', window.location.pathname); setRoute('home'); }} className="mt-8 text-blue-600 font-black text-lg underline">Volver al Inicio</button></div>;
  
  const currentQ = campaign.questions[currentStep];

  const getNextIndex = (currentIndex, currentAnswers) => {
    for (let i = currentIndex + 1; i < campaign.questions.length; i++) {
      const q = campaign.questions[i];
      if (!q.condition) return i;
      const ans = currentAnswers[q.condition.dependsOnId];
      if (ans === undefined) continue;
      const val = q.condition.value;
      if (q.condition.operator === '==' && ans == val) return i;
      if (q.condition.operator === '<=' && ans <= val) return i;
      if (q.condition.operator === '>=' && ans >= val) return i;
    }
    return -1;
  };

  const handleAnswer = (val) => {
    const newAnswers = { ...answers, [currentQ.id]: val };
    setAnswers(newAnswers);
    if (currentQ.type !== 'text') {
      setTimeout(() => { const n = getNextIndex(currentStep, newAnswers); if (n !== -1) setCurrentStep(n); else handleSubmit(newAnswers); }, 400);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'responses'), { campaignId, branchId: branchId || 'direct', answers: finalAnswers, timestamp: Date.now() });
      setIsFinished(true);
      setLoadingAi(true);
      const rating = Object.values(finalAnswers).find(v => typeof v === 'number') || 5;
      const prompt = `Un cliente calificó con ${rating}/5 en "${campaign.title}". Genera un agradecimiento corto y empático (2 frases).`;
      callGeminiAPI(prompt).then(res => { if(res) setAiThanks(res); setLoadingAi(false); });
      setTimeout(() => { setAnswers({}); setCurrentStep(0); setIsFinished(false); setAiThanks(''); }, 8000);
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  if (isFinished) return (
    <div className="flex flex-col items-center justify-center h-screen p-6 text-center animate-in zoom-in-95 duration-500" style={{backgroundColor: campaign.bgColor}}>
      <div className="bg-white/90 backdrop-blur-xl p-16 rounded-[4rem] shadow-2xl max-w-xl w-full border border-white/50 flex flex-col items-center">
        {campaign.logoUrl && <img src={campaign.logoUrl} className="w-32 h-32 object-contain mb-10 drop-shadow-lg" />}
        <div className="p-5 bg-green-100 rounded-full mb-10"><CheckCircle2 className="w-20 h-20 text-green-600" /></div>
        <h2 className="text-5xl font-black mb-6 text-slate-900 tracking-tighter uppercase">¡Gracias!</h2>
        <div className="min-h-[60px] flex items-center justify-center">
          {loadingAi ? <div className="flex items-center gap-2 text-blue-500 font-bold animate-pulse"><Sparkles className="w-5 h-5"/> Generando mensaje...</div> : (
            <p className="text-slate-600 text-xl font-bold italic leading-relaxed">{aiThanks || "Tu opinión nos ayuda a crecer."}</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col relative transition-colors duration-1000 overflow-y-auto" style={{backgroundColor: campaign.bgColor}}>
      <div className="fixed top-0 left-0 right-0 h-2 bg-black/5 z-50"><div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${(currentStep / campaign.questions.length) * 100}%` }}></div></div>
      
      <div className="flex-1 flex flex-col items-center px-6 py-12 md:py-20 max-w-5xl mx-auto w-full">
        <div className="mb-12 md:mb-16 flex justify-center w-full min-h-[100px]">
          {campaign.logoUrl ? <img src={campaign.logoUrl} className="max-h-24 md:max-h-32 max-w-full object-contain drop-shadow-2xl animate-in fade-in" /> : <div className="h-2 w-20 bg-black/5 rounded-full"></div>}
        </div>

        <div className="w-full text-center animate-in fade-in slide-in-from-bottom-8 duration-700" key={currentStep}>
          <div className="bg-white/75 backdrop-blur-2xl p-10 md:p-14 rounded-[3.5rem] shadow-2xl border border-white/50 mb-12">
             <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight tracking-tighter">{currentQ?.title}</h1>
          </div>

          <div className="w-full">
            {currentQ?.type === 'rating' && (
              <div className="flex flex-wrap justify-center gap-4 md:gap-8">
                {RATING_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => handleAnswer(opt.value)} disabled={isSubmitting} className="flex flex-col items-center p-8 md:p-10 bg-white/95 rounded-[3rem] border-4 border-transparent hover:border-blue-500 hover:scale-110 transition-all shadow-xl group">
                    <span className="text-7xl md:text-8xl mb-4 transition-transform group-hover:rotate-12">{opt.emoji}</span>
                    <span className="font-black text-slate-400 group-hover:text-blue-600 uppercase text-[10px] tracking-widest">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
            {currentQ?.type === 'choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {(Array.isArray(currentQ.options) ? currentQ.options : []).map((opt, i) => <button key={i} onClick={() => handleAnswer(opt)} className="py-10 md:py-12 bg-white/95 border-4 border-white rounded-[2.5rem] text-2xl md:text-3xl font-black text-slate-800 hover:bg-blue-600 hover:text-white hover:scale-105 active:scale-95 transition-all shadow-2xl">{opt}</button>)}
              </div>
            )}
            {currentQ?.type === 'text' && (
              <div className="max-w-3xl mx-auto flex flex-col items-center">
                <textarea autoFocus rows={4} value={answers[currentQ.id] || ''} onChange={e => setAnswers({ ...answers, [currentQ.id]: e.target.value })} placeholder="Escribe aquí..." className="w-full p-10 text-2xl md:text-4xl rounded-[3.5rem] border-0 bg-white/90 shadow-2xl outline-none font-black tracking-tight" />
                <button onClick={() => { const n = getNextIndex(currentStep, answers); if (n !== -1) setCurrentStep(n); else handleSubmit(answers); }} className="mt-12 bg-slate-900 text-white px-20 py-8 rounded-[2rem] font-black text-2xl shadow-2xl hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">Siguiente</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {!window.location.search && <button onClick={() => setRoute('admin')} className="fixed bottom-10 right-10 p-5 bg-black/10 hover:bg-black/30 rounded-full transition-all text-white/40 hover:text-white z-50 backdrop-blur-xl"><LogOut className="w-8 h-8" /></button>}
    </div>
  );
}

function StatsView({ campaignId, campaigns, responses, callGeminiAPI, setRoute }) {
  const campaign = campaigns.find(c => c.id === campaignId);
  const campResponses = responses.filter(r => r.campaignId === campaignId);
  const [aiInsight, setAiInsight] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  if (!campaign) return null;

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const summary = campResponses.map(r => r.answers);
    const prompt = `Analiza los datos de la encuesta "${campaign.title}": ${JSON.stringify(summary)}. Da un diagnóstico y 3 consejos.`;
    const res = await callGeminiAPI(prompt);
    if (res) setAiInsight(res);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div className="flex items-center gap-6"><button onClick={() => setRoute('admin')} className="p-4 bg-white rounded-[1.5rem] shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"><ChevronLeft className="w-8 h-8 text-slate-800" /></button><div><h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">{campaign.title}</h1><p className="text-slate-400 font-black text-xs uppercase tracking-widest">{campResponses.length} Feedbacks</p></div></div>
        <button onClick={handleGenerateAI} disabled={isGenerating || campResponses.length === 0} className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
           {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Bot className="w-6 h-6" />} INFORME IA
        </button>
      </div>
      {aiInsight && <div className="mb-12 p-10 bg-indigo-50 border-2 border-indigo-100 rounded-[3rem] shadow-sm animate-in slide-in-from-top-6"><div className="flex items-center gap-3 mb-6 text-indigo-900 font-black text-xl"><Bot className="w-8 h-8" /> ANÁLISIS GEMINI</div><div className="prose prose-indigo max-w-none text-indigo-950 font-bold leading-relaxed whitespace-pre-wrap">{aiInsight}</div></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {(Array.isArray(campaign.questions) ? campaign.questions : []).map((q, idx) => {
          let counts = {}; if (q.type === 'rating' || q.type === 'choice') campResponses.forEach(r => { const v = r.answers[q.id]; if (v) counts[v] = (counts[v] || 0) + 1; });
          return (
            <div key={q.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <h3 className="font-black text-slate-800 mb-10 flex items-start gap-5 leading-tight"><span className="p-2.5 bg-slate-50 rounded-2xl text-[10px] text-slate-400 font-black">#{idx + 1}</span> {q.title}</h3>
              {q.type === 'rating' ? (
                <div className="space-y-4">
                  {[5, 4, 3, 2, 1].map(r => {
                    const c = counts[r] || 0; const pct = campResponses.length ? (c / campResponses.length) * 100 : 0;
                    return (
                      <div key={r} className="flex items-center gap-6">
                        <span className="w-10 text-3xl">{RATING_OPTIONS.find(o => o.value === r).emoji}</span>
                        <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100"><div className={`h-full transition-all duration-1000 ${r >= 4 ? 'bg-green-500' : r === 3 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div></div>
                        <span className="text-xs font-black w-24 text-right text-slate-400 uppercase">{c} VOTOS</span>
                      </div>
                    );
                  })}
                </div>
              ) : q.type === 'choice' ? (
                <div className="space-y-3">
                   {(Array.isArray(q.options) ? q.options : []).map(opt => {
                     const c = counts[opt] || 0; const pct = campResponses.length ? (c / campResponses.length) * 100 : 0;
                     return (
                       <div key={opt} className="relative bg-slate-50 rounded-2xl p-5 overflow-hidden border border-slate-100">
                         <div className="absolute inset-0 bg-blue-100/40 transition-all duration-1000" style={{width: `${pct}%`}}></div>
                         <div className="relative flex justify-between items-center text-sm font-black text-slate-700"><span>{opt}</span><span className="bg-white px-4 py-1 rounded-xl shadow-sm border font-black">{c}</span></div>
                       </div>
                     );
                   })}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-4 pr-3 no-scrollbar">
                   {campResponses.filter(r => r.answers[q.id]).length === 0 ? <p className="text-sm text-slate-300 italic font-medium">Sin comentarios aún.</p> : (
                     campResponses.filter(r => r.answers[q.id]).map((r, i) => <div key={i} className="text-sm p-5 bg-slate-50 rounded-[2rem] italic text-slate-600 border border-slate-100 font-bold leading-relaxed shadow-inner">"{r.answers[q.id]}"</div>)
                   )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlobalStatsView({ campaigns, responses, callGeminiAPI, setRoute }) {
  let totalRatingSum = 0; let totalRatingCount = 0;
  responses.forEach(res => { const camp = campaigns.find(c => c.id === res.campaignId); camp?.questions?.forEach(q => { if (q.type === 'rating' && res.answers[q.id]) { totalRatingSum += res.answers[q.id]; totalRatingCount++; } }); });
  const avg = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(1) : 0;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-20">
      <div className="flex items-center gap-6 mb-12"><button onClick={() => setRoute('admin')} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"><ChevronLeft className="w-8 h-8" /></button><div><h1 className="text-5xl font-black text-slate-900 tracking-tighter">Estadísticas Consolidadas</h1><p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] mt-1">Visión de Alto Nivel de la Organización</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm text-center transform transition-all hover:scale-105"><p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-4">Campañas</p><p className="text-8xl font-black text-slate-900 tracking-tighter">{campaigns.length}</p></div>
        <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm text-center transform transition-all hover:scale-105"><p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-4">Feedback Total</p><p className="text-8xl font-black text-slate-900 tracking-tighter">{responses.length}</p></div>
        <div className="bg-blue-600 p-12 rounded-[4rem] shadow-2xl shadow-blue-200 text-center text-white transform transition-all hover:scale-105 border-b-8 border-blue-800"><p className="text-xs font-black text-blue-200 uppercase tracking-widest mb-4">Puntuación Media</p><p className="text-8xl font-black leading-none">{avg} <span className="text-3xl opacity-50">/ 5</span></p></div>
      </div>
    </div>
  );
}
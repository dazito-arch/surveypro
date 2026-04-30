import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Settings, BarChart3, ChevronLeft, CheckCircle2, AlertCircle, Loader2, Sparkles, Bot, Plus, Trash2, ListPlus, Home, LogOut, User as UserIcon, Link as LinkIcon, Edit3, Copy, Check, Eye, Building2, Store, Users, Image as ImageIcon, Palette } from 'lucide-react';

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
  const [route, setRoute] = useState('home'); // home | login | admin | builder | stats | survey | globalStats | orgs | users
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null); 
  const [editingCampaign, setEditingCampaign] = useState(null); 
  
  // Datos Globales
  const [campaigns, setCampaigns] = useState([]);
  const [responses, setResponses] = useState([]);
  const [companies, setCompanies] = useState([]); 
  const [teamMembers, setTeamMembers] = useState([]);
  const [isCampaignsLoaded, setIsCampaignsLoaded] = useState(false);

  // --- DETECTAR ENLACE PÚBLICO (URL) ---
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
    
    const compsRef = collection(db, 'artifacts', appId, 'public', 'data', 'companies');
    const unsubComps = onSnapshot(compsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompanies(data);
    }, console.error);

    const campsRef = collection(db, 'artifacts', appId, 'public', 'data', 'campaigns');
    const unsubCamps = onSnapshot(campsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCampaigns(data.sort((a, b) => b.createdAt - a.createdAt));
      setIsCampaignsLoaded(true);
    }, (error) => {
      console.error(error);
      setIsCampaignsLoaded(true);
    });

    const respsRef = collection(db, 'artifacts', appId, 'public', 'data', 'responses');
    const unsubResps = onSnapshot(respsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setResponses(data);
    }, console.error);

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'team_members');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeamMembers(data.sort((a, b) => b.createdAt - a.createdAt));
    }, console.error);

    return () => {
      unsubComps(); unsubCamps(); unsubResps(); unsubUsers();
    };
  }, [user]);

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
      console.error(e); return null;
    }
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-200">
      {route !== 'survey' && (
        <nav className="bg-white border-b border-slate-200 p-4 shadow-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <button onClick={() => { window.history.pushState({}, '', window.location.pathname); setRoute('home'); }} className="flex items-center gap-2 font-bold text-xl text-blue-600 hover:text-blue-700 transition-colors">
              <CheckCircle2 className="w-6 h-6" /> <span>SurveyPro</span>
            </button>
            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto">
              {!user || user.isAnonymous ? (
                <button onClick={() => setRoute('login')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700 transition-colors">
                  <UserIcon className="w-4 h-4" /> Acceso Admin
                </button>
              ) : (
                <div className="flex items-center gap-2 md:gap-4">
                  <button onClick={() => setRoute('users')} className="hidden md:flex items-center gap-1 font-medium text-slate-600 hover:text-blue-600 px-2 py-1 rounded-lg"><Users className="w-4 h-4" /> Usuarios</button>
                  <button onClick={() => setRoute('orgs')} className="hidden md:flex items-center gap-1 font-medium text-slate-600 hover:text-blue-600 px-2 py-1 rounded-lg"><Building2 className="w-4 h-4" /> Empresas</button>
                  <button onClick={() => setRoute('admin')} className="font-medium text-slate-600 hover:text-blue-600 px-2 py-1">Campañas</button>
                  <button onClick={() => { signOut(auth); setRoute('home'); }} className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"><LogOut className="w-4 h-4" /> <span className="hidden md:inline">Salir</span></button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className={route === 'survey' ? '' : "max-w-6xl mx-auto p-4 md:p-8"}>
        {route === 'home' && <HomeView campaigns={campaigns} setRoute={setRoute} setSelectedCampaignId={setSelectedCampaignId} />}
        {route === 'login' && <AuthView setRoute={setRoute} />}
        {route === 'admin' && <AdminDashboard user={user} campaigns={campaigns} responses={responses} companies={companies} setRoute={setRoute} setSelectedCampaignId={setSelectedCampaignId} setEditingCampaign={setEditingCampaign} appId={appId} />}
        {route === 'orgs' && <OrgManager user={user} companies={companies} setRoute={setRoute} appId={appId} />}
        {route === 'users' && <UserManager user={user} teamMembers={teamMembers} setRoute={setRoute} appId={appId} />}
        {route === 'builder' && <CampaignBuilder user={user} companies={companies} setRoute={setRoute} appId={appId} editingCampaign={editingCampaign} />}
        {route === 'stats' && <StatsView campaignId={selectedCampaignId} campaigns={campaigns} companies={companies} responses={responses} callGeminiAPI={callGeminiAPI} setRoute={setRoute} />}
        {route === 'globalStats' && <GlobalStatsView user={user} campaigns={campaigns} companies={companies} responses={responses} callGeminiAPI={callGeminiAPI} setRoute={setRoute} />}
      </main>

      {route === 'survey' && <SurveyRunner campaignId={selectedCampaignId} branchId={selectedBranchId} campaigns={campaigns} appId={appId} setRoute={setRoute} user={user} isCampaignsLoaded={isCampaignsLoaded} />}
    </div>
  );
}

// --- VISTAS AUXILIARES ---

function HomeView({ campaigns, setRoute, setSelectedCampaignId }) {
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center animate-in fade-in">
      <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">Mide la satisfacción <br className="hidden md:block" /> con precisión.</h1>
      <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">Plataforma inteligente para crear encuestas dinámicas, gestionar sucursales y obtener insights potenciados por IA.</p>
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-2xl text-left">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-500" /> Encuestas Disponibles (Modo Demo)</h2>
        {activeCampaigns.length === 0 ? <p className="text-slate-500 italic">No hay campañas activas.</p> : (
          <div className="grid gap-4">
            {activeCampaigns.map(camp => (
              <div key={camp.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-4">
                   {camp.logoUrl && <img src={camp.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded bg-white p-1 border border-slate-100" />}
                   <div><h3 className="font-bold text-lg text-slate-800">{camp.title}</h3><p className="text-slate-500 text-sm">{camp.questions?.length || 0} preguntas</p></div>
                </div>
                <button onClick={() => { setSelectedCampaignId(camp.id); setRoute('survey'); }} className="mt-3 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors w-full sm:w-auto">Probar Encuesta</button>
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
      if (isRecovering) { await sendPasswordResetEmail(auth, email); setMessage('Se ha enviado un enlace de recuperación.'); setTimeout(() => setIsRecovering(false), 5000); }
      else if (isLogin) { await signInWithEmailAndPassword(auth, email, password); setRoute('admin'); }
      else { await createUserWithEmailAndPassword(auth, email, password); setRoute('admin'); }
    } catch (err) { setError(err.message.includes('auth/') ? 'Credenciales inválidas.' : 'Ocurrió un error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-8">
      <h2 className="text-3xl font-bold text-center mb-8">{isRecovering ? 'Recuperar Contraseña' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">{error}</div>}
      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm border border-green-200">{message}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Correo" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />
        {!isRecovering && <input type="password" placeholder="Contraseña" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500" />}
        <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isRecovering ? 'Enviar' : (isLogin ? 'Entrar' : 'Registrarse'))}
        </button>
      </form>
      <div className="text-center mt-6 flex flex-col gap-2">
        <button onClick={() => { setIsLogin(!isLogin); setIsRecovering(false); }} className="text-sm text-blue-600 hover:underline">{isLogin ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Inicia sesión'}</button>
        {isLogin && !isRecovering && <button onClick={() => setIsRecovering(true)} className="text-xs text-slate-500 hover:text-blue-500">¿Olvidaste tu contraseña?</button>}
      </div>
    </div>
  );
}

function UserManager({ user, teamMembers, setRoute, appId }) {
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('Analista');
  const [isSaving, setIsSaving] = useState(false);
  const myTeam = teamMembers.filter(m => m.ownerId === user.uid);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'team_members'), {
        ownerId: user.uid, name: newUserName.trim(), email: newUserEmail.trim(), role: newUserRole, createdAt: Date.now()
      });
      setNewUserName(''); setNewUserEmail('');
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('¿Eliminar usuario?')) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'team_members', id)); } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-3xl font-bold text-slate-800">Gestor de Usuarios</h1>
      </div>
      <form onSubmit={handleAddUser} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input placeholder="Nombre" value={newUserName} onChange={e => setNewUserName(e.target.value)} required className="px-4 py-2 rounded-lg border border-slate-300" />
        <input type="email" placeholder="Correo" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required className="px-4 py-2 rounded-lg border border-slate-300" />
        <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="px-4 py-2 rounded-lg border border-slate-300">
          <option value="Administrador">Administrador</option>
          <option value="Gerente">Gerente</option>
          <option value="Analista">Analista</option>
        </select>
        <button type="submit" disabled={isSaving} className="bg-slate-900 text-white rounded-lg font-bold">Agregar</button>
      </form>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {myTeam.map(member => (
          <div key={member.id} className="p-4 flex items-center justify-between border-b border-slate-100 last:border-0">
            <div><p className="font-bold">{member.name}</p><p className="text-sm text-slate-500">{member.email} • {member.role}</p></div>
            <button onClick={() => handleDeleteUser(member.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2"><Trash2 className="w-5 h-5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgManager({ user, companies, setRoute, appId }) {
  const [newCompName, setNewCompName] = useState('');
  const [newBranchNames, setNewBranchNames] = useState({});
  const [isSavingComp, setIsSavingComp] = useState(false);
  const myCompanies = companies.filter(c => c.ownerId === user.uid);

  const handleCreateCompany = async (e) => {
    e.preventDefault(); if (!newCompName.trim()) return;
    setIsSavingComp(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companies'), {
        ownerId: user.uid, name: newCompName.trim(), branches: [], createdAt: Date.now()
      });
      setNewCompName('');
    } catch (err) { console.error(err); } finally { setIsSavingComp(false); }
  };

  const handleCreateBranch = async (compId) => {
    const branchName = newBranchNames[compId]; if (!branchName?.trim()) return;
    try {
      const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', compId);
      await updateDoc(compRef, { branches: arrayUnion({ id: `b_${Date.now()}`, name: branchName.trim() }) });
      setNewBranchNames({ ...newBranchNames, [compId]: '' });
    } catch (err) { console.error(err); }
  };

  const handleDeleteBranch = async (compId, branchObj) => {
    if (!window.confirm('¿Eliminar sucursal?')) return;
    try {
      const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', compId);
      await updateDoc(compRef, { branches: arrayRemove(branchObj) });
    } catch (err) { console.error(err); }
  };

  const handleDeleteCompany = async (id) => {
    if (!window.confirm('¿Eliminar empresa?')) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companies', id)); } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-3xl font-bold">Empresas y Sucursales</h1>
      </div>
      <form onSubmit={handleCreateCompany} className="bg-white p-6 rounded-2xl border border-slate-200 flex gap-4 mb-8">
        <input placeholder="Nombre de Empresa" value={newCompName} onChange={e => setNewCompName(e.target.value)} required className="flex-1 px-4 py-2 border rounded-lg" />
        <button type="submit" disabled={isSavingComp} className="bg-slate-900 text-white px-6 rounded-lg font-bold">Crear</button>
      </form>
      <div className="space-y-6">
        {myCompanies.map(comp => (
          <div key={comp.id} className="bg-white p-6 rounded-3xl border border-slate-200 relative group">
            <button onClick={() => handleDeleteCompany(comp.id)} className="absolute top-6 right-6 text-slate-300 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
            <h3 className="text-2xl font-bold mb-4">{comp.name}</h3>
            <div className="ml-4 md:ml-8 border-l-2 border-slate-100 pl-6">
              <p className="text-xs font-bold text-slate-400 uppercase mb-4">Sucursales</p>
              <div className="space-y-2 mb-4">
                {comp.branches?.map(b => (
                  <div key={b.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-medium text-slate-700">{b.name}</span>
                    <button onClick={() => handleDeleteBranch(comp.id, b)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input placeholder="Nueva sucursal..." value={newBranchNames[comp.id] || ''} onChange={e => setNewBranchNames({ ...newBranchNames, [comp.id]: e.target.value })} className="flex-1 px-4 py-2 text-sm border rounded-lg" />
                <button onClick={() => handleCreateBranch(comp.id)} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard({ user, campaigns, responses, companies, setRoute, setSelectedCampaignId, setEditingCampaign, appId }) {
  const [copiedId, setCopiedId] = useState(null);
  if (!user || user.isAnonymous) return <AuthView setRoute={setRoute} />;
  const myCampaigns = campaigns.filter(c => c.ownerId === user.uid);

  const handleCopyLink = (campaignId, branchId = null) => {
    let url = `${window.location.origin}${window.location.pathname}?survey=${campaignId}`;
    if (branchId) url += `&branch=${branchId}`;
    const textArea = document.createElement("textarea");
    textArea.value = url; document.body.appendChild(textArea); textArea.select();
    try { document.execCommand('copy'); setCopiedId(`${campaignId}-${branchId || 'main'}`); setTimeout(() => setCopiedId(null), 2000); } catch (err) { console.error(err); }
    document.body.removeChild(textArea);
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm('¿Eliminar campaña permanentemente?')) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'campaigns', id)); } catch (err) { console.error(err); }
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div><h1 className="text-3xl font-bold text-slate-800">Mis Campañas</h1><p className="text-slate-500">Analiza y gestiona tus encuestas</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRoute('users')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">Equipo</button>
          <button onClick={() => setRoute('orgs')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">Empresas</button>
          <button onClick={() => setRoute('globalStats')} className="px-4 py-2 bg-white border rounded-xl font-bold text-sm">Global</button>
          <button onClick={() => { setEditingCampaign(null); setRoute('builder'); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-blue-700 transition-colors">+ Nueva</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myCampaigns.map(camp => {
          const campResponses = responses.filter(r => r.campaignId === camp.id);
          const parentComp = companies.find(c => c.id === camp.companyId);
          return (
            <div key={camp.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative group flex flex-col h-full hover:shadow-md transition-all">
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => { setEditingCampaign(camp); setRoute('builder'); }} className="p-2 bg-white shadow text-slate-400 hover:text-blue-600 rounded-lg border border-slate-100" title="Editar"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteCampaign(camp.id)} className="p-2 bg-white shadow text-slate-400 hover:text-red-600 rounded-lg border border-slate-100" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                {camp.logoUrl ? (
                   <img src={camp.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded bg-slate-50 p-1" />
                ) : (
                   <div className="w-10 h-10 rounded bg-slate-50 flex items-center justify-center border border-slate-100" style={{backgroundColor: camp.bgColor || '#f8fafc'}}><ImageIcon className="w-5 h-5 text-slate-300" /></div>
                )}
                <div><h3 className="font-bold text-lg line-clamp-1">{camp.title}</h3><p className="text-xs font-bold text-blue-500 uppercase">{parentComp?.name || 'Independiente'}</p></div>
              </div>
              <div className="flex gap-4 text-xs text-slate-500 mb-6"><span>{campResponses.length} respuestas</span><span>{camp.questions?.length} preguntas</span></div>
              <div className="space-y-1 mb-6 max-h-32 overflow-y-auto pr-2">
                {camp.branchIds?.map(bId => {
                  const b = parentComp?.branches?.find(branch => branch.id === bId);
                  return (
                    <div key={bId} className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded">
                      <span className="truncate flex-1 pr-2">{b?.name || 'Sucursal'}</span>
                      <button onClick={() => handleCopyLink(camp.id, bId)} className="text-blue-500 font-bold hover:underline">{copiedId === `${camp.id}-${bId}` ? 'Copiado!' : 'URL'}</button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto flex gap-2">
                <button onClick={() => { setSelectedCampaignId(camp.id); setRoute('stats'); }} className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">Estadísticas</button>
                <button onClick={() => { setSelectedCampaignId(camp.id); setRoute('survey'); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"><Eye className="w-5 h-5 text-slate-600" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CampaignBuilder({ user, companies, setRoute, appId, editingCampaign }) {
  const [title, setTitle] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bgColor, setBgColor] = useState('#f8fafc'); // Nuevo campo: Color de fondo
  const [companyId, setCompanyId] = useState('');
  const [branchIds, setBranchIds] = useState([]);
  const [questions, setQuestions] = useState([{ id: 'q_1', type: 'rating', title: '¿Cómo calificarías nuestro servicio hoy?' }]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingCampaign) {
      setTitle(editingCampaign.title || '');
      setLogoUrl(editingCampaign.logoUrl || '');
      setBgColor(editingCampaign.bgColor || '#f8fafc');
      setCompanyId(editingCampaign.companyId || '');
      setBranchIds(editingCampaign.branchIds || []);
      setQuestions(editingCampaign.questions || []);
    }
  }, [editingCampaign]);

  const addQuestion = (type) => {
    const newQ = { id: `q_${Date.now()}`, type, title: 'Nueva pregunta...' };
    if (type === 'choice') newQ.options = ['Opción 1', 'Opción 2'];
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (idx, field, value) => {
    const n = [...questions]; n[idx][field] = value; setQuestions(n);
  };

  const updateCondition = (idx, field, value) => {
    const n = [...questions];
    if (!n[idx].condition) n[idx].condition = { dependsOnId: questions[idx-1]?.id || questions[0].id, operator: '==', value: '' };
    n[idx].condition[field] = value;
    setQuestions(n);
  };

  const handleSave = async () => {
    if (!title.trim() || !companyId || branchIds.length === 0) return alert('Por favor, completa el título, empresa y sucursales.');
    setIsSaving(true);
    try {
      const data = { ownerId: user.uid, title, logoUrl, bgColor, companyId, branchIds, questions, status: 'active', updatedAt: Date.now() };
      if (editingCampaign) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'campaigns', editingCampaign.id), data);
      } else {
        data.createdAt = Date.now();
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'campaigns'), data);
      }
      setRoute('admin');
    } catch (err) { console.error(err); alert("Error al guardar."); } finally { setIsSaving(false); }
  };

  const myCompanies = companies.filter(c => c.ownerId === user.uid);
  const selectedComp = myCompanies.find(c => c.id === companyId);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-3xl font-bold">{editingCampaign ? 'Modificar Campaña' : 'Nueva Campaña'}</h1>
      </div>
      
      <div className="bg-white p-8 rounded-3xl border border-slate-200 mb-8 space-y-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Detalles de Identidad */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nombre de la Campaña</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Satisfacción Sucursal Norte" className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">URL del Logotipo</label>
              <div className="flex gap-2">
                <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." className="flex-1 px-4 py-3 rounded-xl border outline-none" />
                {logoUrl && <img src={logoUrl} alt="Preview" className="w-12 h-12 object-contain bg-slate-50 border rounded p-1" />}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-500" /> Color de Fondo de la Encuesta
              </label>
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                 <input 
                   type="color" 
                   value={bgColor} 
                   onChange={e => setBgColor(e.target.value)} 
                   className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent"
                 />
                 <input 
                   type="text" 
                   value={bgColor} 
                   onChange={e => setBgColor(e.target.value)} 
                   placeholder="#ffffff"
                   className="flex-1 bg-white px-3 py-1.5 rounded-lg border text-sm font-mono"
                 />
                 <div className="w-8 h-8 rounded shadow-inner" style={{backgroundColor: bgColor}}></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Este color se verá en el fondo de pantalla del cliente.</p>
            </div>
          </div>

          {/* Detalles de Organización */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Empresa Responsable</label>
              <select value={companyId} onChange={e => { setCompanyId(e.target.value); setBranchIds([]); }} className="w-full px-4 py-3 rounded-xl border bg-white outline-none">
                <option value="">Seleccionar Empresa...</option>
                {myCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedComp && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Activar en Sucursales</p>
                {selectedComp.branches?.map(b => (
                  <label key={b.id} className="flex items-center gap-2 cursor-pointer text-sm mb-1 hover:bg-slate-100 p-1 rounded transition-colors font-medium text-slate-700">
                    <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => setBranchIds(prev => prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id])} className="rounded text-blue-600" /> 
                    {b.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preguntas */}
      <div className="space-y-4 mb-12">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative transition-all hover:border-blue-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-blue-50 text-blue-600 rounded">{q.type === 'rating' ? 'Caritas' : q.type === 'choice' ? 'Opciones' : 'Texto'}</span>
              <button onClick={() => setQuestions(questions.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
            <input value={q.title} onChange={e => updateQuestion(idx, 'title', e.target.value)} className="w-full font-bold text-lg outline-none border-b border-dashed border-slate-200 pb-2 mb-4 focus:border-blue-400" placeholder="Escribe la pregunta..." />
            
            {q.type === 'choice' && (
              <div className="space-y-2 ml-4">
                {q.options?.map((opt, oIdx) => (
                  <div key={oIdx} className="flex gap-2 items-center">
                    <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                    <input value={opt} onChange={e => { const n = [...questions]; n[idx].options[oIdx] = e.target.value; setQuestions(n); }} className="flex-1 text-sm text-slate-600 outline-none border-b border-transparent focus:border-slate-100" />
                    <button onClick={() => { const n = [...questions]; n[idx].options.splice(oIdx, 1); setQuestions(n); }} className="text-slate-300 hover:text-red-400 text-xs">x</button>
                  </div>
                ))}
                <button onClick={() => { const n = [...questions]; n[idx].options = [...(n[idx].options||[]), 'Nueva Opción']; setQuestions(n); }} className="text-[10px] text-blue-600 font-bold hover:underline">+ Agregar Opción</button>
              </div>
            )}

            {idx > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-50 bg-slate-50/50 p-3 rounded-xl">
                 <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer mb-3">
                   <input type="checkbox" checked={!!q.condition} onChange={e => { if(e.target.checked) updateCondition(idx, 'dependsOnId', questions[idx-1].id); else { const n=[...questions]; delete n[idx].condition; setQuestions(n); }}} className="rounded" /> Condicional
                 </label>
                 {q.condition && (
                   <div className="flex flex-wrap gap-2 animate-in fade-in">
                      <select value={q.condition.dependsOnId} onChange={e => updateCondition(idx, 'dependsOnId', e.target.value)} className="text-[10px] p-2 border rounded-lg bg-white outline-none">
                         {questions.slice(0, idx).map(pq => <option key={pq.id} value={pq.id}>Si en: {pq.title.substring(0,20)}...</option>)}
                      </select>
                      <select value={q.condition.operator} onChange={e => updateCondition(idx, 'operator', e.target.value)} className="text-[10px] p-2 border rounded-lg bg-white outline-none">
                         <option value="==">es igual a</option><option value="<=">es menor o igual a</option><option value=">=">es mayor o igual a</option>
                      </select>
                      <input value={q.condition.value} onChange={e => updateCondition(idx, 'value', e.target.value)} placeholder="Valor..." className="text-[10px] p-2 border rounded-lg bg-white outline-none w-20" />
                   </div>
                 )}
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2 justify-center py-4">
          <button onClick={() => addQuestion('rating')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50">🙂 Caritas</button>
          <button onClick={() => addQuestion('choice')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50">🔘 Opciones</button>
          <button onClick={() => addQuestion('text')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50">📝 Texto</button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t flex justify-center z-50">
        <button onClick={handleSave} disabled={isSaving} className="max-w-md w-full py-4 bg-green-600 text-white rounded-2xl font-bold shadow-lg hover:bg-green-700 transition-all flex justify-center items-center gap-2">
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} {editingCampaign ? 'Guardar Cambios' : 'Publicar Campaña'}
        </button>
      </div>
    </div>
  );
}

function SurveyRunner({ campaignId, branchId, campaigns, appId, setRoute, user, isCampaignsLoaded }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  if (!isCampaignsLoaded) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return <div className="text-center p-20 flex flex-col items-center"><AlertCircle className="w-12 h-12 text-red-500 mb-4" /><h1 className="text-2xl font-bold">Encuesta no encontrada</h1><button onClick={() => setRoute('home')} className="mt-4 text-blue-600 font-bold">Ir al inicio</button></div>;
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
      setTimeout(() => { const nextIdx = getNextIndex(currentStep, newAnswers); if (nextIdx !== -1) setCurrentStep(nextIdx); else handleSubmit(newAnswers); }, 400);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'responses'), { campaignId, branchId: branchId || 'unknown', answers: finalAnswers, timestamp: Date.now() });
      setIsFinished(true);
      setTimeout(() => { setAnswers({}); setCurrentStep(0); setIsFinished(false); }, 4000);
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  if (isFinished) return (
    <div className="flex flex-col items-center justify-center h-screen p-6 text-center animate-in zoom-in" style={{backgroundColor: campaign.bgColor || '#ffffff'}}>
      <div className="bg-white/90 backdrop-blur-sm p-10 rounded-[3rem] shadow-2xl max-w-xl w-full border border-white/50 flex flex-col items-center">
        {campaign.logoUrl && <img src={campaign.logoUrl} alt="Logo" className="w-24 h-24 object-contain mb-8 animate-in fade-in" />}
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h2 className="text-4xl font-black mb-4 text-slate-800 tracking-tight">¡Muchas Gracias!</h2>
        <p className="text-slate-600 text-lg font-medium">Tus comentarios nos ayudan a mejorar cada día.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative transition-colors duration-700" style={{backgroundColor: campaign.bgColor || '#f8fafc'}}>
      {/* Barra de progreso sutil */}
      <div className="fixed top-0 left-0 right-0 h-1.5 bg-black/10 z-50">
        <div className="h-full bg-blue-600 transition-all duration-700 rounded-r-full" style={{ width: `${(currentStep / campaign.questions.length) * 100}%` }}></div>
      </div>
      
      {/* Logo superior */}
      <div className="absolute top-10 left-0 right-0 flex justify-center h-20 pointer-events-none px-6">
        {campaign.logoUrl ? (
          <img src={campaign.logoUrl} alt="Logo Empresa" className="max-h-full max-w-[220px] object-contain drop-shadow-sm animate-in fade-in slide-in-from-top-4" />
        ) : (
          <div className="h-10 w-1 bg-black/10 rounded-full"></div>
        )}
      </div>

      <div className="w-full max-w-4xl text-center animate-in fade-in slide-in-from-bottom-8 duration-500" key={currentStep}>
        
        {/* Contenedor de la Pregunta */}
        <div className="bg-white/80 backdrop-blur-md p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-white/40 mb-12">
           <h1 className="text-3xl md:text-5xl font-black text-slate-800 leading-tight">
             {currentQ?.title}
           </h1>
        </div>

        {/* Tipos de Respuesta */}
        <div className="w-full px-4">
          {currentQ?.type === 'rating' && (
            <div className="flex flex-wrap justify-center gap-4 md:gap-8">
              {RATING_OPTIONS.map(opt => (
                <button 
                  key={opt.value} 
                  onClick={() => handleAnswer(opt.value)} 
                  disabled={isSubmitting} 
                  className="flex flex-col items-center p-5 md:p-10 bg-white/95 rounded-[2.5rem] border-4 border-transparent hover:border-blue-500 hover:scale-110 active:scale-95 transition-all shadow-xl group"
                >
                  <span className="text-7xl md:text-9xl mb-4 select-none group-hover:drop-shadow-lg">{opt.emoji}</span>
                  <span className="font-black text-slate-500 group-hover:text-blue-600 uppercase text-[10px] md:text-xs tracking-[0.2em]">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentQ?.type === 'choice' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {currentQ.options?.map((opt, i) => (
                <button 
                  key={i} 
                  onClick={() => handleAnswer(opt)} 
                  className="py-8 px-10 bg-white/95 border-2 border-white rounded-[2rem] text-xl md:text-2xl font-black text-slate-700 hover:bg-blue-600 hover:text-white hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQ?.type === 'text' && (
            <div className="max-w-2xl mx-auto flex flex-col items-center">
              <textarea 
                autoFocus 
                rows={4} 
                value={answers[currentQ.id] || ''} 
                onChange={e => setAnswers({ ...answers, [currentQ.id]: e.target.value })} 
                placeholder="Escribe tu opinión aquí..." 
                className="w-full p-8 text-2xl md:text-3xl rounded-[2rem] border-0 bg-white/95 outline-none focus:ring-4 focus:ring-blue-500/20 shadow-2xl placeholder:text-slate-300 font-medium" 
              />
              <button 
                onClick={() => { const n = getNextIndex(currentStep, answers); if (n !== -1) setCurrentStep(n); else handleSubmit(answers); }} 
                className="mt-10 bg-slate-900 text-white px-12 py-6 rounded-3xl font-black text-2xl shadow-2xl hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Botón Salir flotante (Solo Admin) */}
      {!window.location.search && (
        <button 
          onClick={() => { window.history.pushState({}, '', window.location.pathname); setRoute('admin'); }} 
          className="fixed bottom-10 right-10 p-4 bg-white/30 hover:bg-white/80 rounded-full transition-all text-slate-400 hover:text-slate-800 z-50 backdrop-blur-sm shadow-sm"
        >
           <LogOut className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

function StatsView({ campaignId, campaigns, companies, responses, callGeminiAPI, setRoute }) {
  const campaign = campaigns.find(c => c.id === campaignId);
  const campResponses = responses.filter(r => r.campaignId === campaignId);
  const [aiInsight, setAiInsight] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  if (!campaign) return null;
  const parentComp = companies.find(c => c.id === campaign.companyId);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const summary = campResponses.map(r => r.answers);
    const prompt = `Analiza los siguientes datos de la encuesta "${campaign.title}". Preguntas: ${JSON.stringify(campaign.questions.map(q => q.title))}. Respuestas: ${JSON.stringify(summary)}. Resume lo mejor y lo peor y da 3 consejos específicos. En español.`;
    const res = await callGeminiAPI(prompt);
    if (res) setAiInsight(res);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-20">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200"><ChevronLeft className="w-5 h-5" /></button>
          <div><h1 className="text-2xl md:text-3xl font-bold">{campaign.title}</h1><p className="text-slate-500 text-sm">Resumen de {campResponses.length} respuestas</p></div>
        </div>
        <button onClick={handleGenerateAI} disabled={isGenerating || campResponses.length === 0} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2">
           {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />} Analizar con IA
        </button>
      </div>
      {aiInsight && <div className="mb-8 p-6 bg-indigo-50 border border-indigo-100 rounded-3xl text-indigo-900 prose prose-indigo max-w-none shadow-sm animate-in slide-in-from-top-4">{aiInsight}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {campaign.questions.map((q, idx) => {
          let counts = {};
          if (q.type === 'rating' || q.type === 'choice') campResponses.forEach(r => { const v = r.answers[q.id]; if (v) counts[v] = (counts[v] || 0) + 1; });
          return (
            <div key={q.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-4">{idx + 1}. {q.title}</h3>
              {q.type === 'rating' ? (
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map(r => {
                    const c = counts[r] || 0; const pct = campResponses.length ? (c / campResponses.length) * 100 : 0;
                    return (
                      <div key={r} className="flex items-center gap-2">
                        <span className="w-4 text-xs font-bold text-slate-400">{r}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${r >= 4 ? 'bg-green-500' : r === 3 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }}></div></div>
                        <span className="text-[10px] font-bold w-12 text-right text-slate-500">{c} ({pct.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </div>
              ) : q.type === 'choice' ? (
                <div className="space-y-1">{q.options?.map(opt => (<div key={opt} className="flex justify-between text-xs py-2 border-b border-slate-50 text-slate-600"><span className="flex-1 pr-2">{opt}</span><span className="font-bold">{counts[opt] || 0}</span></div>))}</div>
              ) : (<div className="max-h-48 overflow-y-auto space-y-2 pr-2">{campResponses.filter(r => r.answers[q.id]).map((r, i) => (<div key={i} className="text-[10px] p-2 bg-slate-50 rounded-xl italic text-slate-600 border border-slate-100">"{r.answers[q.id]}"</div>))}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlobalStatsView({ user, campaigns, companies, responses, callGeminiAPI, setRoute }) {
  const myCampaigns = campaigns.filter(c => c.ownerId === user.uid);
  const myResponses = responses.filter(r => myCampaigns.some(c => c.id === r.campaignId));
  let totalRatingSum = 0; let totalRatingCount = 0;
  myResponses.forEach(res => {
    const camp = myCampaigns.find(c => c.id === res.campaignId);
    camp?.questions?.forEach(q => { if (q.type === 'rating' && res.answers[q.id]) { totalRatingSum += res.answers[q.id]; totalRatingCount++; } });
  });
  const avg = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(1) : 0;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in pb-10">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setRoute('admin')} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-3xl font-bold">Estadísticas Globales</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Campañas</p><p className="text-5xl font-black text-slate-800">{myCampaigns.length}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Respuestas Totales</p><p className="text-5xl font-black text-slate-800">{myResponses.length}</p>
        </div>
        <div className="bg-blue-600 p-8 rounded-3xl shadow-lg text-center text-white">
          <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-2">Promedio General</p><p className="text-5xl font-black">{avg} <span className="text-xl">/ 5</span></p>
        </div>
      </div>
    </div>
  );
}
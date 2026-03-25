import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  ArrowLeft, 
  Share2, 
  ShieldAlert,
  CheckSquare,
  Users,
  Building2,
  Home,
  AlertCircle,
  Fingerprint,
  PieChart,
  X
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';

// --- Configuración de Firebase Dinámica ---
let firebaseConfig = {};

try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    firebaseConfig = {
      apiKey: env.VITE_FIREBASE_API_KEY || "",
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
      projectId: env.VITE_FIREBASE_PROJECT_ID || "",
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: env.VITE_FIREBASE_APP_ID || ""
    };
  }
} catch (e) {
  console.warn("Aviso: Configuración de Firebase no detectada.");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mi-app-encuestas-v1'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [settings, setSettings] = useState({ isFinished: false });
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState(false);
  const [role, setRole] = useState('admin');
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [showChartModal, setShowChartModal] = useState(null); // ID de la pregunta para ver gráfica
  
  // Estado para el registro del usuario
  const [userData, setUserData] = useState({ tower: '', apartment: '', idNumber: '' });
  const [isRegistered, setIsRegistered] = useState(false);
  const [regError, setRegError] = useState('');

  // 1. Manejo de Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error Auth:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      const params = new URLSearchParams(window.location.search);
      if (params.get('role') === 'respondent') setRole('respondent');
    });
    return () => unsubscribe();
  }, []);

  // 2. Suscripción a datos
  useEffect(() => {
    if (!user) return;

    const checkUserProfile = async () => {
      const userRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
        setIsRegistered(true);
      }
    };
    checkUserProfile();

    const qRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
    const aRef = collection(db, 'artifacts', appId, 'public', 'data', 'answers');
    const attRef = collection(db, 'artifacts', appId, 'public', 'data', 'attendees');
    const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');

    const unsubQ = onSnapshot(qRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuestions(data.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    }, (error) => console.error("Error suscripción preguntas:", error));

    const unsubA = onSnapshot(aRef, (snap) => {
      setAnswers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("Error suscripción respuestas:", error));

    const unsubAtt = onSnapshot(attRef, (snap) => {
      setAttendees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("Error suscripción asistentes:", error));

    const unsubS = onSnapshot(sRef, (snap) => {
      if (snap.exists()) setSettings(snap.data());
    }, (error) => console.error("Error suscripción settings:", error));

    setLoading(false);
    return () => { unsubQ(); unsubA(); unsubAtt(); unsubS(); };
  }, [user]);

  // --- Lógica ---

  const handleRegister = async () => {
    if (!user || !userData.tower || !userData.apartment || !userData.idNumber) return;
    setRegError('');

    const tower = userData.tower.trim();
    const apartment = userData.apartment.trim();
    const idNumber = userData.idNumber.trim();
    const attendeeId = `${tower}-${apartment}`.toLowerCase();

    try {
      const attRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendees', attendeeId);
      const attSnap = await getDoc(attRef);

      if (attSnap.exists() && attSnap.data().userId !== user.uid) {
        setRegError(`La Torre ${tower} Apto ${apartment} ya ha sido registrada por otro asistente.`);
        return;
      }

      await setDoc(attRef, {
        tower,
        apartment,
        idNumber,
        userId: user.uid,
        registeredAt: Date.now()
      });

      const userProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await setDoc(userProfileRef, { tower, apartment, idNumber });

      setIsRegistered(true);
    } catch (err) {
      console.error("Error en registro:", err);
      setRegError(err.code === 'permission-denied' ? "Error de permisos en Firebase." : "Error al registrar.");
    }
  };

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('role', 'respondent');
    const textArea = document.createElement("textarea");
    textArea.value = url.toString();
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 3000);
    } catch (err) { console.error(err); }
    document.body.removeChild(textArea);
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'questions'), {
      text: newQuestionText.trim(),
      isOpen: false,
      createdAt: Date.now()
    });
    setNewQuestionText('');
  };

  const toggleSurveyFinished = async (isFinished) => {
    if (!user) return;
    try {
      const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
      await setDoc(sRef, { isFinished }, { merge: true });
    } catch (err) {
      console.error("Error al actualizar:", err);
    }
  };

  const handleVote = async (questionId, value) => {
    if (!user || !isRegistered) return;
    const answerId = `${questionId}_${user.uid}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'answers', answerId), {
      questionId,
      userId: user.uid,
      value,
      tower: userData.tower,
      apartment: userData.apartment,
      idNumber: userData.idNumber,
      timestamp: Date.now()
    });
  };

  const getStats = (id) => {
    const qA = answers.filter(a => a.questionId === id);
    const total = qA.length;
    const agree = qA.filter(a => a.value === 'agree').length;
    const disagree = total - agree;
    const pAgree = total === 0 ? 0 : Math.round((agree / total) * 100);
    return { total, agree, disagree, pAgree, pDisagree: total === 0 ? 0 : 100 - pAgree };
  };

  // --- Componentes UI ---

  const ProgressBar = ({ stats }) => (
    <div className="mt-4 w-full">
      <div className="flex justify-between text-[10px] font-bold mb-1 uppercase text-gray-400">
        <span>Sí: {stats.pAgree}%</span>
        <span>No: {stats.pDisagree}%</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${stats.pAgree}%` }} />
        <div className="bg-rose-500 h-full transition-all duration-700" style={{ width: `${stats.pDisagree}%` }} />
      </div>
    </div>
  );

  const ChartModal = ({ questionId, onClose }) => {
    const question = questions.find(q => q.id === questionId);
    const stats = getStats(questionId);
    if (!question) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 p-3 rounded-2xl">
                <PieChart className="w-6 h-6 text-blue-600" />
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2 leading-tight">{question.text}</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium">Resultados consolidados ({stats.total} votos totales)</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 text-center">
                <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-1">A Favor</p>
                <p className="text-4xl font-black text-emerald-700">{stats.agree}</p>
                <p className="text-emerald-500 text-xs font-bold mt-1">{stats.pAgree}%</p>
              </div>
              <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 text-center">
                <p className="text-rose-600 text-[10px] font-black uppercase tracking-widest mb-1">En Contra</p>
                <p className="text-4xl font-black text-rose-700">{stats.disagree}</p>
                <p className="text-rose-500 text-xs font-bold mt-1">{stats.pDisagree}%</p>
              </div>
            </div>

            <ProgressBar stats={stats} />
            
            <button onClick={onClose} className="w-full mt-8 py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-black transition-all">Cerrar Visor</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-sans text-gray-400">Cargando aplicación...</div>;

  if (settings.isFinished) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full bg-white shadow-xl rounded-[2.5rem] overflow-hidden border border-gray-100">
          <div className="bg-blue-600 p-10 text-center text-white">
            <BarChart3 className="w-14 h-14 mx-auto mb-4" />
            <h1 className="text-3xl font-black tracking-tight">RESULTADOS FINALES</h1>
            <p className="opacity-80 font-medium text-sm mt-1 uppercase tracking-widest">Asamblea General Propietarios</p>
          </div>
          <div className="p-8 space-y-6">
            {questions.map((q, i) => (
              <div key={q.id} className="p-6 bg-slate-50 rounded-[1.8rem] border border-slate-100 shadow-sm">
                <div className="flex gap-4 mb-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black text-sm">{i + 1}</span>
                  <p className="font-bold text-slate-800 text-lg leading-snug">{q.text}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Sí</span>
                    <span className="text-xl font-black text-emerald-600">{getStats(q.id).agree}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">No</span>
                    <span className="text-xl font-black text-rose-600">{getStats(q.id).disagree}</span>
                  </div>
                </div>
                <ProgressBar stats={getStats(q.id)} />
              </div>
            ))}
          </div>
          {role === 'admin' && (
            <div className="p-6 text-center border-t border-slate-50">
              <button onClick={() => toggleSurveyFinished(false)} className="text-blue-600 font-bold hover:underline">Reabrir encuesta para nuevos votos</button>
            </div>
          )}
        </div>
        <footer className="mt-8 text-slate-400 text-xs font-bold tracking-widest uppercase">
          © {new Date().getFullYear()} CleandjSoft
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10 flex flex-col">
      <div className="bg-slate-800 text-white p-2 flex justify-center space-x-4 text-[10px] font-bold uppercase tracking-widest">
        <button onClick={() => setRole('admin')} className={role === 'admin' ? 'text-blue-400' : 'opacity-50'}>Admin</button>
        <button onClick={() => setRole('respondent')} className={role === 'respondent' ? 'text-blue-400' : 'opacity-50'}>Usuario</button>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8 flex-1 w-full">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">ENCUESTAS<span className="text-blue-600">LIVE</span></h1>
          {role === 'admin' && (
            <button onClick={handleCopyLink} className={`flex items-center px-5 py-2.5 rounded-full font-bold transition-all shadow-sm ${copyStatus ? 'bg-emerald-500 text-white' : 'bg-white border text-slate-700 hover:bg-slate-100'}`}>
              <Share2 className="w-4 h-4 mr-2" /> {copyStatus ? '¡Copiado!' : 'Copiar enlace usuario'}
            </button>
          )}
        </header>

        {role === 'admin' ? (
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Nueva Pregunta</h2>
              <form onSubmit={handleAddQuestion} className="flex gap-2">
                <input 
                  type="text" 
                  value={newQuestionText} 
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                  placeholder="Escribe aquí tu pregunta..."
                />
                <button type="submit" disabled={!newQuestionText.trim()} className="bg-blue-600 text-white px-8 rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-30 transition-colors shadow-lg shadow-blue-200">Añadir</button>
              </form>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Gestión de Preguntas</h2>
              {questions.map((q, i) => (
                <div key={q.id} className={`bg-white p-6 rounded-[2rem] border transition-all ${q.isOpen ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase tracking-widest">Pregunta #{i+1}</span>
                         {getStats(q.id).total > 0 && (
                           <span className="text-[10px] font-black bg-emerald-100 px-2 py-0.5 rounded text-emerald-600 uppercase tracking-widest">{getStats(q.id).total} Votos</span>
                         )}
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg mb-1 leading-snug">{q.text}</h3>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        title="Ver Gráficas"
                        onClick={() => setShowChartModal(q.id)}
                        className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <PieChart className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', q.id), { isOpen: !q.isOpen })}
                        className={`p-3 rounded-xl transition-colors ${q.isOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {q.isOpen ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', q.id))} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  {q.isOpen && <ProgressBar stats={getStats(q.id)} />}
                </div>
              ))}
              {questions.length > 0 && (
                <button onClick={() => toggleSurveyFinished(true)} className="w-full py-5 bg-slate-800 text-white rounded-[1.8rem] font-bold hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3">
                  <BarChart3 className="w-5 h-5" /> Finalizar y Publicar Resultados
                </button>
              )}
            </section>

            <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-100 p-2 rounded-xl"><Users className="w-5 h-5 text-blue-600" /></div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Control de Asistentes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400 border-b border-slate-100">
                      <th className="py-4 px-4 font-black">Torre</th>
                      <th className="py-4 px-4 font-black">Apartamento</th>
                      <th className="py-4 px-4 font-black">Identificación</th>
                      <th className="py-4 px-4 font-black">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendees.length > 0 ? attendees.map((attendee, index) => (
                      <tr key={index} className="text-slate-700 hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 font-black text-slate-800">{attendee.tower}</td>
                        <td className="py-4 px-4 font-medium">{attendee.apartment}</td>
                        <td className="py-4 px-4 text-xs font-mono text-slate-400">{attendee.idNumber}</td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">Presente</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="py-12 text-center text-slate-300 italic font-medium">No hay participantes registrados aún.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-6">
            {!isRegistered ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 max-w-md mx-auto w-full animate-in slide-in-from-bottom duration-500">
                <div className="text-center mb-8">
                  <div className="bg-blue-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                    <Building2 className="text-blue-600 w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">Identificación</h2>
                  <p className="text-slate-400 text-sm mt-2 font-medium">Por favor registre sus datos para votar.</p>
                </div>
                
                {regError && (
                  <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {regError}
                  </div>
                )}

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Torre</label>
                      <input 
                        type="text" 
                        value={userData.tower}
                        onChange={(e) => setUserData({...userData, tower: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        placeholder="Ej: 1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Apto</label>
                      <input 
                        type="text" 
                        value={userData.apartment}
                        onChange={(e) => setUserData({...userData, apartment: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        placeholder="Ej: 101"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Cédula / ID</label>
                    <div className="relative">
                      <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      <input 
                        type="text" 
                        value={userData.idNumber}
                        onChange={(e) => setUserData({...userData, idNumber: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-4 pl-12 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        placeholder="Documento oficial"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleRegister}
                    disabled={!userData.tower || !userData.apartment || !userData.idNumber}
                    className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black hover:bg-blue-700 disabled:opacity-30 transition-all mt-4 shadow-lg shadow-blue-100 uppercase tracking-widest text-xs"
                  >
                    Validar Acceso
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="col-span-full flex flex-col sm:flex-row items-center justify-between bg-white px-8 py-5 rounded-[2rem] border border-slate-100 shadow-sm mb-4 gap-4">
                  <div className="flex items-center gap-4 w-full">
                    <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600"><Home className="w-6 h-6" /></div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-300 uppercase leading-none tracking-widest mb-1">Identificado como</p>
                      <div className="flex items-center gap-3">
                        <p className="font-black text-slate-700 text-lg">TORRE {userData.tower} • APT {userData.apartment}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-blue-500 uppercase italic border-2 border-blue-50 px-4 py-2 rounded-xl bg-blue-50/30 whitespace-nowrap">Sesión Activa</div>
                </div>

                {activeQuestionId ? (
                  <div className="col-span-full bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 text-center animate-in fade-in zoom-in duration-300">
                    <button onClick={() => setActiveQuestionId(null)} className="mb-8 flex items-center text-slate-400 font-bold hover:text-slate-800 transition-colors"><ArrowLeft className="w-5 h-5 mr-2" /> Volver al listado</button>
                    <h2 className="text-2xl font-black text-slate-800 mb-10 leading-tight">{questions.find(q => q.id === activeQuestionId)?.text}</h2>
                    
                    {answers.some(a => a.questionId === activeQuestionId && a.userId === user?.uid) ? (
                      <div className="p-10 bg-emerald-50 rounded-[2rem] text-emerald-700 border border-emerald-100">
                        <CheckSquare className="w-14 h-14 mx-auto mb-4 text-emerald-500" />
                        <p className="font-black text-xl uppercase tracking-tight">¡Voto recibido!</p>
                        <p className="text-sm mt-1 font-medium opacity-70">Tu participación ha sido registrada correctamente.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button onClick={() => handleVote(activeQuestionId, 'agree')} className="group p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-center">
                          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                          <span className="font-black text-slate-800 text-lg block mb-1">Sí</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-emerald-600">A favor</span>
                        </button>
                        <button onClick={() => handleVote(activeQuestionId, 'disagree')} className="group p-8 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-rose-500 hover:bg-rose-50/50 transition-all text-center">
                          <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                          <span className="font-black text-slate-800 text-lg block mb-1">No</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-rose-600">En contra</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {questions.filter(q => q.isOpen).map((q) => {
                      const answered = answers.some(a => a.questionId === q.id && a.userId === user?.uid);
                      return (
                        <button key={q.id} onClick={() => setActiveQuestionId(q.id)} className={`p-8 rounded-[2rem] border-2 text-left transition-all group ${answered ? 'bg-slate-50 border-slate-100' : 'bg-white border-blue-50 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${answered ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white'}`}>
                              {answered ? 'Respondida' : 'Pendiente'}
                            </div>
                            {answered && <CheckSquare className="w-6 h-6 text-emerald-500" />}
                          </div>
                          <h3 className={`font-black text-lg leading-tight ${answered ? 'text-slate-400' : 'text-slate-800 group-hover:text-blue-700'}`}>{q.text}</h3>
                          {!answered && (
                            <div className="mt-6 flex items-center text-[10px] font-black text-blue-500 uppercase tracking-widest">
                              Votar ahora <ArrowLeft className="w-3 h-3 ml-1 rotate-180" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {questions.filter(q => q.isOpen).length === 0 && (
                      <div className="col-span-full py-20 text-center animate-pulse">
                        <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                        <p className="font-bold text-slate-300 uppercase tracking-widest text-sm">Esperando a que el moderador abra una pregunta...</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showChartModal && (
        <ChartModal 
          questionId={showChartModal} 
          onClose={() => setShowChartModal(null)} 
        />
      )}
      
      <footer className="w-full py-10 text-center">
        <div className="h-[1px] w-20 bg-slate-200 mx-auto mb-6"></div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} CleandjSoft • Asamblea Digital
        </p>
      </footer>
    </div>
  );
}
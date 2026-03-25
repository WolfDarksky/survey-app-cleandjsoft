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
  Fingerprint
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
  
  // Estado para el registro del usuario (incluyendo ID)
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

  // 2. Suscripción a datos y persistencia de perfil
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
    });

    const unsubA = onSnapshot(aRef, (snap) => {
      setAnswers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubAtt = onSnapshot(attRef, (snap) => {
      setAttendees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubS = onSnapshot(sRef, (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });

    setLoading(false);
    return () => { unsubQ(); unsubA(); unsubAtt(); unsubS(); };
  }, [user]);

  // --- Lógica de Negocio ---

  const handleRegister = async () => {
    if (!user || !userData.tower || !userData.apartment || !userData.idNumber) return;
    setRegError('');

    const tower = userData.tower.trim();
    const apartment = userData.apartment.trim();
    const idNumber = userData.idNumber.trim();
    const attendeeId = `${tower}-${apartment}`.toLowerCase();

    try {
      // 1. Validar unidad única
      const attRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendees', attendeeId);
      const attSnap = await getDoc(attRef);

      if (attSnap.exists() && attSnap.data().userId !== user.uid) {
        setRegError(`La Torre ${tower} Apto ${apartment} ya ha sido registrada por otro asistente.`);
        return;
      }

      // 2. Guardar en lista pública (Admin)
      await setDoc(attRef, {
        tower,
        apartment,
        idNumber,
        userId: user.uid,
        registeredAt: Date.now()
      });

      // 3. Guardar en perfil privado (Persistencia)
      const userProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await setDoc(userProfileRef, { tower, apartment, idNumber });

      setIsRegistered(true);
    } catch (err) {
      console.error("Error en registro:", err);
      setRegError("Error al intentar registrar. Intente de nuevo.");
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
      console.error("Error al actualizar settings:", err);
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
    const pAgree = total === 0 ? 0 : Math.round((agree / total) * 100);
    return { total, agree, pAgree, pDisagree: 100 - pAgree };
  };

  const ProgressBar = ({ stats }) => (
    <div className="mt-4 w-full">
      <div className="flex justify-between text-xs font-bold mb-1 uppercase text-gray-500">
        <span>A favor: {stats.pAgree}%</span>
        <span>En contra: {stats.pDisagree}%</span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${stats.pAgree}%` }} />
        <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${stats.pDisagree}%` }} />
      </div>
    </div>
  );

  if (loading) return <div className="h-screen flex items-center justify-center font-sans text-gray-400">Cargando aplicación...</div>;

  if (settings.isFinished) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full bg-white shadow-xl rounded-3xl overflow-hidden border border-gray-100">
          <div className="bg-blue-600 p-8 text-center text-white">
            <BarChart3 className="w-12 h-12 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">Encuesta Finalizada</h1>
          </div>
          <div className="p-8 space-y-6">
            {questions.map((q, i) => (
              <div key={q.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="font-semibold text-gray-800">{i + 1}. {q.text}</p>
                <ProgressBar stats={getStats(q.id)} />
              </div>
            ))}
          </div>
          {role === 'admin' && (
            <div className="p-6 text-center border-t">
              <button onClick={() => toggleSurveyFinished(false)} className="text-blue-600 font-bold hover:underline">Reabrir encuesta</button>
            </div>
          )}
        </div>
        <footer className="mt-8 text-slate-400 text-sm font-medium tracking-wide">
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
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Nueva Pregunta</h2>
              <form onSubmit={handleAddQuestion} className="flex gap-2">
                <input 
                  type="text" 
                  value={newQuestionText} 
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Escribe aquí tu pregunta..."
                />
                <button type="submit" disabled={!newQuestionText.trim()} className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-30 transition-colors">Añadir</button>
              </form>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Listado de Preguntas</h2>
              {questions.map((q, i) => (
                <div key={q.id} className={`bg-white p-5 rounded-3xl border transition-all ${q.isOpen ? 'border-blue-200 shadow-md' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-lg mb-1">{q.text}</h3>
                      <ProgressBar stats={getStats(q.id)} />
                    </div>
                    <div className="flex gap-2">
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
                </div>
              ))}
              {questions.length > 0 && (
                <button onClick={() => toggleSurveyFinished(true)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg">Finalizar y mostrar resultados</button>
              )}
            </section>

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Control de Asistentes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400 border-b border-slate-100">
                      <th className="py-3 px-4">Torre</th>
                      <th className="py-3 px-4">Apartamento</th>
                      <th className="py-3 px-4">Documento / ID</th>
                      <th className="py-3 px-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendees.length > 0 ? attendees.map((attendee, index) => (
                      <tr key={index} className="text-slate-700 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold">{attendee.tower}</td>
                        <td className="py-3 px-4">{attendee.apartment}</td>
                        <td className="py-3 px-4 text-xs font-mono bg-slate-50">{attendee.idNumber}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Presente</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-slate-300 italic">No hay participantes registrados aún.</td>
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
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 max-w-md mx-auto w-full">
                <div className="text-center mb-8">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="text-blue-600 w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">Registro de Asistencia</h2>
                  <p className="text-slate-500 text-sm mt-2">Ingresa tus datos de propietario o inquilino.</p>
                </div>
                
                {regError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {regError}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Torre</label>
                      <input 
                        type="text" 
                        value={userData.tower}
                        onChange={(e) => setUserData({...userData, tower: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: 1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Apto</label>
                      <input 
                        type="text" 
                        value={userData.apartment}
                        onChange={(e) => setUserData({...userData, apartment: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej: 101"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Documento de Identidad</label>
                    <div className="relative">
                      <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        value={userData.idNumber}
                        onChange={(e) => setUserData({...userData, idNumber: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Cédula de Ciudadanía"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleRegister}
                    disabled={!userData.tower || !userData.apartment || !userData.idNumber}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-30 transition-all mt-4"
                  >
                    Validar e Ingresar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="col-span-full flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm mb-2 gap-4">
                  <div className="flex items-center gap-3 w-full">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><Home className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Identificado como</p>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-700 uppercase tracking-wide">T{userData.tower} - A{userData.apartment}</p>
                        <span className="text-slate-300">|</span>
                        <p className="text-sm text-slate-500 font-mono">{userData.idNumber}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase italic border px-2 py-1 rounded bg-slate-50 whitespace-nowrap">Registro Bloqueado</div>
                </div>

                {activeQuestionId ? (
                  <div className="col-span-full bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 text-center animate-in fade-in zoom-in duration-300">
                    <button onClick={() => setActiveQuestionId(null)} className="mb-6 flex items-center text-slate-400 font-bold hover:text-slate-800"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</button>
                    <h2 className="text-2xl font-bold text-slate-800 mb-8">{questions.find(q => q.id === activeQuestionId)?.text}</h2>
                    
                    {answers.some(a => a.questionId === activeQuestionId && a.userId === user?.uid) ? (
                      <div className="p-6 bg-emerald-50 rounded-2xl text-emerald-700">
                        <CheckSquare className="w-10 h-10 mx-auto mb-3" />
                        <p className="font-bold">¡Voto registrado con éxito!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => handleVote(activeQuestionId, 'agree')} className="p-6 bg-white border-2 border-emerald-100 rounded-2xl hover:bg-emerald-50 transition-all">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                          <span className="font-bold text-emerald-700">Sí / A favor</span>
                        </button>
                        <button onClick={() => handleVote(activeQuestionId, 'disagree')} className="p-6 bg-white border-2 border-rose-100 rounded-2xl hover:bg-rose-50 transition-all">
                          <XCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                          <span className="font-bold text-rose-700">No / En contra</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {questions.filter(q => q.isOpen).map((q) => {
                      const answered = answers.some(a => a.questionId === q.id && a.userId === user?.uid);
                      return (
                        <button key={q.id} onClick={() => setActiveQuestionId(q.id)} className={`p-6 rounded-3xl border-2 text-left transition-all hover:shadow-md ${answered ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-blue-50 hover:border-blue-300'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">Pregunta Activa</div>
                            {answered && <CheckSquare className="w-5 h-5 text-emerald-500" />}
                          </div>
                          <h3 className="font-bold text-slate-800 text-lg leading-snug">{q.text}</h3>
                        </button>
                      );
                    })}
                    {questions.filter(q => q.isOpen).length === 0 && (
                      <div className="col-span-full py-20 text-center opacity-30">
                        <ShieldAlert className="w-16 h-16 mx-auto mb-4" />
                        <p className="font-bold">No hay encuestas disponibles por ahora.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <footer className="w-full py-8 text-center text-slate-400 text-sm font-medium tracking-wide">
        © {new Date().getFullYear()} CleandjSoft
      </footer>
    </div>
  );
}
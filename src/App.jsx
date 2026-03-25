import React, { useState, useEffect, useMemo } from 'react';
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
  PlaySquare,
  CheckSquare
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';

/*
// --- Configuración de Firebase ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'survey-app-default';
*/

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'mi-app-de-encuestas-prod'; // Pon un ID único aquí

export default function App() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [settings, setSettings] = useState({ isFinished: false });
  const [loading, setLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState(false);
  
  // Estados de la UI local
  const [role, setRole] = useState('admin'); // 'admin' | 'respondent'
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [newQuestionText, setNewQuestionText] = useState('');

  // 1. Inicialización de Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error en autenticación:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Revisar si hay un rol en la URL al cargar
        const params = new URLSearchParams(window.location.search);
        if (params.get('role') === 'respondent') {
          setRole('respondent');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Suscripciones a Datos (Firestore)
  useEffect(() => {
    if (!user) return;

    // Referencias a colecciones públicas
    const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
    const answersRef = collection(db, 'artifacts', appId, 'public', 'data', 'answers');
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');

    const unsubQuestions = onSnapshot(questionsRef, (snapshot) => {
      const qData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuestions(qData.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    }, console.error);

    const unsubAnswers = onSnapshot(answersRef, (snapshot) => {
      setAnswers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, console.error);

    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      }
    }, console.error);

    setLoading(false);

    return () => {
      unsubQuestions();
      unsubAnswers();
      unsubSettings();
    };
  }, [user]);

  // --- Lógica de Negocio: Administrador ---

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('role', 'respondent');
    const textToCopy = url.toString();

    // Método de respaldo para copiar al portapapeles en iframes/entornos restringidos
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 3000);
    } catch (err) {
      console.error('No se pudo copiar el texto', err);
    }
    document.body.removeChild(textArea);
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !user) return;
    
    try {
      const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
      await addDoc(questionsRef, {
        text: newQuestionText.trim(),
        isOpen: false, 
        createdAt: Date.now()
      });
      setNewQuestionText('');
    } catch (error) {
      console.error("Error al añadir pregunta:", error);
    }
  };

  const toggleQuestionStatus = async (questionId, currentStatus) => {
    if (!user) return;
    try {
      const qDoc = doc(db, 'artifacts', appId, 'public', 'data', 'questions', questionId);
      await updateDoc(qDoc, { isOpen: !currentStatus });
    } catch (error) {
      console.error("Error al actualizar estado:", error);
    }
  };

  const deleteQuestion = async (questionId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', questionId));
    } catch (error) {
      console.error("Error al eliminar pregunta:", error);
    }
  };

  const finishSurvey = async () => {
    if (!user) return;
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
      await setDoc(settingsRef, { isFinished: true }, { merge: true });
    } catch (error) {
      console.error("Error al finalizar encuesta:", error);
    }
  };

  const resetSurvey = async () => {
    if (!user) return;
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
      await setDoc(settingsRef, { isFinished: false }, { merge: true });
    } catch (error) {
      console.error("Error al reiniciar encuesta:", error);
    }
  };

  // --- Lógica de Negocio: Encuestado ---

  const submitAnswer = async (questionId, value) => {
    if (!user) return;
    try {
      const answerId = `${questionId}_${user.uid}`;
      const answerDoc = doc(db, 'artifacts', appId, 'public', 'data', 'answers', answerId);
      await setDoc(answerDoc, {
        questionId,
        userId: user.uid,
        value 
      });
    } catch (error) {
      console.error("Error al enviar respuesta:", error);
    }
  };

  // --- Cálculos y Derivaciones ---
  
  const getQuestionStats = (questionId) => {
    const qAnswers = answers.filter(a => a.questionId === questionId);
    const total = qAnswers.length;
    const agreeCount = qAnswers.filter(a => a.value === 'agree').length;
    const disagreeCount = total - agreeCount;
    
    const agreePercent = total === 0 ? 0 : Math.round((agreeCount / total) * 100);
    const disagreePercent = total === 0 ? 0 : 100 - agreePercent;

    return { total, agreeCount, disagreeCount, agreePercent, disagreePercent };
  };

  // --- Componentes de Interfaz ---

  const ProgressBarChart = ({ stats }) => (
    <div className="mt-4 animate-fade-in">
      <div className="flex justify-between text-sm font-medium mb-1">
        <span className="text-emerald-700">De acuerdo: {stats.agreePercent}% ({stats.agreeCount})</span>
        <span className="text-rose-700">En desacuerdo: {stats.disagreePercent}% ({stats.disagreeCount})</span>
      </div>
      <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
        <div 
          className="bg-emerald-500 h-full transition-all duration-1000 ease-out" 
          style={{ width: `${stats.agreePercent}%` }}
        />
        <div 
          className="bg-rose-500 h-full transition-all duration-1000 ease-out" 
          style={{ width: `${stats.disagreePercent}%` }}
        />
      </div>
      <div className="text-center text-xs text-gray-500 mt-2">
        Total de votos: {stats.total}
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="animate-pulse text-xl text-gray-500">Cargando aplicación...</div></div>;
  }

  // Vista 1: Resultados Globales
  if (settings.isFinished) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white text-center">
            <BarChart3 className="mx-auto h-16 w-16 mb-4 opacity-90" />
            <h1 className="text-3xl font-bold mb-2">Resultados Finales de la Encuesta</h1>
            <p className="text-blue-100">La encuesta ha concluido. Aquí están las estadísticas de todas las preguntas.</p>
          </div>
          
          <div className="p-8 space-y-8">
            {questions.length === 0 ? (
              <p className="text-center text-gray-500">No hay preguntas registradas.</p>
            ) : (
              questions.map((q, idx) => {
                const stats = getQuestionStats(q.id);
                return (
                  <div key={q.id} className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      {idx + 1}. {q.text}
                    </h3>
                    <ProgressBarChart stats={stats} />
                  </div>
                );
              })
            )}
          </div>

          {role === 'admin' && (
            <div className="bg-gray-50 p-6 border-t border-gray-200 text-center">
               <button 
                  onClick={resetSurvey}
                  className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Reabrir Encuesta (Solo Admin)
                </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista 2: Votación Específica
  if (role === 'respondent' && activeQuestionId) {
    const question = questions.find(q => q.id === activeQuestionId);
    const userAnswer = answers.find(a => a.questionId === activeQuestionId && a.userId === user?.uid);
    const stats = getQuestionStats(activeQuestionId);

    if (!question) {
      setActiveQuestionId(null);
      return null;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          <button 
            onClick={() => setActiveQuestionId(null)}
            className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la lista principal
          </button>

          <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center leading-relaxed">
            {question.text}
          </h2>

          {!userAnswer ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => submitAnswer(question.id, 'agree')}
                className="flex flex-col items-center justify-center p-6 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 rounded-xl transition-all hover:scale-[1.02] hover:shadow-md"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-3" />
                <span className="font-semibold text-emerald-800 text-lg">De acuerdo</span>
              </button>
              <button 
                onClick={() => submitAnswer(question.id, 'disagree')}
                className="flex flex-col items-center justify-center p-6 bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 rounded-xl transition-all hover:scale-[1.02] hover:shadow-md"
              >
                <XCircle className="w-12 h-12 text-rose-600 mb-3" />
                <span className="font-semibold text-rose-800 text-lg">En desacuerdo</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center animate-fade-in">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-full mb-4">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">¡Gracias por tu respuesta!</h3>
              <p className="text-slate-500 mb-6">Tu voto ha sido registrado. Aquí están los resultados hasta ahora para esta pregunta:</p>
              
              <ProgressBarChart stats={stats} />
              
              <button 
                onClick={() => setActiveQuestionId(null)}
                className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md w-full sm:w-auto"
              >
                Continuar con otras preguntas
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Selector de Modo de Prueba */}
      <div className="bg-slate-800 text-white p-3 flex justify-between items-center text-sm shadow-md">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-yellow-400" />
          <span className="font-medium">Modo de prueba:</span>
        </div>
        <div className="flex bg-slate-700 rounded-lg p-1">
          <button 
            onClick={() => { setRole('admin'); setActiveQuestionId(null); }}
            className={`px-4 py-1.5 rounded-md transition-colors ${role === 'admin' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            Administrador
          </button>
          <button 
            onClick={() => setRole('respondent')}
            className={`px-4 py-1.5 rounded-md transition-colors ${role === 'respondent' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            Encuestado
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8">
        
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center">
              <PlaySquare className="w-8 h-8 mr-3 text-blue-600" />
              Encuesta Dinámica
            </h1>
            <p className="text-slate-500 mt-1">
              {role === 'admin' ? 'Panel de control y creación de preguntas' : 'Selecciona una pregunta de la lista para responder'}
            </p>
          </div>
          
          {role === 'admin' && (
            <div className="relative">
              <button
                onClick={handleCopyLink}
                className={`flex items-center px-4 py-2 border rounded-lg font-medium transition-all shadow-sm ${copyStatus ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
              >
                {copyStatus ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Copiar Enlace
                  </>
                )}
              </button>
            </div>
          )}
        </header>

        {role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Crear Nueva Pregunta</h2>
              <form onSubmit={handleAddQuestion} className="flex gap-3">
                <input
                  type="text"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Ej: ¿Está de acuerdo con las nuevas políticas?"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newQuestionText.trim()}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center shadow-sm"
                >
                  <Plus className="w-5 h-5 mr-1" />
                  Añadir
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-lg font-semibold text-slate-800">Preguntas Creadas ({questions.length})</h2>
              </div>
              
              <div className="divide-y divide-slate-100">
                {questions.length === 0 ? (
                  <p className="p-8 text-center text-slate-500">Aún no has creado ninguna pregunta.</p>
                ) : (
                  questions.map((q, idx) => {
                    const stats = getQuestionStats(q.id);
                    return (
                      <div key={q.id} className={`p-6 transition-colors ${q.isOpen ? 'bg-white' : 'bg-slate-50'}`}>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span className="font-bold text-slate-400 mr-3">#{idx + 1}</span>
                              <h3 className={`text-lg font-medium ${q.isOpen ? 'text-slate-800' : 'text-slate-500 line-through'}`}>
                                {q.text}
                              </h3>
                              <span className={`ml-4 px-2.5 py-1 text-xs font-semibold rounded-full ${q.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {q.isOpen ? 'Pública' : 'Oculta'}
                              </span>
                            </div>
                            <div className="mt-3 pr-12 opacity-80">
                              <ProgressBarChart stats={stats} />
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleQuestionStatus(q.id, q.isOpen)}
                              className={`p-3 rounded-lg transition-colors flex items-center justify-center w-12 h-12 ${q.isOpen ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                            >
                              {q.isOpen ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
                            </button>
                            <button
                              onClick={() => deleteQuestion(q.id)}
                              className="p-3 text-red-500 hover:bg-red-50 rounded-lg w-12 h-12 flex items-center justify-center"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {questions.length > 0 && (
              <div className="flex justify-end mt-8">
                <button
                  onClick={finishSurvey}
                  className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg transition-all flex items-center text-lg"
                >
                  <BarChart3 className="w-6 h-6 mr-3" />
                  Finalizar Encuesta
                </button>
              </div>
            )}
          </div>
        )}

        {role === 'respondent' && !activeQuestionId && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-slate-600">
                Selecciona una pregunta para responder. Las marcadas con un check ya han sido completadas por ti.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {questions.filter(q => q.isOpen).length === 0 ? (
                <div className="col-span-full p-12 bg-white rounded-xl border border-slate-200 text-center">
                  <EyeOff className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No hay preguntas abiertas en este momento.</p>
                </div>
              ) : (
                questions.filter(q => q.isOpen).map((q, idx) => {
                  const hasAnswered = answers.some(a => a.questionId === q.id && a.userId === user?.uid);
                  return (
                    <button
                      key={q.id}
                      onClick={() => setActiveQuestionId(q.id)}
                      className={`text-left p-6 rounded-xl border transition-all flex flex-col h-full hover:shadow-md ${hasAnswered ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-200 hover:-translate-y-1'}`}
                    >
                      <div className="flex justify-between mb-4">
                        <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600">{idx + 1}</span>
                        {hasAnswered && <CheckSquare className="w-5 h-5 text-emerald-500" />}
                      </div>
                      <h3 className="font-medium text-slate-800 text-lg flex-grow">{q.text}</h3>
                      <div className="mt-4 pt-4 border-t border-slate-100 text-sm font-medium text-blue-600 flex items-center">
                        {hasAnswered ? 'Ver resultados' : 'Responder'}
                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
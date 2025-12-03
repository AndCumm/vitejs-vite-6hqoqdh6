import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, push, child } from "firebase/database";
import { 
  ShieldCheck, Users, Trophy, AlertCircle, CheckCircle2, 
  Loader2, LogOut, ChevronDown, Clock, ArrowRight, 
  Key, Eye, EyeOff, RefreshCw, Download, List, BarChart3
} from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
// ⚠️ IMPORTANTE: INCOLLA QUI LE TUE CHIAVI!
const firebaseConfig = {
  apiKey: "AIzaSyDMx9ak387_0ZRDNvo-DTyjiBnXLcsgDUU",
  authDomain: "elezioni-club.firebaseapp.com",
  databaseURL: "https://elezioni-club-default-rtdb.firebaseio.com/",
  projectId: "elezioni-club",
  storageBucket: "elezioni-club.firebasestorage.app",
  messagingSenderId: "670634398862",
  appId: "1:670634398862:web:9aee5fc260b16e67ce65df",
  measurementId: "G-1P6EXWFKPV"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const MEMBERS = [
  "Colavitti", "Cummaudo", "Fabio", 
  "Forno", "Gabe", "Luca Foro", 
  "Manta", "Muzz", "Zarro"
];

const ADMIN_PASSWORD = "coach2025";

const Button = ({ children, onClick, disabled, className = '', variant = 'primary' }) => {
  const base = "px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:active:scale-100";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:bg-gray-300 disabled:text-gray-500",
    outline: "border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 text-gray-700 disabled:opacity-50",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export default function App() {
  const [currentUserIdentity, setCurrentUserIdentity] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPublicResults, setShowPublicResults] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Stati DB
  const [mockDatabaseScores, setMockDatabaseScores] = useState({});
  const [sessionVotes, setSessionVotes] = useState(new Set());
  const [voteDetails, setVoteDetails] = useState([]);

  // CONTROLLO MEMORIA DISPOSITIVO
  const [hasLocalVoted, setHasLocalVoted] = useState(() => {
    return localStorage.getItem('hasVoted') === 'true';
  });

  // Se ha già votato in passato, vai subito ai risultati
  useEffect(() => {
    if (hasLocalVoted) {
      setShowPublicResults(true);
    }
  }, [hasLocalVoted]);

  // Sincronizzazione Firebase
  useEffect(() => {
    const scoresRef = ref(db, 'scores');
    const votesRef = ref(db, 'votedUsers');
    const detailsRef = ref(db, 'voteDetails');

    onValue(scoresRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMockDatabaseScores(data);
      } else {
        const initialScores = {};
        MEMBERS.forEach(m => initialScores[m] = 0);
        set(scoresRef, initialScores); // Inizializza se vuoto
      }
    });

    onValue(votesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSessionVotes(new Set(Object.keys(data)));
      } else {
        setSessionVotes(new Set());
      }
    });

    onValue(detailsRef, (snapshot) => {
      const data = snapshot.val();
      setVoteDetails(data ? Object.values(data) : []);
    });
  }, []);

  const handleLogin = (identity) => {
    setCurrentUserIdentity(identity);
  };

  const handleAdminAccess = () => {
    setShowAdminPanel(true);
    setCurrentUserIdentity(null);
    setShowPublicResults(false);
  };

  const handleResetVoting = () => {
    if (window.confirm('Sei sicuro di voler resettare TUTTI i dati?')) {
      const initialScores = {};
      MEMBERS.forEach(m => initialScores[m] = 0);
      set(ref(db, 'scores'), initialScores);
      set(ref(db, 'votedUsers'), null);
      set(ref(db, 'voteDetails'), null);
      // Reset locale
      localStorage.removeItem('hasVoted');
      setHasLocalVoted(false);
      window.location.reload();
    }
  };

  const handleSubmitVote = (rankings) => {
    setIsSubmitting(true);
    
    const pointsToAdd = {};
    const candidatesCount = MEMBERS.length - 1; 
    Object.entries(rankings).forEach(([candidate, rank]) => {
      pointsToAdd[candidate] = (candidatesCount + 1) - rank; 
    });

    const newScores = { ...mockDatabaseScores };
    Object.entries(pointsToAdd).forEach(([candidate, points]) => {
      newScores[candidate] = (newScores[candidate] || 0) + points;
    });

    const updates = {};
    updates['/scores'] = newScores;
    const newVoteKey = push(child(ref(db), 'voteDetails')).key;
    updates['/voteDetails/' + newVoteKey] = {
      voter: currentUserIdentity,
      rankings: rankings,
      points: pointsToAdd,
      timestamp: new Date().toISOString()
    };
    updates['/votedUsers/' + currentUserIdentity] = currentUserIdentity;

    update(ref(db), updates)
      .then(() => {
        localStorage.setItem('hasVoted', 'true');
        setHasLocalVoted(true);
        setIsSubmitting(false);
        setCurrentUserIdentity(null);
        setShowPublicResults(true);
      })
      .catch((error) => {
        console.error(error);
        alert("Errore di connessione. Riprova.");
        setIsSubmitting(false);
      });
  };

  if (showAdminPanel) {
    return <AdminPanel scores={mockDatabaseScores} sessionVotes={sessionVotes} voteDetails={voteDetails} onBack={() => setShowAdminPanel(false)} onReset={handleResetVoting} />;
  }

  if (hasLocalVoted || showPublicResults) {
    return <ResultsAndStatusScreen scores={mockDatabaseScores} sessionVotes={sessionVotes} />;
  }

  if (!currentUserIdentity) {
    return <IdentityScreen onSelect={handleLogin} sessionVotes={sessionVotes} onAdminAccess={handleAdminAccess} />;
  }

  return <BallotScreen identity={currentUserIdentity} onSubmit={handleSubmitVote} isSubmitting={isSubmitting} />;
}

// --- COMPONENTI UI ---

function IdentityScreen({ onSelect, sessionVotes, onAdminAccess }) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  
  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Chi sei?</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {MEMBERS.map((member) => {
            const hasVoted = sessionVotes.has(member);
            return (
              <button
                key={member}
                onClick={() => !hasVoted && onSelect(member)}
                disabled={hasVoted}
                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                  hasVoted ? 'bg-slate-50 text-slate-400 grayscale cursor-not-allowed' : 'hover:border-indigo-500 hover:bg-indigo-50 text-slate-700'
                }`}
              >
                {hasVoted ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full bg-slate-200" />}
                <span className="truncate text-sm font-semibold">{member}</span>
              </button>
            );
          })}
        </div>

        {showPasswordPrompt ? (
          <form onSubmit={(e) => {
            e.preventDefault();
            if (password === ADMIN_PASSWORD) onAdminAccess();
          }} className="space-y-2">
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="Password Admin"
              className="w-full p-3 border rounded-xl"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowPasswordPrompt(false)} className="flex-1">Annulla</Button>
              <Button type="submit" className="flex-1">Accedi</Button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowPasswordPrompt(true)} className="w-full text-xs text-slate-400 hover:text-indigo-600 py-2">
            Area Amministratore
          </button>
        )}
      </div>
    </div>
  );
}

function BallotScreen({ identity, onSubmit, isSubmitting }) {
  const candidates = useMemo(() => MEMBERS.filter(m => m !== identity), [identity]);
  const [rankings, setRankings] = useState({});

  const { valid, msg } = useMemo(() => {
    const values = Object.values(rankings);
    const unique = new Set(values);
    if (values.length < candidates.length) return { valid: false, msg: `Classifica tutti!` };
    if (unique.size !== values.length) return { valid: false, msg: "Posizioni doppie!" };
    return { valid: true, msg: "Ok" };
  }, [rankings, candidates]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-4 mb-4 border border-indigo-100">
        <h2 className="font-bold text-indigo-900 text-lg mb-1 flex items-center gap-2">
           <ShieldCheck size={20}/> Scheda di {identity}
        </h2>
        <p className="text-slate-500 text-sm">Trascina o seleziona per classificare.</p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        {candidates.map(candidate => (
          <div key={candidate} className={`flex items-center justify-between p-3 rounded-xl border-2 bg-white ${rankings[candidate] ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/20' : 'border-slate-100'}`}>
            <span className="font-bold text-slate-700 ml-2">{candidate}</span>
            <select 
              className={`bg-slate-50 border-2 rounded-lg py-2 px-3 font-bold outline-none cursor-pointer ${rankings[candidate] ? 'text-indigo-600 border-indigo-200' : 'text-slate-400 border-slate-200'}`}
              value={rankings[candidate] || ''}
              onChange={e => setRankings(p => ({...p, [candidate]: parseInt(e.target.value)}))}
            >
              <option value="" disabled>-</option>
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}°</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t z-50">
        <div className="max-w-md mx-auto">
          {!valid && Object.keys(rankings).length > 0 && <p className="text-center text-red-500 text-xs font-bold mb-2 animate-pulse">{msg}</p>}
          <Button onClick={() => onSubmit(rankings)} disabled={!valid || isSubmitting} className="w-full text-lg">
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Conferma Voto Definitivo"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultsAndStatusScreen({ scores, sessionVotes }) {
  const leaders = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const pending = MEMBERS.filter(m => !sessionVotes.has(m));

  return (
    <div className="min-h-screen bg-slate-50 p-6 animate-in fade-in flex flex-col items-center">
      <div className="max-w-md w-full space-y-6">
        
        {/* Banner Voto Confermato */}
        <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 p-5 rounded-2xl flex flex-col items-center text-center gap-2 shadow-sm">
          <div className="bg-white p-2 rounded-full">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-xl">Voto Registrato!</h2>
            <p className="text-sm text-emerald-700 mt-1">Grazie. Non è possibile modificare il voto o votare di nuovo.</p>
          </div>
        </div>

        {/* Classifica Live */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
            <Trophy className="text-yellow-500 fill-yellow-500"/> Classifica Live
          </h2>
          <div className="space-y-3">
            {leaders.map(([name, score], idx) => (
              <div key={name} className="flex justify-between items-center p-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${idx===0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{idx+1}</span>
                  <span className="font-medium text-slate-700">{name}</span>
                </div>
                <span className="font-bold text-indigo-600">{score} pt</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lista di Attesa */}
        <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-sm text-slate-500 mb-3 flex items-center gap-2">
            <Clock size={16}/> Mancano all'appello:
          </h3>
          {pending.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pending.map(m => (
                <span key={m} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-500">
                  {m}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-emerald-600 text-sm font-bold flex items-center gap-2">
              <CheckCircle2 size={16}/> Tutti hanno votato!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- NUOVO PANNELLO ADMIN MIGLIORATO ---
function AdminPanel({ scores, sessionVotes, voteDetails, onBack, onReset }) {
  const [tab, setTab] = useState('ranking'); // 'ranking' o 'votes'

  const leaders = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const pending = MEMBERS.filter(m => !sessionVotes.has(m));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-10">
      {/* Header Admin */}
      <div className="bg-slate-900 text-white p-6 pb-12">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500 rounded-lg"><Key size={20}/></div>
             <h1 className="text-xl font-bold">Pannello Controllo</h1>
          </div>
          <button onClick={onBack} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors">
            Esci
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto -mt-6 px-4">
        
        {/* Statistiche Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="text-xs text-slate-500 font-bold uppercase mb-1">Voti Ricevuti</div>
            <div className="text-3xl font-bold text-indigo-600">{sessionVotes.size} <span className="text-sm text-slate-300">/ {MEMBERS.length}</span></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
             <div className="text-xs text-slate-500 font-bold uppercase mb-1">Mancanti</div>
             <div className="text-3xl font-bold text-orange-500">{pending.length}</div>
          </div>
        </div>

        {/* Tabs Navigazione */}
        <div className="flex gap-2 mb-4 bg-white/50 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setTab('ranking')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${tab === 'ranking' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-white/50'}`}
          >
            <BarChart3 size={16}/> Classifica Totale
          </button>
          <button 
            onClick={() => setTab('votes')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${tab === 'votes' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-white/50'}`}
          >
            <List size={16}/> Dettaglio Voti
          </button>
        </div>

        {/* Contenuto Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {tab === 'ranking' && (
            <div className="divide-y divide-slate-100">
              <div className="bg-slate-50 p-3 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Candidato</span>
                <span>Punti Totali</span>
              </div>
              {leaders.map(([name, score], idx) => (
                <div key={name} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${idx===0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-700">{name}</span>
                  </div>
                  <span className="font-mono text-xl font-bold text-indigo-600">{score}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'votes' && (
            <div className="divide-y divide-slate-100">
              {voteDetails.length === 0 && (
                <div className="p-12 text-center text-slate-400">Nessun voto registrato.</div>
              )}
              {voteDetails.map((vote, i) => (
                <div key={i} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">
                        {vote.voter.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{vote.voter}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(vote.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  
                  {/* Visualizzazione compatta dei voti */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(vote.rankings)
                      .sort(([, r1], [, r2]) => r1 - r2) // Ordina per posizione (1°, 2°...)
                      .map(([candidate, rank]) => (
                        <div key={candidate} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                           <span className="font-bold text-indigo-500 w-4">{rank}°</span>
                           <span className="text-slate-700 truncate">{candidate}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pulsante Reset (Pericolo) */}
        <div className="mt-8 text-center">
          <button 
            onClick={onReset}
            className="text-red-500 text-xs font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={12}/> RESETTA DATABASE E RICOMINCIA
          </button>
        </div>
      </div>
    </div>
  );
}
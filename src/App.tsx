/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User,
  OperationType,
  handleFirestoreError
} from './firebase';
import { 
  doc, 
  collection, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  updateDoc,
  arrayUnion,
  where,
  deleteDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  LogOut, 
  MessageSquare, 
  Hash, 
  User as UserIcon, 
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Check,
  X,
  Users,
  ShieldAlert,
  Terminal,
  Cpu,
  Radio,
  Clock,
  Unlock,
  Sparkles,
  Lock,
  Globe,
  Bell,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import IronManHelmet from './components/IronManHelmet';

// --- Types ---
interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp | null;
}

interface RoomData {
  createdAt: Timestamp;
  ownerId: string;
  members: string[];
  lastMessageAt?: Timestamp;
}

interface AccessRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: Timestamp;
}

interface UserProfile {
  username: string;
}

// --- Digital Clock & System Status Utility Hook ---
function useSystemStats() {
  const [time, setTime] = useState(new Date());
  const [ping, setPing] = useState(14);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const pingTimer = setInterval(() => {
      setPing(prev => Math.max(8, Math.min(64, prev + Math.floor(Math.random() * 11) - 5)));
    }, 4000);
    return () => {
      clearInterval(timer);
      clearInterval(pingTimer);
    };
  }, []);

  return {
    formattedTime: format(time, 'yyyy.MM.dd | HH:mm:ss'),
    ping
  };
}

// --- Error Boundary Component ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      try {
        const parsed = JSON.parse(event.error.message);
        if (parsed.error && parsed.operationType) {
          setHasError(true);
          setErrorInfo(JSON.stringify(parsed, null, 2));
        }
      } catch (e) {
        // Not a FirestoreErrorInfo
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-cyber-dark bg-opacity-95 flex items-center justify-center p-4 font-mono relative overflow-hidden cyber-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-red-950/20 pointer-events-none" />
        <div className="max-w-2xl w-full cyber-panel border-red-500/40 text-slate-100 p-8 rounded-2xl relative z-10">
          <div className="absolute top-0 right-0 p-2 text-[10px] text-red-500 font-bold bg-red-500/10 px-4 py-1 border-b border-l border-red-500/40">
            SYSTEM FAILURE CRITICAL
          </div>
          
          <div className="flex items-center gap-4 text-red-400 mb-6">
            <div className="w-12 h-12 rounded-lg bg-red-500/15 flex items-center justify-center border border-red-500/30 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-orbitron font-bold tracking-wider">RESTRICTED ACCESS INTERRUPT</h1>
              <p className="text-xs text-red-400/75 mt-0.5">FIRESTORE SECURITY EXCEPTION TRIGGERED</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            An unauthorized protocol execution was intercepted. This typical security behavior is handled, indicating validation rules blocked the pipeline.
          </p>

          <div className="relative mb-6">
            <div className="absolute top-2 right-2 text-[8px] text-red-400/50 uppercase select-none">Buffer Output</div>
            <pre className="bg-slate-950/90 text-red-400 p-5 rounded-xl overflow-auto max-h-56 text-xs border border-red-500/20 font-mono leading-relaxed">
              {errorInfo}
            </pre>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-red-900 border border-red-400/40 text-white rounded-xl font-orbitron font-semibold tracking-widest hover:brightness-110 active:scale-[0.99] transition-all"
          >
            RESTORE SUBSYSTEMS & RELOAD
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [membersProfiles, setMembersProfiles] = useState<Record<string, { username: string; isOnline?: boolean; lastActiveAt?: Timestamp | null }>>({});
  const [roomCode, setRoomCode] = useState('');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [joiningStatus, setJoiningStatus] = useState<'none' | 'requesting' | 'waiting' | 'denied'>('none');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { formattedTime, ping } = useSystemStats();

  // --- Auth & Profile ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setIsAuthReady(true);
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setActiveRoom(null);
    setRoomCode('');
    setJoiningStatus('none');
  };

  const setUsername = async (username: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        username: username,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  // --- Online Presence Tracking (Heartbeat) ---
  useEffect(() => {
    if (!user || !userProfile) return;

    const userRef = doc(db, 'users', user.uid);

    const setOnline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: true,
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        // Safe fail-silent or fallback
      }
    };

    const setOffline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        // Ignore
      }
    };

    setOnline();

    const interval = setInterval(() => {
      setOnline();
    }, 15000);

    const handleUnload = () => {
      setOffline();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      setOffline();
    };
  }, [user, userProfile]);

  // --- Room Logic ---
  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !user || !userProfile) return;

    setIsLoading(true);
    const normalizedCode = roomCode.trim().toLowerCase();
    const roomRef = doc(db, 'rooms', normalizedCode);

    try {
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        // Create new room
        await setDoc(roomRef, {
          createdAt: serverTimestamp(),
          ownerId: user.uid,
          members: [user.uid]
        });
        setActiveRoom(normalizedCode);
      } else {
        const data = roomSnap.data() as RoomData;
        if (data.members.includes(user.uid)) {
          // Already a member
          setActiveRoom(normalizedCode);
        } else if (data.members.length < 2) {
          // Join immediately if less than 2 members
          await updateDoc(roomRef, {
            members: arrayUnion(user.uid)
          });
          setActiveRoom(normalizedCode);
        } else {
          // Must request permission
          setJoiningStatus('requesting');
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `rooms/${normalizedCode}`);
    } finally {
      setIsLoading(false);
    }
  };

  const requestAccess = async () => {
    if (!roomCode.trim() || !user || !userProfile) return;
    const normalizedCode = roomCode.trim().toLowerCase();
    setIsLoading(true);
    try {
      const requestRef = doc(db, 'rooms', normalizedCode, 'requests', user.uid);
      await setDoc(requestRef, {
        requesterId: user.uid,
        requesterName: userProfile.username,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setJoiningStatus('waiting');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${normalizedCode}/requests/${user.uid}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Listeners ---
  useEffect(() => {
    if (!activeRoom || !user) return;
    const unsubscribe = onSnapshot(doc(db, 'rooms', activeRoom), (docSnap) => {
      if (docSnap.exists()) {
        setRoomData(docSnap.data() as RoomData);
      }
    });
    return () => unsubscribe();
  }, [activeRoom, user]);

  // Listen to profiles of all room members to see their usernames and online presence state
  useEffect(() => {
    if (!roomData?.members || roomData.members.length === 0) {
      setMembersProfiles({});
      return;
    }

    const unsubscribes = roomData.members.map((memberId) => {
      return onSnapshot(doc(db, 'users', memberId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMembersProfiles((prev) => ({
            ...prev,
            [memberId]: {
              username: data.username || 'Unknown',
              isOnline: data.isOnline ?? false,
              lastActiveAt: data.lastActiveAt ?? null,
            },
          }));
        } else {
          setMembersProfiles((prev) => ({
            ...prev,
            [memberId]: {
              username: 'Unknown Operator',
              isOnline: false,
              lastActiveAt: null,
            },
          }));
        }
      });
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [roomData?.members]);

  useEffect(() => {
    if (!activeRoom || !isAuthReady || !user) return;

    // Messages listener
    const q = query(
      collection(db, 'rooms', activeRoom, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsubscribeMsgs = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${activeRoom}/messages`);
    });

    // Requests listener (for members to see incoming requests)
    const reqQ = query(
      collection(db, 'rooms', activeRoom, 'requests'),
      where('status', '==', 'pending')
    );
    const unsubscribeReqs = onSnapshot(reqQ, (snapshot) => {
      const reqs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as AccessRequest[];
      setPendingRequests(reqs);
    });

    return () => {
      unsubscribeMsgs();
      unsubscribeReqs();
    };
  }, [activeRoom, isAuthReady, user]);

  // Listen to own request status if waiting
  useEffect(() => {
    if (joiningStatus !== 'waiting' || !roomCode || !user) return;
    const normalizedCode = roomCode.trim().toLowerCase();
    const unsubscribe = onSnapshot(doc(db, 'rooms', normalizedCode, 'requests', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AccessRequest;
        if (data.status === 'approved') {
          setActiveRoom(normalizedCode);
          setJoiningStatus('none');
          deleteDoc(docSnap.ref); // Cleanup request
        } else if (data.status === 'declined') {
          setJoiningStatus('denied');
        }
      }
    });
    return () => unsubscribe();
  }, [joiningStatus, roomCode, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom || !user || !userProfile) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'rooms', activeRoom, 'messages'), {
        text: msgText,
        senderId: user.uid,
        senderName: userProfile.username,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'rooms', activeRoom), {
        lastMessageAt: serverTimestamp()
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `rooms/${activeRoom}/messages`);
    }
  };

  const handleRequestAction = async (requestId: string, requesterId: string, status: 'approved' | 'declined') => {
    if (!activeRoom) return;
    try {
      if (status === 'approved') {
        // First add the requester to members so that security rules allow their read connections
        await updateDoc(doc(db, 'rooms', activeRoom), {
          members: arrayUnion(requesterId)
        });
        // Only then update the request status to approved
        await updateDoc(doc(db, 'rooms', activeRoom, 'requests', requestId), {
          status: 'approved'
        });
      } else {
        await updateDoc(doc(db, 'rooms', activeRoom, 'requests', requestId), {
          status: 'declined'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${activeRoom}/requests/${requestId}`);
    }
  };

  // --- UI Screens Render Setup ---

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-cyber-dark flex flex-col items-center justify-center font-mono relative overflow-hidden cyber-grid text-cyan-400">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration: 1.5 }}
          className="relative w-12 h-12 mb-4"
        >
          <Loader2 className="w-12 h-12 text-cyan-500 absolute top-0 left-0" />
          <Cpu className="w-6 h-6 text-pink-500 absolute top-3 left-3" />
        </motion.div>
        <div className="text-xs uppercase tracking-[0.2em] font-orbitron animate-pulse text-cyan-300">
          Syncing Quantum Hub...
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Background Cyber-Tech Matrix Container */}
      <div className="min-h-screen bg-cyber-dark text-slate-100 font-sans selection:bg-cyan-500/20 selection:text-cyan-200 relative overflow-hidden flex flex-col justify-between">
        
        {/* Shifting Cyber Grid Overlay */}
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none animate-grid-shift" />
        
        {/* Glowing Ambient Particles/Blur Spheres */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

        {/* Global HUD Top Header Stats Panel */}
        <header className="w-full px-6 py-2 border-b border-indigo-500/15 bg-slate-950/45 backdrop-blur-md flex items-center justify-between text-[11px] font-mono tracking-wider z-20 text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-cyan-400" /> CODECHAT // CORE_SYS_ALPHA</span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-slate-500">|</span>
            <span className="hidden md:inline-flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-pink-500 animate-pulse" /> LATENCY: <span className="text-pink-400">{ping}ms</span></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-violet-400" /> {formattedTime}</span>
            <span className="hidden sm:inline bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-sm uppercase tracking-widest text-[9px] font-bold">Secure Tunnel Active</span>
          </div>
        </header>

        {/* Dynamic Screen View Container */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 z-10 w-full relative">
          <AnimatePresence mode="wait">
            {!user ? (
              /* =========================================
                 1. Holographic Login Card View
                 ========================================= */
              <motion.div
                key="login"
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -30 }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className="max-w-md w-full"
              >
                <div className="cyber-panel px-8 py-10 rounded-3xl border-indigo-500/30 text-center relative">
                  {/* Digital corner notches */}
                  <span className="cyber-corner corner-tl" />
                  <span className="cyber-corner corner-tr" />
                  <span className="cyber-corner corner-bl" />
                  <span className="cyber-corner corner-br" />

                  {/* Dynamic Laser Line Scanning Effect */}
                  <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent top-0 animate-scanline pointer-events-none" />

                  {/* Holographic Interactive Iron Man Suit Helmet */}
                  <div className="mb-4">
                    <IronManHelmet />
                  </div>

                  <h1 className="text-4xl font-extrabold font-orbitron tracking-[0.15em] text-slate-100 mb-2 select-none relative">
                    CODE<span className="text-cyan-400">CHAT</span>
                  </h1>
                  <p className="text-slate-400/80 text-xs tracking-wider uppercase font-mono max-w-xs mx-auto mb-10 leading-relaxed">
                    [ VERIFIED MULTI-USER COGNITIVE INTERFACE NETWORK ]
                  </p>

                  <button
                    onClick={handleLogin}
                    className="w-full py-4.5 font-orbitron font-bold tracking-[0.1em] text-xs text-cyan-300 rounded-2xl glow-btn-cyan flex items-center justify-center gap-3 transition-all uppercase relative overflow-hidden"
                  >
                    <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
                    <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400" />
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                      alt="Google logo" 
                      className="w-5 h-5 bg-white rounded-full p-0.5" 
                    />
                    Decrypt Interface with Google
                  </button>

                  <div className="mt-8 pt-6 border-t border-indigo-500/10 text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2">
                    <Unlock className="w-3 h-3 text-cyan-400/50" /> END-TO-END VERIFICATION ENABLED
                  </div>
                </div>
              </motion.div>
            ) : !userProfile ? (
              /* =========================================
                 2. Interface Credentials Assignment View
                 ========================================= */
              <motion.div
                key="set-username"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="max-w-md w-full"
              >
                <div className="cyber-panel p-8 rounded-3xl border-indigo-500/30 relative">
                  <span className="cyber-corner corner-tl" />
                  <span className="cyber-corner corner-tr" />
                  <span className="cyber-corner corner-bl" />
                  <span className="cyber-corner corner-br" />

                  <div className="mb-6 flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold font-orbitron tracking-wider text-slate-100">IDENT_REGISTRY_v1</h2>
                      <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Select Access Callsign</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-6 font-mono bg-indigo-950/30 p-4 border border-indigo-500/15 rounded-xl">
                    [!] Establish your custom digital handle. This transmitter signature will identify your telemetry across the chat conduit.
                  </p>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value;
                      if (name.trim()) setUsername(name.trim());
                    }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-400/80 font-mono uppercase tracking-widest mb-2 block">
                        Channel Callsign [HANDLE]
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/60 w-5 h-5" />
                        <input
                          name="username"
                          type="text"
                          placeholder="e.g. CYBER_SENTRY_99"
                          className="w-full pl-12 pr-4 py-4 bg-slate-950/60 border border-indigo-500/25 rounded-2xl focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-slate-200 placeholder:text-slate-600 font-mono transition-all text-sm"
                          required
                          minLength={2}
                          maxLength={20}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white rounded-2xl font-orbitron font-bold tracking-widest text-xs border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all uppercase"
                    >
                      Authenticate Credentials
                    </button>
                  </form>

                  <button 
                    onClick={handleLogout} 
                    className="w-full mt-4 text-xs font-mono text-slate-500 hover:text-red-400 hover:underline transition-all text-center"
                  >
                    Terminate Connected Session
                  </button>
                </div>
              </motion.div>
            ) : !activeRoom ? (
              /* =========================================
                 3. Lobby Terminal Hub (Room Entry Logic)
                 ========================================= */
              <motion.div
                key="lobby"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="max-w-md w-full"
              >
                <div className="cyber-panel p-8 rounded-3xl border-indigo-500/30 relative">
                  <span className="cyber-corner corner-tl" />
                  <span className="cyber-corner corner-tr" />
                  <span className="cyber-corner corner-bl" />
                  <span className="cyber-corner corner-br" />

                  <AnimatePresence mode="wait">
                    {joiningStatus === 'none' && (
                      <motion.div 
                        key="st-none" 
                        initial={{ opacity: 0, y: 15 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -15 }}
                      >
                        {/* Upper User HUD banner */}
                        <div className="flex flex-col gap-3 mb-8 bg-indigo-950/20 border border-indigo-500/15 p-4 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-orbitron font-bold shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                                {userProfile?.username ? userProfile.username[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <p className="text-sm font-bold font-orbitron text-slate-200">{userProfile?.username}</p>
                                <p className="text-[9px] text-cyan-400 font-mono uppercase tracking-wider">NODE_CREDS_ASSIGNED</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setIsEditingUsername(!isEditingUsername);
                                  setNewUsernameInput(userProfile?.username || '');
                                }}
                                className="p-2 bg-slate-900/40 hover:bg-cyan-500/10 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/20 rounded-xl transition-all text-slate-400 text-xs font-mono flex items-center gap-1"
                                title="Change Callsign"
                              >
                                <UserIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">EDIT</span>
                              </button>
                              <button 
                                onClick={handleLogout} 
                                className="p-2 bg-slate-900/40 hover:bg-red-500/10 hover:text-red-400 border border-slate-800 hover:border-red-500/20 rounded-xl transition-all text-slate-400"
                                title="Disconnect Session"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Editable container if editing is triggered */}
                          {isEditingUsername && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pt-2 border-t border-indigo-500/10 mt-1"
                            >
                              <form 
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (newUsernameInput.trim() && userProfile && newUsernameInput.trim() !== userProfile.username) {
                                    setIsLoading(true);
                                    await setUsername(newUsernameInput.trim());
                                    setIsLoading(false);
                                  }
                                  setIsEditingUsername(false);
                                }}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={newUsernameInput}
                                  onChange={(e) => setNewUsernameInput(e.target.value)}
                                  className="flex-1 px-3 py-2 text-xs bg-slate-950/80 border border-indigo-500/20 rounded-xl focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 outline-none text-slate-200 font-mono transition-all"
                                  placeholder="New Callsign"
                                  maxLength={20}
                                  required
                                />
                                <button
                                  type="submit"
                                  disabled={isLoading}
                                  className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-indigo-700 hover:from-cyan-500 text-white rounded-xl text-[10px] font-mono tracking-wider font-bold"
                                >
                                  SAVE
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingUsername(false)}
                                  className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl text-[10px] font-mono"
                                >
                                  BACK
                                </button>
                              </form>
                            </motion.div>
                          )}
                        </div>

                        {/* Quantum Entry Terminal Input Panel */}
                        <div className="mb-6 flex items-center gap-2">
                          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                          <h2 className="text-lg font-bold font-orbitron tracking-wider text-slate-100">TUNNEL_GRID_GATE</h2>
                        </div>

                        <form onSubmit={joinRoom} className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400/80 font-mono uppercase tracking-widest mb-2 block">
                              Enter Target Quantum Lock (Code)
                            </label>
                            <div className="relative">
                              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/60 w-5 h-5 animate-pulse" />
                              <input
                                type="text"
                                placeholder="e.g. quantum-secret"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-950/60 border border-indigo-500/25 rounded-2xl font-mono text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-slate-200 placeholder:text-slate-600 transition-all uppercase tracking-widest"
                                required
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-700 hover:from-cyan-500 hover:to-indigo-600 text-white rounded-2xl font-orbitron font-bold tracking-[0.2em] text-xs border border-cyan-400/30 shadow-[0_0_25px_rgba(6,182,212,0.15)] transition-all flex items-center justify-center gap-2 uppercase cursor-pointer"
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-cyan-300" /> : 'Sync Tunnel Frequency'}
                          </button>
                        </form>
                      </motion.div>
                    )}

                    {joiningStatus === 'requesting' && (
                      <motion.div 
                        key="st-req" 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.9 }} 
                        className="text-center"
                      >
                        <div className="w-16 h-16 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(219,39,119,0.15)] animate-pulse">
                          <Users className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold font-orbitron tracking-wide text-slate-100 mb-2">TUNNEL CAPACITY LIMIT</h3>
                        <p className="text-slate-300 text-xs font-mono mb-6 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-indigo-500/15">
                          WARNING: Standard room has reaches 2 operators limit. You must present identification credentials and request operational override from existing nodes.
                        </p>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setJoiningStatus('none')} 
                            className="flex-1 py-3 bg-slate-900/60 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 rounded-xl font-orbitron text-xs tracking-wider transition-all text-slate-400"
                          >
                            ABORT PROTOCOL
                          </button>
                          <button 
                            onClick={requestAccess}
                            disabled={isLoading}
                            className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-pink-800 hover:brightness-110 text-white rounded-xl font-orbitron text-xs tracking-wider border border-pink-500/30 shadow-[0_0_15px_rgba(219,39,119,0.2)] transition-all flex items-center justify-center gap-2"
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'PING REQUEST'}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {joiningStatus === 'waiting' && (
                      <motion.div 
                        key="st-wait" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="text-center"
                      >
                        <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-6 relative shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                           <Loader2 className="w-10 h-10 animate-spin absolute text-cyan-500/70" />
                           <MessageSquare className="w-6 h-6 text-pink-500" />
                        </div>
                        <h3 className="text-xl font-bold font-orbitron tracking-wide text-slate-100 mb-2">TRANSMITTING OVERRIDE</h3>
                        <p className="text-slate-300 text-xs font-mono mb-6 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-indigo-500/15">
                          Awaiting decryptions validation signal from terminal operators of <span className="font-bold text-cyan-400">#{roomCode}</span>...
                        </p>
                        <button 
                          onClick={() => setJoiningStatus('none')} 
                          className="w-full py-3 bg-slate-900/60 border border-slate-800 hover:bg-slate-800 font-orbitron text-xs tracking-wider text-slate-400 rounded-xl transition-all"
                        >
                          CEASE TRANSMISSION
                        </button>
                      </motion.div>
                    )}

                    {joiningStatus === 'denied' && (
                      <motion.div 
                        key="st-denied" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="text-center"
                      >
                        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse">
                          <ShieldAlert className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold font-orbitron tracking-wide text-red-400 mb-2">ACCESS OVERRIDE DENIED</h3>
                        <p className="text-slate-300 text-xs font-mono mb-6 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-indigo-500/15">
                          The active operator cells have declined your tunnel entry credentials. Access to this line partition is locked.
                        </p>
                        <button 
                          onClick={() => setJoiningStatus('none')} 
                          className="w-full py-4 bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl font-orbitron font-bold tracking-widest text-xs hover:bg-slate-800 transition-all uppercase"
                        >
                          Return to Grid Console
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              /* =========================================
                 4. Active Futuristic Hologram Chat Interface
                 ========================================= */
              <motion.div
                key="chat"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full max-w-5xl h-[82vh] flex flex-col md:flex-row rounded-3xl overflow-hidden cyber-panel border-indigo-500/35 relative"
              >
                <span className="cyber-corner corner-tl" />
                <span className="cyber-corner corner-tr" />
                <span className="cyber-corner corner-bl" />
                <span className="cyber-corner corner-br" />

                {/* Laser Line Scanner inside Active Chat Panel */}
                <div className="absolute inset-y-0 w-[1px] bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent left-0 animate-scanline pointer-events-none" style={{ animationDuration: '12s' }} />

                {/* Left Side Systems Status Bar HUD Column (Desktop View) */}
                <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-indigo-500/15 bg-slate-950/50 p-4 font-mono flex flex-col justify-between text-xs text-slate-400 relative">
                  <div className="space-y-6">
                    {/* Tunnel Meta Area */}
                    <div>
                      <div className="flex items-center gap-1.5 text-cyan-400 font-orbitron font-semibold mb-1 text-[11px] tracking-widest uppercase">
                        <Lock className="w-3.5 h-3.5" /> TUNNEL_LINK
                      </div>
                      <div className="text-[15px] font-bold text-slate-100 font-mono flex items-center gap-1.5 pl-1">
                        <span className="text-indigo-400">#</span>
                        {activeRoom}
                      </div>
                    </div>

                    {/* Node Operator Directory */}
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" /> Active Nodes ({roomData?.members?.length || 0})
                      </div>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {roomData?.members?.map((memberId) => {
                          const profile = membersProfiles[memberId];
                          const isMe = memberId === user.uid;
                          const isOnline = isMe ? true : (profile?.isOnline ?? false);
                          const isOwner = memberId === roomData.ownerId;
                          const name = isMe ? `${userProfile.username} (You)` : (profile?.username || 'Decrypting...');

                          return (
                            <div 
                              key={memberId} 
                              className={`rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px] transition-all border ${
                                isOnline 
                                  ? 'bg-cyan-500/5 border-cyan-500/15 text-cyan-300' 
                                  : 'bg-indigo-950/20 border-indigo-500/10 text-slate-400 opacity-75'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 truncate max-w-[130px]">
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                                <span className="truncate">{name}</span>
                              </span>
                              <div className="flex items-center gap-1">
                                {isOwner && (
                                  <span className="text-[8px] bg-indigo-500/25 text-indigo-300 px-1 rounded">HOST</span>
                                )}
                                <span className="text-[8px] opacity-70">
                                  {isOnline ? 'ONLN' : 'OFFL'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Operational Telemetry Sub-Logs */}
                    <div className="hidden md:block">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-slate-500" /> Channel Stream Logs
                      </div>
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-white/5 space-y-2 text-[9px] text-emerald-400/80 leading-normal font-mono max-h-36 overflow-y-auto">
                        <p className="text-slate-600">[00.01] Establishing crypto channel...</p>
                        <p className="text-slate-600">[00.03] Core node verified.</p>
                        <p className="text-cyan-400/80">[00.05] Tunnel established on path: #{activeRoom}</p>
                        <p className="text-pink-400/80">[00.08] Member synchronization completed.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-indigo-500/10 flex flex-col gap-2">
                    {/* Inline edit callsign for active chat session */}
                    <div className="bg-slate-900/40 p-2.5 rounded-lg border border-indigo-500/10 mb-1">
                      {isEditingUsername ? (
                        <form 
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (newUsernameInput.trim() && userProfile && newUsernameInput.trim() !== userProfile.username) {
                              setIsLoading(true);
                              await setUsername(newUsernameInput.trim());
                              setIsLoading(false);
                            }
                            setIsEditingUsername(false);
                          }}
                          className="space-y-1.5"
                        >
                          <span className="text-[8px] text-cyan-400 font-mono tracking-widest uppercase block">Changing callsign...</span>
                          <input
                            type="text"
                            value={newUsernameInput}
                            onChange={(e) => setNewUsernameInput(e.target.value)}
                            className="w-full px-2 py-1 text-[10px] bg-slate-950/80 border border-cyan-500/30 rounded-md focus:border-cyan-400 outline-none text-slate-200 font-mono transition-all"
                            maxLength={20}
                            required
                          />
                          <div className="flex gap-1">
                            <button
                              type="submit"
                              disabled={isLoading}
                              className="flex-1 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[8px] font-mono tracking-wider font-bold"
                            >
                              APPLY
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingUsername(false)}
                              className="flex-1 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded text-[8px] font-mono"
                            >
                              CANCEL
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="truncate max-w-[120px]">
                            <span className="text-[8px] text-slate-500 font-mono block uppercase">Your Handle:</span>
                            <span className="font-bold text-slate-300 font-mono truncate">{userProfile?.username}</span>
                          </div>
                          <button
                            onClick={() => {
                              setIsEditingUsername(true);
                              setNewUsernameInput(userProfile?.username || '');
                            }}
                            className="px-2 py-1 bg-indigo-500/10 hover:bg-cyan-500/10 text-[9px] font-mono text-cyan-400 border border-indigo-500/20 hover:border-cyan-500/30 rounded transition-all"
                          >
                            RENAME
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>PACKETS RX:</span>
                      <span className="text-emerald-400 font-bold">{messages.length * 4}KB</span>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveRoom(null);
                        setIsEditingUsername(false);
                      }}
                      className="w-full py-2 bg-slate-900 border border-indigo-500/20 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-cyan-400 font-orbitron transition-all text-[10px] font-semibold tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> RETRACT NODE
                    </button>
                  </div>
                </aside>

                {/* Primary Chat View Panel */}
                <div className="flex-1 flex flex-col bg-slate-950/20 relative">
                  
                  {/* Floating Incoming Member Overrides Banner Alert */}
                  <AnimatePresence>
                    {pendingRequests.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -25, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -25, scale: 0.95 }}
                        className="absolute top-4 inset-x-4 z-30"
                      >
                        <div className="bg-slate-950/95 border border-pink-500/40 text-slate-200 p-4 rounded-2xl shadow-2xl shadow-pink-500/5 flex flex-col gap-3 backdrop-blur-xl relative">
                          <div className="absolute top-0 right-0 p-1 text-[8px] bg-pink-500/20 text-pink-400 rounded-bl font-mono tracking-widest uppercase">Overriding Beacon</div>
                          
                          <div className="flex items-center gap-2 text-pink-400 font-orbitron text-[11px] font-bold tracking-widest uppercase">
                            <Radio className="w-4 h-4 text-pink-500 animate-pulse" /> CRITICAL_ACCESS_REQUEST
                          </div>
                          
                          {pendingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-pink-950/20 border border-pink-500/10 p-3 rounded-xl">
                              <div className="flex flex-col">
                                <span className="font-bold text-pink-300 font-mono text-xs">{req.requesterName}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-mono tracking-wider mt-0.5">SECURE_ID_OVERFLOW</span>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleRequestAction(req.id, req.requesterId, 'declined')}
                                  className="p-2 bg-red-500/10 border border-red-500/25 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all"
                                  title="Decline Override"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleRequestAction(req.id, req.requesterId, 'approved')}
                                  className="p-2 bg-cyan-500/20 border border-cyan-500/35 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 rounded-lg transition-all"
                                  title="Approve Node"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Messages Transmission Feed */}
                  <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scroll-smooth bg-slate-900/15">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 font-mono text-center">
                        <div className="w-14 h-14 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-center animate-pulse">
                          <MessageSquare className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Secure Line Established</p>
                          <p className="text-[10px] text-indigo-400/60 mt-1 max-w-xs font-light">Transmission conduit is prepared for quantum message relay. All operations logged.</p>
                        </div>
                      </div>
                    ) : (
                      messages.map((msg, index) => {
                        const isMe = msg.senderId === user.uid;
                        const showName = index === 0 || messages[index - 1].senderId !== msg.senderId;
                        
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {showName && !isMe && (
                              <span className="text-[10px] font-bold text-slate-500 uppercase font-mono mb-1 ml-1 tracking-wider">{msg.senderName}</span>
                            )}
                            <div className={`
                              max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-2xl text-sm relative border shadow-sm transition-all
                              ${isMe 
                                ? 'bg-indigo-600/10 text-cyan-200 border-indigo-500/40 rounded-tr-none shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
                                : 'bg-slate-950/50 text-slate-200 border-indigo-500/15 rounded-tl-none'}
                            `}>
                              {/* Glowing side anchor for matching active sender */}
                              <span className={`absolute top-0 w-1 h-3 rounded-full ${isMe ? 'right-[-2px] bg-cyan-400' : 'left-[-2px] bg-indigo-500'}`} />
                              <p className="leading-relaxed break-words font-sans">{msg.text}</p>
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono mt-1 mx-1 tracking-wider">
                              {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : 'TRANSMITTING...'}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </main>

                  {/* Operational Input console Terminal Form */}
                  <footer className="p-4 bg-slate-950/40 border-t border-indigo-500/15 sticky bottom-0">
                    <form onSubmit={sendMessage} className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Type transmitter signal..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="w-full px-5 py-3.5 bg-slate-950/50 border border-indigo-500/25 rounded-2xl focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-slate-200 placeholder:text-slate-600 transition-all text-sm font-mono"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-40 select-none">
                          <span className="text-[8px] font-mono uppercase bg-slate-900 border border-slate-700 px-1 py-0.5 rounded">ENTER</span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-4.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-900 hover:text-white rounded-2xl transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-cyan-400/20 shadow-[0_0_15px_rgba(6,182,212,0.1)] focus:outline-none flex items-center justify-center cursor-pointer"
                      >
                        <Send className="w-5 h-5 text-cyan-200" />
                      </button>
                    </form>
                  </footer>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Footer System Metadata */}
        <footer className="w-full px-6 py-2 border-t border-indigo-500/15 bg-slate-950/25 backdrop-blur-sm flex items-center justify-between text-[9px] font-mono tracking-widest text-slate-600 z-10">
          <div>QUANTUM_SYSTEM_ENCRYPTION_v2.09 // ONLINE</div>
          <div>CRAFTED_IN_FUTURE_TERRAIN</div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

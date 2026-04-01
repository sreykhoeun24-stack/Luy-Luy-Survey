import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Theme, StatusMessage, Language } from '../types';
import { Home, User, LogOut, Sun, Moon, Settings, CheckCircle, XCircle, Copy, RefreshCw, Upload, DollarSign, Languages, ClipboardList, MessageSquare, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Auth from './Auth';
import Dashboard from './Dashboard';
import Admin from './Admin';
import Profile from './Profile';
import Surveys from './Surveys';
import ChatHub from './ChatHub';
import Feed from './Feed';
import Friends from './Friends';
import DirectMessages from './DirectMessages';
import ErrorBoundary from './ErrorBoundary';

const MASTER_EMAIL = "sreykhoeun24@gmail.com";

const TRANSLATIONS = {
  en: {
    home: 'TERMINAL',
    profile: 'SETTINGS',
    surveys: 'TASKS',
    feed: 'FEED',
    circle: 'FRIENDS',
    messages: 'MESSAGES',
    admin: 'ADMIN',
    admin_ledger: 'Master Ledger',
    admin_surveys: 'Task Control',
    specialist_terminal: 'Specialist Terminal Active',
    global_oversight: 'Global Oversight Terminal',
    welcome: 'Welcome',
    sign_out: 'DEAUTHORIZE',
    payout_requested: 'PAYOUT REQUESTED',
    request_payout: 'REQUEST PAYOUT',
    verified_balance: 'Verified Balance',
    history: 'HISTORY',
    wallet: 'WALLET',
    settlement: 'SUPPORT',
  },
  km: {
    home: 'ស្ថានីយ',
    profile: 'ការកំណត់',
    surveys: 'ភារកិច្ច',
    feed: 'ព័ត៌មាន',
    circle: 'មិត្តភក្តិ',
    messages: 'សារ',
    admin: 'អ្នកគ្រប់គ្រង',
    admin_ledger: 'សៀវភៅបញ្ជីមេ',
    admin_surveys: 'ការគ្រប់គ្រងភារកិច្ច',
    specialist_terminal: 'ស្ថានីយជំនាញសកម្ម',
    global_oversight: 'ស្ថានីយត្រួតពិនិត្យសកល',
    welcome: 'សូមស្វាគមន៍',
    sign_out: 'ចាកចេញ',
    payout_requested: 'បានស្នើសុំការទូទាត់',
    request_payout: 'ស្នើសុំការទូទាត់',
    verified_balance: 'សមតុល្យដែលបានផ្ទៀងផ្ទាត់',
    history: 'ប្រវត្តិ',
    wallet: 'កាបូប',
    settlement: 'ជំនួយ',
  }
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<Theme>('night');
  const [language, setLanguage] = useState<Language>('en');
  const [view, setView] = useState<'home' | 'profile' | 'surveys' | 'chat' | 'feed' | 'circle' | 'messages' | 'admin'>('home');
  const [initialChatUserId, setInitialChatUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const path = `users/${user.uid}`;
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile);
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'night');
  }, [theme]);

  const showStatus = (text: string, type: 'success' | 'error') => {
    setStatus({ text, type });
    setTimeout(() => setStatus(null), 2000);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showStatus('Signed out successfully', 'success');
    } catch (error: any) {
      showStatus(error.message, 'error');
    }
  };

  const startChat = (userId: string) => {
    setInitialChatUserId(userId);
    setView('messages');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="loading-bar w-full h-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <div className={`min-h-screen ${theme === 'night' ? 'dark' : ''}`}>
          <Auth showStatus={showStatus} theme={theme} />
          <div className="fixed top-6 right-6 z-50 flex gap-2">
            <LanguageToggle language={language} setLanguage={setLanguage} />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const isAdmin = user.email === MASTER_EMAIL;

  return (
    <ErrorBoundary>
      <div className={`min-h-screen flex flex-col ${theme === 'night' ? 'dark' : ''}`}>
        {/* Fast Status Bar */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 3 }}
              exit={{ height: 0 }}
              className={`fixed top-0 left-0 right-0 z-50 ${status.type === 'success' ? 'bg-blue-500' : 'bg-red-500'}`}
            />
          )}
        </AnimatePresence>

        {/* Status Text Notification */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 10 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 glass rounded-full text-xs font-medium"
            >
              {status.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggles */}
        <div className="fixed top-6 right-6 z-50 flex gap-2">
          <LanguageToggle language={language} setLanguage={setLanguage} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        {/* Main Content */}
        <main className="flex-1 pb-24 pt-8 px-4 max-w-lg mx-auto w-full">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {view === 'home' ? (
              <Dashboard profile={profile} showStatus={showStatus} language={language} t={t} />
            ) : (view === 'admin' && isAdmin) ? (
              <Admin showStatus={showStatus} language={language} t={t} />
            ) : view === 'profile' ? (
              <Profile profile={profile} showStatus={showStatus} onSignOut={handleSignOut} language={language} t={t} />
            ) : view === 'surveys' ? (
              <Surveys profile={profile} showStatus={showStatus} language={language} t={t} />
            ) : view === 'feed' ? (
              <Feed profile={profile} isAdmin={isAdmin} showStatus={showStatus} language={language} t={t} onStartChat={startChat} />
            ) : view === 'circle' ? (
              <Friends profile={profile} showStatus={showStatus} language={language} t={t} onStartChat={startChat} />
            ) : view === 'messages' ? (
              <DirectMessages profile={profile} showStatus={showStatus} language={language} t={t} initialChatUserId={initialChatUserId} onChatOpened={() => setInitialChatUserId(null)} />
            ) : (
              <ChatHub profile={profile} language={language} showStatus={showStatus} />
            )}
          </motion.div>
        </main>

        {/* Bottom Nav Dock */}
        <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[98%] max-w-lg glass rounded-2xl p-2 grid ${isAdmin ? 'grid-cols-8' : 'grid-cols-7'} items-center justify-around z-40`}>
          <NavButton
            active={view === 'home'}
            onClick={() => setView('home')}
            icon={<Home size={16} />}
            label={t.home}
          />
          {isAdmin && (
            <NavButton
              active={view === 'admin'}
              onClick={() => setView('admin')}
              icon={<Shield size={16} />}
              label={t.admin}
            />
          )}
          <NavButton
            active={view === 'surveys'}
            onClick={() => setView('surveys')}
            icon={<ClipboardList size={16} />}
            label={t.surveys}
          />
          <NavButton
            active={view === 'feed'}
            onClick={() => setView('feed')}
            icon={<RefreshCw size={16} />}
            label={t.feed}
          />
          <NavButton
            active={view === 'circle'}
            onClick={() => setView('circle')}
            icon={<User size={16} />}
            label={t.circle}
          />
          <NavButton
            active={view === 'messages'}
            onClick={() => setView('messages')}
            icon={<MessageSquare size={16} />}
            label={t.messages}
          />
          <NavButton
            active={view === 'chat'}
            onClick={() => setView('chat')}
            icon={<DollarSign size={16} />}
            label={t.settlement}
          />
          <NavButton
            active={view === 'profile'}
            onClick={() => setView('profile')}
            icon={<Settings size={16} />}
            label={t.profile}
          />
        </nav>
      </div>
    </ErrorBoundary>
  );
}

function LanguageToggle({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'km' : 'en')}
      className="p-3 glass rounded-full active:scale-95 transition-all flex items-center gap-2"
    >
      <Languages size={20} />
      <span className="text-[10px] font-bold tracking-widest">{language === 'en' ? 'EN' : 'KM'}</span>
    </button>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <button
      onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
      className="p-3 glass rounded-full active:scale-95 transition-all"
    >
      {theme === 'night' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl transition-all active:scale-95 ${
        active ? 'bg-blue-500/20 text-blue-500' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {icon}
      <span className="text-[8px] font-bold tracking-tighter uppercase truncate w-full text-center">{label}</span>
    </button>
  );
}

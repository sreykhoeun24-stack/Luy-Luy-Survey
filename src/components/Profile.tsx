import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { UserProfile, Language } from '../types';
import { LogOut, Settings, Key, ShieldCheck, User, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile({ profile, showStatus, onSignOut, language, t }: { profile: UserProfile | null; showStatus: (t: string, type: 'success' | 'error') => void; onSignOut: () => Promise<void> | void; language: Language; t: any }) {
  const [showSettings, setShowSettings] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!profile) return null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      showStatus('Access Key Updated Successfully', 'success');
      setOldPassword('');
      setNewPassword('');
      setShowSettings(false);
    } catch (error: any) {
      showStatus(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tighter text-white">{t.profile}</h2>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase">Specialist Identity Settings</p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-3xl p-8 flex flex-col gap-8"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="p-6 bg-blue-500/10 text-blue-500 rounded-3xl">
            <User size={48} />
          </div>
          <div className="flex flex-col items-center">
            <h3 className="text-2xl font-black text-white">{profile.display_name}</h3>
            <p className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">{profile.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-full font-bold py-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${
              showSettings ? 'bg-zinc-800 text-white' : 'bg-zinc-900/50 text-zinc-400 hover:text-white'
            }`}
          >
            <Settings size={18} />
            {showSettings ? 'CLOSE SETTINGS' : 'SECURITY SETTINGS'}
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleUpdatePassword}
                className="flex flex-col gap-4 overflow-hidden"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Old Access Key</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">New Access Key</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-48 h-1 bg-blue-400/30 rounded-full overflow-hidden">
                      <div className="loading-bar w-full h-full" />
                    </div>
                  ) : (
                    <>
                      <Key size={18} />
                      UPDATE ACCESS KEY
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <button
            onClick={onSignOut}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            {t.sign_out}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

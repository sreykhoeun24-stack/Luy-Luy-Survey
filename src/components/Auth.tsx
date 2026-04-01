import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, UserPlus, ShieldCheck, Chrome, Loader2 } from 'lucide-react';

export default function Auth({ showStatus, theme }: { showStatus: (t: string, type: 'success' | 'error') => void; theme: string }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          display_name: user.displayName || 'Specialist',
          verified_balance: 0,
          aba_status: false,
          qr_url: '',
          email: user.email
        });
      }
      showStatus('Authorized Google Sign In Successful', 'success');
    } catch (error: any) {
      showStatus(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        showStatus('Authorized Sign In Successful', 'success');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const path = `users/${userCredential.user.uid}`;
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            display_name: displayName,
            verified_balance: 0,
            aba_status: false,
            qr_url: '',
            email: email
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
        showStatus('Account Created Successfully', 'success');
      }
    } catch (error: any) {
      showStatus(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm glass-card rounded-3xl p-8 flex flex-col gap-8"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 mb-2">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">LUYLUY PRO</h1>
          <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase">High-Speed Terminal</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                placeholder="Specialist Name"
                required
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Email Terminal</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
              placeholder="name@terminal.pro"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Access Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-4 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                {isLogin ? 'AUTHORIZED SIGN IN' : 'INITIALIZE ACCOUNT'}
              </>
            )}
          </button>

          <div className="flex items-center gap-4 my-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">OR</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold py-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Chrome size={18} />
                SIGN IN WITH GOOGLE
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase hover:text-white transition-all"
        >
          {isLogin ? "Don't have an access key? Initialize" : "Already have an access key? Sign In"}
        </button>
      </motion.div>
    </div>
  );
}

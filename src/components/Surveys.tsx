import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { ManualTask, UserProfile, Language } from '../types';
import { ClipboardList, ExternalLink, ChevronRight, X, Loader2, Camera, QrCode, Send, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Surveys({ profile, showStatus, language, t }: { profile: UserProfile | null; showStatus: (t: string, type: 'success' | 'error') => void; language: Language; t: any }) {
  const [tasks, setTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskUrl, setActiveTaskUrl] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  
  // Submission State
  const [submittingTask, setSubmittingTask] = useState<ManualTask | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'manual_tasks'), where('active', '==', true), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ManualTask[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ManualTask);
      });
      setTasks(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'manual_tasks');
    });
    return () => unsubscribe();
  }, []);

  const getFinalUrl = (task: ManualTask) => {
    if (!profile) return '';
    let finalUrl = task.url;
    const separator = finalUrl.includes('?') ? '&' : '?';
    return `${finalUrl}${separator}uid=${profile.uid}`;
  };

  const handleStartTask = (task: ManualTask) => {
    if (!profile) return;
    setIframeLoading(true);
    setActiveTaskUrl(getFinalUrl(task));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'screenshot' | 'qr') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'screenshot') setScreenshot(reader.result as string);
      else setQrCode(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!profile || !submittingTask || !screenshot || !qrCode) {
      showStatus('Please upload both screenshot and QR code', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'task_submissions'), {
        task_id: submittingTask.id,
        task_title: submittingTask.title,
        user_id: profile.uid,
        user_name: profile.display_name,
        screenshot_url: screenshot,
        qr_url: qrCode,
        status: 'pending',
        payout_usd: submittingTask.user_reward_usd,
        admin_profit_usd: submittingTask.payout_usd * 0.55,
        timestamp: serverTimestamp()
      });

      showStatus('Proof submitted! Admin will verify soon.', 'success');
      setSubmittingTask(null);
      setScreenshot(null);
      setQrCode(null);
    } catch (err) {
      showStatus('Submission failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [showStagingModal, setShowStagingModal] = useState(false);

  return (
    <div className="flex flex-col gap-12 max-w-4xl mx-auto py-8">
      <div className="flex flex-col gap-4 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-3 text-zinc-600">
          <div className="h-[1px] w-8 bg-zinc-800" />
          <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Market Intelligence</span>
        </div>
        <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-white leading-[0.9]">
          Premium<br />Opportunities
        </h2>
        <p className="text-zinc-500 text-sm font-medium tracking-wide max-w-md">
          High-priority task verification terminals for verified specialists.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowStagingModal(true)}
          className="pro-border rounded-[2.5rem] p-10 flex flex-col gap-8 group cursor-pointer bg-zinc-900/10 hover:bg-zinc-900/30 transition-all duration-500 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <ClipboardList size={80} />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all duration-500">
            <ClipboardList size={28} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-2xl font-black text-white tracking-tighter">Terminal Alpha</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">
              Primary task verification node for high-priority activity auditing.
            </p>
          </div>
          <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Status: Staging</span>
            </div>
            <ChevronRight size={18} className="text-zinc-700 group-hover:text-white transition-colors" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowStagingModal(true)}
          className="pro-border rounded-[2.5rem] p-10 flex flex-col gap-8 group cursor-pointer bg-zinc-900/10 hover:bg-zinc-900/30 transition-all duration-500 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <ClipboardList size={80} />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all duration-500">
            <ClipboardList size={28} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-2xl font-black text-white tracking-tighter">Terminal Beta</h3>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">
              Secondary verification node for global task auditing and verification.
            </p>
          </div>
          <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Status: Staging</span>
            </div>
            <ChevronRight size={18} className="text-zinc-700 group-hover:text-white transition-colors" />
          </div>
        </motion.div>
      </div>

      {/* Staging Modal */}
      <AnimatePresence>
        {showStagingModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStagingModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm pro-border rounded-[3rem] p-12 flex flex-col items-center text-center gap-10 bg-zinc-900 shadow-2xl"
            >
              <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center text-white">
                <RefreshCw size={48} className="animate-spin-slow opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-3xl font-black text-white tracking-tighter leading-none">Terminal in<br />Staging Mode</h3>
                <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                  Integration scheduled for Production Launch. Audit phase active.
                </p>
              </div>
              <button
                onClick={() => setShowStagingModal(false)}
                className="w-full py-6 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 tracking-[0.2em] text-[10px] uppercase"
              >
                Acknowledge Protocol
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, orderBy, addDoc, serverTimestamp, getDocs, setDoc, deleteDoc, increment, limit, where } from 'firebase/firestore';
import { UserProfile, Survey, Language, AdminFinances, ChatMessage, PayoutHistory, Settlement } from '../types';
import { CheckCircle, XCircle, Copy, Users, DollarSign, Trash2, History, X, Plus, Edit2, Loader2, ExternalLink, TrendingUp, Settings, Shield, MessageSquare, Send, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Admin({ showStatus, language, t }: { showStatus: (t: string, type: 'success' | 'error') => void; language: Language; t: any }) {
  const [activeTab, setActiveTab] = useState<'ledger' | 'tasks' | 'verifications' | 'finances' | 'system' | 'overview' | 'profit_log' | 'vault'>('overview');
  const [vaultKeys, setVaultKeys] = useState({ apiKey: '', secureHash: '' });
  const [savingVault, setSavingVault] = useState(false);

  useEffect(() => {
    const fetchVault = async () => {
      try {
        const q = query(collection(db, 'settings'), where('key', 'in', ['vault_api_key', 'vault_secure_hash']));
        const snapshot = await getDocs(q);
        const keys = { apiKey: '', secureHash: '' };
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.key === 'vault_api_key') keys.apiKey = data.value;
          if (data.key === 'vault_secure_hash') keys.secureHash = data.value;
        });
        setVaultKeys(keys);
      } catch (e) {
        console.error("Vault fetch failed", e);
      }
    };
    fetchVault();
  }, []);

  const handleSaveVault = async () => {
    setSavingVault(true);
    try {
      const batch = writeBatch(db);
      const apiKeyRef = doc(db, 'settings', 'vault_api_key');
      const hashRef = doc(db, 'settings', 'vault_secure_hash');
      
      batch.set(apiKeyRef, { key: 'vault_api_key', value: vaultKeys.apiKey, description: 'Encrypted API Key Storage' }, { merge: true });
      batch.set(hashRef, { key: 'vault_secure_hash', value: vaultKeys.secureHash, description: 'Encrypted Secure Hash Storage' }, { merge: true });
      
      await batch.commit();
      showStatus('Key Vault Updated Successfully', 'success');
    } catch (e: any) {
      showStatus(e.message, 'error');
    } finally {
      setSavingVault(false);
    }
  };
  const [manualTasks, setManualTasks] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [settings, setSettings] = useState<{id: string, key: string, value: string, description?: string}[]>([]);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [finances, setFinances] = useState<AdminFinances | null>(null);
  const [financialOverview, setFinancialOverview] = useState<{ today_profit_usd: number, pending_payments: any[], payout_date: string } | null>(null);
  const [specialists, setSpecialists] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Profit Log State
  const [profitForm, setProfitForm] = useState({
    userId: '',
    amountUsd: 1.0,
    taskName: ''
  });
  const [loggingProfit, setLoggingProfit] = useState(false);
  
  // Specialist Review State
  const [reviewingSpecialist, setReviewingSpecialist] = useState<UserProfile | null>(null);
  const [specialistChat, setSpecialistChat] = useState<ChatMessage[]>([]);
  const [specialistPayouts, setSpecialistPayouts] = useState<PayoutHistory[]>([]);
  const [specialistSettlements, setSpecialistSettlements] = useState<Settlement[]>([]);
  const [adminReply, setAdminReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [settling, setSettling] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Settings Form State
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [editingSetting, setEditingSetting] = useState<{id: string, key: string, value: string, description?: string} | null>(null);
  const [settingForm, setSettingForm] = useState({
    key: '',
    value: '',
    description: ''
  });
  
  // Task Form State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    url: '',
    payout_usd: 1.0,
    user_reward_usd: 0.45,
    active: true
  });

  // Live Reward Calculation
  useEffect(() => {
    const providerPay = taskForm.payout_usd || 0;
    const userShareUsd = providerPay * 0.45;
    
    if (userShareUsd !== taskForm.user_reward_usd) {
      setTaskForm(prev => ({ ...prev, user_reward_usd: userShareUsd }));
    }
  }, [taskForm.payout_usd]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as UserProfile);
      });
      setSpecialists(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'manual_tasks'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setManualTasks(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'manual_tasks');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'task_submissions'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setPendingSubmissions(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'task_submissions');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchEnv = async () => {
      try {
        const res = await fetch('/api/admin/env');
        const data = await res.json();
        setEnvVars(data);
      } catch (e) {
        console.error("Failed to fetch env vars", e);
      }
    };
    if (activeTab === 'system') {
      fetchEnv();
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchFinancialOverview = async () => {
      try {
        const res = await fetch('/api/admin/finances');
        const data = await res.json();
        setFinancialOverview(data);
      } catch (e) {
        console.error("Failed to fetch financial overview", e);
      }
    };
    if (activeTab === 'overview') {
      fetchFinancialOverview();
    }
  }, [activeTab]);

  useEffect(() => {
    const q = query(collection(db, 'settings'), orderBy('key', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setSettings(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'settings');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'admin_finances', 'stats'), (doc) => {
      if (doc.exists()) {
        setFinances(doc.data() as AdminFinances);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'admin_finances/stats');
    });
    return () => unsubscribe();
  }, []);

  const handleCopy = (amount: number) => {
    navigator.clipboard.writeText(amount.toString());
    showStatus(`Copied $${amount.toLocaleString()} to clipboard`, 'success');
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [specialistChat]);

  useEffect(() => {
    if (!reviewingSpecialist) {
      setSpecialistChat([]);
      return;
    }

    const chatQ = query(
      collection(db, 'chats', reviewingSpecialist.uid, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    
    const unsubscribe = onSnapshot(chatQ, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setSpecialistChat(msgs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `chats/${reviewingSpecialist.uid}/messages`);
    });

    return () => unsubscribe();
  }, [reviewingSpecialist?.uid]);

  const handleReviewSpecialist = async (specialist: UserProfile) => {
    setReviewingSpecialist(specialist);
    
    try {
      // Fetch Payout History (Surveys)
      const payoutQ = query(
        collection(db, 'users', specialist.uid, 'payout_history'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const payoutSnap = await getDocs(payoutQ);
      const payouts: PayoutHistory[] = [];
      payoutSnap.forEach((doc) => {
        payouts.push({ id: doc.id, ...doc.data() } as PayoutHistory);
      });
      setSpecialistPayouts(payouts);

      // Fetch Settlement History (Cash)
      const settlementQ = query(
        collection(db, 'users', specialist.uid, 'settlements'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const settlementSnap = await getDocs(settlementQ);
      const settlements: Settlement[] = [];
      settlementSnap.forEach((doc) => {
        settlements.push({ id: doc.id, ...doc.data() } as Settlement);
      });
      setSpecialistSettlements(settlements);
    } catch (error: any) {
      showStatus("Failed to fetch specialist history", 'error');
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingSpecialist || !adminReply.trim()) return;

    setSendingReply(true);
    try {
      await addDoc(collection(db, 'chats', reviewingSpecialist.uid, 'messages'), {
        text: adminReply.trim(),
        sender_id: 'admin',
        timestamp: serverTimestamp(),
        is_admin: true
      });
      setAdminReply('');
    } catch (error: any) {
      showStatus(error.message, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!reviewingSpecialist) return;
    const amount = reviewingSpecialist.verified_balance;
    if (amount <= 0) {
      showStatus("Balance is zero", 'error');
      return;
    }

    if (!window.confirm(`Mark ${reviewingSpecialist.display_name} as paid $${amount.toLocaleString()}?`)) return;

    setSettling(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Reset user balance
      const userRef = doc(db, 'users', reviewingSpecialist.uid);
      batch.update(userRef, {
        verified_balance: 0,
        aba_status: false
      });

      // 2. Log settlement
      const settlementRef = doc(collection(db, 'users', reviewingSpecialist.uid, 'settlements'));
      batch.set(settlementRef, {
        amount: amount,
        timestamp: serverTimestamp(),
        admin_uid: auth.currentUser?.uid,
        status: 'paid'
      });

      // 3. Update admin stats (Total Payout)
      const statsRef = doc(db, 'admin_finances', 'stats');
      batch.update(statsRef, {
        total_payout_usd: increment(amount),
        last_updated: serverTimestamp()
      });

      await batch.commit();
      showStatus('Settlement Recorded Successfully', 'success');
      setReviewingSpecialist(null);
    } catch (error: any) {
      showStatus(error.message, 'error');
    } finally {
      setSettling(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const providerPay = taskForm.payout_usd || 1.0;
      const userShareUsd = providerPay * 0.45;

      const finalTaskData = {
        ...taskForm,
        payout_usd: providerPay,
        user_reward_usd: userShareUsd,
        updated_at: serverTimestamp()
      };

      if (editingTask) {
        await updateDoc(doc(db, 'manual_tasks', editingTask.id), finalTaskData);
        showStatus('Task Updated (55/45 Split Applied)', 'success');
      } else {
        await addDoc(collection(db, 'manual_tasks'), {
          ...finalTaskData,
          created_at: serverTimestamp()
        });
        showStatus('Task Created (55/45 Split Applied)', 'success');
      }
      setShowTaskForm(false);
      setEditingTask(null);
      setTaskForm({
        title: '',
        url: '',
        payout_usd: 1.0,
        user_reward_usd: 0.45,
        active: true
      });
    } catch (error: any) {
      showStatus(error.message, 'error');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'manual_tasks', id));
      showStatus('Task Deleted', 'success');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `manual_tasks/${id}`);
    }
  };

  const handleApproveSubmission = async (submission: any) => {
    if (!window.confirm(`Approve submission for ${submission.user_name}? This will release $${submission.payout_usd.toLocaleString()}.`)) return;
    
    try {
      const res = await fetch('/api/admin/approve-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          adminUid: auth.currentUser?.uid
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve task');
      }

      showStatus('Task Approved & Funds Released', 'success');
    } catch (error: any) {
      showStatus(error.message, 'error');
    }
  };

  const handleRejectSubmission = async (id: string) => {
    if (!window.confirm('Reject this submission?')) return;
    try {
      await updateDoc(doc(db, 'task_submissions', id), {
        status: 'rejected',
        rejected_at: serverTimestamp(),
        rejected_by: auth.currentUser?.uid
      });
      showStatus('Submission Rejected', 'success');
    } catch (error: any) {
      showStatus(error.message, 'error');
    }
  };

  const handleLogProfit = async () => {
    if (!profitForm.userId || !profitForm.taskName) {
      showStatus('Please fill all fields', 'error');
      return;
    }

    setLoggingProfit(true);
    try {
      const user = specialists.find(s => s.uid === profitForm.userId);
      if (!user) throw new Error('User not found');

      const batch = writeBatch(db);
      
      // 1. Credit User ($0.45)
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        verified_balance: increment(0.45)
      });

      // 2. Log Admin Profit ($0.55)
      const profitLogRef = doc(collection(db, 'admin_finances_logs'));
      batch.set(profitLogRef, {
        amount_usd: 0.55,
        task_name: profitForm.taskName,
        user_id: user.uid,
        user_name: user.display_name,
        timestamp: serverTimestamp()
      });

      // 3. Update Total Admin Profit
      const financesRef = doc(db, 'admin_finances', 'totals');
      batch.set(financesRef, {
        total_profit_usd: increment(0.55)
      }, { merge: true });

      // 4. Add to User Payout History
      const historyRef = doc(collection(db, 'users', user.uid, 'payout_history'));
      batch.set(historyRef, {
        amount: 0.45,
        task_name: profitForm.taskName,
        timestamp: serverTimestamp(),
        type: 'manual_task'
      });

      await batch.commit();
      showStatus('Profit logged and user credited', 'success');
      setProfitForm({ userId: '', amountUsd: 1.0, taskName: '' });
    } catch (error: any) {
      showStatus(error.message, 'error');
    } finally {
      setLoggingProfit(false);
    }
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...settingForm,
        updated_at: serverTimestamp()
      };

      if (editingSetting) {
        await updateDoc(doc(db, 'settings', editingSetting.id), data);
        showStatus('Setting Updated', 'success');
      } else {
        await addDoc(collection(db, 'settings'), {
          ...data,
          created_at: serverTimestamp()
        });
        showStatus('Setting Created', 'success');
      }
      setShowSettingsForm(false);
      setEditingSetting(null);
      setSettingForm({ key: '', value: '', description: '' });
    } catch (error: any) {
      showStatus(error.message, 'error');
    }
  };

  const handleDeleteSetting = async (id: string) => {
    if (!window.confirm('Delete this setting?')) return;
    try {
      await deleteDoc(doc(db, 'settings', id));
      showStatus('Setting Deleted', 'success');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `settings/${id}`);
    }
  };

  if (loading) return <div className="loading-bar w-full" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tighter text-white">Admin Terminal</h2>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase">LuyLuy Pro Oversight</p>
      </div>

      {/* Admin Tabs */}
      <div className="flex gap-2 p-1 glass rounded-xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('profit_log')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'profit_log' ? 'bg-green-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Profit Log
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'ledger' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Ledger
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Task Manager
        </button>
        <button
          onClick={() => setActiveTab('verifications')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'verifications' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Verifications
        </button>
        <button
          onClick={() => setActiveTab('finances')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'finances' ? 'bg-green-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Finances
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'system' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          System
        </button>
        <button
          onClick={() => setActiveTab('vault')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'vault' ? 'bg-blue-900 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Key Vault
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center border-indigo-500/20">
              <div className="p-4 bg-indigo-500/10 text-indigo-500 rounded-full">
                <TrendingUp size={48} />
              </div>
              <div className="flex flex-col">
                <span className="text-4xl font-black text-white">
                  ${financialOverview?.today_profit_usd?.toFixed(2) || '0.00'}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Today's 55% Profit (USD)</span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center border-blue-500/20">
              <div className="p-4 bg-blue-500/10 text-blue-500 rounded-full">
                <History size={48} />
              </div>
              <div className="flex flex-col">
                <span className="text-4xl font-black text-white">
                  {financialOverview?.payout_date || '25th'}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Next Payout Cycle</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white tracking-widest uppercase">Pending Payments</h3>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/50 border-b border-zinc-800">
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Specialist</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Balance (USD)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">ABA Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {(!financialOverview?.pending_payments || financialOverview?.pending_payments?.length === 0) ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                          No pending payments found.
                        </td>
                      </tr>
                    ) : (
                      financialOverview?.pending_payments?.map((p) => (
                        <tr key={p.uid} className="hover:bg-zinc-900/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-white">{p.display_name}</span>
                              <span className="text-[10px] text-zinc-500 font-medium">{p.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-blue-500">${(p.verified_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`inline-flex p-1.5 rounded-lg ${p.aba_status ? 'bg-green-500/10 text-green-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                              {p.aba_status ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopy(p.verified_balance)}
                                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleReviewSpecialist(p)}
                                className="p-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest"
                              >
                                <Shield size={14} />
                                Review
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="flex flex-col gap-4">
          {specialists.map((s) => (
            <motion.div
              key={s.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h4 className="font-bold text-white">{s.display_name}</h4>
                  <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">{s.email}</p>
                </div>
                <div className={`p-2 rounded-lg ${s.aba_status ? 'bg-green-500/10 text-green-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                  {s.aba_status ? <CheckCircle size={16} /> : <XCircle size={16} />}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Verified Balance</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white">
                      ${(s.verified_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReviewSpecialist(s)}
                    className="p-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 rounded-xl transition-all active:scale-95 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                  >
                    <Shield size={16} />
                    Review
                  </button>
                  <button
                    onClick={() => handleCopy(s.verified_balance)}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition-all active:scale-95"
                    title="Copy Amount"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              setEditingTask(null);
              setTaskForm({
                title: '',
                url: '',
                payout_usd: 1.0,
                user_reward_usd: 0.45,
                active: true
              });
              setShowTaskForm(true);
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            ADD NEW MANUAL TASK
          </button>

          {manualTasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h4 className="font-bold text-white">{task.title}</h4>
                  <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase truncate max-w-[200px]">
                    {task.url}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingTask(task);
                      setTaskForm(task);
                      setShowTaskForm(true);
                    }}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">User Reward</span>
                  <span className="text-sm font-black text-white">${task.user_reward_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Provider Pay</span>
                  <span className="text-sm font-black text-green-500">${task.payout_usd.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'verifications' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white tracking-widest uppercase">Pending Verifications</h3>
          {pendingSubmissions.filter(s => s.status === 'pending').length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
              No pending verifications.
            </div>
          ) : (
            pendingSubmissions.filter(s => s.status === 'pending').map((sub) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-6 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-bold text-white">{sub.task_title}</h4>
                    <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
                      By: {sub.user_name}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-orange-500/10 text-orange-500 text-[8px] font-bold uppercase tracking-widest rounded-full">
                    Pending
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Screenshot</span>
                    {sub.screenshot_url ? (
                      <a href={sub.screenshot_url} target="_blank" rel="noreferrer" className="relative group rounded-xl overflow-hidden aspect-video bg-zinc-900 border border-zinc-800">
                        <img src={sub.screenshot_url} alt="Proof" className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink size={24} className="text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-video bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-700">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">QR Code</span>
                    {sub.qr_url ? (
                      <a href={sub.qr_url} target="_blank" rel="noreferrer" className="relative group rounded-xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800">
                        <img src={sub.qr_url} alt="QR" className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink size={24} className="text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-square bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-700">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => handleApproveSubmission(sub)}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Confirm & Pay
                  </button>
                  <button
                    onClick={() => handleRejectSubmission(sub.id)}
                    className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all"
                  >
                    Reject
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {activeTab === 'finances' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Total Revenue (100%)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">${finances?.total_revenue_usd?.toFixed(2) || '0.00'}</span>
                <span className="text-xs font-bold text-zinc-500">USD</span>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Total Payout (45%)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-blue-500">${finances?.total_payout_usd?.toFixed(2) || '0.00'}</span>
                <span className="text-xs font-bold text-zinc-500">USD</span>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-2 border-green-500/20">
              <span className="text-[10px] font-bold text-green-500 tracking-widest uppercase">Net Profit</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-green-500">${finances?.total_profit_usd?.toFixed(2) || '0.00'}</span>
                <span className="text-xs font-bold text-green-500">USD</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-white tracking-widest uppercase">API Integration Status</h4>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">CPX Research</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${process.env.CPX_APP_ID ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {process.env.CPX_APP_ID ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">BitLabs</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${process.env.BITLABS_API_TOKEN ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {process.env.BITLABS_API_TOKEN ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-white tracking-widest uppercase">Revenue Model</h4>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Admin Profit</span>
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest">55%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">User Reward</span>
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest">45%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 bg-green-500/10 text-green-500 rounded-full">
              <TrendingUp size={48} />
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-black text-white">
                ${finances?.total_profit_usd?.toFixed(2) || '0.00'}
              </span>
              <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Total Admin Profit (USD)</span>
            </div>
            <p className="text-[10px] text-zinc-600 mt-4 uppercase tracking-widest">
              Last Updated: {finances?.last_updated?.toDate().toLocaleString() || 'N/A'}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'profit_log' && (
        <div className="flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-bold text-white tracking-tight">Manual Profit Entry</h3>
              <p className="specialist-label">Log task completion & credit user</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="specialist-label">Select Specialist</label>
                <select
                  value={profitForm.userId}
                  onChange={(e) => setProfitForm({ ...profitForm, userId: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">Select User...</option>
                  {specialists.map(s => (
                    <option key={s.uid} value={s.uid}>{s.display_name} ({s.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="specialist-label">Task Name</label>
                <input
                  type="text"
                  value={profitForm.taskName}
                  onChange={(e) => setProfitForm({ ...profitForm, taskName: e.target.value })}
                  placeholder="e.g. CPX Survey #123"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="specialist-label">Admin Profit</label>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-green-500 font-bold">
                    $0.55
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="specialist-label">User Reward</label>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-blue-500 font-bold">
                    $0.45
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogProfit}
                disabled={loggingProfit}
                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loggingProfit ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                LOG PROFIT & CREDIT USER
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vault' && (
        <div className="flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-10 flex flex-col gap-8 border-zinc-800/50">
            <div className="flex flex-col gap-2">
              <h3 className="text-2xl font-black text-white tracking-tighter">Secure Key Vault</h3>
              <p className="specialist-label">Encrypted storage for production API credentials</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Production API Key</label>
                <input
                  type="password"
                  value={vaultKeys.apiKey}
                  onChange={(e) => setVaultKeys({ ...vaultKeys, apiKey: e.target.value })}
                  placeholder="Paste API_KEY here..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Secure Hash / Secret</label>
                <input
                  type="password"
                  value={vaultKeys.secureHash}
                  onChange={(e) => setVaultKeys({ ...vaultKeys, secureHash: e.target.value })}
                  placeholder="Paste SECURE_HASH here..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                />
              </div>

              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                <p className="text-[10px] font-medium text-blue-400 leading-relaxed italic">
                  * Note: These keys are stored in your private Firestore settings and will be used to initialize production terminals once the audit phase is complete.
                </p>
              </div>

              <button
                onClick={handleSaveVault}
                disabled={savingVault}
                className="w-full bg-white text-black font-bold py-5 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest"
              >
                {savingVault ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
                Commit to Secure Vault
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'system' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-widest uppercase">Dynamic Configuration</h3>
              <button
                onClick={() => {
                  setEditingSetting(null);
                  setSettingForm({ key: '', value: '', description: '' });
                  setShowSettingsForm(true);
                }}
                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(settings?.length === 0) && (
                <div className="glass-card rounded-2xl p-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                  No dynamic settings configured.
                </div>
              )}
              {settings.map((s) => (
                <div key={s.id} className="glass-card rounded-2xl p-6 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">{s.key}</span>
                      <span className="text-sm font-bold text-white break-all">{s.value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingSetting(s);
                          setSettingForm({ key: s.key, value: s.value, description: s.description || '' });
                          setShowSettingsForm(true);
                        }}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteSetting(s.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {s.description && (
                    <p className="text-[10px] text-zinc-500 font-medium">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white tracking-widest uppercase">Environment Variables</h3>
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-3">
              {Object.entries(envVars || {}).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1 py-2 border-b border-zinc-800/50 last:border-0">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{key}</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white break-all">{value || 'NOT SET'}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(value);
                        showStatus(`${key} copied`, 'success');
                      }}
                      className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 italic px-2">
              Note: These are server-side variables. To update them, use the AI Studio Secrets panel.
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence mode="wait">
        {reviewingSpecialist && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewingSpecialist(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-5xl h-[85vh] glass-card rounded-3xl overflow-hidden flex flex-col border-zinc-800/50"
            >
              {/* Review Header */}
              <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-black">
                    {reviewingSpecialist.display_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-xl font-black text-white">{reviewingSpecialist.display_name}</h3>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{reviewingSpecialist.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end mr-4">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Verified Balance</span>
                    <span className="text-2xl font-black text-white">${(reviewingSpecialist.verified_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <button 
                    onClick={handleMarkAsPaid}
                    disabled={settling || reviewingSpecialist.verified_balance <= 0}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:bg-zinc-800 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2"
                  >
                    {settling ? <Loader2 size={18} className="animate-spin" /> : <DollarSign size={18} />}
                    MARK AS PAID
                  </button>
                  <button onClick={() => setReviewingSpecialist(null)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500">
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Review Content */}
              <div className="flex-1 flex overflow-hidden">
                {/* Chat History */}
                <div className="flex-1 flex flex-col border-r border-zinc-800">
                  <div className="p-4 bg-zinc-900/30 border-b border-zinc-800 flex items-center gap-2">
                    <MessageSquare size={14} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Chat History & QR Codes</span>
                  </div>
                  <div 
                    ref={chatScrollRef}
                    className="flex-1 overflow-y-auto p-6 flex flex-col gap-4"
                  >
                    {specialistChat?.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] flex flex-col gap-1 ${msg.is_admin ? 'items-end' : 'items-start'}`}>
                          <div className={`p-4 rounded-2xl text-sm ${
                            msg.is_admin 
                              ? 'bg-blue-600 text-white rounded-tr-none' 
                              : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                          }`}>
                            {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                            {msg.image_url && (
                              <img 
                                src={msg.image_url} 
                                alt="QR Code" 
                                className="max-w-full rounded-lg mt-2 border border-white/10"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                            {msg.timestamp?.toDate().toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Admin Reply Input */}
                  <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
                    <form onSubmit={handleSendAdminReply} className="flex gap-2">
                      <input
                        type="text"
                        value={adminReply}
                        onChange={(e) => setAdminReply(e.target.value)}
                        placeholder="Send a message to specialist..."
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !adminReply.trim()}
                        className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-all"
                      >
                        {sendingReply ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                      </button>
                    </form>
                  </div>
                </div>

                {/* History Sidebar */}
                <div className="w-80 flex flex-col bg-zinc-900/20">
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 bg-zinc-900/30 border-b border-zinc-800 flex items-center gap-2">
                      <History size={14} className="text-indigo-500" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Survey History</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                      {specialistPayouts?.map((p) => (
                        <div key={p.id} className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-800 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{p.survey_id}</span>
                            <span className="text-[10px] font-black text-green-500">+${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <span className="text-[8px] text-zinc-500 font-bold uppercase">{p.timestamp?.toDate().toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col border-t border-zinc-800 overflow-hidden">
                    <div className="p-4 bg-zinc-900/30 border-b border-zinc-800 flex items-center gap-2">
                      <DollarSign size={14} className="text-green-500" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Cash Settlements</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                      {specialistSettlements?.map((s) => (
                        <div key={s.id} className="p-3 bg-green-500/5 rounded-xl border border-green-500/10 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-white">${s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className="text-[8px] font-bold text-green-500 uppercase">PAID</span>
                          </div>
                          <span className="text-[8px] text-zinc-500 font-bold uppercase">{s.timestamp?.toDate().toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSettingsForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsForm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="settings-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md glass-card rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">{editingSetting ? 'Edit Setting' : 'Add Setting'}</h3>
                <button onClick={() => setShowSettingsForm(false)} className="p-2 hover:bg-zinc-800 rounded-xl">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSetting} className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Key Name</label>
                  <input
                    type="text"
                    value={settingForm.key}
                    onChange={(e) => setSettingForm({ ...settingForm, key: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. CPX_OVERRIDE_URL"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Value / Link</label>
                  <textarea
                    value={settingForm.value}
                    onChange={(e) => setSettingForm({ ...settingForm, value: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
                    placeholder="Paste your link or key here..."
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={settingForm.description}
                    onChange={(e) => setSettingForm({ ...settingForm, description: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="What is this for?"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-4 active:scale-95 transition-all"
                >
                  {editingSetting ? 'UPDATE SETTING' : 'SAVE SETTING'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showTaskForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="task-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTaskForm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="task-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md glass-card rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">{editingTask ? 'Edit Task' : 'Add New Task'}</h3>
                <button onClick={() => setShowTaskForm(false)} className="p-2 hover:bg-zinc-800 rounded-xl">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Task Name</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Follow on Twitter"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Direct Link URL</label>
                  <input
                    type="url"
                    value={taskForm.url}
                    onChange={(e) => setTaskForm({ ...taskForm, url: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="https://example.com/task"
                    required
                  />
                  <p className="text-[8px] text-zinc-600 font-bold tracking-widest uppercase mt-1">System will automatically append &uid=${'{currentUser.uid}'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase ml-1">Payout ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={taskForm.payout_usd}
                      onChange={(e) => setTaskForm({ ...taskForm, payout_usd: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                      placeholder="1.00"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-blue-500 tracking-widest uppercase ml-1">User Reward ($ USD)</label>
                    <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-500 font-black">
                      ${taskForm.user_reward_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={taskForm.active}
                    onChange={(e) => setTaskForm({ ...taskForm, active: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-blue-600"
                  />
                  <label htmlFor="active" className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Active Task</label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-4 active:scale-95 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                >
                  {editingTask ? 'UPDATE TASK' : 'SAVE TASK'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

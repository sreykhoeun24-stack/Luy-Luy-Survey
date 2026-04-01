import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { UserProfile, Language, PayoutHistory, Settlement } from '../types';
import { DollarSign, History, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard({ profile, language, t }: { profile: UserProfile | null; showStatus: (t: string, type: 'success' | 'error') => void; language: Language; t: any }) {
  const [history, setHistory] = useState<(PayoutHistory | Settlement)[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const payoutQ = query(
      collection(db, 'users', profile.uid, 'payout_history'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const settlementQ = query(
      collection(db, 'users', profile.uid, 'settlements'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubPayout = onSnapshot(payoutQ, (snapshot) => {
      const payouts = snapshot.docs.map(d => ({ id: d.id, ...d.data(), type: 'payout' } as any));
      updateHistory(payouts, 'payout');
    });

    const unsubSettlement = onSnapshot(settlementQ, (snapshot) => {
      const settlements = snapshot.docs.map(d => ({ id: d.id, ...d.data(), type: 'settlement' } as any));
      updateHistory(settlements, 'settlement');
    });

    const updateHistory = (items: any[], type: string) => {
      setHistory(prev => {
        const otherType = type === 'payout' ? 'settlement' : 'payout';
        const others = prev.filter((i: any) => i.type === otherType);
        const combined = [...items, ...others].sort((a, b) => {
          const timeA = a.timestamp?.seconds || 0;
          const timeB = b.timestamp?.seconds || 0;
          return timeB - timeA;
        });
        return combined.slice(0, 20);
      });
      setLoadingHistory(false);
    };

    return () => {
      unsubPayout();
      unsubSettlement();
    };
  }, [profile?.uid]);

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto py-8">
      {/* Branding Header */}
      <div className="flex flex-col gap-4 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-3 text-zinc-600">
          <div className="h-[1px] w-8 bg-zinc-800" />
          <span className="text-[9px] font-bold tracking-[0.4em] uppercase">Moeun Chey Terminal</span>
        </div>
        <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-white leading-[0.9]">
          Specialist<br />Wallet
        </h2>
      </div>

      {/* Wallet Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pro-border rounded-[2.5rem] p-12 flex flex-col gap-6 relative overflow-hidden bg-zinc-900/10"
      >
        <div className="absolute top-0 right-0 p-12 opacity-[0.02]">
          <DollarSign size={140} />
        </div>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
            <Wallet size={24} />
          </div>
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">{t.wallet}</span>
        </div>
        <div className="h-[1px] w-12 bg-zinc-800 my-2" />
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-zinc-600 italic">$</span>
          <span className="text-7xl font-black tracking-tighter text-white">
            {profile.verified_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mt-4">{t.verified_balance}</p>
      </motion.div>

      {/* History Section */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <History size={16} className="text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{t.history}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="pro-border rounded-3xl p-12 text-center bg-zinc-900/5">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">No transaction history found</p>
            </div>
          ) : (
            history.map((item: any) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="pro-border rounded-2xl p-6 flex items-center justify-between bg-zinc-900/5 hover:bg-zinc-900/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${item.type === 'payout' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {item.type === 'payout' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white tracking-tight">
                      {item.type === 'payout' ? (item.source || 'Task Reward') : 'Settlement Payout'}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                      {item.timestamp?.toDate().toLocaleDateString()} • {item.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-lg font-black tracking-tighter ${item.type === 'payout' ? 'text-green-500' : 'text-white'}`}>
                    {item.type === 'payout' ? '+' : '-'}${item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">USD</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

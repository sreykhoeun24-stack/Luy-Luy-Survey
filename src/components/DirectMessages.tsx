import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  limit,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { UserProfile, Language, Conversation, ChatMessage } from '../types';
import { 
  MessageSquare, 
  Send, 
  ArrowLeft, 
  MoreVertical, 
  Search, 
  Clock, 
  CheckCheck,
  User,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DirectMessages({ 
  profile, 
  showStatus, 
  language, 
  t,
  initialChatUserId,
  onChatOpened
}: { 
  profile: UserProfile | null; 
  showStatus: (t: string, type: 'success' | 'error') => void; 
  language: Language; 
  t: any;
  initialChatUserId?: string | null;
  onChatOpened?: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', profile.uid),
      orderBy('last_timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      setConversations(convs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (initialChatUserId && profile && conversations.length > 0) {
      const existing = conversations.find(c => c.participants.includes(initialChatUserId));
      if (existing) {
        setSelectedConv(existing);
        onChatOpened?.();
      } else {
        // Create new conversation
        const createConv = async () => {
          try {
            const convId = [profile.uid, initialChatUserId].sort().join('_');
            const convRef = doc(db, 'conversations', convId);
            const snap = await getDoc(convRef);
            
            if (!snap.exists()) {
              await setDoc(convRef, {
                participants: [profile.uid, initialChatUserId],
                last_message: 'New conversation started',
                last_timestamp: serverTimestamp(),
                unread_count: { [profile.uid]: 0, [initialChatUserId]: 0 }
              });
            }
            
            setSelectedConv({
              id: convId,
              participants: [profile.uid, initialChatUserId],
              last_message: 'New conversation started',
              last_timestamp: serverTimestamp(),
              unread_count: { [profile.uid]: 0, [initialChatUserId]: 0 }
            });
            onChatOpened?.();
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'conversations');
          }
        };
        createConv();
      }
    }
  }, [initialChatUserId, profile, conversations]);

  useEffect(() => {
    if (!selectedConv) return;

    const q = query(
      collection(db, 'conversations', selectedConv.id, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)).reverse();
      setMessages(msgs);
      
      // Mark as read
      if (selectedConv.unread_count?.[profile?.uid || ''] > 0) {
        updateDoc(doc(db, 'conversations', selectedConv.id), {
          [`unread_count.${profile?.uid}`]: 0
        });
      }
    });

    return () => unsubscribe();
  }, [selectedConv, profile]);

  const handleSendMessage = async () => {
    if (!profile || !selectedConv || !newMessage.trim()) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      const msgData = {
        sender_id: profile.uid,
        text: msgText,
        timestamp: serverTimestamp(),
        is_admin: profile.role === 'admin'
      };

      await addDoc(collection(db, 'conversations', selectedConv.id, 'messages'), msgData);

      const otherId = selectedConv.participants.find(id => id !== profile.uid);
      await updateDoc(doc(db, 'conversations', selectedConv.id), {
        last_message: msgText,
        last_timestamp: serverTimestamp(),
        [`unread_count.${otherId}`]: (selectedConv.unread_count?.[otherId || ''] || 0) + 1
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${selectedConv.id}/messages`);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <AnimatePresence mode="wait">
        {!selectedConv ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-4xl font-black tracking-tighter text-white">MESSAGES</h2>
              <p className="specialist-label">Direct Peer Communication</p>
            </div>

            <div className="flex flex-col gap-2">
              {conversations.length === 0 ? (
                <div className="pro-border rounded-3xl p-12 flex flex-col items-center justify-center gap-4 opacity-20">
                  <MessageSquare size={48} />
                  <p className="text-xs font-bold tracking-widest uppercase">No active chats</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <ConversationItem 
                    key={conv.id} 
                    conv={conv} 
                    profile={profile} 
                    onClick={() => setSelectedConv(conv)} 
                  />
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full pro-border rounded-3xl overflow-hidden bg-zinc-950/50"
          >
            {/* Chat Header */}
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedConv(null)}
                  className="p-2 -ml-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <ChatPartnerInfo conv={selectedConv} profile={profile} />
              </div>
              <button className="p-2 text-zinc-700 hover:text-white transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div 
                  key={msg.id || idx}
                  className={`flex ${msg.sender_id === profile?.uid ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    msg.sender_id === profile?.uid 
                      ? 'bg-white text-black font-medium' 
                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                  }`}>
                    {msg.text}
                    <div className={`text-[8px] mt-1 uppercase font-bold tracking-widest ${
                      msg.sender_id === profile?.uid ? 'text-black/40' : 'text-zinc-600'
                    }`}>
                      {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-zinc-900 bg-black/20">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-900 border-none rounded-2xl px-6 py-4 text-white placeholder-zinc-700 focus:ring-1 focus:ring-white/20 transition-all"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-5 bg-white text-black rounded-2xl hover:bg-zinc-200 transition-all active:scale-90 disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConversationItem({ conv, profile, onClick }: { conv: Conversation; profile: UserProfile | null; onClick: () => void }) {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const otherId = conv.participants.find(id => id !== profile?.uid);
  const unreadCount = conv.unread_count?.[profile?.uid || ''] || 0;

  useEffect(() => {
    if (!otherId) return;
    getDoc(doc(db, 'users', otherId)).then(snap => {
      if (snap.exists()) setPartner(snap.data() as UserProfile);
    });
  }, [otherId]);

  if (!partner) return null;

  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-between p-6 hover:bg-white/5 rounded-3xl transition-all group pro-border border-transparent hover:border-zinc-900"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden">
          {partner.qr_url ? (
            <img src={partner.qr_url} alt={partner.display_name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
          ) : (
            <span className="text-lg font-bold text-zinc-500">{partner.display_name[0]}</span>
          )}
        </div>
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{partner.display_name}</span>
            {partner.role === 'admin' && <ShieldCheck size={12} className="text-zinc-500" />}
          </div>
          <p className="text-xs text-zinc-600 line-clamp-1 font-medium">{conv.last_message}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
          {conv.last_timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {unreadCount > 0 && (
          <div className="px-2 py-1 bg-white text-black text-[10px] font-black rounded-full min-w-[20px] flex items-center justify-center">
            {unreadCount}
          </div>
        )}
      </div>
    </button>
  );
}

function ChatPartnerInfo({ conv, profile }: { conv: Conversation; profile: UserProfile | null }) {
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const otherId = conv.participants.find(id => id !== profile?.uid);

  useEffect(() => {
    if (!otherId) return;
    getDoc(doc(db, 'users', otherId)).then(snap => {
      if (snap.exists()) setPartner(snap.data() as UserProfile);
    });
  }, [otherId]);

  if (!partner) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden">
        {partner.qr_url ? (
          <img src={partner.qr_url} alt={partner.display_name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-zinc-500">{partner.display_name[0]}</span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-white">{partner.display_name}</span>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Active Now</span>
        </div>
      </div>
    </div>
  );
}

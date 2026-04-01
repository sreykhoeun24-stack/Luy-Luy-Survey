import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, getDocs } from 'firebase/firestore';
import { ChatMessage, UserProfile, Language } from '../types';
import { Send, Image as ImageIcon, Loader2, MessageSquare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatHub({ profile, language, showStatus }: { profile: UserProfile | null; language: Language; showStatus: (t: string, type: 'success' | 'error') => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const welcomeMessageEn = "Welcome to Moeun Chey Dry Port Specialists! Please send your Task Completion Screenshot and QR Code (ABA/Wing) here for manual verification.\n\nNote: Rewards are processed within 24 hours of verification.";
  const welcomeMessageKm = "សូមស្វាគមន៍មកកាន់ Moeun Chey Dry Port Specialists! សូមផ្ញើ Screenshot បញ្ចប់ភារកិច្ច និង QR Code (ABA/Wing) របស់អ្នកនៅទីនេះសម្រាប់ការផ្ទៀងផ្ទាត់ដោយដៃ។\n\nចំណាំ៖ រង្វាន់ត្រូវបានដំណើរការក្នុងរយៈពេល ២៤ ម៉ោងបន្ទាប់ពីការផ្ទៀងផ្ទាត់។";

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'chats', profile.uid, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(msgs);
      setLoading(false);

      // Auto-Welcome Logic: If no messages exist, send the welcome message
      if (msgs.length === 0) {
        sendWelcomeMessage();
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `chats/${profile.uid}/messages`);
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendWelcomeMessage = async () => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'chats', profile.uid, 'messages'), {
        text: `${welcomeMessageEn}\n\n${welcomeMessageKm}`,
        sender_id: 'system',
        timestamp: serverTimestamp(),
        is_admin: true
      });
    } catch (e) {
      console.error("Failed to send welcome message", e);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!profile || (!inputText.trim())) return;

    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'chats', profile.uid, 'messages'), {
        text,
        sender_id: profile.uid,
        timestamp: serverTimestamp(),
        is_admin: false
      });
    } catch (error: any) {
      showStatus(error.message, 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await addDoc(collection(db, 'chats', profile.uid, 'messages'), {
            image_url: base64,
            sender_id: profile.uid,
            timestamp: serverTimestamp(),
            is_admin: false
          });
          setUploading(false);
          showStatus("Proof uploaded successfully", 'success');
        } catch (err: any) {
          showStatus("Image too large or upload failed", 'error');
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      showStatus(error.message, 'error');
      setUploading(false);
    }
  };

  if (loading) return <div className="loading-bar w-full" />;

  return (
    <div className="flex flex-col h-[600px] glass-card rounded-3xl overflow-hidden border-zinc-800/50">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
            <MessageSquare size={20} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-white tracking-tight uppercase">Verification Hub</h3>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online • Specialist Verification Active</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scroll-smooth"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`max-w-[80%] flex flex-col gap-1 ${msg.is_admin ? 'items-start' : 'items-end'}`}>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                msg.is_admin 
                  ? 'bg-zinc-800 text-zinc-200 rounded-tl-none' 
                  : 'bg-blue-600 text-white rounded-tr-none'
              }`}>
                {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                {msg.image_url && (
                  <img 
                    src={msg.image_url} 
                    alt="Uploaded" 
                    className="max-w-full rounded-lg mt-2 border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <label className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition-all cursor-pointer">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload}
              disabled={uploading}
            />
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
          </label>
          
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-zinc-800/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
          />
          
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-zinc-800 text-white rounded-xl transition-all active:scale-95"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

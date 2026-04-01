import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  setDoc 
} from 'firebase/firestore';
import { UserProfile, FriendRequest } from '../types';
import { 
  X, 
  UserPlus, 
  MessageSquare, 
  ShieldCheck, 
  Clock, 
  UserCheck,
  MapPin,
  Calendar,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfileModalProps {
  userId: string;
  currentProfile: UserProfile | null;
  onClose: () => void;
  onStartChat: (userId: string) => void;
  showStatus: (t: string, type: 'success' | 'error') => void;
}

export default function UserProfileModal({ 
  userId, 
  currentProfile, 
  onClose, 
  onStartChat,
  showStatus 
}: UserProfileModalProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', userId), (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!currentProfile || !userId) return;

    // Check if friends
    const checkFriends = onSnapshot(doc(db, 'users', currentProfile.uid, 'friends', userId), (doc) => {
      if (doc.exists()) {
        setFriendStatus('friends');
      } else {
        // Check if pending request
        const q = query(
          collection(db, 'friend_requests'),
          where('from_id', '==', currentProfile.uid),
          where('to_id', '==', userId),
          where('status', '==', 'pending')
        );
        getDocs(q).then(snap => {
          if (!snap.empty) {
            setFriendStatus('pending');
          } else {
            setFriendStatus('none');
          }
        });
      }
    });

    return () => checkFriends();
  }, [currentProfile, userId]);

  const handleAddFriend = async () => {
    if (!currentProfile || !userProfile) return;
    try {
      await addDoc(collection(db, 'friend_requests'), {
        from_id: currentProfile.uid,
        from_name: currentProfile.display_name,
        to_id: userProfile.uid,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      setFriendStatus('pending');
      showStatus('Friend request sent', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'friend_requests');
    }
  };

  if (loading) return null;
  if (!userProfile) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-zinc-950 pro-border rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Profile Header/Cover */}
        <div className="h-32 bg-gradient-to-br from-zinc-800 to-zinc-900 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black rounded-full text-white transition-all z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-8 pb-8 -mt-12 relative">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-24 h-24 rounded-full bg-zinc-900 border-4 border-zinc-950 overflow-hidden shadow-xl">
              {userProfile.qr_url ? (
                <img src={userProfile.qr_url} alt={userProfile.display_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-zinc-700">
                  {userProfile.display_name[0]}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white">{userProfile.display_name}</h2>
                {userProfile.role === 'admin' && <ShieldCheck size={20} className="text-blue-500" />}
              </div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">
                {userProfile.role} Specialist
              </p>
            </div>

            {/* Stats/Badges */}
            <div className="flex items-center gap-6 py-4 border-y border-zinc-900 w-full justify-center">
              <div className="flex flex-col items-center gap-1">
                <Award size={16} className="text-zinc-600" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Elite</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Calendar size={16} className="text-zinc-600" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <MapPin size={16} className="text-zinc-600" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Global</span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 w-full mt-4">
              {friendStatus === 'friends' ? (
                <div className="flex items-center justify-center gap-2 bg-zinc-900 text-zinc-400 py-4 rounded-2xl border border-zinc-800">
                  <UserCheck size={18} />
                  <span className="text-[10px] font-bold tracking-widest uppercase">Friends</span>
                </div>
              ) : friendStatus === 'pending' ? (
                <div className="flex items-center justify-center gap-2 bg-zinc-900 text-zinc-500 py-4 rounded-2xl border border-zinc-800 italic">
                  <Clock size={18} />
                  <span className="text-[10px] font-bold tracking-widest uppercase">Pending</span>
                </div>
              ) : (
                <button 
                  onClick={handleAddFriend}
                  className="flex items-center justify-center gap-2 bg-white text-black py-4 rounded-2xl hover:bg-zinc-200 transition-all active:scale-95"
                >
                  <UserPlus size={18} />
                  <span className="text-[10px] font-bold tracking-widest uppercase">Add Friend</span>
                </button>
              )}

              <button 
                onClick={() => {
                  onStartChat(userId);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 bg-zinc-900 text-white py-4 rounded-2xl hover:bg-zinc-800 transition-all border border-zinc-800 active:scale-95"
              >
                <MessageSquare size={18} />
                <span className="text-[10px] font-bold tracking-widest uppercase">Message</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

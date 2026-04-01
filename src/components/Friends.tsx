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
  deleteDoc, 
  serverTimestamp, 
  getDocs,
  setDoc,
  limit
} from 'firebase/firestore';
import { UserProfile, Language, FriendRequest } from '../types';
import UserProfileModal from './UserProfileModal';
import { 
  UserPlus, 
  UserCheck, 
  UserX, 
  Search, 
  ShieldCheck, 
  Users, 
  Clock, 
  Check, 
  X,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Friends({ 
  profile, 
  showStatus, 
  language, 
  t,
  onStartChat
}: { 
  profile: UserProfile | null; 
  showStatus: (t: string, type: 'success' | 'error') => void; 
  language: Language; 
  t: any;
  onStartChat: (userId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    // Listen for friend requests
    const q = query(
      collection(db, 'friend_requests'), 
      where('to_id', '==', profile.uid),
      where('status', '==', 'pending')
    );
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
      setFriendRequests(requests);
    });

    // Listen for friends
    const qFriends = query(collection(db, 'users', profile.uid, 'friends'));
    const unsubscribeFriends = onSnapshot(qFriends, (snapshot) => {
      const friendIds = snapshot.docs.map(doc => doc.id);
      setFriends(friendIds);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeFriends();
    };
  }, [profile]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !profile) return;
    setSearching(true);
    try {
      // Simple search by display_name
      const q = query(
        collection(db, 'users'), 
        where('display_name', '>=', searchQuery),
        where('display_name', '<=', searchQuery + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== profile.uid);
      setSearchResults(results);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (targetUser: UserProfile) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'friend_requests'), {
        from_id: profile.uid,
        from_name: profile.display_name,
        to_id: targetUser.uid,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      showStatus('Friend request sent', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'friend_requests');
    }
  };

  const respondToRequest = async (request: FriendRequest, status: 'accepted' | 'declined') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'friend_requests', request.id), { status });
      
      if (status === 'accepted') {
        // Add to both users' friends subcollection
        await setDoc(doc(db, 'users', profile.uid, 'friends', request.from_id), { timestamp: serverTimestamp() });
        await setDoc(doc(db, 'users', request.from_id, 'friends', profile.uid), { timestamp: serverTimestamp() });
        showStatus('Friend request accepted', 'success');
      } else {
        showStatus('Friend request declined', 'success');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `friend_requests/${request.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-4xl font-black tracking-tighter text-white">FRIENDS</h2>
        <p className="specialist-label">Connect with Peer Specialists</p>
      </div>

      {/* Search Section */}
      <div className="flex flex-col gap-4">
        <div className="relative group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search specialists by name..."
            className="w-full bg-zinc-950/50 pro-border rounded-2xl px-12 py-5 text-lg text-white placeholder-zinc-700 focus:ring-1 focus:ring-white/20 transition-all"
          />
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-white transition-colors" />
          <button 
            onClick={handleSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-white text-black rounded-xl font-bold text-[10px] tracking-widest uppercase hover:bg-zinc-200 transition-all active:scale-95"
          >
            {searching ? '...' : 'SEARCH'}
          </button>
        </div>

        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-2 p-4 bg-zinc-950/30 rounded-2xl pro-border"
            >
              {searchResults.map((user) => (
                <div key={user.uid} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors">
                  <button 
                    onClick={() => setSelectedUserId(user.uid)}
                    className="flex items-center gap-4 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                      <span className="text-xs font-bold text-zinc-500">{user.display_name[0]}</span>
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-bold text-white">{user.display_name}</span>
                      <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                        {user.role}
                      </span>
                    </div>
                  </button>
                  {friends.includes(user.uid) ? (
                    <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">
                      <UserCheck size={14} />
                      <span className="text-[10px] font-bold tracking-widest uppercase">Friends</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => sendFriendRequest(user)}
                      className="p-3 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-xl transition-all active:scale-125"
                    >
                      <UserPlus size={20} />
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-2">
            <Clock size={16} className="text-zinc-500" />
            <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Pending Requests</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {friendRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="pro-border rounded-2xl p-6 flex items-center justify-between bg-zinc-950/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                    <span className="text-sm font-bold text-zinc-500">{request.from_name[0]}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{request.from_name}</span>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Wants to connect</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => respondToRequest(request, 'accepted')}
                    className="p-4 bg-white text-black rounded-xl hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    <Check size={18} />
                  </button>
                  <button 
                    onClick={() => respondToRequest(request, 'declined')}
                    className="p-4 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all active:scale-95"
                  >
                    <X size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-2">
          <Users size={16} className="text-zinc-500" />
          <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Your Friends</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {friends.length === 0 ? (
            <div className="pro-border rounded-3xl p-12 flex flex-col items-center justify-center gap-4 opacity-20">
              <Users size={48} />
              <p className="text-xs font-bold tracking-widest uppercase">No connections yet</p>
            </div>
          ) : (
            friends.map((friendId) => (
              <FriendCard key={friendId} friendId={friendId} profile={profile} t={t} onSelect={() => setSelectedUserId(friendId)} />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedUserId && (
          <UserProfileModal
            userId={selectedUserId}
            currentProfile={profile}
            onClose={() => setSelectedUserId(null)}
            onStartChat={onStartChat}
            showStatus={showStatus}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FriendCard({ friendId, profile, t, onSelect }: { friendId: string; profile: UserProfile | null; t: any; onSelect: () => void }) {
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', friendId), (snapshot) => {
      if (snapshot.exists()) {
        setFriendProfile(snapshot.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [friendId]);

  if (!friendProfile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className="pro-border rounded-2xl p-6 flex items-center justify-between bg-zinc-950/30 hover:bg-zinc-950/50 transition-all group cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden">
          {friendProfile.qr_url ? (
            <img src={friendProfile.qr_url} alt={friendProfile.display_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-zinc-500">{friendProfile.display_name[0]}</span>
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white group-hover:text-white transition-colors">{friendProfile.display_name}</span>
            {friendProfile.role === 'admin' && <ShieldCheck size={12} className="text-zinc-500" />}
          </div>
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
            {friendProfile.role}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-green-500/50 px-3 py-1 rounded-full border border-green-500/10">
          <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
          Online
        </div>
      </div>
    </motion.div>
  );
}

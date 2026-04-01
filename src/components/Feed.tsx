import React, { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  increment, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile, Language, Post, Comment } from '../types';
import UserProfileModal from './UserProfileModal';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Image as ImageIcon, 
  X, 
  Trash2, 
  MoreHorizontal,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Feed({ 
  profile, 
  isAdmin, 
  showStatus, 
  language, 
  t,
  onStartChat
}: { 
  profile: UserProfile | null; 
  isAdmin: boolean;
  showStatus: (t: string, type: 'success' | 'error') => void; 
  language: Language; 
  t: any;
  onStartChat: (userId: string) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(postsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });
    return () => unsubscribe();
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreatePost = async () => {
    if (!profile || (!newPostContent.trim() && !selectedImage)) return;

    setUploading(true);
    try {
      let imageUrl = '';
      if (selectedImage) {
        const imageRef = ref(storage, `posts/${profile.uid}_${Date.now()}`);
        await uploadBytes(imageRef, selectedImage);
        imageUrl = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, 'posts'), {
        author_id: profile.uid,
        author_name: profile.display_name,
        author_photo: profile.qr_url || '', // Using QR as placeholder photo if needed
        content: newPostContent,
        image_url: imageUrl,
        likes_count: 0,
        comments_count: 0,
        liked_by: [],
        timestamp: serverTimestamp()
      });

      setNewPostContent('');
      setSelectedImage(null);
      setImagePreview(null);
      showStatus('Post shared to Feed', 'success');
    } catch (error: any) {
      showStatus(error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (post: Post) => {
    if (!profile) return;
    const isLiked = post.liked_by?.includes(profile.uid);
    const postRef = doc(db, 'posts', post.id);

    try {
      await updateDoc(postRef, {
        liked_by: isLiked ? arrayRemove(profile.uid) : arrayUnion(profile.uid),
        likes_count: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      showStatus('Post deleted', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const fetchComments = (postId: string) => {
    if (comments[postId]) return;
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
    onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(prev => ({ ...prev, [postId]: commentsData }));
    });
  };

  const handleAddComment = async (postId: string) => {
    if (!profile || !newComment.trim()) return;

    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        author_id: profile.uid,
        author_name: profile.display_name,
        content: newComment,
        timestamp: serverTimestamp()
      });
      await updateDoc(doc(db, 'posts', postId), {
        comments_count: increment(1)
      });
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/comments`);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Create Post Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-4xl font-black tracking-tighter text-white">FEED</h2>
        <p className="specialist-label">Proof of Work & Daily Updates</p>
      </div>

      {/* Post Creator */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pro-border rounded-3xl p-6 flex flex-col gap-4 bg-zinc-950/50"
      >
        <textarea
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
          placeholder="What's happening in the field?"
          className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-zinc-700 resize-none min-h-[100px] text-lg font-medium"
        />

        {imagePreview && (
          <div className="relative rounded-2xl overflow-hidden aspect-video pro-border">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button 
              onClick={() => { setSelectedImage(null); setImagePreview(null); }}
              className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
          <div className="flex items-center gap-2">
            <label className="p-3 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer text-zinc-500 hover:text-white">
              <Camera size={20} />
              <input type="file" onChange={handleImageSelect} accept="image/*" className="hidden" />
            </label>
            <label className="p-3 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer text-zinc-500 hover:text-white">
              <ImageIcon size={20} />
              <input type="file" onChange={handleImageSelect} accept="image/*" className="hidden" />
            </label>
          </div>
          <button
            onClick={handleCreatePost}
            disabled={uploading || (!newPostContent.trim() && !selectedImage)}
            className="px-8 py-3 bg-white text-black rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-zinc-200 transition-all disabled:opacity-50 active:scale-95"
          >
            {uploading ? 'SHARING...' : 'SHARE POST'}
          </button>
        </div>
      </motion.div>

      {/* Posts List */}
      <div className="flex flex-col gap-6">
        <AnimatePresence mode="popLayout">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="pro-border rounded-3xl overflow-hidden bg-zinc-950/30"
            >
              {/* Post Header */}
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedUserId(post.author_id)}
                    className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden hover:scale-105 transition-transform"
                  >
                    {post.author_photo ? (
                      <img src={post.author_photo} alt={post.author_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-zinc-500">{post.author_name[0]}</span>
                    )}
                  </button>
                  <div className="flex flex-col">
                    <button 
                      onClick={() => setSelectedUserId(post.author_id)}
                      className="text-sm font-bold text-white hover:text-blue-500 transition-colors text-left"
                    >
                      {post.author_name}
                    </button>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                      {post.timestamp?.toDate().toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {(isAdmin || post.author_id === profile?.uid) && (
                  <button 
                    onClick={() => handleDeletePost(post.id)}
                    className="p-2 text-zinc-700 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              {/* Post Content */}
              <div className="px-6 pb-4">
                <p className="text-zinc-300 leading-relaxed">{post.content}</p>
              </div>

              {/* Post Image */}
              {post.image_url && (
                <div className="aspect-square w-full bg-zinc-900 border-y border-zinc-900">
                  <img 
                    src={post.image_url} 
                    alt="Post content" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Post Actions */}
              <div className="p-4 flex items-center gap-6 border-t border-zinc-900/50">
                <button 
                  onClick={() => handleLike(post)}
                  className={`flex items-center gap-2 transition-all active:scale-125 ${
                    post.liked_by?.includes(profile?.uid || '') ? 'text-red-500' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Heart size={20} fill={post.liked_by?.includes(profile?.uid || '') ? 'currentColor' : 'none'} />
                  <span className="text-xs font-bold">{post.likes_count}</span>
                </button>
                <button 
                  onClick={() => {
                    setCommentingOn(commentingOn === post.id ? null : post.id);
                    fetchComments(post.id);
                  }}
                  className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <MessageCircle size={20} />
                  <span className="text-xs font-bold">{post.comments_count}</span>
                </button>
              </div>

              {/* Comments Section */}
              <AnimatePresence>
                {commentingOn === post.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-black/40 border-t border-zinc-900 overflow-hidden"
                  >
                    <div className="p-6 flex flex-col gap-4">
                      {/* Comments List */}
                      <div className="flex flex-col gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {comments[post.id]?.map((comment) => (
                          <div key={comment.id} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{comment.author_name}</span>
                              <span className="text-[10px] text-zinc-700">
                                {comment.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-400">{comment.content}</p>
                          </div>
                        ))}
                      </div>

                      {/* Add Comment */}
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-900">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Write a comment..."
                          className="flex-1 bg-zinc-900 border-none rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-700 focus:ring-1 focus:ring-white/20"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                        />
                        <button 
                          onClick={() => handleAddComment(post.id)}
                          className="p-2 text-white hover:scale-110 transition-transform"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
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

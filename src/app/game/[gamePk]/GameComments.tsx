"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { updateCommentLike } from "@/lib/comments";
import { calculateAnalystBadge } from "@/lib/analyst";
import { useLang } from "@/contexts/LangContext";

interface Comment {
  id: string;
  text: string;
  author: string;
  uid: string | null;
  photoURL: string | null;
  createdAt: Timestamp | null;
  likes: number;
  userLikes: string[];
}

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "now";
  try {
    const diffMs = Date.now() - ts.toMillis();
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return `${Math.floor(diffMs / 86_400_000)}d ago`;
  } catch {
    return "now";
  }
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-pink-500",
    "bg-cyan-500",
  ];
  const charCode = name.charCodeAt(0);
  return colors[charCode % colors.length];
}

interface UserBadgeCache {
  [uid: string]: any;
}

export default function GameComments({ gamePk }: { gamePk: string }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [guestName, setGuestName] = useState("Guest");
  const [isNameSet, setIsNameSet] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liking, setLiking] = useState<Set<string>>(new Set());
  const [badgeCache, setBadgeCache] = useState<UserBadgeCache>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load guest name from localStorage and subscribe to comments
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Load saved guest name
    const saved = localStorage.getItem("statscope_guest_name");
    if (saved) {
      setGuestName(saved);
      setIsNameSet(true);
    }

    const db = getFirebaseDb();
    if (!db) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "gameComments", gamePk, "messages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          text: doc.data().text,
          author: doc.data().author,
          uid: doc.data().uid,
          photoURL: doc.data().photoURL,
          createdAt: doc.data().createdAt,
          likes: doc.data().likes || 0,
          userLikes: doc.data().userLikes || [],
        })) as Comment[];
        setComments(docs);
        setIsLoading(false);
        // Auto-scroll to bottom on new comment
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (err) => {
        console.error("Failed to load comments:", err);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [gamePk]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true });
        form.dispatchEvent(submitEvent);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.length > 300) return;

    setIsSending(true);
    setError(null);

    try {
      const db = getFirebaseDb();
      if (!db) {
        setError("Firebase not configured");
        setIsSending(false);
        return;
      }

      const displayName =
        user?.displayName || guestName.trim() || "Guest";

      // Save guest name for next time
      if (!user && guestName.trim()) {
        localStorage.setItem("statscope_guest_name", guestName.trim());
        setIsNameSet(true);
      }

      // Set expireAt to 7 days from now for automatic deletion via Firestore TTL
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await addDoc(
        collection(db, "gameComments", gamePk, "messages"),
        {
          text: text.trim(),
          author: displayName,
          uid: user?.uid ?? null,
          photoURL: user?.photoURL ?? null,
          createdAt: serverTimestamp(),
          likes: 0,
          userLikes: [],
          expiresAt: expiresAt,
        }
      );

      setText("");
    } catch (err) {
      console.error("Failed to post comment:", err);
      setError("Failed to post comment. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleLike = async (comment: Comment) => {
    if (!user) return; // Only logged-in users can like
    if (liking.has(comment.id)) return; // Prevent double-clicking

    const newLiking = new Set(liking);
    newLiking.add(comment.id);
    setLiking(newLiking);

    try {
      const isCurrentlyLiked = comment.userLikes.includes(user.uid);
      await updateCommentLike(gamePk, comment.id, user.uid, !isCurrentlyLiked);
    } catch (err) {
      console.error("Failed to like comment:", err);
    } finally {
      const updated = new Set(liking);
      updated.delete(comment.id);
      setLiking(updated);
    }
  };

  const loadUserBadge = async (uid: string) => {
    // Check cache first
    if (badgeCache[uid] !== undefined) {
      return badgeCache[uid];
    }

    try {
      const db = getFirebaseDb();
      if (!db) return null;

      // Fetch user's picks
      const picksQuery = query(
        collection(db, "userPicks", uid, "picks")
      );
      const snapshot = await getDocs(picksQuery);
      const picks = snapshot.docs.map((doc) => ({
        id: doc.id,
        uid,
        ...doc.data(),
      })) as any[];

      const badge = calculateAnalystBadge(picks);

      // Cache the badge
      setBadgeCache((prev) => ({
        ...prev,
        [uid]: badge,
      }));

      return badge;
    } catch (err) {
      console.error("Failed to load user badge:", err);
      return null;
    }
  };

  if (!isFirebaseConfigured) {
    return null;
  }

  const charCount = text.length;
  const isOverLimit = charCount > 300;

  return (
    <section className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 shadow h-[550px] flex flex-col">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 flex-shrink-0 uppercase tracking-wide">
        <span>💬</span> Chat <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{comments.length}</span>
      </h2>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 rounded-lg p-2 mb-4">
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            Loading comments...
          </p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            No comments yet. Be the first!
          </p>
        ) : (
          comments.map((comment) => {
            const isLiked = user && comment.userLikes.includes(user.uid);
            const isLiking = liking.has(comment.id);
            const badge = comment.uid ? badgeCache[comment.uid] : null;

            // Load badge if user is logged in and we haven't cached it yet
            if (comment.uid && badgeCache[comment.uid] === undefined) {
              loadUserBadge(comment.uid);
            }

            return (
              <div
                key={comment.id}
                className="rounded-md bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors p-2 group"
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Avatar */}
                    {comment.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={comment.photoURL}
                        alt={comment.author}
                        className="w-5 h-5 rounded-full object-cover flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-600"
                      />
                    ) : (
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-600 ${getAvatarColor(
                          comment.author
                        )}`}
                      >
                        {getInitial(comment.author)}
                      </div>
                    )}

                    {/* Author with optional badge */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-100 flex-shrink-0">
                        {comment.author}
                      </span>
                      {badge && (
                        <span
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge.bgColor} ${badge.color}`}
                          title={badge.name}
                        >
                          {badge.emoji}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comment text */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">
                    {comment.text}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Like button */}
                    {user && (
                      <button
                        onClick={() => handleLike(comment)}
                        disabled={isLiking}
                        className={`text-xs font-medium px-1.5 py-0.5 rounded transition-all ${
                          isLiked
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-500 dark:text-slate-400 hover:text-red-500"
                        } disabled:opacity-50 disabled:cursor-wait`}
                      >
                        ❤️ {comment.likes > 0 ? comment.likes : ""}
                      </button>
                    )}

                    {/* Time */}
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-2 flex-shrink-0">
        {/* Guest name field */}
        {!user && !isNameSet && (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">
              Name
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value.slice(0, 50))}
              placeholder="Your name..."
              className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Display name (when already set) */}
        {!user && isNameSet && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">{guestName}</span> {t("로 댓글 작성 중", "commenting as")}
          </p>
        )}

        {/* Text input + char counter */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Comment
            </label>
            <span
              className={`text-xs font-medium ${
                isOverLimit
                  ? "text-red-500 dark:text-red-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {charCount}/300
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            onKeyDown={handleKeyDown}
            placeholder={t("댓글을 작성하세요... (Enter로 전송, Shift+Enter는 줄바꿈)", "Write a comment... (Enter to send, Shift+Enter for new line)")}
            maxLength={300}
            rows={2}
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-700/50 resize-none transition-colors"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={
            !text.trim() || isOverLimit || isSending || isLoading
          }
          className="w-full px-3 py-2 text-xs font-semibold rounded-lg transition-all bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          {isSending ? t("전송 중...", "Sending...") : t("댓글 작성", "Post Comment")}
        </button>
      </form>
    </section>
  );
}

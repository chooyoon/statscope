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
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface Comment {
  id: string;
  text: string;
  author: string;
  uid: string | null;
  photoURL: string | null;
  createdAt: Timestamp | null;
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

export default function GameComments({ gamePk }: { gamePk: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [guestName, setGuestName] = useState("Guest");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      }

      await addDoc(
        collection(db, "gameComments", gamePk, "messages"),
        {
          text: text.trim(),
          author: displayName,
          uid: user?.uid ?? null,
          photoURL: user?.photoURL ?? null,
          createdAt: serverTimestamp(),
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

  if (!isFirebaseConfigured) {
    return null;
  }

  const charCount = text.length;
  const isOverLimit = charCount > 300;

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm h-[600px] flex flex-col">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2 flex-shrink-0">
        <span>💬</span> <span className="truncate">Chat ({comments.length})</span>
      </h2>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 mb-4">
        {isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            Loading comments...
          </p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            No comments yet. Be the first!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {comment.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comment.photoURL}
                    alt={comment.author}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${getAvatarColor(
                      comment.author
                    )}`}
                  >
                    {getInitial(comment.author)}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {comment.author}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">
                    {comment.text}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-2 flex-shrink-0">
        {/* Guest name field (hidden if logged in) */}
        {!user && (
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

        {/* Text input + char counter */}
        <div>
          <div className="flex items-baseline justify-between mb-0.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Comment
            </label>
            <span
              className={`text-xs font-medium ${
                isOverLimit
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {charCount}/300
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder="Write..."
            maxLength={300}
            rows={2}
            className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
          className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
          {isSending ? "..." : "Post"}
        </button>
      </form>
    </section>
  );
}

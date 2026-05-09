import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export interface CommentData {
  id: string;
  text: string;
  author: string;
  uid: string | null;
  photoURL: string | null;
  createdAt: Timestamp | null;
  likes: number;
  userLikes: string[];
  gamePk: string;
}

export async function updateCommentLike(
  gamePk: string,
  commentId: string,
  userId: string,
  liked: boolean
): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) throw new Error("Firebase not configured");

    const commentRef = doc(db, "gameComments", gamePk, "messages", commentId);

    if (liked) {
      await updateDoc(commentRef, {
        userLikes: arrayUnion(userId),
        likes: increment(1),
      });
    } else {
      await updateDoc(commentRef, {
        userLikes: arrayRemove(userId),
        likes: increment(-1),
      });
    }
  } catch (error) {
    console.error("Failed to update comment like:", error);
    throw error;
  }
}

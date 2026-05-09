import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export interface PortfolioPick {
  id?: string;
  uid: string;
  date: string;
  fav: string;
  fav_id: number;
  home_id: number;
  away_id: number;
  home: string;
  away: string;
  prob: number;
  ml: string;
  ou_line: number;
  ou_lean: "over" | "under" | "push";
  userBetSide: "fav" | "dog";
  stakeUnits: number;
  result: "pending" | "W" | "L";
  final_score?: string;
  createdAt?: Timestamp;
}

export interface PortfolioStats {
  totalPicks: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  unitsProfit: number;
  roi: number;
}

export async function addPick(uid: string, pick: Omit<PortfolioPick, "id" | "createdAt">): Promise<string> {
  try {
    const db = getFirebaseDb();
    if (!db) throw new Error("Firebase not configured");

    const docRef = await addDoc(
      collection(db, "userPicks", uid, "picks"),
      {
        ...pick,
        createdAt: serverTimestamp(),
      }
    );

    return docRef.id;
  } catch (error) {
    console.error("Failed to add pick:", error);
    throw error;
  }
}

export async function getUserPicks(uid: string, limitCount = 100): Promise<PortfolioPick[]> {
  try {
    const db = getFirebaseDb();
    if (!db) return [];

    const q = query(
      collection(db, "userPicks", uid, "picks"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      uid,
      ...doc.data(),
    })) as PortfolioPick[];
  } catch (error) {
    console.error("Failed to fetch user picks:", error);
    return [];
  }
}

export async function updatePickResult(
  uid: string,
  pickId: string,
  result: "W" | "L",
  finalScore?: string
): Promise<void> {
  try {
    const db = getFirebaseDb();
    if (!db) throw new Error("Firebase not configured");

    const pickRef = doc(db, "userPicks", uid, "picks", pickId);
    const updateData: Record<string, any> = { result };

    if (finalScore) {
      updateData.final_score = finalScore;
    }

    await updateDoc(pickRef, updateData);
  } catch (error) {
    console.error("Failed to update pick result:", error);
    throw error;
  }
}

export function calcPortfolioStats(picks: PortfolioPick[]): PortfolioStats {
  const stats: PortfolioStats = {
    totalPicks: picks.length,
    wins: 0,
    losses: 0,
    pending: 0,
    winRate: 0,
    unitsProfit: 0,
    roi: 0,
  };

  let totalBets = 0;
  let totalProfit = 0;

  picks.forEach((pick) => {
    const stake = pick.stakeUnits || 1;
    totalBets += stake;

    if (pick.result === "W") {
      stats.wins += 1;
      const ml = pick.ml;
      const mlNum = parseInt(ml, 10);

      if (mlNum < 0) {
        // Favored (negative ML)
        totalProfit += (100 / Math.abs(mlNum)) * stake;
      } else {
        // Underdog (positive ML)
        totalProfit += (mlNum / 100) * stake;
      }
    } else if (pick.result === "L") {
      stats.losses += 1;
      totalProfit -= stake;
    } else if (pick.result === "pending") {
      stats.pending += 1;
    }
  });

  if (stats.wins + stats.losses > 0) {
    stats.winRate = (stats.wins / (stats.wins + stats.losses)) * 100;
  }

  stats.unitsProfit = totalProfit;
  stats.roi = totalBets > 0 ? (totalProfit / totalBets) * 100 : 0;

  return stats;
}

export function getPickResult(pick: PortfolioPick): number | null {
  if (pick.result !== "W" && pick.result !== "L") return null;

  const stake = pick.stakeUnits || 1;
  const ml = pick.ml;
  const mlNum = parseInt(ml, 10);

  if (pick.result === "W") {
    if (mlNum < 0) {
      return (100 / Math.abs(mlNum)) * stake;
    } else {
      return (mlNum / 100) * stake;
    }
  } else {
    // Loss
    return -stake;
  }
}

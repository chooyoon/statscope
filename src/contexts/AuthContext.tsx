"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, googleProvider } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  favoriteTeams: number[];
  favoritePlayers: number[];
  createdAt: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateFavoriteTeams: (teams: number[]) => Promise<void>;
  updateFavoritePlayers: (players: number[]) => Promise<void>;
  toggleFavoriteTeam: (teamId: number) => Promise<void>;
  toggleFavoritePlayer: (playerId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const authInstance = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const dbInstance = getFirebaseDb();
        const profileDoc = await getDoc(doc(dbInstance, "users", firebaseUser.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            favoriteTeams: [],
            favoritePlayers: [],
            createdAt: Date.now(),
          };
          await setDoc(doc(dbInstance, "users", firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await signInWithPopup(getFirebaseAuth(), googleProvider);
  }

  async function signOut() {
    await firebaseSignOut(getFirebaseAuth());
    setProfile(null);
  }

  async function updateProfile(data: Partial<UserProfile>) {
    if (!user) return;
    const ref = doc(getFirebaseDb(), "users", user.uid);
    await setDoc(ref, data, { merge: true });
    setProfile((prev) => (prev ? { ...prev, ...data } : null));
  }

  async function updateFavoriteTeams(teams: number[]) {
    await updateProfile({ favoriteTeams: teams });
  }

  async function updateFavoritePlayers(players: number[]) {
    await updateProfile({ favoritePlayers: players });
  }

  async function toggleFavoriteTeam(teamId: number) {
    const current = profile?.favoriteTeams ?? [];
    const updated = current.includes(teamId)
      ? current.filter((id) => id !== teamId)
      : [...current, teamId];
    await updateFavoriteTeams(updated);
  }

  async function toggleFavoritePlayer(playerId: number) {
    const current = profile?.favoritePlayers ?? [];
    const updated = current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : [...current, playerId];
    await updateFavoritePlayers(updated);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signOut,
        updateFavoriteTeams,
        updateFavoritePlayers,
        toggleFavoriteTeam,
        toggleFavoritePlayer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

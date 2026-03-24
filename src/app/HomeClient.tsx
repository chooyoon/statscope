"use client";

import Dashboard from "@/components/dashboard/Dashboard";
import { useAuth } from "@/contexts/AuthContext";

export default function HomeClient() {
  const { user } = useAuth();

  if (!user) return null;

  return <Dashboard />;
}

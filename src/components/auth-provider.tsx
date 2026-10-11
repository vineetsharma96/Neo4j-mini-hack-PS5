"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebase";
const Context = createContext<{ user: User | null; ready: boolean }>({
  user: null,
  ready: false,
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({
    user: null,
    ready: !firebaseConfigured,
  });
  useEffect(() => {
    if (firebaseConfigured)
      return onAuthStateChanged(clientAuth(), (user) =>
        setState({ user, ready: true }),
      );
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);

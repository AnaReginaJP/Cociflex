import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  idToken: string | null;
  isAuthReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<string | null>;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const token = await credential.user.getIdToken();
      setFirebaseUser(credential.user);
      setIdToken(token);
      return token;
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') {
        setAuthError('Se cerró la ventana de inicio de sesión antes de completar.');
      } else {
        setAuthError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
      }
      return null;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setIdToken(null);
    } catch {
      // ignore
    }
  }, []);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken();
      setIdToken(token);
      return token;
    } catch {
      return idToken;
    }
  }, [idToken]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        idToken,
        isAuthReady,
        isSigningIn,
        authError,
        signInWithGoogle,
        logout,
        getFreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

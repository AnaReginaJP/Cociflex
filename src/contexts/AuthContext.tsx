import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Local accounts: the server keeps the session in an HttpOnly cookie, so no token lives in JS.
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (displayName: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Restore the session on load.
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setUser(data?.user ?? null);
      })
      .catch(() => {
        // Offline: keep working without an account.
      })
      .finally(() => {
        if (active) setIsAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const authenticate = useCallback(async (path: string, body: unknown): Promise<boolean> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const { ok, data } = await postJson(path, body);
      if (!ok || !data?.user) {
        setAuthError(data?.error || 'No se pudo iniciar sesión. Intenta de nuevo.');
        return false;
      }
      setUser(data.user);
      return true;
    } catch {
      setAuthError('No hay conexión con el servidor. Intenta de nuevo.');
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const login = useCallback(
    (email: string, password: string) => authenticate('/api/auth/login', { email, password }),
    [authenticate]
  );

  const register = useCallback(
    (displayName: string, email: string, password: string) =>
      authenticate('/api/auth/register', { displayName, email, password }),
    [authenticate]
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await postJson('/api/auth/logout', {});
    } catch {
      // ignore: the local state is cleared anyway
    }
    setUser(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthReady, isSigningIn, authError, login, register, logout, clearAuthError }}
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

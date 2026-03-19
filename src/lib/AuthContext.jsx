import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const TOKEN_KEY = 'positive_percy_token';
const REFRESH_TOKEN_KEY = 'positive_percy_refresh_token';
const FAMILY_CODE_KEY = 'positive_percy_family_code';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [familyCode, setFamilyCode] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsFamily, setNeedsFamily] = useState(false);

  // Handle auth tokens from URL (magic link redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    const refreshToken = params.get('refresh_token');
    const authError = params.get('auth_error');
    const needsFamilyParam = params.get('needs_family');

    // Clean URL
    if (authToken || authError || needsFamilyParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (authError) {
      console.error('Auth error:', authError);
      setIsLoading(false);
      return;
    }

    if (authToken) {
      localStorage.setItem(TOKEN_KEY, authToken);
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
      if (needsFamilyParam === 'true') {
        setNeedsFamily(true);
        setIsLoading(false);
        return;
      }
      loadUser(authToken);
      return;
    }

    // Normal startup — check for existing token
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedCode = localStorage.getItem(FAMILY_CODE_KEY);
    if (storedToken) {
      loadUser(storedToken);
    } else if (storedCode) {
      // Legacy user without proper token — need to re-authenticate
      localStorage.removeItem(FAMILY_CODE_KEY);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async (token) => {
    try {
      // Try new account endpoint first
      const accountRes = await fetch('/auth/account', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (accountRes.ok) {
        const data = await accountRes.json();
        if (data.legacy) {
          // Legacy token — use old users data
          setUser(data.user);
          setFamilyCode(data.family_code);
          localStorage.setItem(FAMILY_CODE_KEY, data.family_code);
        } else {
          setAccount(data.account);
          setFamilyCode(data.family_code);
          localStorage.setItem(FAMILY_CODE_KEY, data.family_code);
          // Also load legacy user data for backward compat with existing UI
          const userRes = await fetch(`/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData);
          }
        }
        setIsAuthenticated(true);
        setIsLoading(false);
        return true;
      }

      // Fallback: try legacy endpoint
      const storedCode = localStorage.getItem(FAMILY_CODE_KEY);
      if (storedCode) {
        const legacyRes = await fetch(`/api/auth/me?family_code=${encodeURIComponent(storedCode)}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (legacyRes.ok) {
          const userData = await legacyRes.json();
          setUser(userData);
          setFamilyCode(storedCode);
          setIsAuthenticated(true);
          setIsLoading(false);
          return true;
        }
      }

      // Token invalid — try refresh
      const refreshed = await tryRefresh();
      if (!refreshed) {
        clearAuth();
      }
      setIsLoading(false);
      return false;
    } catch {
      clearAuth();
      setIsLoading(false);
      return false;
    }
  };

  const tryRefresh = async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    try {
      const res = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      localStorage.setItem(FAMILY_CODE_KEY, data.family_code);

      setAccount(data.account);
      setFamilyCode(data.family_code);
      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  };

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(FAMILY_CODE_KEY);
    setUser(null);
    setAccount(null);
    setFamilyCode(null);
    setIsAuthenticated(false);
    setNeedsFamily(false);
  };

  // Google OAuth handler
  const loginWithGoogle = async (credential) => {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Google login failed');
    }
    const data = await res.json();

    if (data.needs_family) {
      // Account created but no family — need to create or join
      setAccount(data.account);
      setNeedsFamily(true);
      // Issue a temp token for create/join calls
      // The server returned no tokens, so we store nothing for now
      return data;
    }

    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    localStorage.setItem(FAMILY_CODE_KEY, data.family_code);
    setAccount(data.account);
    setFamilyCode(data.family_code);
    setIsAuthenticated(true);
    await loadUser(data.access_token);
    return data;
  };

  // Magic link request
  const requestMagicLink = async (email) => {
    const res = await fetch('/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send magic link');
    }
    return res.json();
  };

  // Create family (for new accounts)
  const createFamily = async (familyName) => {
    const token = getToken();
    const res = await fetch(token ? '/auth/create-family' : '/api/family/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ family_name: familyName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create family');
    }
    const data = await res.json();

    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    } else if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    localStorage.setItem(FAMILY_CODE_KEY, data.family_code);
    setFamilyCode(data.family_code);
    setNeedsFamily(false);

    await loadUser(localStorage.getItem(TOKEN_KEY));
    return data;
  };

  // Join family (for new accounts or legacy)
  const joinFamily = async (code) => {
    const token = getToken();
    const res = await fetch(token && account ? '/auth/join-family' : '/api/family/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ family_code: code.toUpperCase() }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to join family');
    }
    const data = await res.json();

    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    } else if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    localStorage.setItem(FAMILY_CODE_KEY, data.family_code || code.toUpperCase());
    setFamilyCode(data.family_code || code.toUpperCase());
    setNeedsFamily(false);

    await loadUser(localStorage.getItem(TOKEN_KEY));
  };

  const updateUser = async (data) => {
    const token = getToken();
    const res = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const updated = await res.json();
    setUser(updated);
    return updated;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    clearAuth();
  };

  const deleteAccount = async () => {
    const token = getToken();
    const res = await fetch('/auth/account', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Account deletion failed');
    }
    clearAuth();
  };

  const exportData = async () => {
    const token = getToken();
    const res = await fetch('/auth/export', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Export failed');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `positive-percy-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AuthContext.Provider value={{
      user,
      account,
      familyCode,
      isAuthenticated,
      isLoading,
      needsFamily,
      loginWithGoogle,
      requestMagicLink,
      createFamily,
      joinFamily,
      updateUser,
      logout,
      deleteAccount,
      exportData,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

const FAMILY_CODE_KEY = 'positive_percy_family_code';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [familyCode, setFamilyCode] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedCode = localStorage.getItem(FAMILY_CODE_KEY);
    if (storedCode) {
      loadUser(storedCode);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async (code) => {
    try {
      const res = await fetch(`/api/auth/me?family_code=${encodeURIComponent(code)}`);
      if (!res.ok) {
        localStorage.removeItem(FAMILY_CODE_KEY);
        setIsLoading(false);
        return false;
      }
      const userData = await res.json();
      setUser(userData);
      setFamilyCode(code);
      setIsAuthenticated(true);
      localStorage.setItem(FAMILY_CODE_KEY, code);
      setIsLoading(false);
      return true;
    } catch {
      localStorage.removeItem(FAMILY_CODE_KEY);
      setIsLoading(false);
      return false;
    }
  };

  const createFamily = async (familyName) => {
    const res = await fetch('/api/family/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family_name: familyName }),
    });
    if (!res.ok) throw new Error('Failed to create family');
    const family = await res.json();
    await loadUser(family.family_code);
    return family;
  };

  const joinFamily = async (code) => {
    const res = await fetch('/api/family/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family_code: code.toUpperCase() }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to join family');
    }
    await loadUser(code.toUpperCase());
  };

  const updateUser = async (data) => {
    const res = await fetch(`/api/auth/me?family_code=${encodeURIComponent(familyCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const updated = await res.json();
    setUser(updated);
    return updated;
  };

  const logout = () => {
    localStorage.removeItem(FAMILY_CODE_KEY);
    setUser(null);
    setFamilyCode(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      familyCode,
      isAuthenticated,
      isLoading,
      createFamily,
      joinFamily,
      updateUser,
      logout,
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

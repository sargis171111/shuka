import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [lastAddress, setLastAddress] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiRequest('/me');
      setUser(data.user || null);
      setLastAddress(data.last_address || null);
      return data.user || null;
    } catch {
      setUser(null);
      setLastAddress(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await refreshMe();
    return data.user;
  };

  const register = async (payload) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: payload,
    });
    await refreshMe();
    return data.user;
  };

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
    setLastAddress(null);
  };

  const updateProfile = async (payload) => {
    const data = await apiRequest('/me', {
      method: 'PATCH',
      body: payload,
    });
    setUser(data.user);
    return data.user;
  };

  const activateSeller = async (payload) => {
    const data = await apiRequest('/seller/activate', {
      method: 'POST',
      body: payload,
    });
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        lastAddress,
        loading,
        refreshMe,
        login,
        register,
        logout,
        updateProfile,
        activateSeller,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

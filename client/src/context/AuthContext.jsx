/**
 * SentinelPharma Auth Context
 * ========================
 * Authentication state management (placeholder for future implementation).
 */

import { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  /**
   * Login user
   */
  const login = useCallback(async (credentials) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual authentication
      setUser({ name: 'Demo User', role: 'researcher' });
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Logout user
   */
  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);
  
  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

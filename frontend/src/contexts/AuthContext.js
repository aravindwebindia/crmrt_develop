import React, { createContext, useContext, useState } from 'react';
import api from '../utils/axiosConfig';
import { useOnce } from '../hooks/useOnce';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Debug user state changes
  React.useEffect(() => {
    }, [user]);

  useOnce(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token with backend
      api.get('/verify-token.php')
      .then(response => {
        if (response.data.success) {
          setUser(response.data.user);
          } else {
          localStorage.removeItem('token');
        }
      })
      .catch((error) => {
        // Only clear token if it's a 401 error (invalid/expired token)
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
        } else {
          // Don't clear token on network errors - user might still be logged in
        }
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth.php', {
        username,
        password
      });
      if (response.data.success) {
        const { token, user: userData } = response.data;
        localStorage.setItem('token', token);
        setUser(userData);
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    // Clear any other auth-related data from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('token') || key.includes('auth') || key.includes('user'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      });
    
    // Clear user state
    setUser(null);
    // Verify token is cleared
    };

  const updateUser = (updatedUser) => {
    setUser(prev => ({
      ...prev,
      ...updatedUser
    }));
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/verify-token.php');
      
      if (response.data.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      }
  };

  const checkAuthStatus = () => {
    const token = localStorage.getItem('token');
    return !!token && !!user;
  };

  const value = {
    user,
    login,
    logout,
    updateUser,
    refreshUser,
    checkAuthStatus,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

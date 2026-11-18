import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, signupUser, getMe, updateProfile as apiUpdateProfile } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const TOKEN_KEY = 'cicd_auth_token';
const USER_KEY  = 'cicd_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [loading, setLoading] = useState(true);

  // Sync session on mount with /auth/me
  useEffect(() => {
    async function verifySession() {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await getMe();
        if (data && data.user) {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
      } catch (err) {
        // Token invalid or expired — clear stored session
        console.warn('Session expired or invalid, signing out');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }

    verifySession();
  }, []);

  const login = async (usernameOrEmail, password) => {
    try {
      const { data } = await loginUser({
        username_or_email: usernameOrEmail,
        password: password,
      });

      if (data && data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        toast.success(`Welcome back, ${data.user.full_name || data.user.username}!`);
        return { success: true, user: data.user };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Login failed. Please check credentials.';
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  const signup = async ({ username, email, password, full_name, role }) => {
    try {
      const { data } = await signupUser({
        username,
        email,
        password,
        full_name,
        role,
      });

      if (data && data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        toast.success(`Account created! Welcome, ${data.user.full_name}!`);
        return { success: true, user: data.user };
      }
      return { success: false, message: 'Signup failed' };
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Signup failed. Please check your details.';
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  const updateProfile = async (updateData) => {
    try {
      const { data } = await apiUpdateProfile(updateData);
      if (data && data.user) {
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        toast.success('Profile updated successfully!');
        return { success: true, user: data.user };
      }
      return { success: false };
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Could not update profile';
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    toast.success('Signed out successfully');
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    signup,
    updateProfile,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

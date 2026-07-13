import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { generateE2EEKeys, exportPublicKey, exportPrivateKey, importPrivateKey } from '../services/crypto';
import { getPrivateKeyFromDB, savePrivateKeyToDB } from '../services/db';

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  profilePhoto: string | null;
  bio: string | null;
  publicKey: string | null;
  settings?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
  updateSettings: (settings: any) => Promise<void>;
  privateKey: CryptoKey | null;
  publicKeyJwk: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKeyJwk, setPublicKeyJwk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize local E2EE keys
  const initE2EEKeys = async (userId: string, existingPublicKeyJwk: string | null) => {
    try {
      // 1. Try to load local private key from IndexedDB
      const savedPrivateKeyJwk = await getPrivateKeyFromDB(userId);
      
      if (savedPrivateKeyJwk) {
        // Import it back to memory
        const privKey = await importPrivateKey(savedPrivateKeyJwk);
        setPrivateKey(privKey);
        if (existingPublicKeyJwk) {
          setPublicKeyJwk(existingPublicKeyJwk);
        }
        console.log('E2EE private key recovered from IndexedDB.');
      } else {
        // 2. No local private key found, generate a new pair
        console.log('No local private key found. Scaffolding new E2EE keypair...');
        const keyPair = await generateE2EEKeys();
        
        // Export keys
        const pubKeyJwk = await exportPublicKey(keyPair.publicKey);
        const privKeyJwk = await exportPrivateKey(keyPair.privateKey);
        
        // Save locally
        await savePrivateKeyToDB(userId, privKeyJwk);
        
        // Upload public key to database profile
        await api.put('/users/profile', { publicKey: pubKeyJwk });
        
        setPrivateKey(keyPair.privateKey);
        setPublicKeyJwk(pubKeyJwk);
        console.log('New E2EE keys generated, local private key saved, and public key uploaded.');
      }
    } catch (err) {
      console.error('Failed to initialize E2EE keys:', err);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      
      if (accessToken && userId) {
        try {
          const res = await api.get('/users/profile');
          setUser(res.data);
          // Sync keys
          await initE2EEKeys(res.data.id, res.data.publicKey);
        } catch (err) {
          console.error('Session validation failed:', err);
          logoutLocal();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData } = res.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userId', userData.id);
    localStorage.setItem('user', JSON.stringify(userData));

    setUser(userData);
    await initE2EEKeys(userData.id, userData.publicKey);
  };

  const register = async (data: any) => {
    await api.post('/auth/register', data);
  };

  const logoutLocal = () => {
    setUser(null);
    setPrivateKey(null);
    setPublicKeyJwk(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      const userId = user?.id;
      if (refreshToken && userId) {
        await api.post('/auth/logout', { refreshToken, userId });
      }
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      logoutLocal();
    }
  };

  const updateProfile = async (data: any) => {
    const res = await api.put('/users/profile', data);
    setUser(prev => prev ? { ...prev, ...res.data.user } : null);
  };

  const updateSettings = async (settings: any) => {
    const res = await api.put('/users/settings', settings);
    setUser(prev => prev ? { ...prev, settings: res.data.settings } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, updateSettings, privateKey, publicKeyJwk }}>
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

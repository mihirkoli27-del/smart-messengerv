import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials or connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden">
      {/* Background blobs for premium depth */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse delay-700"></div>

      <div className="w-full max-w-md glass rounded-2xl p-8 border border-slate-800 shadow-2xl relative z-10 transition-all duration-300">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            AETHER
          </h1>
          <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide">
            SECURE TEMPORARY REAL-TIME CHAT
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:from-violet-700 active:to-purple-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg hover:shadow-violet-900/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-slate-400">
          New to Aether?{' '}
          <Link to="/register" className="font-semibold text-violet-400 hover:text-violet-300 transition-colors">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Lock, Loader2, ArrowLeft } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess('If the email matches an account, we have sent a 6-digit OTP code.');
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp || !newPassword) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      setSuccess('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Check OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse delay-700"></div>

      <div className="w-full max-w-md glass rounded-2xl p-8 border border-slate-800 shadow-2xl relative z-10">
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-slate-200 gap-1.5 transition-colors uppercase tracking-wider">
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            RESET PASSWORD
          </h1>
          <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide">
            RECOVER YOUR AETHER ACCOUNT
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 text-sm">
            {success}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Your Email Address
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
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:from-violet-700 active:to-purple-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg hover:shadow-violet-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sending OTP...
                </>
              ) : (
                'Request Reset OTP'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Enter 6-Digit OTP Code
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <KeyRound size={16} />
                </span>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all tracking-widest text-center font-bold text-lg"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                * Check your server console to copy the generated OTP code!
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Enter New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:from-violet-700 active:to-purple-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg hover:shadow-violet-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Confirm Reset'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
export default ResetPasswordPage;

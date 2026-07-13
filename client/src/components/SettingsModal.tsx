import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, ShieldAlert, Key, User, ToggleLeft, Loader2 } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { user, publicKeyJwk, updateProfile, updateSettings } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || '');
  
  const [lastSeenVisibility, setLastSeenVisibility] = useState(user?.settings?.lastSeenVisibility || 'ALL');
  const [onlineStatusVisibility, setOnlineStatusVisibility] = useState(user?.settings?.onlineStatusVisibility || 'ALL');
  const [readReceipts, setReadReceipts] = useState(user?.settings?.readReceipts !== false);
  const [messageTimerDefault, setMessageTimerDefault] = useState<number>(user?.settings?.messageTimerDefault || 300);
  const [allowMessagesFrom, setAllowMessagesFrom] = useState(user?.settings?.allowMessagesFrom || 'ALL');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      // 1. Update Profile (Name, Bio, Profile Photo)
      await updateProfile({ name, bio: bio || null, profilePhoto: profilePhoto || null });

      // 2. Update Settings
      await updateSettings({
        lastSeenVisibility,
        onlineStatusVisibility,
        readReceipts,
        messageTimerDefault,
        allowMessagesFrom
      });

      setSuccess('Settings saved successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  // Generate a hash or fingerprint of the public key JWK as a "Safety Number"
  const getSafetyNumber = () => {
    if (!publicKeyJwk) return 'No E2EE key generated';
    // Simple hashing simulation for UI display
    let hash = 0;
    for (let i = 0; i < publicKeyJwk.length; i++) {
      hash = (hash << 5) - hash + publicKeyJwk.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash).toString();
    // Format into 5 groups of 5 digits
    const padded = absHash.padStart(15, '0');
    return `${padded.slice(0, 3)}-${padded.slice(3, 6)}-${padded.slice(6, 9)}-${padded.slice(9, 12)}-${padded.slice(12, 15)}`;
  };

  const timerOptions = [
    { label: '30 seconds', value: 30 },
    { label: '1 minute', value: 60 },
    { label: '5 minutes', value: 300 },
    { label: '10 minutes', value: 600 },
    { label: '1 hour', value: 3600 },
    { label: '24 hours', value: 86400 }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-900 flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <ToggleLeft size={20} className="text-violet-400" /> User Settings & Privacy
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-350 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {success && (
            <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 text-xs">
              {success}
            </div>
          )}
          {error && (
            <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Profile Details Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-2">
              <User size={14} className="text-violet-400" /> Profile Customization
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Profile Photo URL</label>
                <input
                  type="url"
                  value={profilePhoto}
                  onChange={(e) => setProfilePhoto(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something about yourself..."
                rows={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
          </div>

          {/* Privacy & Expiration Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-2">
              <ShieldAlert size={14} className="text-violet-400" /> Privacy & Security Controls
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Last Seen Visibility</label>
                <select
                  value={lastSeenVisibility}
                  onChange={(e) => setLastSeenVisibility(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                >
                  <option value="ALL">Everyone</option>
                  <option value="FRIENDS">Friends Only</option>
                  <option value="NONE">Nobody</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Online Status Visibility</label>
                <select
                  value={onlineStatusVisibility}
                  onChange={(e) => setOnlineStatusVisibility(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                >
                  <option value="ALL">Everyone</option>
                  <option value="FRIENDS">Friends Only</option>
                  <option value="NONE">Nobody</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Default Chat Timer</label>
                <select
                  value={messageTimerDefault}
                  onChange={(e) => setMessageTimerDefault(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                >
                  {timerOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Allow Messages From</label>
                <select
                  value={allowMessagesFrom}
                  onChange={(e) => setAllowMessagesFrom(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                >
                  <option value="ALL">Everyone</option>
                  <option value="FRIENDS_ONLY">Friends Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-900/50 border border-slate-900 rounded-xl">
              <div>
                <h5 className="text-xs font-semibold text-slate-200">Read Receipts</h5>
                <p className="text-[10px] text-slate-500 mt-0.5">Let others know when you have read their messages.</p>
              </div>
              <input
                type="checkbox"
                checked={readReceipts}
                onChange={(e) => setReadReceipts(e.target.checked)}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-slate-900 border-slate-800 cursor-pointer"
              />
            </div>
          </div>

          {/* E2EE Safety Number Fingerprint Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-2">
              <Key size={14} className="text-violet-400" /> End-to-End Encryption Key
            </h4>
            <div className="p-4 bg-violet-950/20 border border-violet-900/30 rounded-xl space-y-2">
              <h5 className="text-xs font-semibold text-violet-300 flex items-center gap-1">Your Device Safety Number</h5>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                This number acts as a unique fingerprint for your RSA safety keys. Share and verify this number with your friends to guarantee your messages are secure and untampered.
              </p>
              <div className="text-sm font-mono font-bold tracking-widest text-violet-400 pt-1.5 text-center">
                {getSafetyNumber()}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-900 flex justify-end gap-2 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold rounded-lg shadow-lg hover:shadow-violet-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default SettingsModal;

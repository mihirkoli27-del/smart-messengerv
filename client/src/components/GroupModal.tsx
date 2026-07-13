import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { X, Users, Loader2 } from 'lucide-react';

interface GroupModalProps {
  onClose: () => void;
}

export const GroupModal: React.FC<GroupModalProps> = ({ onClose }) => {
  const { friends, createGroupChat } = useChat();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckboxChange = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createGroupChat(name, description, selectedFriends);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-950 border border-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-900 flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Users size={20} className="text-violet-400" /> Create Group Chat
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-350 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Group Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Team, Family Room"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">Select Members</label>
            
            {friends.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No friends available to add. Add friends first!</p>
            ) : (
              <div className="border border-slate-900 rounded-xl overflow-hidden max-h-40 overflow-y-auto divide-y divide-slate-900 bg-slate-900/20">
                {friends.map((item) => {
                  const isChecked = selectedFriends.includes(item.friend.id);
                  return (
                    <label
                      key={item.friend.id}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-900 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img
                          src={item.friend.profilePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.friend.username}`}
                          alt="Photo"
                          className="w-6 h-6 rounded-md object-cover bg-slate-850"
                        />
                        <div className="truncate">
                          <p className="text-xs font-semibold truncate text-slate-200">{item.friend.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">@{item.friend.username}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange(item.friend.id)}
                        className="w-4 h-4 text-violet-600 focus:ring-violet-500 bg-slate-900 border-slate-800 rounded cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            )}
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
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold rounded-lg shadow-lg hover:shadow-violet-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default GroupModal;

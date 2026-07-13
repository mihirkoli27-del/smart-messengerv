import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { MessageSquare, Users, UserPlus, Settings, LogOut, Search, Check, X, Shield, Plus, HeartPulse } from 'lucide-react';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenCreateGroup: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings, onOpenCreateGroup }) => {
  const { user, logout } = useAuth();
  const {
    friends, pendingSent, pendingReceived, groups,
    activeRoomId, onlineUsers, setActiveRoom,
    sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
    loadFriendsAndGroups
  } = useChat();

  const [activeTab, setActiveTab] = useState<'friends' | 'groups' | 'requests'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');

  // Handle searching new users to add
  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchStatus('');
    setSearchResults([]);
    try {
      const res = await api.get(`/users/search?query=${searchQuery}`); // Wait! api import? Yes, we must import api
      setSearchResults(res.data);
      if (res.data.length === 0) {
        setSearchStatus('No users found.');
      }
    } catch (err: any) {
      setSearchStatus(err.response?.data?.error || 'Failed to search users.');
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      await sendFriendRequest(friendId);
      setSearchResults(prev => prev.filter(u => u.id !== friendId));
      alert('Friend request sent!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send request.');
    }
  };

  return (
    <div className="w-80 h-full border-r border-slate-900 bg-slate-950 flex flex-col text-slate-200">
      {/* Profile Header */}
      <div className="p-4 border-b border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user?.profilePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
              alt="Avatar"
              className="w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 object-cover"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950"></span>
          </div>
          <div className="overflow-hidden">
            <h3 className="font-semibold text-sm truncate">{user?.name}</h3>
            <p className="text-xs text-slate-500 truncate">@{user?.username}</p>
          </div>
        </div>
        
        {/* Profile Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Admin badge if username starts with admin */}
          {(user?.username.toLowerCase().startsWith('admin') || user?.email.toLowerCase().startsWith('admin')) && (
            <div className="text-amber-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-900 transition-all cursor-pointer" title="Admin Dashboard" onClick={() => window.location.href = '/admin'}>
              <Shield size={16} />
            </div>
          )}
          <button onClick={onOpenSettings} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900 transition-all cursor-pointer" title="Settings">
            <Settings size={16} />
          </button>
          <button onClick={logout} className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-950/20 transition-all cursor-pointer" title="Log Out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* User Search Input */}
      <div className="p-3">
        <form onSubmit={handleSearchUsers} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users to add..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-all"
          />
          <Search size={14} className="absolute left-3 top-3 text-slate-500" />
        </form>

        {/* Search Results Display */}
        {searchQuery && searchResults.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto glass border border-slate-800 rounded-lg p-2 space-y-2">
            {searchResults.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-900 rounded-md">
                <div className="flex items-center gap-2 overflow-hidden">
                  <img
                    src={item.profilePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.username}`}
                    alt="Photo"
                    className="w-6 h-6 rounded-md object-cover bg-slate-800"
                  />
                  <div className="truncate">
                    <p className="text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">@{item.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAddFriend(item.id)}
                  className="bg-violet-600 hover:bg-violet-500 text-white p-1 rounded-md cursor-pointer transition-colors"
                >
                  <UserPlus size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {searching && <p className="text-[10px] text-slate-500 mt-1 pl-2">Searching...</p>}
        {searchStatus && <p className="text-[10px] text-slate-500 mt-1 pl-2">{searchStatus}</p>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 px-2 gap-1 text-xs font-semibold">
        <button
          onClick={() => { setActiveTab('friends'); setSearchQuery(''); }}
          className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'friends' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare size={14} /> Friends
        </button>
        <button
          onClick={() => { setActiveTab('groups'); setSearchQuery(''); }}
          className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'groups' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={14} /> Groups
        </button>
        <button
          onClick={() => { setActiveTab('requests'); setSearchQuery(''); }}
          className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
            activeTab === 'requests' ? 'border-violet-500 text-violet-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserPlus size={14} /> Requests
          {pendingReceived.length > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-500 animate-ping"></span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'friends' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 tracking-wider px-2 py-1 uppercase">
              <span>Direct Chats</span>
              <span>{friends.length}</span>
            </div>
            {friends.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No friends added yet.</p>
            ) : (
              friends.map((item) => {
                const isOnline = onlineUsers.has(item.friend.id);
                const dmRoomId = `dm_${[user?.id, item.friend.id].sort().join('_')}`;
                const isActive = activeRoomId === dmRoomId;
                
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveRoom(dmRoomId, 'DIRECT', item)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      isActive ? 'bg-slate-900 border border-slate-800' : 'hover:bg-slate-900/40 border border-transparent'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={item.friend.profilePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.friend.username}`}
                        alt="Photo"
                        className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-800"
                      />
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-950 ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}></span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold truncate text-slate-200">{item.friend.name}</p>
                        {item.friend.publicKey && (
                          <span className="text-[9px] px-1 bg-slate-900 border border-slate-800 text-violet-400 font-bold rounded">E2EE</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">@{item.friend.username}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 tracking-wider px-2 py-1 uppercase">
              <span>Rooms</span>
              <button onClick={onOpenCreateGroup} className="text-violet-400 hover:text-violet-300 p-0.5 rounded cursor-pointer">
                <Plus size={14} />
              </button>
            </div>
            {groups.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No group chats joined.</p>
            ) : (
              groups.map((group) => {
                const groupRoomId = `group_${group.id}`;
                const isActive = activeRoomId === groupRoomId;

                return (
                  <div
                    key={group.id}
                    onClick={() => setActiveRoom(groupRoomId, 'GROUP', group)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      isActive ? 'bg-slate-900 border border-slate-800' : 'hover:bg-slate-900/40 border border-transparent'
                    }`}
                  >
                    <img
                      src={group.groupImage || `https://api.dicebear.com/7.x/identicon/svg?seed=${group.name}`}
                      alt="Photo"
                      className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-800"
                    />
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-xs font-semibold truncate text-slate-200">{group.name}</h4>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {group.members.length} members
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            {/* Received Requests */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 tracking-wider px-2 py-1 uppercase mb-1">
                Received ({pendingReceived.length})
              </p>
              {pendingReceived.length === 0 ? (
                <p className="text-[10px] text-slate-600 text-center py-2">No pending requests.</p>
              ) : (
                pendingReceived.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-2 hover:bg-slate-900/40 border border-slate-900 rounded-xl gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img
                        src={req.user.profilePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.user.username}`}
                        alt="Photo"
                        className="w-8 h-8 rounded-lg object-cover bg-slate-850"
                      />
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate">{req.user.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">@{req.user.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => acceptFriendRequest(req.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded-md cursor-pointer"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => rejectFriendRequest(req.id)}
                        className="bg-red-600 hover:bg-red-500 text-white p-1 rounded-md cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sent Requests */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 tracking-wider px-2 py-1 uppercase mb-1">
                Sent ({pendingSent.length})
              </p>
              {pendingSent.length === 0 ? (
                <p className="text-[10px] text-slate-600 text-center py-2">No sent requests.</p>
              ) : (
                pendingSent.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-2 hover:bg-slate-900/40 border border-slate-900 rounded-xl gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img
                        src={req.user.profilePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.user.username}`}
                        alt="Photo"
                        className="w-8 h-8 rounded-lg object-cover bg-slate-850"
                      />
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate">{req.user.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">@{req.user.username}</p>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded">
                      Pending
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Import statement for API in first function needs definition. Let's make sure it imports api.
import api from '../services/api';

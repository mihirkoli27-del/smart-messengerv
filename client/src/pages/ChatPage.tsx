import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { SettingsModal } from '../components/SettingsModal';
import { GroupModal } from '../components/GroupModal';
import { useChat } from '../context/ChatContext';

export const ChatPage: React.FC = () => {
  const { activeRoomId } = useChat();
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Panel */}
      <div className={`${activeRoomId ? 'hidden md:flex' : 'flex w-full md:w-80'} h-full flex-col shrink-0`}>
        <Sidebar
          onOpenSettings={() => setShowSettings(true)}
          onOpenCreateGroup={() => setShowCreateGroup(true)}
        />
      </div>

      {/* Main Chat Area */}
      <div className={`${activeRoomId ? 'flex' : 'hidden md:flex'} flex-1 h-full`}>
        <ChatArea />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <GroupModal onClose={() => setShowCreateGroup(false)} />
      )}
    </div>
  );
};

export default ChatPage;

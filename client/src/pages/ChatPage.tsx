import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatArea } from '../components/ChatArea';
import { SettingsModal } from '../components/SettingsModal';
import { GroupModal } from '../components/GroupModal';

export const ChatPage: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Panel */}
      <Sidebar
        onOpenSettings={() => setShowSettings(true)}
        onOpenCreateGroup={() => setShowCreateGroup(true)}
      />

      {/* Main Chat Area */}
      <ChatArea />

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

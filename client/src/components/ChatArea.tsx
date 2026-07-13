import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { Send, Paperclip, Clock, Sparkles, Languages, AlertTriangle, FileText, ChevronDown, CheckCheck, Loader2, X } from 'lucide-react';

export const ChatArea: React.FC = () => {
  const { user } = useAuth();
  const {
    activeRoomId, activeRoomType, activeRoomData, messages,
    typingUsers, aiSuggestions, aiSummary, aiSummaryLoading,
    sendMessage, requestChatSummary, translateTextMessage,
    requestSmartReplies, setTypingStatus
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationTimer, setExpirationTimer] = useState<number>(300); // 5 minutes default
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState('Spanish');
  const [showTranslateMenuId, setShowTranslateMenuId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Timer countdown hook for messages
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      // Trigger AI Smart Replies suggestion on new incoming message
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== user?.id) {
        requestSmartReplies();
      }
    }
  }, [messages.length, user?.id]);

  // Typing debounce timer
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    setTypingStatus(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, 3000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    await sendMessage(inputText, selectedFile, expirationTimer);
    setInputText('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTypingStatus(false);
  };

  const handleSuggestionClick = async (text: string) => {
    await sendMessage(text, null, expirationTimer);
  };

  const handleTranslate = async (msgId: string, content: string) => {
    setTranslatingId(msgId);
    await translateTextMessage(msgId, content, targetLang);
    setTranslatingId(null);
    setShowTranslateMenuId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  if (!activeRoomId) {
    return (
      <div className="flex-1 h-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-violet-400 mb-4 animate-bounce">
          <Sparkles size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-400">Your Secure Sanctuary</h3>
        <p className="text-xs text-center max-w-sm mt-2 leading-relaxed">
          Select a conversation from the sidebar to begin. Every word and file shared is transient and will dissolve after its expiration countdown.
        </p>
      </div>
    );
  }

  const roomName = activeRoomType === 'DIRECT' ? activeRoomData.friend.name : activeRoomData.name;
  const roomUsername = activeRoomType === 'DIRECT' ? `@${activeRoomData.friend.username}` : 'Group chat';
  const isE2EE = activeRoomType === 'DIRECT' ? !!activeRoomData.friend.publicKey : true; // Simplification

  // List of other users currently typing in this room
  const typers = typingUsers[activeRoomId] || new Set();
  const typingList = Array.from(typers).filter(id => id !== user?.id);

  const timerOptions = [
    { label: '30 seconds', value: 30 },
    { label: '1 minute', value: 60 },
    { label: '5 minutes', value: 300 },
    { label: '10 minutes', value: 600 },
    { label: '1 hour', value: 3600 },
    { label: '24 hours', value: 86400 }
  ];

  return (
    <div className="flex-1 h-full bg-slate-950 flex flex-col relative">
      {/* Header */}
      <div className="p-4 border-b border-slate-900 bg-slate-950 flex items-center justify-between z-10">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-slate-100">{roomName}</h3>
            {isE2EE && (
              <span className="text-[10px] px-1.5 py-0.5 bg-violet-950/40 border border-violet-800/40 text-violet-400 font-bold rounded-full flex items-center gap-1">
                E2EE Secure
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {typingList.length > 0 ? (
              <span className="text-violet-400 animate-pulse font-medium">Someone is typing...</span>
            ) : (
              roomUsername
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => { requestChatSummary(); setShowSummaryModal(true); }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles size={14} className="text-violet-400 animate-pulse" /> AI Summary
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600">
            <Clock size={28} className="mb-2 text-slate-800" />
            <p className="text-xs">No messages yet. Send a message to start.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            const remainingSecs = Math.max(0, Math.floor((msg.expiresAt - currentTime) / 1000));
            
            // Format remaining duration string
            const formatTime = (secs: number) => {
              if (secs < 60) return `${secs}s`;
              const mins = Math.floor(secs / 60);
              if (mins < 60) return `${mins}m`;
              const hrs = Math.floor(mins / 60);
              return `${hrs}h`;
            };

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1 px-1">
                  <span className="font-semibold">{isMe ? 'You' : roomName}</span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div className="flex items-end gap-2 max-w-[80%] relative group">
                  {isMe && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-full shrink-0">
                      <Clock size={10} className="text-slate-500" />
                      <span>{formatTime(remainingSecs)}</span>
                    </div>
                  )}

                  <div className={`p-3.5 rounded-2xl relative shadow-md ${
                    isMe 
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-br-none' 
                      : 'bg-slate-900 border border-slate-850 text-slate-200 rounded-bl-none'
                  }`}>
                    {/* Render File attachment if present */}
                    {msg.fileUrl && (
                      <div className="mb-2 p-2.5 bg-black/20 border border-white/5 rounded-lg flex items-center gap-2 max-w-xs">
                        <FileText size={20} className="text-slate-300" />
                        <div className="overflow-hidden flex-1">
                          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline truncate block hover:text-violet-200">
                            {msg.fileName}
                          </a>
                          <span className="text-[9px] text-slate-400 mt-0.5 block">
                            {Math.round((msg.fileSize || 0) / 1024)} KB
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {msg.decryptedContent && (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.decryptedContent}</p>
                    )}

                    {/* Action buttons (Translate / Report) overlaying on hover */}
                    <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} hidden group-hover:flex flex-col gap-1`}>
                      {msg.decryptedContent && !msg.fileUrl && (
                        <button
                          onClick={() => setShowTranslateMenuId(showTranslateMenuId === msg.id ? null : msg.id)}
                          className="p-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-md shadow-md cursor-pointer"
                          title="Translate"
                        >
                          <Languages size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {!isMe && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-full shrink-0">
                      <Clock size={10} className="text-slate-500" />
                      <span>{formatTime(remainingSecs)}</span>
                    </div>
                  )}

                  {/* Translate Popup */}
                  {showTranslateMenuId === msg.id && (
                    <div className={`absolute top-8 ${isMe ? 'left-0' : 'right-0'} z-20 bg-slate-900 border border-slate-850 p-2.5 rounded-xl shadow-xl w-40 flex flex-col gap-1`}>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Translate Language</p>
                      {['Spanish', 'French', 'Hindi', 'German', 'Japanese'].map(lang => (
                        <button
                          key={lang}
                          onClick={() => { setTargetLang(lang); handleTranslate(msg.id, msg.decryptedContent || ''); }}
                          className="text-[10px] font-semibold text-slate-300 hover:bg-slate-800 p-1.5 rounded-md text-left transition-colors cursor-pointer"
                        >
                          {translatingId === msg.id && targetLang === lang ? 'Translating...' : lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Smart Replies Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 items-center bg-slate-950 border-t border-slate-900/40">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 pr-1">
            <Sparkles size={12} className="text-violet-400" /> AI Suggestions:
          </span>
          {aiSuggestions.map((text, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(text)}
              className="text-[10px] font-semibold px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* Composer Input Bar */}
      <div className="p-4 border-t border-slate-900 bg-slate-950">
        <form onSubmit={handleSend} className="flex flex-col gap-2">
          {selectedFile && (
            <div className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded-lg max-w-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <Paperclip size={14} className="text-violet-400" />
                <span className="text-xs truncate font-semibold">{selectedFile.name}</span>
              </div>
              <button type="button" onClick={() => setSelectedFile(null)} className="text-slate-500 hover:text-slate-350 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer shrink-0"
              title="Attach File"
            >
              <Paperclip size={18} />
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type a secure message..."
                className="w-full bg-slate-900 border border-slate-850 rounded-xl py-3 pl-4 pr-12 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                {/* Expiration Timer selector */}
                <button
                  type="button"
                  onClick={() => setShowTimerMenu(!showTimerMenu)}
                  className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-0.5 rounded-lg cursor-pointer"
                  title="Expiration Time"
                >
                  <Clock size={16} />
                  <ChevronDown size={10} />
                </button>
              </div>

              {/* Timer Menu Dropdown */}
              {showTimerMenu && (
                <div className="absolute bottom-12 right-2 z-20 bg-slate-900 border border-slate-850 p-2.5 rounded-xl shadow-xl w-40 flex flex-col gap-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Dissolve Timer</p>
                  {timerOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setExpirationTimer(opt.value); setShowTimerMenu(false); }}
                      className={`text-[10px] font-semibold p-1.5 rounded-md text-left transition-colors cursor-pointer ${
                        expirationTimer === opt.value ? 'bg-violet-950/40 text-violet-400' : 'text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="p-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-violet-900/20 transition-all cursor-pointer shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>

      {/* AI Summary Drawer Modal */}
      {showSummaryModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-end">
          <div className="w-80 h-full bg-slate-950 border-l border-slate-900 p-6 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                <Sparkles size={16} className="text-violet-400" /> AI Conversation Summary
              </h3>
              <button onClick={() => setShowSummaryModal(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {aiSummaryLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 size={24} className="animate-spin text-violet-400" />
                  <p className="text-[10px]">Processing transcripts...</p>
                </div>
              ) : (
                <div className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap bg-slate-900/40 border border-slate-900 p-4 rounded-xl">
                  {aiSummary}
                </div>
              )}
            </div>
            
            <p className="text-[9px] text-slate-600 mt-4 leading-relaxed">
              * Summaries are generated using Gemini. If E2EE is active, messages are decrypted locally before being processed securely.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

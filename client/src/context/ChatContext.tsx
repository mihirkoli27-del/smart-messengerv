import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { getSocket, connectSocket, disconnectSocket } from '../services/socket';
import { encryptMessage, decryptMessage } from '../services/crypto';

interface Message {
  id: string;
  roomId: string;
  chatType: 'DIRECT' | 'GROUP';
  senderId: string;
  receiverId: string;
  encryptedContent: string | null;
  decryptedContent?: string; // Client-side decrypted
  iv: string | null;
  encryptedKeys: { [userId: string]: string } | null;
  isEncrypted: boolean;
  timestamp: number;
  expiresAt: number;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  error?: boolean;
}

interface Friend {
  id: string;
  friend: {
    id: string;
    name: string;
    username: string;
    profilePhoto: string | null;
    bio: string | null;
    publicKey: string | null;
  };
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  groupImage: string | null;
  createdBy: string;
  members: Array<{
    id: string;
    userId: string;
    role: 'ADMIN' | 'MEMBER';
    user: {
      id: string;
      name: string;
      username: string;
      profilePhoto: string | null;
      publicKey: string | null;
    };
  }>;
}

interface ChatContextType {
  friends: Friend[];
  pendingSent: any[];
  pendingReceived: any[];
  blocked: any[];
  groups: Group[];
  activeRoomId: string | null;
  activeRoomType: 'DIRECT' | 'GROUP' | null;
  activeRoomData: any;
  messages: Message[];
  onlineUsers: Set<string>;
  typingUsers: { [roomId: string]: Set<string> };
  aiSuggestions: string[];
  aiSummary: string;
  aiSummaryLoading: boolean;
  setActiveRoom: (roomId: string | null, type: 'DIRECT' | 'GROUP' | null, roomData: any) => void;
  sendMessage: (content: string, file: File | null, duration: number) => Promise<void>;
  sendFriendRequest: (receiverId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  createGroupChat: (name: string, description: string, memberIds: string[]) => Promise<void>;
  requestChatSummary: () => Promise<void>;
  translateTextMessage: (messageId: string, text: string, targetLanguage: string) => Promise<string>;
  requestSmartReplies: () => Promise<void>;
  setTypingStatus: (isTyping: boolean) => void;
  loadFriendsAndGroups: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, privateKey } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomType, setActiveRoomType] = useState<'DIRECT' | 'GROUP' | null>(null);
  const [activeRoomData, setActiveRoomData] = useState<any>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<{ [roomId: string]: Set<string> }>({});
  
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState<boolean>(false);

  // Load friends lists and group memberships
  const loadFriendsAndGroups = useCallback(async () => {
    if (!user) return;
    try {
      const friendRes = await api.get('/friends');
      setFriends(friendRes.data.friends || []);
      setPendingSent(friendRes.data.pendingSent || []);
      setPendingReceived(friendRes.data.pendingReceived || []);
      setBlocked(friendRes.data.blocked || []);

      const groupRes = await api.get('/groups');
      setGroups(groupRes.data || []);
    } catch (err) {
      console.error('Failed to load friends/groups:', err);
    }
  }, [user]);

  // Decrypt an E2EE message locally
  const decryptIncomingMessage = useCallback(async (msg: Message): Promise<Message> => {
    if (!msg.isEncrypted || !msg.encryptedContent || !msg.iv || !msg.encryptedKeys || !user || !privateKey) {
      // Not encrypted or missing decryption context
      return { ...msg, decryptedContent: msg.encryptedContent || '' };
    }

    const encryptedKeyForMe = msg.encryptedKeys[user.id];
    if (!encryptedKeyForMe) {
      return { ...msg, decryptedContent: '[Encrypted Message - Key unavailable for this session]' };
    }

    try {
      const decrypted = await decryptMessage(msg.encryptedContent, msg.iv, encryptedKeyForMe, privateKey);
      return { ...msg, decryptedContent: decrypted };
    } catch (err) {
      console.warn('Decryption failed for message ID:', msg.id, err);
      return { ...msg, decryptedContent: '[Decryption Error: Key mismatch or corrupted content]' };
    }
  }, [user, privateKey]);

  // Connect Socket and Load initial data
  useEffect(() => {
    if (user) {
      connectSocket(user.id);
      loadFriendsAndGroups();
      
      const socket = getSocket();

      // Listen for online status updates
      socket.on('user_status_update', (data: { userId: string; isOnline: boolean }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          if (data.isOnline) {
            next.add(data.userId);
          } else {
            next.delete(data.userId);
          }
          return next;
        });
      });

      // Listen for typing indicator updates
      socket.on('typing_update', (data: { roomId: string; userId: string; isTyping: boolean }) => {
        setTypingUsers(prev => {
          const next = { ...prev };
          if (!next[data.roomId]) {
            next[data.roomId] = new Set();
          } else {
            next[data.roomId] = new Set(next[data.roomId]);
          }

          if (data.isTyping) {
            next[data.roomId].add(data.userId);
          } else {
            next[data.roomId].delete(data.userId);
          }
          return next;
        });
      });

      // Listen for new messages
      socket.on('new_message', async (msg: Message) => {
        if (activeRoomId && msg.roomId === activeRoomId) {
          const decrypted = await decryptIncomingMessage(msg);
          setMessages(prev => {
            // Deduplicate in case message already added via REST response
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, decrypted];
          });
          
          // Clear typing status when message arrives
          setTypingUsers(prev => {
            if (!prev[msg.roomId]) return prev;
            const next = { ...prev };
            next[msg.roomId] = new Set(next[msg.roomId]);
            next[msg.roomId].delete(msg.senderId);
            return next;
          });
        }
      });

      // Listen for message expiration deletion events
      socket.on('message_expired', (data: { messageId: string; roomId: string }) => {
        if (activeRoomId && data.roomId === activeRoomId) {
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        }
      });

      return () => {
        socket.off('user_status_update');
        socket.off('typing_update');
        socket.off('new_message');
        socket.off('message_expired');
        disconnectSocket();
      };
    }
  }, [user, activeRoomId, decryptIncomingMessage, loadFriendsAndGroups]);

  // Load messages when entering a new room
  useEffect(() => {
    const loadRoomMessages = async () => {
      if (!user || !activeRoomId) {
        setMessages([]);
        return;
      }

      try {
        const res = await api.get(`/messages/${activeRoomId}`);
        const rawMsgs: Message[] = res.data || [];
        
        // Decrypt messages sequentially
        const decryptedList = await Promise.all(
          rawMsgs.map(m => decryptIncomingMessage(m))
        );
        
        setMessages(decryptedList);
        setAiSummary('');
        setAiSuggestions([]);
      } catch (err) {
        console.error('Failed to load room messages:', err);
      }
    };

    loadRoomMessages();
  }, [activeRoomId, user, decryptIncomingMessage]);

  // Join/leave rooms on activeRoomId change
  useEffect(() => {
    const socket = getSocket();
    if (activeRoomId && socket.connected) {
      socket.emit('join_room', activeRoomId);
      return () => {
        socket.emit('leave_room', activeRoomId);
      };
    }
  }, [activeRoomId]);

  const setActiveRoom = (roomId: string | null, type: 'DIRECT' | 'GROUP' | null, roomData: any) => {
    setActiveRoomId(roomId);
    setActiveRoomType(type);
    setActiveRoomData(roomData);
  };

  // Send a message/file
  const sendMessage = async (content: string, file: File | null, duration: number) => {
    if (!user || !activeRoomId || !activeRoomType || !activeRoomData) return;

    try {
      const formData = new FormData();
      formData.append('chatType', activeRoomType);
      formData.append('duration', duration.toString());
      
      let isE2EE = false;
      const recipients: Array<{ userId: string; publicKeyJwk: string }> = [];

      // Determine recipients and E2EE capability
      if (activeRoomType === 'DIRECT') {
        const friendObj = activeRoomData.friend;
        formData.append('receiverId', friendObj.id);
        
        if (friendObj.publicKey) {
          isE2EE = true;
          recipients.push({ userId: friendObj.id, publicKeyJwk: friendObj.publicKey });
        }
      } else {
        formData.append('receiverId', activeRoomData.id);
        // For groups, if every member has a public key uploaded, we can encrypt it.
        // For simplicity in group encryption, if E2EE is enabled, we check if members have public keys.
        const groupMembers = activeRoomData.members || [];
        const encryptable = groupMembers.every((m: any) => m.user.publicKey);
        if (encryptable && groupMembers.length > 0) {
          isE2EE = true;
          groupMembers.forEach((m: any) => {
            if (m.userId !== user.id) {
              recipients.push({ userId: m.userId, publicKeyJwk: m.user.publicKey });
            }
          });
        }
      }

      // If E2EE is active and we have text content
      if (isE2EE && content) {
        // Find our public key (either generate or import, but we need our own public CryptoKey)
        // Since we only have privateKey stored in state, we can generate a temporary publicKey or import JWK.
        // Actually, we can get our own public key by generating from private key, or import the JWK public key.
        // To do this simply, we will fetch our public key JWK from localStorage or authContext.
        const myJwk = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).publicKey : null;
        if (myJwk && privateKey) {
          // Import public key
          const { importPublicKey } = await import('../services/crypto');
          const myPublicKey = await importPublicKey(myJwk);
          
          const encrypted = await encryptMessage(content, recipients, { userId: user.id, publicKey: myPublicKey });
          
          formData.append('encryptedContent', encrypted.encryptedContent);
          formData.append('iv', encrypted.iv);
          formData.append('encryptedKeys', JSON.stringify(encrypted.encryptedKeys));
          formData.append('isEncrypted', 'true');
        } else {
          // Fallback to plain text
          formData.append('encryptedContent', content);
          formData.append('isEncrypted', 'false');
        }
      } else {
        // Plain text
        formData.append('encryptedContent', content);
        formData.append('isEncrypted', 'false');
      }

      if (file) {
        formData.append('file', file);
      }

      const res = await api.post('/messages', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Decrypt and insert locally to show instantly
      const decrypted = await decryptIncomingMessage(res.data);
      setMessages(prev => {
        if (prev.some(m => m.id === decrypted.id)) return prev;
        return [...prev, decrypted];
      });
      
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    await api.post('/friends/request', { receiverId });
    await loadFriendsAndGroups();
  };

  const acceptFriendRequest = async (requestId: string) => {
    await api.post('/friends/accept', { requestId });
    await loadFriendsAndGroups();
  };

  const rejectFriendRequest = async (requestId: string) => {
    await api.post('/friends/reject', { requestId });
    await loadFriendsAndGroups();
  };

  const removeFriend = async (friendId: string) => {
    await api.post('/friends/remove', { friendId });
    await loadFriendsAndGroups();
  };

  const createGroupChat = async (name: string, description: string, memberIds: string[]) => {
    await api.post('/groups', { name, description, memberIds });
    await loadFriendsAndGroups();
  };

  const setTypingStatus = (isTyping: boolean) => {
    if (!user || !activeRoomId) return;
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('typing_status', { roomId: activeRoomId, userId: user.id, isTyping });
    }
  };

  // AI features
  const requestChatSummary = async () => {
    if (messages.length === 0) return;
    setAiSummaryLoading(true);
    try {
      // Map decrypted contents so AI gets plain text (preserving E2EE)
      const mappedMsgs = messages
        .filter(m => m.decryptedContent && !m.fileUrl)
        .map(m => {
          const sender = m.senderId === user?.id ? 'You' : 'Participant';
          return { senderName: sender, content: m.decryptedContent };
        });

      if (mappedMsgs.length === 0) {
        setAiSummary('No text messages available to summarize.');
        setAiSummaryLoading(false);
        return;
      }

      const res = await api.post('/ai/summarize', { messages: mappedMsgs });
      setAiSummary(res.data.summary || 'Summary unavailable.');
    } catch (err) {
      console.error('Summarize request failed:', err);
      setAiSummary('Failed to generate AI summary.');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const translateTextMessage = async (messageId: string, text: string, targetLanguage: string): Promise<string> => {
    try {
      const res = await api.post('/ai/translate', { text, targetLanguage });
      const transText = res.data.translatedText || text;
      
      // Update local state to cache translation visually
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, decryptedContent: `${m.decryptedContent}\n\n[Translated to ${targetLanguage}]: ${transText}` };
        }
        return m;
      }));

      return transText;
    } catch (err) {
      console.error('Translate request failed:', err);
      return 'Translation failed';
    }
  };

  const requestSmartReplies = async () => {
    if (messages.length === 0 || !user) return;
    try {
      // Extract last 4 messages
      const recent = messages
        .slice(-4)
        .filter(m => m.decryptedContent && !m.fileUrl)
        .map(m => {
          const sender = m.senderId === user.id ? 'Sender' : 'Receiver';
          return { senderName: sender, content: m.decryptedContent };
        });

      if (recent.length === 0) return;

      const res = await api.post('/ai/suggest-replies', { messages: recent });
      setAiSuggestions(res.data.suggestions || []);
    } catch (err) {
      console.error('Smart replies suggestion failed:', err);
    }
  };

  return (
    <ChatContext.Provider value={{
      friends, pendingSent, pendingReceived, blocked, groups,
      activeRoomId, activeRoomType, activeRoomData, messages,
      onlineUsers, typingUsers, aiSuggestions, aiSummary, aiSummaryLoading,
      setActiveRoom, sendMessage, sendFriendRequest, acceptFriendRequest,
      rejectFriendRequest, removeFriend, createGroupChat, requestChatSummary,
      translateTextMessage, requestSmartReplies, setTypingStatus, loadFriendsAndGroups
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

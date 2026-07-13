// Zero-dependency native Node.js HTTP server.
// Serves index.html, REST endpoints, uploads files, implements SSE real-time streams,
// and schedules automatic message and file expirations using in-memory timers.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 5000;
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Local Database Initialization
let db = {
  users: [],
  friends: [],
  groups: [],
  settings: {},
  reports: []
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to parse db.json, starting fresh.', e);
  }
}

const saveDb = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
};

// In-memory Temporary Message Store (Simulating Redis)
// roomId -> Array of Message Objects
const tempMessages = new Map();

// Active Real-time SSE Connections (userId -> Array of HTTP Response objects)
const activeSseConnections = new Map();

// Helper: Custom base64 converters
const base64Encode = (str) => Buffer.from(str).toString('base64');
const base64Decode = (str) => Buffer.from(str, 'base64').toString('utf8');

// JWT signature helpers using native HMAC-SHA256
const JWT_SECRET = 'aether_zero_dependency_jwt_secret_key_9988';
const hashPassword = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

const generateToken = (userId) => {
  const header = base64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Encode(JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })); // 7 days expiration
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64');
  return `${header}.${payload}.${signature}`;
};

const verifyToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64');
    if (signature !== expectedSig) return null;
    const data = JSON.parse(base64Decode(payload));
    if (data.exp < Date.now()) return null;
    return data;
  } catch (e) {
    return null;
  }
};

// Authentication Middleware
const authenticate = (req, res, callback) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Access token required' }));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid or expired token' }));
  }

  req.userId = decoded.userId;
  callback();
};

// SSE Broadcast Helper
const broadcastToUser = (userId, payload) => {
  const connections = activeSseConnections.get(userId);
  if (connections) {
    connections.forEach(res => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
  }
};

const getRoomMembers = (roomId) => {
  if (roomId.startsWith('dm_')) {
    // dm_user1_user2 -> [user1, user2]
    return roomId.split('_').slice(1);
  } else if (roomId.startsWith('group_')) {
    const groupId = roomId.replace('group_', '');
    const grp = db.groups.find(g => g.id === groupId);
    return grp ? grp.members.map(m => m.userId) : [];
  }
  return [];
};

const broadcastToRoom = (roomId, payload) => {
  const memberIds = getRoomMembers(roomId);
  memberIds.forEach(userId => {
    broadcastToUser(userId, payload);
  });
};

// Parse JSON Body
const getJsonBody = (req, res, callback) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      req.body = body ? JSON.parse(body) : {};
      callback();
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }
  });
};

// Expiration timer setup (Simulating Redis TTL Keyspace Notifications)
const scheduleMessageExpiration = (roomId, messageId, durationSeconds, filePath) => {
  setTimeout(() => {
    console.log(`[Timer] Message ${messageId} expired in room ${roomId}`);
    
    // 1. Delete message from in-memory store
    const roomMsgs = tempMessages.get(roomId);
    if (roomMsgs) {
      tempMessages.set(roomId, roomMsgs.filter(m => m.id !== messageId));
    }

    // 2. Unlink local file from disk if present
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Failed to delete expired file ${filePath}:`, err);
        else console.log(`Deleted expired file ${filePath}`);
      });
    }

    // 3. Broadcast real-time deletion event
    broadcastToRoom(roomId, {
      type: 'message_expired',
      messageId,
      roomId
    });

  }, durationSeconds * 1000);
};

// Native Gemini API requester
const callGemini = (prompt, callback, errorCallback) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorCallback(new Error('GEMINI_API_KEY environment variable is not configured.'));
  }

  const postData = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const text = json.candidates[0].content.parts[0].text;
        callback(text);
      } catch (err) {
        errorCallback(new Error('Failed to parse Gemini response payload'));
      }
    });
  });

  req.on('error', (e) => {
    errorCallback(e);
  });

  req.write(postData);
  req.end();
};

// HTTP Server Listener
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // --- Serve Frontend Static Page ---
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }

  // --- Serve Uploaded Files ---
  if (pathname.startsWith('/uploads/')) {
    const filename = pathname.replace('/uploads/', '');
    const safePath = path.join(UPLOADS_DIR, path.basename(filename));
    
    if (fs.existsSync(safePath)) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      return res.end(fs.readFileSync(safePath));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'File not found' }));
    }
  }

  // --- Real-time SSE Stream Channel Endpoint ---
  if (pathname === '/api/events' && method === 'GET') {
    const userId = parsedUrl.searchParams.get('userId');
    if (!userId) {
      res.writeHead(400);
      return res.end('userId required');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    if (!activeSseConnections.has(userId)) {
      activeSseConnections.set(userId, []);
    }
    activeSseConnections.get(userId).push(res);
    console.log(`[SSE] User ${userId} opened events channel`);

    req.on('close', () => {
      console.log(`[SSE] User ${userId} disconnected event stream`);
      const list = activeSseConnections.get(userId) || [];
      activeSseConnections.set(userId, list.filter(r => r !== res));
    });
    return;
  }

  // ================= REST API ROUTES =================

  // 1. REGISTER
  if (pathname === '/api/auth/register' && method === 'POST') {
    return getJsonBody(req, res, () => {
      const { name, username, email, password } = req.body;
      if (!name || !username || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing registration details' }));
      }

      if (db.users.some(u => u.email === email || u.username === username)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Email or username already registered' }));
      }

      const newUser = {
        id: crypto.randomUUID(),
        name,
        username,
        email,
        passwordHash: hashPassword(password),
        profilePhoto: null,
        bio: null,
        publicKey: null,
        isSuspended: false,
        isAdmin: email.toLowerCase() === 'mihirkoli27@gmail.com'
      };

      db.users.push(newUser);
      db.settings[newUser.id] = {
        lastSeenVisibility: 'ALL',
        messageTimerDefault: 300,
        readReceipts: true
      };
      saveDb();

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'User registered', user: { id: newUser.id } }));
    });
  }

  // 2. LOGIN
  if (pathname === '/api/auth/login' && method === 'POST') {
    return getJsonBody(req, res, () => {
      const { email, password } = req.body;
      const user = db.users.find(u => u.email === email && u.passwordHash === hashPassword(password));

      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid credentials' }));
      }

      if (user.isSuspended) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'This user account has been suspended' }));
      }

      const accessToken = generateToken(user.id);
      
      // Update online presence state
      user.isOnline = true;
      broadcastToRoom(`friends`, { type: 'user_status_update', userId: user.id });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          profilePhoto: user.profilePhoto,
          bio: user.bio,
          publicKey: user.publicKey,
          isAdmin: !!user.isAdmin,
          settings: db.settings[user.id]
        }
      }));
    });
  }

  // 3. OTP FORGOT PASSWORD
  const activeOtps = new Map();
  if (pathname === '/api/auth/forgot-password' && method === 'POST') {
    return getJsonBody(req, res, () => {
      const { email } = req.body;
      const user = db.users.find(u => u.email === email);
      if (!user) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: 'If account exists, OTP sent.' }));
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      activeOtps.set(email, otp);

      console.log(`\n======================================================`);
      console.log(`[PASSWORD RESET OTP FOR ${email}]: ${otp}`);
      console.log(`======================================================\n`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'If account exists, OTP sent.' }));
    });
  }

  // 4. RESET PASSWORD
  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    return getJsonBody(req, res, () => {
      const { email, otp, newPassword } = req.body;
      const savedOtp = activeOtps.get(email);
      
      if (!savedOtp || savedOtp !== otp) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired OTP code' }));
      }

      const userIdx = db.users.findIndex(u => u.email === email);
      if (userIdx !== -1) {
        db.users[userIdx].passwordHash = hashPassword(newPassword);
        saveDb();
      }
      activeOtps.delete(email);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Password updated successfully' }));
    });
  }

  // 5. GET USER PROFILE
  if (pathname === '/api/users/profile' && method === 'GET') {
    return authenticate(req, res, () => {
      const user = db.users.find(u => u.id === req.userId);
      if (!user) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...user,
        settings: db.settings[user.id]
      }));
    });
  }

  // 6. UPDATE PROFILE (Name, bio, photo, public key)
  if (pathname === '/api/users/profile' && method === 'PUT') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { name, bio, profilePhoto, publicKey } = req.body;
        const userIdx = db.users.findIndex(u => u.id === req.userId);
        
        if (userIdx !== -1) {
          if (name) db.users[userIdx].name = name;
          if (bio !== undefined) db.users[userIdx].bio = bio;
          if (profilePhoto !== undefined) db.users[userIdx].profilePhoto = profilePhoto;
          if (publicKey !== undefined) db.users[userIdx].publicKey = publicKey;
          saveDb();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Profile updated', user: db.users[userIdx] }));
      });
    });
  }

  // 7. UPDATE SETTINGS
  if (pathname === '/api/users/settings' && method === 'PUT') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        db.settings[req.userId] = {
          ...db.settings[req.userId],
          ...req.body
        };
        saveDb();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Settings updated', settings: db.settings[req.userId] }));
      });
    });
  }

  // 8. SEARCH USERS
  if (pathname === '/api/users/search' && method === 'GET') {
    return authenticate(req, res, () => {
      const q = parsedUrl.searchParams.get('query');
      if (!q) {
        res.writeHead(400);
        return res.end();
      }

      const queryLower = q.toLowerCase();
      const matched = db.users
        .filter(u => u.id !== req.userId && !u.isSuspended && (u.username.toLowerCase().includes(queryLower) || u.name.toLowerCase().includes(queryLower)))
        .map(u => ({ id: u.id, name: u.name, username: u.username, profilePhoto: u.profilePhoto, publicKey: u.publicKey }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(matched));
    });
  }

  // 9. FRIEND LIST & REQUESTS
  if (pathname === '/friends' && method === 'GET') {
    return authenticate(req, res, () => {
      const rels = db.friends.filter(f => f.senderId === req.userId || f.receiverId === req.userId);
      const friends = [];
      const pendingSent = [];
      const pendingReceived = [];
      const blocked = [];

      rels.forEach(r => {
        const isSender = r.senderId === req.userId;
        const otherId = isSender ? r.receiverId : r.senderId;
        const otherUser = db.users.find(u => u.id === otherId);
        
        if (!otherUser || otherUser.isSuspended) return;

        const info = {
          id: otherUser.id,
          name: otherUser.name,
          username: otherUser.username,
          profilePhoto: otherUser.profilePhoto,
          publicKey: otherUser.publicKey,
          isOnline: !!otherUser.isOnline
        };

        if (r.status === 'ACCEPTED') {
          friends.push({ id: r.id, friend: info });
        } else if (r.status === 'PENDING') {
          if (isSender) pendingSent.push({ id: r.id, user: info });
          else pendingReceived.push({ id: r.id, user: info });
        } else if (r.status === 'BLOCKED' && isSender) {
          blocked.push({ id: r.id, user: info });
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ friends, pendingSent, pendingReceived, blocked }));
    });
  }

  // 10. SEND FRIEND REQUEST
  if (pathname === '/friends/request' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { receiverId } = req.body;
        if (!receiverId) {
          res.writeHead(400);
          return res.end();
        }

        const relation = {
          id: crypto.randomUUID(),
          senderId: req.userId,
          receiverId,
          status: 'PENDING'
        };

        db.friends.push(relation);
        saveDb();

        broadcastToUser(receiverId, { type: 'user_status_update' });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(relation));
      });
    });
  }

  // 11. ACCEPT FRIEND REQUEST
  if (pathname === '/friends/accept' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { requestId } = req.body;
        const idx = db.friends.findIndex(r => r.id === requestId && r.receiverId === req.userId);
        if (idx !== -1) {
          db.friends[idx].status = 'ACCEPTED';
          saveDb();
          
          broadcastToUser(db.friends[idx].senderId, { type: 'user_status_update' });
          broadcastToUser(req.userId, { type: 'user_status_update' });
        }
        res.writeHead(200);
        res.end();
      });
    });
  }

  // 12. REJECT FRIEND REQUEST
  if (pathname === '/friends/reject' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { requestId } = req.body;
        db.friends = db.friends.filter(r => !(r.id === requestId && r.receiverId === req.userId));
        saveDb();
        res.writeHead(200);
        res.end();
      });
    });
  }

  // 13. GROUPS CREATE & READ
  if (pathname === '/groups' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { name, description, memberIds } = req.body;
        
        const newGroup = {
          id: crypto.randomUUID(),
          name,
          description: description || null,
          createdBy: req.userId,
          members: [
            { userId: req.userId, role: 'ADMIN' },
            ...(memberIds || []).map(id => ({ userId: id, role: 'MEMBER' }))
          ]
        };

        db.groups.push(newGroup);
        saveDb();

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newGroup));
      });
    });
  }

  if (pathname === '/groups' && method === 'GET') {
    return authenticate(req, res, () => {
      const myGroups = db.groups
        .filter(g => g.members.some(m => m.userId === req.userId))
        .map(g => ({
          ...g,
          members: g.members.map(m => {
            const u = db.users.find(usr => usr.id === m.userId);
            return {
              ...m,
              user: u ? { id: u.id, name: u.name, username: u.username, publicKey: u.publicKey } : null
            };
          })
        }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(myGroups));
    });
  }

  // 14. MESSAGES POST (Supports text, base64 file upload, E2EE key payload)
  if (pathname === '/api/messages' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { receiverId, chatType, encryptedContent, iv, encryptedKeys, duration, isEncrypted, fileBase64, fileName, fileSize, fileMime } = req.body;

        if (!receiverId || !chatType || !duration) {
          res.writeHead(400);
          return res.end();
        }

        const messageId = crypto.randomUUID();
        const timestamp = Date.now();
        const expiresAt = timestamp + parseInt(duration) * 1000;

        const roomId = chatType === 'DIRECT'
          ? `dm_${[req.userId, receiverId].sort().join('_')}`
          : `group_${receiverId}`;

        let fileData = {};
        let localFilePath = null;

        // If file base64 is uploaded, write base64 file buffer to disk
        if (fileBase64) {
          try {
            const base64Data = fileBase64.split(';base64,').pop();
            const uniqueFilename = `${Date.now()}-${fileName}`;
            localFilePath = path.join(UPLOADS_DIR, uniqueFilename);
            
            fs.writeFileSync(localFilePath, base64Data, { encoding: 'base64' });
            
            fileData = {
              fileUrl: `/uploads/${uniqueFilename}`,
              fileName,
              fileSize,
              fileMime
            };
          } catch (fileErr) {
            console.error('File base64 write error:', fileErr);
          }
        }

        const msgObj = {
          id: messageId,
          roomId,
          chatType,
          senderId: req.userId,
          receiverId,
          encryptedContent: encryptedContent || null,
          iv: iv || null,
          encryptedKeys: encryptedKeys || null,
          isEncrypted: isEncrypted === 'true' || isEncrypted === true,
          timestamp,
          expiresAt,
          ...fileData
        };

        // Save to temporary memory list
        if (!tempMessages.has(roomId)) {
          tempMessages.set(roomId, []);
        }
        tempMessages.get(roomId).push(msgObj);

        // Schedule deletion timeout (simulating keyspace notification)
        scheduleMessageExpiration(roomId, messageId, parseInt(duration), localFilePath);

        // Broadcast to sockets/SSE connections in the room
        broadcastToRoom(roomId, {
          type: 'new_message',
          message
        });
        
        // Wait, broadcast format:
        broadcastToRoom(roomId, {
          type: 'new_message',
          message: msgObj
        });

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(msgObj));
      });
    });
  }

  // 15. MESSAGES GET (with cleanups)
  if (pathname.startsWith('/messages/') && method === 'GET') {
    return authenticate(req, res, () => {
      const roomId = pathname.replace('/messages/', '');
      const rawMsgs = tempMessages.get(roomId) || [];

      // Filter active non-expired messages (Self-cleaning filter)
      const activeMsgs = [];
      const expiredIds = [];

      rawMsgs.forEach(m => {
        if (m.expiresAt > Date.now()) {
          activeMsgs.push(m);
        } else {
          expiredIds.push(m.id);
        }
      });

      // Update memory store to remove expired items
      if (expiredIds.length > 0) {
        tempMessages.set(roomId, activeMsgs);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(activeMsgs));
    });
  }

  // 16. TYPING HEARBEAT
  if (pathname === '/api/typing' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { roomId, isTyping } = req.body;
        const sender = db.users.find(u => u.id === req.userId);
        
        broadcastToRoom(roomId, {
          type: 'typing_update',
          roomId,
          userId: req.userId,
          username: sender ? sender.username : 'User',
          isTyping: !!isTyping
        });

        res.writeHead(200);
        res.end();
      });
    });
  }

  // 17. AI CHAT SUMMARIZE
  if (pathname === '/api/ai/summarize' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { messages } = req.body;
        const formatted = (messages || []).map(m => `${m.senderName}: ${m.content}`).join('\n');
        
        const prompt = `Summarize the following chat conversation in 2-3 short concise bullet points. Output format: HTML bullet points.
Conversation:
${formatted}`;

        callGemini(prompt, (text) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ summary: text }));
        }, (err) => {
          // Heuristic Summary Mock Fallback
          console.warn('AI summarize call failed, using mock.', err.message);
          const count = messages ? messages.length : 0;
          const summary = `<li>Discussed temporary chat updates across ${count} exchanges.</li><li>Ensured cryptographic privacy and expiration triggers.</li>`;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ summary }));
        });
      });
    });
  }

  // 18. AI TRANSLATE
  if (pathname === '/api/ai/translate' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { text, targetLanguage } = req.body;
        const prompt = `Translate the following text into "${targetLanguage}". Return ONLY the translation, no extra texts.
Text: ${text}`;

        callGemini(prompt, (text) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ translatedText: text }));
        }, (err) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ translatedText: `[Translated to ${targetLanguage}]: ${text} (API offline)` }));
        });
      });
    });
  }

  // 19. AI SUGGEST REPLIES
  if (pathname === '/api/ai/suggest-replies' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { messages } = req.body;
        const formatted = (messages || []).map(m => `${m.senderName}: ${m.content}`).join('\n');
        
        const prompt = `Suggest exactly 3 short natural contextual replies to the recent conversation. Return ONLY as a valid JSON array of strings, e.g. ["Okay!", "Sounds good", "I will check"]. No markdown blocks.
Conversation:
${formatted}`;

        callGemini(prompt, (text) => {
          try {
            const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const suggestions = JSON.parse(cleaned);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ suggestions }));
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ suggestions: ['Got it!', 'Awesome.', 'Sounds good.'] }));
          }
        }, (err) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ suggestions: ['Sure!', 'Okay, thanks.', 'Sounds good.'] }));
        });
      });
    });
  }

  // 20. ADMIN REPORT USER
  if (pathname === '/api/users/report' && method === 'POST') {
    return authenticate(req, res, () => {
      getJsonBody(req, res, () => {
        const { targetUserId, reason, evidence } = req.body;
        if (!targetUserId || !reason) {
          res.writeHead(400);
          return res.end();
        }

        const report = {
          id: crypto.randomUUID(),
          reporterId: req.userId,
          reportedId: targetUserId,
          reason,
          evidence: evidence || null,
          createdAt: new Date().toISOString()
        };

        db.reports.push(report);
        saveDb();

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(report));
      });
    });
  }

  // 21. ADMIN STATS & REPORTS FETCH (Protected Admin check)
  const verifyAdmin = (req, res, callback) => {
    const user = db.users.find(u => u.id === req.userId);
    const hasAdmin = user && user.isAdmin;
    if (!hasAdmin) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Admin access required' }));
    }
    callback();
  };

  if (pathname === '/api/admin/stats' && method === 'GET') {
    return authenticate(req, res, () => {
      verifyAdmin(req, res, () => {
        const usersCount = db.users.length;
        const activeFriends = db.friends.filter(f => f.status === 'ACCEPTED').length;
        const groupsCount = db.groups.length;
        const reportsCount = db.reports.length;
        
        let onlineUsersCount = 0;
        activeSseConnections.forEach((connections) => {
          if (connections.length > 0) onlineUsersCount++;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          usersCount,
          activeFriends,
          groupsCount,
          reportsCount,
          onlineUsersCount,
          uptime: process.uptime()
        }));
      });
    });
  }

  if (pathname === '/api/admin/reports' && method === 'GET') {
    return authenticate(req, res, () => {
      verifyAdmin(req, res, () => {
        const reports = db.reports.map(r => {
          const reporter = db.users.find(u => u.id === r.reporterId);
          const reported = db.users.find(u => u.id === r.reportedId);
          return {
            ...r,
            reporter: reporter ? { id: reporter.id, name: reporter.name, username: reporter.username } : null,
            reported: reported ? { id: reported.id, name: reported.name, username: reported.username, isSuspended: reported.isSuspended } : null
          };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reports));
      });
    });
  }

  if (pathname.startsWith('/api/admin/users/') && pathname.endsWith('/suspend') && method === 'PUT') {
    return authenticate(req, res, () => {
      verifyAdmin(req, res, () => {
        getJsonBody(req, res, () => {
          const userId = pathname.split('/')[4];
          const { suspend } = req.body;

          const idx = db.users.findIndex(u => u.id === userId);
          if (idx !== -1) {
            db.users[idx].isSuspended = !!suspend;
            saveDb();

            // If suspending, close their SSE sockets immediately
            if (suspend) {
              const connections = activeSseConnections.get(userId) || [];
              connections.forEach(res => {
                res.write(`data: ${JSON.stringify({ type: 'session_revoked' })}\n\n`);
                res.end();
              });
              activeSseConnections.delete(userId);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'User suspended status updated' }));
        });
      });
    });
  }

  // Route Fallback
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`ZERO-DEPENDENCY SECURE TEMPORARY CHAT SERVER STARTED`);
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});

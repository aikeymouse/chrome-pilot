#!/usr/bin/env node

/**
 * ChromePilot - Native Messaging Host
 * WebSocket server with native messaging bridge to Chrome extension
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const WS_PORT = 9000;
const CHUNK_SIZE = 1024 * 1024; // 1MB
const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Sessions storage
const sessions = new Map();

// Native messaging communication - tracks if extension is connected
let extensionConnected = false;

/**
 * Session class
 */
class Session {
  constructor(sessionId, timeout) {
    this.sessionId = sessionId;
    this.timeout = timeout;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.expiresAt = this.lastActivity + timeout;
    this.ws = null;
    this.commandQueue = [];
    this.processing = false;
    this.logFile = path.join(LOGS_DIR, `session-${sessionId}-${Date.now()}.log`);
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.timeoutWarning = null;
    this.timeoutTimer = null;
    
    this.log('SESSION_CREATED', { sessionId, timeout, expiresAt: this.expiresAt });
    this.scheduleTimeout();
  }
  
  log(event, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data
    };
    this.logStream.write(JSON.stringify(logEntry) + '\n');
  }
  
  updateActivity() {
    this.lastActivity = Date.now();
    this.expiresAt = this.lastActivity + this.timeout;
    this.scheduleTimeout();
  }
  
  scheduleTimeout() {
    // Clear existing timers
    if (this.timeoutWarning) clearTimeout(this.timeoutWarning);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    
    // Schedule warning 60 seconds before expiry
    const warningTime = this.timeout - 60000;
    if (warningTime > 0) {
      this.timeoutWarning = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'sessionTimeout',
            sessionId: this.sessionId,
            remainingTime: 60000,
            message: 'Session will expire in 60 seconds'
          }));
        }
      }, warningTime);
    }
    
    // Schedule expiration
    this.timeoutTimer = setTimeout(() => {
      this.expire();
    }, this.timeout);
  }
  
  expire() {
    this.log('SESSION_EXPIRED', { sessionId: this.sessionId });
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'sessionExpired',
        sessionId: this.sessionId,
        message: 'Session has expired due to inactivity'
      }));
      this.ws.close();
    }
    
    // Notify Chrome extension
    sendNativeMessage({
      type: 'sessionExpired',
      sessionId: this.sessionId
    });
    
    this.cleanup();
    sessions.delete(this.sessionId);
  }
  
  cleanup() {
    if (this.timeoutWarning) clearTimeout(this.timeoutWarning);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    if (this.logStream) this.logStream.end();
  }
  
  async enqueueCommand(command) {
    this.commandQueue.push(command);
    this.updateActivity();
    await this.processQueue();
  }
  
  async processQueue() {
    if (this.processing || this.commandQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      await this.executeCommand(command);
    }
    
    this.processing = false;
  }
  
  async executeCommand(command) {
    this.log('REQUEST', command);
    
    // Send to extension via native messaging
    if (extensionConnected) {
      const message = {
        type: 'command',
        sessionId: this.sessionId,
        command
      };
      sendNativeMessage(message);
    } else {
      // No native connection
      this.sendError(command.requestId, 'NATIVE_HOST_ERROR', 'Not connected to Chrome extension');
    }
  }
  
  sendResponse(response) {
    this.log('RESPONSE', response);
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const responseStr = JSON.stringify(response);
    
    // Check if chunking is needed
    if (responseStr.length > CHUNK_SIZE) {
      this.sendChunked(response);
    } else {
      this.ws.send(responseStr);
    }
  }
  
  sendChunked(response) {
    const responseStr = JSON.stringify(response);
    const encoded = Buffer.from(responseStr).toString('base64');
    const totalChunks = Math.ceil(encoded.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, encoded.length);
      const chunk = encoded.substring(start, end);
      
      const chunkMessage = {
        requestId: response.requestId,
        chunk,
        chunkIndex: i,
        totalChunks
      };
      
      this.ws.send(JSON.stringify(chunkMessage));
    }
  }
  
  sendError(requestId, code, message) {
    this.sendResponse({
      requestId,
      result: null,
      error: { code, message }
    });
  }
}

/**
 * HTTP Server for WebSocket upgrade
 */
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/session')) {
    // Parse query parameters
    const url = new URL(req.url, `http://localhost:${WS_PORT}`);
    const timeout = parseInt(url.searchParams.get('timeout')) || DEFAULT_TIMEOUT;
    const sessionId = url.searchParams.get('sessionId');
    
    // Check for existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      
      if (Date.now() < session.expiresAt) {
        // Resume existing session
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          type: 'sessionResumed',
          sessionId: session.sessionId,
          timeout: session.timeout,
          expiresAt: session.expiresAt
        }));
        return;
      } else {
        // Session expired, remove it
        session.cleanup();
        sessions.delete(sessionId);
      }
    }
    
    // Session upgrade will be handled by WebSocket server
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ready',
      message: 'Upgrade to WebSocket'
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

/**
 * WebSocket Server
 */
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // Parse session parameters from URL
  const url = new URL(req.url, `http://localhost:${WS_PORT}`);
  const timeout = parseInt(url.searchParams.get('timeout')) || DEFAULT_TIMEOUT;
  let sessionId = url.searchParams.get('sessionId');
  
  let session;
  
  // Resume or create session
  if (sessionId && sessions.has(sessionId)) {
    session = sessions.get(sessionId);
    
    if (Date.now() >= session.expiresAt) {
      // Expired
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Session expired'
      }));
      ws.close();
      return;
    }
    
    // Resume
    session.ws = ws;
    session.updateActivity();
    
    ws.send(JSON.stringify({
      type: 'sessionResumed',
      sessionId: session.sessionId,
      timeout: session.timeout,
      expiresAt: session.expiresAt
    }));
  } else {
    // Create new session
    sessionId = sessionId || crypto.randomUUID();
    session = new Session(sessionId, timeout);
    session.ws = ws;
    sessions.set(sessionId, session);
    
    ws.send(JSON.stringify({
      type: 'sessionCreated',
      sessionId: session.sessionId,
      timeout: session.timeout,
      expiresAt: session.expiresAt
    }));
    
    // Notify Chrome extension about new session
    sendNativeMessage({
      type: 'sessionCreated',
      sessionId: session.sessionId,
      timeout: session.timeout,
      expiresAt: session.expiresAt
    });
  }
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Validate message format
      if (!message.action || !message.requestId) {
        ws.send(JSON.stringify({
          requestId: message.requestId || 'unknown',
          result: null,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Missing required fields: action, requestId'
          }
        }));
        return;
      }
      
      // Enqueue command
      await session.enqueueCommand(message);
      
    } catch (err) {
      ws.send(JSON.stringify({
        requestId: 'error',
        result: null,
        error: {
          code: 'PARSE_ERROR',
          message: err.message
        }
      }));
    }
  });
  
  ws.on('close', () => {
    // Don't delete session on disconnect - allow reconnection
    if (session) {
      session.ws = null;
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    if (session) {
      session.log('WS_ERROR', { error: err.message });
    }
  });
});

/**
 * Native Messaging Protocol
 */
function sendNativeMessage(message) {
  const messageStr = JSON.stringify(message);
  const messageLen = Buffer.byteLength(messageStr);
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(messageLen, 0);
  
  process.stdout.write(buffer);
  process.stdout.write(messageStr);
}

function handleNativeMessages() {
  let messageLength = null;
  let messageBuffer = Buffer.alloc(0);
  
  process.stdin.on('readable', () => {
    let chunk;
    
    while (null !== (chunk = process.stdin.read())) {
      messageBuffer = Buffer.concat([messageBuffer, chunk]);
      
      while (messageBuffer.length > 0) {
        // Read message length if we don't have it yet
        if (messageLength === null) {
          if (messageBuffer.length < 4) {
            // Not enough data for length header
            break;
          }
          
          messageLength = messageBuffer.readUInt32LE(0);
          messageBuffer = messageBuffer.slice(4);
        }
        
        // Read message if we have enough data
        if (messageLength !== null) {
          if (messageBuffer.length < messageLength) {
            // Not enough data for message
            break;
          }
          
          const messageData = messageBuffer.slice(0, messageLength);
          messageBuffer = messageBuffer.slice(messageLength);
          messageLength = null;
          
          try {
            const message = JSON.parse(messageData.toString());
            processNativeMessage(message);
          } catch (err) {
            console.error('Error parsing message:', err);
          }
        }
      }
    }
  });
  
  process.stdin.on('end', () => {
    console.error('Native messaging stdin closed');
    process.exit(0);
  });
}

function processNativeMessage(message) {
  // Mark extension as connected when we receive any message
  if (!extensionConnected) {
    extensionConnected = true;
    console.error('Chrome extension connected');
  }
  
  if (message.type === 'response') {
    // Response from extension
    const session = sessions.get(message.sessionId);
    if (session) {
      session.sendResponse({
        requestId: message.requestId,
        result: message.result,
        error: message.error
      });
    }
  } else if (message.type === 'log') {
    // Log event from extension
    const session = sessions.get(message.sessionId);
    if (session) {
      session.log(message.direction === 'in' ? 'REQUEST_EXTENSION' : 'RESPONSE_EXTENSION', message.data);
    }
  } else if (message.type === 'tabUpdate') {
    // Broadcast tab update to all sessions
    sessions.forEach(session => {
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({
          type: 'tabUpdate',
          event: message.event,
          tab: message.tab
        }));
      }
    });
  }
}

/**
 * Startup
 */

// Start native messaging first (always works)
handleNativeMessages();

// Attach error handler to HTTP server before listening
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${WS_PORT} is already in use. Running as native messaging bridge only.`);
    
    // Send ready signal indicating another instance is serving WebSocket
    sendNativeMessage({
      type: 'ready',
      port: WS_PORT,
      bridgeOnly: true
    });
    
    // Keep process alive
    process.stdin.resume();
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Try to start WebSocket server
server.listen(WS_PORT, () => {
  console.error(`WebSocket server listening on port ${WS_PORT}`);
  
  // Send ready signal to extension
  sendNativeMessage({
    type: 'ready',
    port: WS_PORT
  });
});

/**
 * Cleanup on exit
 */
process.on('SIGINT', () => {
  console.error('Shutting down...');
  
  sessions.forEach(session => {
    session.cleanup();
  });
  
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sessions.forEach(session => {
    session.cleanup();
  });
  
  server.close();
  process.exit(0);
});

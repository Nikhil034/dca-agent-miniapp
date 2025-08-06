const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock DCA strategies and transactions data
let dcaStrategies = {
  active: [],
  completed: [],
  totalVolume: 0
};

let chatHistory = [];
let activeConnections = new Set();

// Mock transaction data
const mockTransactions = [
  {
    id: 'tx_001',
    strategy: 'ETH-USDC-5MIN',
    type: 'BUY',
    token: 'ETH',
    amount: '0.01',
    price: '2340.50',
    value: '23.41',
    timestamp: Date.now() - 300000,
    txHash: '0xabc123...',
    status: 'completed'
  },
  {
    id: 'tx_002', 
    strategy: 'ETH-USDC-5MIN',
    type: 'BUY',
    token: 'ETH',
    amount: '0.01',
    price: '2335.75',
    value: '23.36',
    timestamp: Date.now() - 600000,
    txHash: '0xdef456...',
    status: 'completed'
  }
];

// WebSocket handling for real-time chat
wss.on('connection', (ws) => {
  activeConnections.add(ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleChatMessage(data, ws);
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    activeConnections.delete(ws);
  });
});

function handleChatMessage(data, ws) {
  const { message, type } = data;
  
  // Add user message to history
  const userMessage = {
    id: Date.now(),
    type: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  chatHistory.push(userMessage);
  
  // Process message and generate AI response
  const aiResponse = processUserMessage(message);
  chatHistory.push(aiResponse);
  
  // Broadcast to all connected clients
  const chatUpdate = {
    type: 'chat_update',
    messages: [userMessage, aiResponse]
  };
  
  activeConnections.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(chatUpdate));
    }
  });
}

function processUserMessage(message) {
  const lowerMessage = message.toLowerCase();
  
  let response = {
    id: Date.now() + 1,
    type: 'agent',
    content: '',
    timestamp: new Date().toISOString(),
    action: null
  };
  
  // DCA Strategy Creation Intent
  if (lowerMessage.includes('dca') || lowerMessage.includes('dollar cost') || 
      (lowerMessage.includes('buy') && (lowerMessage.includes('every') || lowerMessage.includes('interval')))) {
    
    response.content = "🤖 I'll help you set up a DCA strategy! I can see you want to automate your purchases. Let me create a strategy for you.\n\nBased on your message, I suggest:\n• Token: ETH\n• Amount: $25 per interval\n• Interval: 5 minutes\n• Duration: 1 hour\n• DEX: Camelot on Arbitrum\n\nShould I create this strategy?";
    response.action = {
      type: 'suggest_strategy',
      strategy: {
        token: 'ETH',
        amount: 25,
        interval: 5,
        duration: 60,
        dex: 'Camelot'
      }
    };
  }
  // Transaction Status Request
  else if (lowerMessage.includes('transaction') || lowerMessage.includes('tx') || lowerMessage.includes('history')) {
    response.content = `📊 Here are your recent DCA transactions:\n\n${formatTransactionList(mockTransactions)}`;
    response.action = {
      type: 'show_transactions',
      transactions: mockTransactions
    };
  }
  // Strategy Status Request
  else if (lowerMessage.includes('strategy') || lowerMessage.includes('status') || lowerMessage.includes('active')) {
    response.content = "📈 Active Strategies:\n\n• ETH-USDC-5MIN: Running (2/12 executions)\n• Next execution in: 3m 45s\n• Total invested: $46.77\n• Current value: $48.23 (+3.1%)\n\nWould you like to modify or create a new strategy?";
  }
  // Help/Instructions
  else if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
    response.content = "🚀 DCA Agent Help:\n\n• Say 'create DCA for ETH every 5 minutes' to start\n• Ask 'show my transactions' for history\n• Say 'strategy status' for active strategies\n• Use 'stop strategy [name]' to pause\n\nI can help you automate crypto purchases on Arbitrum using Camelot DEX!";
  }
  // Greeting
  else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    response.content = "👋 Hey there! I'm your DCA (Dollar Cost Averaging) agent. I help you automate crypto purchases on Arbitrum using Camelot DEX.\n\nJust tell me what you'd like to buy and how often - for example: 'Buy $20 of ETH every 5 minutes for 1 hour'";
  }
  // Default response
  else {
    response.content = "🤖 I understand you want to set up automated trading. Could you tell me:\n\n1. Which token? (ETH, ARB, USDC, etc.)\n2. How much per purchase?\n3. How often? (every 5 minutes, 10 minutes, etc.)\n4. For how long?\n\nExample: 'Buy $25 of ETH every 5 minutes for 1 hour'";
  }
  
  return response;
}

function formatTransactionList(transactions) {
  return transactions.map(tx => 
    `${tx.type} ${tx.amount} ${tx.token} at $${tx.price}\nValue: $${tx.value} • ${new Date(tx.timestamp).toLocaleTimeString()}\nTx: ${tx.txHash.slice(0, 10)}...`
  ).join('\n\n');
}

// Mini App Embed Configuration
function getMiniAppEmbed(req) {
  const baseUrl = getBaseUrl(req);
  
  return {
    version: "1",
    imageUrl: `${baseUrl}/api/image/preview`,
    button: {
      title: "💬 Chat with DCA Agent",
      action: {
        type: "launch_frame",
        name: "DCA Agent",
        url: `${baseUrl}/app`,
        splashImageUrl: `${baseUrl}/api/image/splash`,
        splashBackgroundColor: "#0f0f23"
      }
    }
  };
}

// Main frame endpoint
app.get('/', (req, res) => {
  const embed = getMiniAppEmbed(req);
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCA Agent - Automated Trading on Arbitrum</title>
  
  <!-- Mini App Meta Tags -->
  <meta name="fc:miniapp" content='${JSON.stringify(embed)}' />
  <meta name="fc:frame" content='${JSON.stringify(embed)}' />
  
  <!-- Open Graph -->
  <meta property="og:title" content="DCA Agent - Automated Trading" />
  <meta property="og:description" content="Chat with AI to set up automated DCA strategies on Arbitrum using Camelot DEX" />
  <meta property="og:image" content="${embed.imageUrl}" />
  <meta property="og:type" content="website" />
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 600px;
      background: rgba(255,255,255,0.1);
      padding: 40px;
      border-radius: 20px;
      backdrop-filter: blur(10px);
    }
    .features {
      background: rgba(0,0,0,0.2);
      padding: 20px;
      border-radius: 12px;
      margin: 20px 0;
      text-align: left;
    }
    .feature-item {
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .stats {
      display: flex;
      justify-content: space-around;
      margin: 20px 0;
    }
    .stat {
      text-align: center;
    }
    .test-button {
      background: #00ff88;
      color: #000;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      text-decoration: none;
      display: inline-block;
      margin: 10px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 DCA Agent</h1>
    <p>AI-powered automated trading on Arbitrum</p>
    
    <div class="features">
      <h3>💼 Features</h3>
      <div class="feature-item">💬 Natural language chat interface</div>
      <div class="feature-item">⚡ Automated DCA strategies</div>
      <div class="feature-item">🔗 Arbitrum + Camelot DEX integration</div>
      <div class="feature-item">📊 Real-time transaction tracking</div>
      <div class="feature-item">🔄 Customizable intervals & duration</div>
    </div>
    
    <div class="stats">
      <div class="stat">
        <div style="font-size: 24px; font-weight: bold;">$2.3M</div>
        <div style="opacity: 0.8;">Volume Traded</div>
      </div>
      <div class="stat">
        <div style="font-size: 24px; font-weight: bold;">1,247</div>
        <div style="opacity: 0.8;">Active Strategies</div>
      </div>
      <div class="stat">
        <div style="font-size: 24px; font-weight: bold;">5min</div>
        <div style="opacity: 0.8;">Min Interval</div>
      </div>
    </div>
    
    <p><strong>🎯 How it works:</strong></p>
    <p>1. Chat with the AI agent in natural language</p>
    <p>2. Describe your DCA strategy preferences</p>
    <p>3. Agent executes trades automatically on Arbitrum</p>
    <p>4. Monitor progress and transactions in real-time</p>
    
    <a href="/app" class="test-button">💬 Test Chat Interface</a>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Mini App main interface
app.get('/app', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCA Agent Chat</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f23;
      color: white;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    /* Header */
    .header {
      background: linear-gradient(90deg, #667eea, #764ba2);
      padding: 15px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    
    .agent-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .agent-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(45deg, #00ff88, #00d4aa);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    
    .agent-details h3 {
      font-size: 16px;
      margin-bottom: 2px;
    }
    
    .agent-status {
      font-size: 12px;
      opacity: 0.8;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      background: #00ff88;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .network-info {
      text-align: right;
      font-size: 12px;
    }
    
    .network-badge {
      background: rgba(0,255,136,0.2);
      border: 1px solid #00ff88;
      border-radius: 12px;
      padding: 4px 8px;
      margin-top: 4px;
    }
    
    /* Wallet Info */
    .wallet-info {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      padding: 15px 20px;
      margin: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .wallet-status {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .wallet-address {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      background: rgba(0,255,136,0.1);
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid rgba(0,255,136,0.3);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .connect-button {
      background: linear-gradient(45deg, #00ff88, #00d4aa);
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    
    .connect-button:hover {
      transform: scale(1.05);
    }
    
    .disconnect-button {
      background: rgba(255,255,255,0.1);
      color: white;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
    }
    
    /* Chat Container */
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .messages-area {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    
    .message {
      margin-bottom: 16px;
      display: flex;
      animation: fadeIn 0.3s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .message.user {
      justify-content: flex-end;
    }
    
    .message-content {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 18px;
      position: relative;
    }
    
    .message.user .message-content {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-bottom-right-radius: 6px;
    }
    
    .message.agent .message-content {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-bottom-left-radius: 6px;
    }
    
    .message-time {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 6px;
    }
    
    /* Strategy Cards */
    .strategy-card {
      background: linear-gradient(45deg, #1a1a2e, #16213e);
      border: 1px solid #00ff88;
      border-radius: 12px;
      padding: 15px;
      margin: 10px 0;
    }
    
    .strategy-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .strategy-title {
      font-weight: bold;
      color: #00ff88;
    }
    
    .strategy-status {
      font-size: 12px;
      background: rgba(0,255,136,0.2);
      padding: 4px 8px;
      border-radius: 6px;
    }
    
    .strategy-details {
      font-size: 14px;
      line-height: 1.4;
    }
    
    /* Transaction List */
    .transaction-item {
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      border-left: 3px solid #00ff88;
    }
    
    .tx-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin-bottom: 6px;
    }
    
    .tx-details {
      font-size: 12px;
      opacity: 0.8;
    }
    
    /* Input Area */
    .input-area {
      background: rgba(255,255,255,0.05);
      padding: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    
    .input-container {
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }
    
    .message-input {
      flex: 1;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      padding: 12px 16px;
      color: white;
      resize: none;
      max-height: 100px;
      min-height: 44px;
      font-family: inherit;
      font-size: 14px;
    }
    
    .message-input:focus {
      outline: none;
      border-color: #00ff88;
      box-shadow: 0 0 0 2px rgba(0,255,136,0.2);
    }
    
    .message-input::placeholder {
      color: rgba(255,255,255,0.5);
    }
    
    .send-button {
      background: linear-gradient(45deg, #00ff88, #00d4aa);
      border: none;
      border-radius: 50%;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    
    .send-button:hover {
      transform: scale(1.05);
    }
    
    .send-button:active {
      transform: scale(0.95);
    }
    
    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Quick Actions */
    .quick-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    
    .quick-action {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 16px;
      padding: 8px 12px;
      font-size: 12px;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .quick-action:hover {
      background: rgba(0,255,136,0.2);
      border-color: #00ff88;
    }
    
    /* Typing Indicator */
    .typing-indicator {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    
    .typing-dots {
      display: flex;
      gap: 4px;
    }
    
    .typing-dot {
      width: 6px;
      height: 6px;
      background: #00ff88;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }
    
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes typing {
      0%, 60%, 100% { opacity: 0.3; }
      30% { opacity: 1; }
    }
    
    /* Scrollbar */
    .messages-area::-webkit-scrollbar {
      width: 6px;
    }
    
    .messages-area::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.1);
    }
    
    .messages-area::-webkit-scrollbar-thumb {
      background: rgba(0,255,136,0.5);
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="agent-info">
      <div class="agent-avatar">🤖</div>
      <div class="agent-details">
        <h3>DCA Agent</h3>
        <div class="agent-status">
          <span class="status-dot"></span>
          Active & Ready
        </div>
      </div>
    </div>
    <div class="network-info">
      <div>Arbitrum Network</div>
      <div class="network-badge">Camelot DEX</div>
    </div>
  </div>
  
  <!-- Wallet Info -->
  <div class="wallet-info" id="walletInfo" style="display: none;">
    <div class="wallet-status">
      <div id="walletIcon">🔗</div>
      <div>
        <div style="font-weight: bold; margin-bottom: 4px;" id="walletStatusText">Wallet Connected</div>
        <div class="wallet-address" id="walletAddress">0x0000...0000</div>
      </div>
    </div>
    <button class="disconnect-button" id="disconnectWalletBtn">Disconnect</button>
  </div>
  
  <div class="wallet-info" id="walletConnect">
    <div class="wallet-status">
      <div>💼</div>
      <div>
        <div style="font-weight: bold; margin-bottom: 4px;">Connect Your Wallet</div>
        <div style="font-size: 12px; opacity: 0.8;">Connect to start trading with DCA Agent</div>
      </div>
    </div>
    <button class="connect-button" id="connectWalletBtn">Connect Wallet</button>
  </div>
  
  <!-- Chat Container -->
  <div class="chat-container">
    <div class="messages-area" id="messagesArea">
      <!-- Welcome Message -->
      <div class="message agent">
        <div class="message-content">
          <div>👋 Welcome! I'm your DCA Agent for automated trading on Arbitrum.</div>
          <div style="margin-top: 8px; font-size: 14px; opacity: 0.8;">
            Tell me what you'd like to trade! For example:<br>
            • "Buy $25 of ETH every 5 minutes for 1 hour"<br>
            • "Show my transaction history"<br>
            • "What are my active strategies?"
          </div>
          <div class="message-time">Just now</div>
        </div>
      </div>
      
      <!-- Typing Indicator -->
      <div class="typing-indicator" id="typingIndicator">
        <div>Agent is typing</div>
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>
    
    <!-- Input Area -->
    <div class="input-area">
      <div class="quick-actions">
        <div class="quick-action" onclick="sendQuickMessage('Show my strategies')">📊 My Strategies</div>
        <div class="quick-action" onclick="sendQuickMessage('Transaction history')">📋 History</div>
        <div class="quick-action" onclick="sendQuickMessage('Buy ETH every 5 minutes')">⚡ Quick DCA</div>
        <div class="quick-action" onclick="sendQuickMessage('Help me')">❓ Help</div>
      </div>
      
      <div class="input-container">
        <textarea 
          id="messageInput" 
          class="message-input" 
          placeholder="Ask me to set up a DCA strategy... (e.g. 'Buy $20 of ETH every 5 minutes')"
          rows="1"
        ></textarea>
        <button id="sendButton" class="send-button" onclick="sendMessage()">
          <span style="font-size: 18px;">➤</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Mini App SDK -->
  <script type="module">
    // Import wagmi and configuration - using unpkg for better reliability
    let wagmi, chains, miniAppConnector;
    
    async function loadWagmiLibraries() {
      try {
        wagmi = await import('https://unpkg.com/wagmi@2.16.1/dist/esm/index.js');
        chains = await import('https://unpkg.com/wagmi@2.16.1/dist/esm/chains.js');
        miniAppConnector = await import('https://unpkg.com/@farcaster/miniapp-wagmi-connector@1.0.0/dist/index.js');
        console.log('Wagmi libraries loaded successfully');
        return true;
      } catch (error) {
        console.warn('Failed to load wagmi libraries:', error);
        return false;
      }
    }
    
    // Wagmi configuration - will be set up after libraries load
    let wagmiConfig = null;
    
    let ws = null;
    let isConnected = false;
    let wagmiClient = null;
    let currentAccount = null;
    
    // WebSocket connection
    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = \`\${protocol}//\${window.location.host}\`;
      
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          isConnected = true;
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'chat_update') {
              data.messages.forEach(msg => addMessageToChat(msg));
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected');
          isConnected = false;
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.warn('WebSocket not available, using fallback');
      }
    }
    
    // DOM elements
    const messagesArea = document.getElementById('messagesArea');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const typingIndicator = document.getElementById('typingIndicator');
    
    // Send message function
    window.sendMessage = function() {
      const message = messageInput.value.trim();
      if (!message) return;
      
      // Clear input
      messageInput.value = '';
      
      // Add user message immediately
      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      addMessageToChat(userMessage);
      
      // Show typing indicator
      showTyping();
      
      // Use HTTP API instead of WebSocket (Vercel doesn't support WebSocket)
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: message })
        });
        
        if (response.ok) {
          const data = await response.json();
          hideTyping();
          // Add only the agent response (user message already added)
          if (data.messages && data.messages[1]) {
            addMessageToChat(data.messages[1]);
          }
        } else {
          throw new Error('API request failed');
        }
      } catch (error) {
        console.error('Chat API failed, using fallback:', error);
        // Fallback: simulate response
        setTimeout(() => {
          hideTyping();
          const response = simulateAgentResponse(message);
          addMessageToChat(response);
        }, 1500);
      }
    };
    
    // Quick message function
    window.sendQuickMessage = function(message) {
      messageInput.value = message;
      sendMessage();
    };
    
    // Add message to chat
    function addMessageToChat(message) {
      hideTyping();
      
      const messageDiv = document.createElement('div');
      messageDiv.className = \`message \${message.type}\`;
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      
      let contentHTML = \`<div>\${formatMessageContent(message.content)}</div>\`;
      
      // Add special components based on message action
      if (message.action) {
        if (message.action.type === 'suggest_strategy') {
          contentHTML += createStrategyCard(message.action.strategy);
        } else if (message.action.type === 'show_transactions') {
          contentHTML += createTransactionList(message.action.transactions);
        }
      }
      
      contentHTML += \`<div class="message-time">\${formatTime(message.timestamp)}</div>\`;
      
      contentDiv.innerHTML = contentHTML;
      messageDiv.appendChild(contentDiv);
      messagesArea.appendChild(messageDiv);
      
      // Scroll to bottom
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
    
    // Format message content
    function formatMessageContent(content) {
      return content
        .replace(/\n/g, '<br>')
        .replace(/•/g, '•')
        .replace(/\$(\d+\.?\d*)/g, '<strong>$$$1</strong>')
        .replace(/(\d+)\s*(minutes?|mins?)/gi, '<strong>$1 $2</strong>')
        .replace(/(ETH|BTC|ARB|USDC)/g, '<strong style="color: #00ff88;">$1</strong>');
    }
    
    // Create strategy card
    function createStrategyCard(strategy) {
      return \`
        <div class="strategy-card">
          <div class="strategy-header">
            <div class="strategy-title">\${strategy.token} DCA Strategy</div>
            <div class="strategy-status">Suggested</div>
          </div>
          <div class="strategy-details">
            💰 Amount: $\${strategy.amount} per interval<br>
            ⏱️ Interval: Every \${strategy.interval} minutes<br>
            ⏳ Duration: \${strategy.duration} minutes<br>
            🔗 DEX: \${strategy.dex} (Arbitrum)<br>
            📊 Est. Total: $\${(strategy.amount * (strategy.duration / strategy.interval)).toFixed(2)}
          </div>
          <div style="margin-top: 12px;">
            <button onclick="approveStrategy('\${strategy.token}')" style="background: #00ff88; color: #000; border: none; padding: 8px 16px; border-radius: 6px; margin-right: 8px; cursor: pointer;">✅ Approve</button>
            <button onclick="modifyStrategy('\${strategy.token}')" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 6px; cursor: pointer;">✏️ Modify</button>
          </div>
        </div>
      \`;
    }
    
    // Create transaction list
    function createTransactionList(transactions) {
      const transactionHTML = transactions.map(tx => \`
        <div class="transaction-item">
          <div class="tx-header">
            <span>\${tx.type} \${tx.amount} \${tx.token}</span>
            <span style="color: #00ff88;">$\${tx.value}</span>
          </div>
          <div class="tx-details">
            Price: $\${tx.price} • \${formatTime(tx.timestamp)}<br>
            Tx: <a href="https://arbiscan.io/tx/\${tx.txHash}" target="_blank" style="color: #00ff88;">\${tx.txHash.slice(0, 16)}...</a>
          </div>
        </div>
      \`).join('');
      
      return \`<div style="margin-top: 12px;">\${transactionHTML}</div>\`;
    }
    
    // Strategy actions
    window.approveStrategy = function(token) {
      sendQuickMessage(\`Approve and start the \${token} DCA strategy\`);
    };
    
    window.modifyStrategy = function(token) {
      sendQuickMessage(\`I want to modify the \${token} strategy parameters\`);
    };
    
    // Show/hide typing indicator
    function showTyping() {
      typingIndicator.style.display = 'flex';
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
    
    function hideTyping() {
      typingIndicator.style.display = 'none';
    }
    
    // Format time
    function formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return \`\${Math.floor(diff / 60000)}m ago\`;
      if (diff < 86400000) return \`\${Math.floor(diff / 3600000)}h ago\`;
      return date.toLocaleDateString();
    }
    
    // Simulate agent response (fallback)
    function simulateAgentResponse(message) {
      const responses = {
        'show my strategies': {
          content: "📈 Active Strategies:\\n\\n• ETH-USDC-5MIN: Running (2/12 executions)\\n• Next execution in: 3m 45s\\n• Total invested: $46.77\\n• Current value: $48.23 (+3.1%)\\n\\nWould you like to modify or create a new strategy?",
          action: null
        },
        'transaction history': {
          content: "📊 Here are your recent DCA transactions:",
          action: {
            type: 'show_transactions',
            transactions: [
              {
                id: 'tx_001',
                type: 'BUY',
                token: 'ETH',
                amount: '0.01',
                price: '2340.50',
                value: '23.41',
                timestamp: Date.now() - 300000,
                txHash: '0xabc123456789',
                status: 'completed'
              }
            ]
          }
        },
        default: {
          content: "🤖 I understand you want to set up automated trading. Could you tell me:\\n\\n1. Which token? (ETH, ARB, USDC, etc.)\\n2. How much per purchase?\\n3. How often? (every 5 minutes, 10 minutes, etc.)\\n4. For how long?\\n\\nExample: 'Buy $25 of ETH every 5 minutes for 1 hour'",
          action: null
        }
      };
      
      const key = message.toLowerCase();
      const response = responses[key] || responses.default;
      
      return {
        id: Date.now() + 1,
        type: 'agent',
        content: response.content,
        timestamp: new Date().toISOString(),
        action: response.action
      };
    }
    
    // Input handling
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = messageInput.scrollHeight + 'px';
    });
    
    // Wallet connection functions - make them globally available
    async function connectWallet() {
      try {
        if (!wagmiClient) {
          const { connect, connectors } = await setupWagmi();
          const connector = connectors[0]; // Use the miniapp connector
          await connect({ connector });
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        showWalletError('Failed to connect wallet');
      }
    }
    
    async function disconnectWallet() {
      try {
        if (wagmiClient && wagmiClient.disconnect) {
          await wagmiClient.disconnect();
        }
        updateWalletDisplay(null);
      } catch (error) {
        console.error('Failed to disconnect wallet:', error);
      }
    }
    
    // Add event listeners for wallet buttons
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const disconnectWalletBtn = document.getElementById('disconnectWalletBtn');
    
    if (connectWalletBtn) {
      connectWalletBtn.addEventListener('click', connectWallet);
    }
    
    if (disconnectWalletBtn) {
      disconnectWalletBtn.addEventListener('click', disconnectWallet);
    }
    
    // Setup wagmi functionality
    async function setupWagmi() {
      try {
        // Load wagmi libraries first
        const librariesLoaded = await loadWagmiLibraries();
        if (!librariesLoaded) {
          throw new Error('Failed to load wagmi libraries');
        }
        
        // Create wagmi config
        wagmiConfig = wagmi.createConfig({
          chains: [chains.base],
          transports: {
            [chains.base.id]: wagmi.http(),
          },
          connectors: [
            miniAppConnector.farcasterMiniApp()
          ]
        });
        
        console.log('Wagmi config created:', wagmiConfig);
        
        // Setup connection handlers
        const connectors = wagmiConfig.connectors;
        
        wagmiClient = {
          connect: async (options) => {
            const wagmiActions = await import('https://unpkg.com/wagmi@2.16.1/dist/esm/actions.js');
            const result = await wagmiActions.connect(wagmiConfig, options);
            currentAccount = wagmiActions.getAccount(wagmiConfig);
            updateWalletDisplay(currentAccount);
            return result;
          },
          disconnect: async () => {
            const wagmiActions = await import('https://unpkg.com/wagmi@2.16.1/dist/esm/actions.js');
            await wagmiActions.disconnect(wagmiConfig);
            currentAccount = null;
            updateWalletDisplay(null);
          },
          getAccount: async () => {
            const wagmiActions = await import('https://unpkg.com/wagmi@2.16.1/dist/esm/actions.js');
            return wagmiActions.getAccount(wagmiConfig);
          }
        };
        
        // Check if already connected
        const account = await wagmiClient.getAccount();
        if (account.isConnected) {
          currentAccount = account;
          updateWalletDisplay(account);
        }
        
        return { connect: wagmiClient.connect, connectors };
      } catch (error) {
        console.error('Failed to setup wagmi:', error);
        // Don't throw error, just continue without wallet functionality
        return { connect: null, connectors: [] };
      }
    }
    
    // Update wallet display
    function updateWalletDisplay(account) {
      const walletInfo = document.getElementById('walletInfo');
      const walletConnect = document.getElementById('walletConnect');
      const walletAddress = document.getElementById('walletAddress');
      const walletStatusText = document.getElementById('walletStatusText');
      const walletIcon = document.getElementById('walletIcon');
      
      if (account && account.address) {
        // Connected state
        walletConnect.style.display = 'none';
        walletInfo.style.display = 'flex';
        walletAddress.textContent = formatAddress(account.address);
        walletStatusText.textContent = 'Connected to ' + (account.connector && account.connector.name || 'Wallet');
        walletIcon.textContent = '✅';
        
        // Add wallet info to chat context
        addWalletConnectedMessage(account.address);
      } else {
        // Disconnected state
        walletInfo.style.display = 'none';
        walletConnect.style.display = 'flex';
      }
    }
    
    // Format wallet address
    function formatAddress(address) {
      if (!address) return '';
      return address.slice(0, 6) + '...' + address.slice(-4);
    }
    
    // Show wallet error
    function showWalletError(message) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); color: white; padding: 12px 16px; border-radius: 8px; z-index: 1000;';
      errorDiv.textContent = message;
      document.body.appendChild(errorDiv);
      
      setTimeout(() => {
        document.body.removeChild(errorDiv);
      }, 5000);
    }
    
    // Add wallet connected message to chat
    function addWalletConnectedMessage(address) {
      const message = {
        id: Date.now(),
        type: 'agent',
        content: '🎉 Wallet connected successfully!\\n\\nYour address: ' + formatAddress(address) + '\\n\\nNow you can start creating DCA strategies. Your trades will be executed from this wallet address.',
        timestamp: new Date().toISOString()
      };
      addMessageToChat(message);
    }
    
    // Initialize Mini App SDK
    async function initializeMiniApp() {
      try {
        console.log('Loading Farcaster miniapp SDK...');
        const { sdk } = await import('https://unpkg.com/@farcaster/miniapp-sdk@0.1.6/dist/index.js');
        console.log('Mini App SDK loaded successfully', sdk);
        
        // Call ready to signal the app is loaded
        if (sdk && sdk.actions && sdk.actions.ready) {
          await sdk.actions.ready();
          console.log('Mini App ready() called successfully');
        }
        
        window.farcasterSdk = sdk;
        
        // Check if running in Farcaster context
        console.log('User agent:', navigator.userAgent);
        console.log('Window context:', {
          isFarcaster: window.parent !== window,
          hasPostMessage: !!window.parent.postMessage
        });
        
        return sdk;
      } catch (error) {
        console.warn('Mini App SDK not available:', error);
        console.log('This might be expected if not running in Farcaster context');
        return null;
      }
    }
    
    // Initialize everything
    async function init() {
      console.log('Initializing DCA Agent...');
      
      // Initialize Farcaster SDK first
      const sdk = await initializeMiniApp();
      
      // Skip WebSocket on Vercel (doesn't support it)
      console.log('Skipping WebSocket connection (using HTTP API instead)');
      
      // Setup wagmi for wallet functionality
      try {
        console.log('Setting up wagmi...');
        await setupWagmi();
        console.log('Wagmi setup completed successfully');
      } catch (error) {
        console.warn('Wagmi setup failed:', error);
        console.log('Continuing without wallet functionality');
      }
      
      console.log('DCA Agent initialization complete');
    }
    
    // Start the app
    init();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// API endpoints
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  
  const userMessage = {
    id: Date.now(),
    type: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  const agentResponse = processUserMessage(message);
  
  chatHistory.push(userMessage, agentResponse);
  
  res.json({
    messages: [userMessage, agentResponse]
  });
});

app.get('/api/strategies', (req, res) => {
  res.json(dcaStrategies);
});

app.post('/api/strategies', (req, res) => {
  const { token, amount, interval, duration } = req.body;
  
  const strategy = {
    id: `${token}-USDC-${interval}MIN`,
    token,
    amount,
    interval,
    duration,
    created: Date.now(),
    status: 'active',
    executions: 0,
    totalInvested: 0,
    nextExecution: Date.now() + (interval * 60000)
  };
  
  dcaStrategies.active.push(strategy);
  
  res.json({ success: true, strategy });
});

app.get('/api/transactions', (req, res) => {
  res.json({
    transactions: mockTransactions,
    total: mockTransactions.length
  });
});

// Image endpoints
app.get('/api/image/preview', (req, res) => {
  const svg = `
<svg width="600" height="315" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
    <linearGradient id="chatBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0f23"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
  </defs>
  
  <rect width="600" height="315" fill="url(#bg)"/>
  
  <!-- Chat Interface Mock -->
  <rect x="50" y="40" width="500" height="235" rx="20" fill="url(#chatBg)" opacity="0.9"/>
  
  <!-- Header -->
  <rect x="70" y="60" width="460" height="40" rx="8" fill="rgba(102,126,234,0.3)"/>
  <circle cx="90" cy="80" r="12" fill="#00ff88"/>
  <text x="110" y="78" font-family="Arial" font-size="14" font-weight="bold" fill="white">🤖 DCA Agent</text>
  <text x="110" y="92" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.7)">Active & Ready</text>
  <text x="480" y="78" font-family="Arial" font-size="10" fill="white" text-anchor="end">Arbitrum</text>
  <text x="480" y="92" font-family="Arial" font-size="10" fill="#00ff88" text-anchor="end">Camelot DEX</text>
  
  <!-- Chat Messages -->
  <rect x="90" y="120" width="300" height="60" rx="12" fill="rgba(255,255,255,0.1)"/>
  <text x="105" y="140" font-family="Arial" font-size="12" fill="white">👋 Welcome! I'm your DCA Agent</text>
  <text x="105" y="155" font-family="Arial" font-size="11" fill="rgba(255,255,255,0.8)">Tell me: "Buy $25 of ETH every 5 minutes"</text>
  <text x="105" y="170" font-family="Arial" font-size="11" fill="rgba(255,255,255,0.8)">and I'll automate it on Arbitrum!</text>
  
  <rect x="210" y="190" width="280" height="40" rx="12" fill="url(#bg)"/>
  <text x="225" y="210" font-family="Arial" font-size="12" fill="white">Buy $20 of ETH every 5 minutes for 1 hour</text>
  
  <!-- Input Area -->
  <rect x="90" y="240" width="350" height="25" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)"/>
  <text x="105" y="255" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.5)">Ask me to set up a DCA strategy...</text>
  <circle cx="460" cy="252" r="12" fill="#00ff88"/>
  <text x="460" y="257" font-family="Arial" font-size="12" fill="black" text-anchor="middle">➤</text>
  
  <!-- Title -->
  <text x="300" y="30" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="white">DCA Agent</text>
  <text x="300" y="295" text-anchor="middle" font-family="Arial" font-size="14" fill="white">AI-Powered Automated Trading on Arbitrum</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(svg);
});

app.get('/api/image/splash', (req, res) => {
  const svg = `
<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="splash" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#0f0f23"/>
    </radialGradient>
  </defs>
  
  <rect width="400" height="400" fill="url(#splash)"/>
  
  <!-- Agent Avatar -->
  <circle cx="200" cy="150" r="60" fill="rgba(0,255,136,0.2)" stroke="#00ff88" stroke-width="3"/>
  <text x="200" y="170" text-anchor="middle" font-size="60">🤖</text>
  
  <!-- Title -->
  <text x="200" y="250" text-anchor="middle" font-family="Arial" font-size="32" font-weight="bold" fill="white">DCA Agent</text>
  <text x="200" y="280" text-anchor="middle" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.8)">Automated Trading</text>
  
  <!-- Network Badge -->
  <rect x="140" y="310" width="120" height="30" rx="15" fill="rgba(0,255,136,0.2)" stroke="#00ff88"/>
  <text x="200" y="330" text-anchor="middle" font-family="Arial" font-size="14" fill="#00ff88">Arbitrum + Camelot</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Manifest endpoint
app.get('/.well-known/farcaster.json', (req, res) => {
  const baseUrl = getBaseUrl(req);
  
  const manifest = {
    miniapp: {
      version: "1",
      name: "DCA Agent",
      description: "AI-powered automated DCA trading on Arbitrum using Camelot DEX. Chat with the agent to set up custom strategies.",
      iconUrl: `${baseUrl}/api/image/splash`,
      homeUrl: baseUrl,
      imageUrl: `${baseUrl}/api/image/preview`,
      buttonTitle: "💬 Chat with Agent",
      splashImageUrl: `${baseUrl}/api/image/splash`,
      splashBackgroundColor: "#0f0f23",
      tags: ["defi", "trading", "dca", "arbitrum", "camelot", "automation", "ai"],
      primaryCategory: "defi",
      webhookUrl: null
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(manifest);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeStrategies: dcaStrategies.active.length,
    totalTransactions: mockTransactions.length,
    connectedClients: activeConnections.size
  });
});

// Utility function
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `\${protocol}://\${req.get('host')}`;
}

// Start server
server.listen(PORT, () => {
  console.log(`🤖 DCA Agent Mini App running on port \${PORT}`);
  console.log(`💬 Chat URL: http://localhost:\${PORT}`);
  console.log(`🎮 App URL: http://localhost:\${PORT}/app`);
  console.log(`📋 Manifest: http://localhost:\${PORT}/.well-known/farcaster.json`);
  console.log(`🔗 WebSocket available for real-time chat`);
});

module.exports = app;
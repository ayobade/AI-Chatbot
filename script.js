document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.querySelector('.search-bar .chat-input');
  const sendButton = document.querySelector('.send-button');
  const topics = document.querySelectorAll('.topic');
  const helpEl = document.querySelector('.help-text');
  const chatEl = document.querySelector('.chat-container');
  const hamburger = document.querySelector('.hamburger-menu');
  const sidebar = document.querySelector('.sidebar');
  const newChatBtn = document.querySelector('.new-chat-btn');
  const sidebarList = document.querySelector('.sidebar-list');
  const sidebarCloseBtn = document.querySelector('.sidebar-close');
  const attachTrigger = document.querySelector('.attach-trigger');
  const attachmentMenu = document.querySelector('.attachment-menu');
  const fileInput = document.getElementById('file-input');
  const profileImage = document.querySelector('.profile-image');
  const profileMenu = document.querySelector('.profile-menu');
  const logoutBtn = document.querySelector('.logout-btn');
  const themeToggleBtn = document.querySelector('.theme-toggle-btn');
  const micIcon = document.querySelector('.search-bar .mic-toggle');
  const micVisual = document.querySelector('.mic-visual');
  const modelDropdown = document.querySelector('.model-dropdown');

  const STORAGE_KEY = 'aichat.conversations.v1';
  const OPENROUTER_API_KEY = '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';
  const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
  let currentModel = 'anthropic/claude-3.5-sonnet';
  const THEME_KEY = 'aichat.theme';
  const SPEECH_INACTIVITY_MS = 5000;

  let conversations = loadConversations();
  let activeConversationId = conversations.length ? conversations[0].id : null;
  if (!activeConversationId) {
    activeConversationId = createNewConversation().id;
  }
  renderSidebar();
  const activeAtStart = conversations.find(c => c.id === activeConversationId);
  if (activeAtStart && activeAtStart.messages.length) {
    renderConversationToChat(activeAtStart);
    startChatIfNeeded();
  }

  function bindTopicHandlers() {
    const topicEls = document.querySelectorAll('.topic');
    if (!topicEls || !inputEl) return;
    topicEls.forEach((topic) => {
      if (topic.dataset.bound === '1') return;
      topic.addEventListener('click', () => {
        const text = (topic.textContent || '').trim();
        inputEl.value = text;
        inputEl.focus();
        const len = inputEl.value.length;
        if (typeof inputEl.setSelectionRange === 'function') {
          inputEl.setSelectionRange(len, len);
        }
        updateSendButtonState();
      });
      topic.dataset.bound = '1';
    });
  }
  bindTopicHandlers();

  const send = () => {
    if (!inputEl) return;
    const message = inputEl.value.trim();
    if (!message) return;
    startChatIfNeeded();
    appendUserMessage(message);
    addMessageToConversation(activeConversationId, { role: 'user', content: message });
    updateConversationTitleFromFirstMessage(activeConversationId);
    persistConversations();
    renderSidebar();
    handleSendMessage(message);
    inputEl.value = '';
    inputEl.focus();
    if (inputEl.tagName === 'TEXTAREA') {
      inputEl.style.height = 'auto';
    }
    if (attachmentMenu) attachmentMenu.classList.remove('open');
    if (fileInput) fileInput.value = '';
    if (recognition && isListening) {
      try { userRequestedStop = true; recognition.stop(); } catch(_) {}
    }
    if (micIcon) {
      micIcon.classList.remove('recording');
      micIcon.classList.remove('fa-stop');
      micIcon.classList.add('fa-microphone');
    }
    if (micVisual) micVisual.classList.remove('active');
    updateSendButtonState();
  };

  if (sendButton) {
    sendButton.addEventListener('click', send);
  }

  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        send();
      }
    });
    inputEl.addEventListener('input', () => {
      updateSendButtonState();
      if (inputEl.tagName === 'TEXTAREA') {
        autoGrowTextarea(inputEl);
      }
    });
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target) && !sidebarCloseBtn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
    if (!profileMenu.contains(e.target) && !profileImage.contains(e.target)) {
      profileMenu.classList.remove('open');
    }
    if (!attachmentMenu.contains(e.target) && !attachTrigger.contains(e.target)) {
      attachmentMenu.classList.remove('open');
    }
  });

  if (profileImage) {
    profileImage.addEventListener('click', () => {
      profileMenu.classList.toggle('open');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      alert('Cannot log you out right now');
      profileMenu.classList.remove('open');
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  if (modelDropdown) {
    modelDropdown.addEventListener('change', (e) => {
      currentModel = e.target.value;
    });
  }

  let recognition = null;
  let isListening = false;
  let speechBaseValue = '';
  let speechFinalText = '';
  let userRequestedStop = false;
  let inactivityTimerId = null;

  function ensureRecognition() {
    if (recognition) return;
    try {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
    } catch (e) {
      console.error('Speech recognition not supported:', e);
    }
  }

  if (micIcon) {
    micIcon.addEventListener('click', () => {
      if (!recognition) ensureRecognition();
      if (!recognition) return;

      if (isListening) {
        userRequestedStop = true;
        try { recognition.stop(); } catch (_) {}
      } else {
        startListening();
      }
    });
  }

  function startListening() {
    if (!recognition) return;
    isListening = true;
    speechBaseValue = inputEl.value;
    speechFinalText = '';
    userRequestedStop = false;
    micIcon.classList.remove('fa-microphone');
    micIcon.classList.add('fa-stop', 'recording');
    micVisual.classList.add('active');
    recognition.start();
  }

  function scheduleInactivityStop() {
    clearInactivityStop();
    inactivityTimerId = setTimeout(() => {
      if (recognition && isListening) {
        userRequestedStop = true;
        try { recognition.stop(); } catch (_) {}
      }
    }, SPEECH_INACTIVITY_MS);
  }

  function clearInactivityStop() {
    if (inactivityTimerId) {
      clearTimeout(inactivityTimerId);
      inactivityTimerId = null;
    }
  }

  if (attachTrigger && attachmentMenu) {
    attachTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      attachmentMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!attachmentMenu.classList.contains('open')) return;
      const target = e.target;
      const clickedInside = attachmentMenu.contains(target) || (attachTrigger && attachTrigger.contains(target));
      if (!clickedInside) {
        attachmentMenu.classList.remove('open');
      }
    });
  }

  const uploadBtn = document.querySelector('.attachment-menu .upload');
  const driveBtn = document.querySelector('.attachment-menu .drive');
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }
  if (driveBtn) {
    driveBtn.addEventListener('click', () => {
      attachmentMenu && attachmentMenu.classList.remove('open');
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;
      attachmentMenu && attachmentMenu.classList.remove('open');
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      const convo = createNewConversation();
      activeConversationId = convo.id;
      clearChatUI();
      renderSidebar();
      if (helpEl) helpEl.style.display = '';
      if (chatEl) chatEl.style.display = 'none';
      if (sidebar) sidebar.classList.remove('open');
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
        updateSendButtonState();
      }
      bindTopicHandlers();
    });
  }

  async function handleSendMessage(message) {
    try {
      appendMessage('assistant', 'Thinking...');
      
      const conversation = conversations.find(c => c.id === activeConversationId);
      const messageHistory = conversation?.messages || [];
      
      const apiMessages = [
        { role: 'system', content: 'You are a helpful Web3 assistant. Format your responses professionally like ChatGPT and Claude:\n\n# Main Topic\n\n## Key Points\n\n• **Important terms** in bold\n• Clear bullet points\n• Concise explanations\n\n## Details\n\nProvide structured information with proper headings, bullet points, and emphasis on key concepts. Use markdown formatting consistently.' },
        ...messageHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];
      
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AIChatbot'
        },
        body: JSON.stringify({
          model: currentModel,
          messages: apiMessages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Response:', response.status, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const aiReply = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
      
      if (chatEl?.lastElementChild) {
        chatEl.removeChild(chatEl.lastElementChild);
      }
      
      addMessageToConversation(activeConversationId, { role: 'assistant', content: aiReply });
      appendMessage('assistant', aiReply);
      persistConversations();
      
    } catch (error) {
      console.error('OpenRouter API error:', error);
      
      if (chatEl?.lastElementChild) {
        chatEl.removeChild(chatEl.lastElementChild);
      }
      
      const errorMessage = `Error: ${error.message}. Please check the console for details.`;
      appendMessage('assistant', errorMessage);
      
      addMessageToConversation(activeConversationId, { role: 'assistant', content: errorMessage });
      persistConversations();
    }
    
    scrollChatToBottom();
  }

  function parseMarkdown(text) {
    if (!text) return '';
    
    let result = text
      .replace(/^###\s+(.*?)$/gim, '<h3>$1</h3>')
      .replace(/^##\s+(.*?)$/gim, '<h2>$1</h2>')
      .replace(/^#\s+(.*?)$/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/^[\s]*•\s+(.*?)$/gim, '<li>$1</li>')
      .replace(/^[\s]*\-\s+(.*?)$/gim, '<li>$1</li>')
      .replace(/^[\s]*\*\s+(.*?)$/gim, '<li>$1</li>')
      .replace(/^[\s]*\d+\.\s+(.*?)$/gim, '<li>$1</li>')
      .replace(/\n\s*\n/g, '</p><p>')
      .replace(/^([^<].*?)$/gm, (match, content) => {
        if (!content.trim() || content.includes('<h') || content.includes('<li>')) {
          return content;
        }
        return `<p>${content}</p>`;
      })
      .replace(/<p><\/p>/g, '')
      .replace(/<p><br><\/p>/g, '')
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>')
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim();
    
    return result;
  }

  function updateSendButtonState() {
    if (!sendButton || !inputEl) return;
    const hasText = inputEl.value.trim().length > 0;
    sendButton.disabled = !hasText;
  }

  function startChatIfNeeded() {
    if (!chatEl) return;
    if (chatEl.style.display !== 'block') {
      chatEl.style.display = 'block';
    }
    if (helpEl && helpEl.style.display !== 'none') {
      helpEl.style.display = 'none';
    }
  }

  function appendUserMessage(text) {
    appendMessage('user', text);
  }

  function appendAssistantMessage(text) {
    appendMessage('assistant', text);
  }

  function appendMessage(role, text) {
    if (!chatEl) return;
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = role === 'assistant' ? 'assistant-avatar' : 'user-avatar';
    const icon = document.createElement('i');
    icon.className = role === 'assistant' ? 'fas fa-robot' : 'fas fa-user';
    avatar.appendChild(icon);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    if (role === 'assistant') {
      bubble.innerHTML = parseMarkdown(text);
    } else {
      bubble.textContent = text;
    }

    if (role === 'assistant') {
      wrapper.appendChild(avatar);
      wrapper.appendChild(bubble);
    } else {
      wrapper.appendChild(bubble);
      wrapper.appendChild(avatar);
    }

    chatEl.appendChild(wrapper);
    scrollChatToBottom();
  }

  function scrollChatToBottom() {
    if (!chatEl) return;
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function loadConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function persistConversations() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }

  function createNewConversation() {
    const convo = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: 'New chat',
      messages: [],
      createdAt: Date.now(),
    };
    conversations.unshift(convo);
    persistConversations();
    return convo;
  }

  function addMessageToConversation(conversationId, message) {
    const convo = conversations.find(c => c.id === conversationId);
    if (!convo) return;
    convo.messages.push(message);
  }

  function updateConversationTitleFromFirstMessage(conversationId) {
    const convo = conversations.find(c => c.id === conversationId);
    if (!convo) return;
    if (convo.messages.length > 0) {
      const first = convo.messages[0].content || '';
      convo.title = first.slice(0, 40) + (first.length > 40 ? '…' : '');
    } else {
      convo.title = 'New chat';
    }
  }

  function renderSidebar() {
    if (!sidebarList) return;
    sidebarList.innerHTML = '';
    conversations.forEach((convo) => {
      const item = document.createElement('div');
      item.className = 'sidebar-item';
      item.dataset.id = convo.id;

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = convo.title || 'New chat';

      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.innerHTML = '<i class="fas fa-trash"></i>';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(convo.id);
      });

      item.appendChild(title);
      item.appendChild(del);
      sidebarList.appendChild(item);

      item.addEventListener('click', () => {
        activeConversationId = convo.id;
        renderConversationToChat(convo);
        startChatIfNeeded();
        sidebar.classList.remove('open');
      });
    });
  }

  function deleteConversation(conversationId) {
    conversations = conversations.filter(c => c.id !== conversationId);
    if (activeConversationId === conversationId) {
      activeConversationId = conversations.length ? conversations[0].id : null;
      if (!activeConversationId) {
        activeConversationId = createNewConversation().id;
      }
      clearChatUI();
      if (helpEl) helpEl.style.display = '';
      if (chatEl) chatEl.style.display = 'none';
    }
    persistConversations();
    renderSidebar();
  }

  function clearChatUI() {
    if (!chatEl) return;
    chatEl.innerHTML = '';
  }

  function renderConversationToChat(convo) {
    if (!chatEl) return;
    clearChatUI();
    convo.messages.forEach(msg => {
      appendMessage(msg.role, msg.content);
    });
  }

  if (ensureRecognition) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      micVisual.classList.add('active');
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      isListening = false;
      micIcon.classList.remove('fa-stop', 'recording');
      micIcon.classList.add('fa-microphone');
      micVisual.classList.remove('active');
    };

    recognition.onend = () => {
      isListening = false;
      micIcon.classList.remove('fa-stop', 'recording');
      micIcon.classList.add('fa-microphone');
      micVisual.classList.remove('active');
      if (!userRequestedStop) {
        setTimeout(() => startListening(), 100);
      }
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const newValue = [speechBaseValue, speechFinalText, finalTranscript, interimTranscript].filter(Boolean).join(' ');
      inputEl.value = newValue;
      speechFinalText = finalTranscript;
      updateSendButtonState();
      if (inputEl.tagName === 'TEXTAREA') {
        autoGrowTextarea(inputEl);
      }
      clearInactivityStop();
      scheduleInactivityStop();
    };
  }

  function autoGrowTextarea(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    
    const btn = themeToggleBtn;
    if (btn) {
      btn.textContent = theme === 'light' ? 'Switch to Dark mode' : 'Switch to Light mode';
    }
  }
});



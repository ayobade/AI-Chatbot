document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.querySelector('.search-bar input');
  const sendButton = document.querySelector('.send-button');
  const topics = document.querySelectorAll('.topic');
  const helpEl = document.querySelector('.help-text');
  const chatEl = document.querySelector('.chat-container');
  const hamburger = document.querySelector('.hamburger-menu');
  const sidebar = document.querySelector('.sidebar');
  const newChatBtn = document.querySelector('.new-chat-btn');
  const sidebarList = document.querySelector('.sidebar-list');
  const sidebarCloseBtn = document.querySelector('.sidebar-close');

  
  const STORAGE_KEY = 'aichat.conversations.v1';
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

    inputEl.addEventListener('input', updateSendButtonState);
   
    updateSendButtonState();
  }


  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }

  
  document.addEventListener('click', (event) => {
    if (!sidebar) return;
    if (!sidebar.classList.contains('open')) return;
    const target = event.target;
    const clickedInsideSidebar = sidebar.contains(target);
    const clickedHamburger = hamburger && hamburger.contains(target);
    const clickedCloseButton = sidebarCloseBtn && sidebarCloseBtn.contains(target);
    if (!clickedInsideSidebar && !clickedHamburger && !clickedCloseButton) {
      sidebar.classList.remove('open');
    }
  });

 
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

 
  function handleSendMessage(message) {
    
    appendAssistantMessage(''); 
    const placeholderNode = chatEl?.lastElementChild?.querySelector('.bubble');
    setTimeout(() => {
      const reply = generateLocalAssistantReply(message);
      if (placeholderNode) placeholderNode.textContent = reply;
      addMessageToConversation(activeConversationId, { role: 'assistant', content: reply });
      persistConversations();
      scrollChatToBottom();
    }, 500);
  }

  function generateLocalAssistantReply(userMessage) {
   
    return `You said: "${userMessage}"`;
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
    bubble.textContent = text;

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

      item.addEventListener('click', () => {
        activeConversationId = convo.id;
        renderConversationToChat(convo);
        startChatIfNeeded();
      });

      sidebarList.appendChild(item);
    });
  }

  function deleteConversation(conversationId) {
    const idx = conversations.findIndex(c => c.id === conversationId);
    if (idx === -1) return;
    conversations.splice(idx, 1);
    if (activeConversationId === conversationId) {
      if (conversations.length) {
        activeConversationId = conversations[0].id;
        renderConversationToChat(conversations[0]);
        startChatIfNeeded();
      } else {
        activeConversationId = createNewConversation().id;
        clearChatUI();
        if (helpEl) helpEl.style.display = '';
      }
    }
    persistConversations();
    renderSidebar();
    const active = conversations.find(c => c.id === activeConversationId);
    if (active && active.messages.length) {
      renderConversationToChat(active);
      startChatIfNeeded();
    } else {
      clearChatUI();
    }
  }

  function clearChatUI() {
    if (chatEl) chatEl.innerHTML = '';
  }

  function renderConversationToChat(convo) {
    clearChatUI();
    if (!convo || !chatEl) return;
    convo.messages.forEach(m => {
      if (m.role === 'user') appendUserMessage(m.content);
      else appendAssistantMessage(m.content);
    });
    if (convo.messages.length) startChatIfNeeded();
  }
});



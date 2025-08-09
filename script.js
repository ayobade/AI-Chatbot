document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.querySelector('.search-bar input');
  const sendButton = document.querySelector('.send-button');
  const topics = document.querySelectorAll('.topic');
  const helpEl = document.querySelector('.help-text');
  const chatEl = document.querySelector('.chat-container');

 
  if (topics && inputEl) {
    topics.forEach((topic) => {
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
    });
  }

  
  const send = () => {
    if (!inputEl) return;
    const message = inputEl.value.trim();
    if (!message) return;
    startChatIfNeeded();
    appendUserMessage(message);
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

 
  function handleSendMessage(message) {
    
    appendAssistantMessage(''); 
    const placeholderNode = chatEl?.lastElementChild?.querySelector('.bubble');
    setTimeout(() => {
      const reply = generateLocalAssistantReply(message);
      if (placeholderNode) placeholderNode.textContent = reply;
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
});



document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.querySelector('.search-bar input');
  const sendButton = document.querySelector('.send-button');
  const topics = document.querySelectorAll('.topic');

 
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
    handleSendMessage(message);
    inputEl.value = '';
    inputEl.focus();
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
   
    console.log('Sending message:', message);
  }

  function updateSendButtonState() {
    if (!sendButton || !inputEl) return;
    const hasText = inputEl.value.trim().length > 0;
    sendButton.disabled = !hasText;
  }
});



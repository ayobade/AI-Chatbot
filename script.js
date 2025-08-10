document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.querySelector(".search-bar .chat-input");
  const sendButton = document.querySelector(".send-button");
  const topics = document.querySelectorAll(".topic");
  const helpEl = document.querySelector(".help-text");
  const chatEl = document.querySelector(".chat-container");
  const hamburger = document.querySelector(".hamburger-menu");
  const sidebar = document.querySelector(".sidebar");
  const newChatBtn = document.querySelector(".new-chat-btn");
  const sidebarList = document.querySelector(".sidebar-list");
  const sidebarCloseBtn = document.querySelector(".sidebar-close");
  const attachTrigger = document.querySelector(".attach-trigger");
  const attachmentMenu = document.querySelector(".attachment-menu");
  const fileInput = document.getElementById("file-input");
  const profileImage = document.querySelector(".profile-image");
  const profileMenu = document.querySelector(".profile-menu");
  const logoutBtn = document.querySelector(".logout-btn");

  const STORAGE_KEY = "aichat.conversations.v1";
  let conversations = loadConversations();
  let activeConversationId = conversations.length ? conversations[0].id : null;
  if (!activeConversationId) {
    activeConversationId = createNewConversation().id;
  }
  renderSidebar();
  const activeAtStart = conversations.find(
    (c) => c.id === activeConversationId
  );
  if (activeAtStart && activeAtStart.messages.length) {
    renderConversationToChat(activeAtStart);
    startChatIfNeeded();
  }

  function bindTopicHandlers() {
    const topicEls = document.querySelectorAll(".topic");
    if (!topicEls || !inputEl) return;
    topicEls.forEach((topic) => {
      if (topic.dataset.bound === "1") return;
      topic.addEventListener("click", () => {
        const text = (topic.textContent || "").trim();
        inputEl.value = text;
        inputEl.focus();
        const len = inputEl.value.length;
        if (typeof inputEl.setSelectionRange === "function") {
          inputEl.setSelectionRange(len, len);
        }
        updateSendButtonState();
      });
      topic.dataset.bound = "1";
    });
  }
  bindTopicHandlers();

  const send = () => {
    if (!inputEl) return;
    const message = inputEl.value.trim();
    if (!message) return;
    startChatIfNeeded();
    appendUserMessage(message);
    addMessageToConversation(activeConversationId, {
      role: "user",
      content: message,
    });
    updateConversationTitleFromFirstMessage(activeConversationId);
    persistConversations();
    renderSidebar();
    handleSendMessage(message);
    inputEl.value = "";
    inputEl.focus();
    updateSendButtonState();
  };

  if (sendButton) {
    sendButton.addEventListener("click", send);
  }

  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
    });

    inputEl.addEventListener("input", updateSendButtonState);

    updateSendButtonState();
  }

  if (hamburger && sidebar) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener("click", () => {
      sidebar.classList.remove("open");
    });
  }

  document.addEventListener("click", (event) => {
    if (!sidebar) return;
    if (!sidebar.classList.contains("open")) return;
    const target = event.target;
    const clickedInsideSidebar = sidebar.contains(target);
    const clickedHamburger = hamburger && hamburger.contains(target);
    const clickedCloseButton =
      sidebarCloseBtn && sidebarCloseBtn.contains(target);
    if (!clickedInsideSidebar && !clickedHamburger && !clickedCloseButton) {
      sidebar.classList.remove("open");
    }
  });

  if (profileImage && profileMenu) {
    const toggleProfileMenu = (show) => {
      if (show === undefined) {
        profileMenu.classList.toggle("open");
      } else if (show) {
        profileMenu.classList.add("open");
      } else {
        profileMenu.classList.remove("open");
      }
    };

    profileImage.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleProfileMenu();
    });

    document.addEventListener("click", (e) => {
      if (!profileMenu.classList.contains("open")) return;
      const target = e.target;
      const inside =
        profileMenu.contains(target) || profileImage.contains(target);
      if (!inside) toggleProfileMenu(false);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      alert("Can't log you out right now");
    });
  }

  if (attachTrigger && attachmentMenu) {
    attachTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = attachmentMenu.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!attachmentMenu.classList.contains("open")) return;
      const target = e.target;
      const clickedInside =
        attachmentMenu.contains(target) ||
        (attachTrigger && attachTrigger.contains(target));
      if (!clickedInside) {
        attachmentMenu.classList.remove("open");
      }
    });
  }

  const uploadBtn = document.querySelector(".attachment-menu .upload");
  const driveBtn = document.querySelector(".attachment-menu .drive");
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }
  if (driveBtn) {
    driveBtn.addEventListener("click", () => {
      console.log("Add from drive clicked");
      attachmentMenu && attachmentMenu.classList.remove("open");
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;
      console.log(
        "Selected files:",
        files.map((f) => ({ name: f.name, size: f.size }))
      );
      attachmentMenu && attachmentMenu.classList.remove("open");
    });
  }

  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      const convo = createNewConversation();
      activeConversationId = convo.id;
      clearChatUI();
      renderSidebar();
      if (helpEl) helpEl.style.display = "";
      if (chatEl) chatEl.style.display = "none";
      if (sidebar) sidebar.classList.remove("open");
      if (inputEl) {
        inputEl.value = "";
        inputEl.focus();
        updateSendButtonState();
      }
      bindTopicHandlers();
    });
  }

  async function handleSendMessage(message) {
    appendAssistantMessage("");
    const placeholderNode = chatEl?.lastElementChild?.querySelector(".bubble");
    setTimeout(async () => {
      const reply = await generateLocalAssistantReply(message);
      if (placeholderNode) placeholderNode.textContent = reply;
      addMessageToConversation(activeConversationId, {
        role: "assistant",
        content: reply,
      });
      persistConversations();

      scrollChatToBottom();
    }, 500);
  }

  async function generateLocalAssistantReply(userMessage) {
    try {
      const model =
        document.querySelector(".model-dropdown")?.value ||
        "openai/gpt-3.5-turbo";
      const API_KEY =
        "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";

      const api_base = "https://openrouter.ai/api/v1/chat/completions";

      const convo = conversations.find((c) => c.id === activeConversationId);
      const validChatHistory = (convo?.messages || []).filter(
        (m) => m.role && m.content && typeof m.content === "string"
      );

      const messagesToSend = [
        ...validChatHistory,
        {
          role: "user",
          content: `${userMessage}?`,
        },
      ];

      const response = await fetch(api_base, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: messagesToSend,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });
      const data = await response.json();
      console.log(data);
      const result = data.choices?.[0]?.message?.content || "No response";
      console.log(result);

      return `${result}`;
    } catch (error) {
      console.log();
      return `${error.message}`;
    }
  }

  function updateSendButtonState() {
    if (!sendButton || !inputEl) return;
    const hasText = inputEl.value.trim().length > 0;
    sendButton.disabled = !hasText;
  }

  function startChatIfNeeded() {
    if (!chatEl) return;
    if (chatEl.style.display !== "block") {
      chatEl.style.display = "block";
    }
    if (helpEl && helpEl.style.display !== "none") {
      helpEl.style.display = "none";
    }
  }

  function appendUserMessage(text) {
    appendMessage("user", text);
  }

  function appendAssistantMessage(text) {
    appendMessage("assistant", text);
  }

  function appendMessage(role, text) {
    if (!chatEl) return;
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message ${role}`;

    const avatar = document.createElement("div");
    avatar.className =
      role === "assistant" ? "assistant-avatar" : "user-avatar";
    const icon = document.createElement("i");
    icon.className = role === "assistant" ? "fas fa-robot" : "fas fa-user";
    avatar.appendChild(icon);

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    // console.log(text);

    if (role === "assistant") {
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
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
    };
    conversations.unshift(convo);
    persistConversations();
    return convo;
  }

  function addMessageToConversation(conversationId, message) {
    const convo = conversations.find((c) => c.id === conversationId);
    if (!convo) return;
    convo.messages.push(message);
  }

  function updateConversationTitleFromFirstMessage(conversationId) {
    const convo = conversations.find((c) => c.id === conversationId);
    if (!convo) return;
    if (convo.messages.length > 0) {
      const first = convo.messages[0].content || "";
      convo.title = first.slice(0, 40) + (first.length > 40 ? "…" : "");
    } else {
      convo.title = "New chat";
    }
  }

  function renderSidebar() {
    if (!sidebarList) return;
    sidebarList.innerHTML = "";
    conversations.forEach((convo) => {
      const item = document.createElement("div");
      item.className = "sidebar-item";
      item.dataset.id = convo.id;

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = convo.title || "New chat";

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.innerHTML = '<i class="fas fa-trash"></i>';
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteConversation(convo.id);
      });

      item.appendChild(title);
      item.appendChild(del);

      item.addEventListener("click", () => {
        activeConversationId = convo.id;
        renderConversationToChat(convo);
        startChatIfNeeded();
      });

      sidebarList.appendChild(item);
    });
  }

  function deleteConversation(conversationId) {
    const idx = conversations.findIndex((c) => c.id === conversationId);
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
        if (helpEl) helpEl.style.display = "";
      }
    }
    persistConversations();
    renderSidebar();
    const active = conversations.find((c) => c.id === activeConversationId);
    if (active && active.messages.length) {
      renderConversationToChat(active);
      startChatIfNeeded();
    } else {
      clearChatUI();
    }
  }

  function clearChatUI() {
    if (chatEl) chatEl.innerHTML = "";
  }

  function renderConversationToChat(convo) {
    clearChatUI();
    if (!convo || !chatEl) return;
    convo.messages.forEach((m) => {
      if (m.role === "user") appendUserMessage(m.content);
      else appendAssistantMessage(m.content);
    });
    if (convo.messages.length) startChatIfNeeded();
  }
});

const STORAGE_KEY = 'zhichat-state-v2';
const DEFAULT_API_BASE = 'http://localhost:4174/api';
const DEFAULT_MODEL = 'mimo-v2.5-pro';

const MODELS = [
  { id: 'mimo-v2.5-pro', name: 'Mimo v2.5 Pro', desc: '最强推理能力', mode: 'chat' },
  { id: 'mimo-v2.5', name: 'Mimo v2.5', desc: '均衡性能', mode: 'chat' },
  { id: 'mimo-v2.5-tts', name: 'Mimo v2.5 TTS', desc: '文字转语音', mode: 'tts' },
  { id: 'mimo-v2.5-tts-voicedesign', name: 'Mimo v2.5 TTS VoiceDesign', desc: '自定义音色设计', mode: 'tts' },
  { id: 'mimo-v2.5-tts-voiceclone', name: 'Mimo v2.5 TTS VoiceClone', desc: '音色克隆', mode: 'tts' },
];

const THEMES = {
  dark: {
    '--bg-primary': '#0d1117',
    '--bg-secondary': '#161b22',
    '--bg-chat': '#0d1117',
    '--bg-message-user': '#1c2128',
    '--bg-message-ai': 'transparent',
    '--bg-input': '#161b22',
    '--bg-hover': '#21262d',
    '--bg-elevated': '#11161d',
    '--border-color': '#30363d',
    '--border-strong': '#3d444d',
    '--text-primary': '#e6edf3',
    '--text-secondary': '#8b949e',
    '--text-muted': '#6e7681',
    '--accent': '#4f94ef',
    '--accent-hover': '#388bfd',
    '--accent-soft': 'rgba(79, 148, 239, 0.14)',
    '--danger': '#f85149',
    '--success': '#3fb950',
    '--shadow-lg': '0 24px 60px rgba(0, 0, 0, 0.38)',
    '--shadow-md': '0 12px 32px rgba(0, 0, 0, 0.28)',
    '--overlay': 'rgba(0, 0, 0, 0.5)',
    '--code-bg': '#0b1016',
    colorScheme: 'dark',
  },
  light: {
    '--bg-primary': '#f5f7fb',
    '--bg-secondary': '#ffffff',
    '--bg-chat': '#f8fafc',
    '--bg-message-user': '#eaf2ff',
    '--bg-message-ai': 'transparent',
    '--bg-input': '#ffffff',
    '--bg-hover': '#eef2f7',
    '--bg-elevated': '#ffffff',
    '--border-color': '#d7dee7',
    '--border-strong': '#c5cfda',
    '--text-primary': '#18212b',
    '--text-secondary': '#596579',
    '--text-muted': '#7b8797',
    '--accent': '#2563eb',
    '--accent-hover': '#1d4ed8',
    '--accent-soft': 'rgba(37, 99, 235, 0.1)',
    '--danger': '#dc2626',
    '--success': '#16a34a',
    '--shadow-lg': '0 24px 60px rgba(15, 23, 42, 0.12)',
    '--shadow-md': '0 12px 32px rgba(15, 23, 42, 0.08)',
    '--overlay': 'rgba(15, 23, 42, 0.28)',
    '--code-bg': '#f3f6fb',
    colorScheme: 'light',
  },
};

const state = {
  conversations: new Map(),
  currentConvId: null,
  settings: {
    apiBase: DEFAULT_API_BASE,
    apiKey: '',
    protocol: 'openai',
    theme: 'dark',
  },
  isStreaming: false,
};

const els = {};

function init() {
  cacheElements();
  configureMarkdown();
  loadState();
  bindEvents();

  if (!state.currentConvId || !state.conversations.has(state.currentConvId)) {
    createNewConversation({ silent: true });
  }

  applyTheme(state.settings.theme || 'dark', false);
  syncSettingsToUI();
  renderConversationList();
  renderCurrentConversation();
  updateProtocolButtons();
  updateModelUI(getCurrentConversation().model);
  updateSendButtonState();
  autoResizeTextarea();
}

function cacheElements() {
  els.html = document.documentElement;
  els.body = document.body;
  els.sidebar = document.getElementById('sidebar');
  els.sidebarOverlay = document.getElementById('sidebarOverlay');
  els.sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  els.hamburgerBtn = document.getElementById('hamburgerBtn');
  els.newChatBtn = document.getElementById('newChatBtn');
  els.conversationsList = document.getElementById('conversationsList');
  els.settingsBtn = document.getElementById('settingsBtn');
  els.footerModelHint = document.getElementById('footerModelHint');
  els.messagesArea = document.getElementById('messagesArea');
  els.messagesList = document.getElementById('messagesList');
  els.welcomeScreen = document.getElementById('welcomeScreen');
  els.chatInput = document.getElementById('chatInput');
  els.sendBtn = document.getElementById('sendBtn');
  els.settingsModal = document.getElementById('settingsModal');
  els.settingsCloseBtn = document.getElementById('settingsCloseBtn');
  els.settingsCancelBtn = document.getElementById('settingsCancelBtn');
  els.settingsSaveBtn = document.getElementById('settingsSaveBtn');
  els.apiBaseInput = document.getElementById('apiBaseInput');
  els.apiKeyInput = document.getElementById('apiKeyInput');
  els.toggleApiKey = document.getElementById('toggleApiKey');
  els.radioOpenAI = document.getElementById('radioOpenAI');
  els.radioAnthropic = document.getElementById('radioAnthropic');
  els.protoOpenAI = document.getElementById('protoOpenAI');
  els.protoAnthropic = document.getElementById('protoAnthropic');
  els.modelSelector = document.getElementById('modelSelector');
  els.modelSelectorDisplay = document.getElementById('modelSelectorDisplay');
  els.modelDropdown = document.getElementById('modelDropdown');
  els.currentModelName = document.getElementById('currentModelName');
  els.toastContainer = document.getElementById('toastContainer');
  els.themeButtons = Array.from(document.querySelectorAll('.theme-btn'));
  els.suggestionCards = Array.from(document.querySelectorAll('.suggestion-card'));
}

function configureMarkdown() {
  if (!window.marked) return;
  marked.setOptions({ breaks: true, gfm: true });
}

function bindEvents() {
  els.newChatBtn.addEventListener('click', () => createNewConversation());
  els.sendBtn.addEventListener('click', () => handleSend());
  els.chatInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendButtonState();
  });
  els.chatInput.addEventListener('keydown', handleInputKeydown);

  els.settingsBtn.addEventListener('click', openSettingsModal);
  els.settingsCloseBtn.addEventListener('click', closeSettingsModal);
  els.settingsCancelBtn.addEventListener('click', closeSettingsModal);
  els.settingsSaveBtn.addEventListener('click', saveSettingsFromModal);
  els.settingsModal.addEventListener('click', (event) => {
    if (event.target === els.settingsModal) closeSettingsModal();
  });

  els.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
  els.protoOpenAI.addEventListener('click', () => updateProtocol('openai'));
  els.protoAnthropic.addEventListener('click', () => updateProtocol('anthropic'));

  els.modelSelectorDisplay.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.isStreaming) return;
    els.modelSelector.classList.toggle('open');
  });

  els.modelDropdown.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const option = event.target.closest('.model-option');
    if (!option) return;
    selectModel(option.dataset.model);
  });

  document.addEventListener('click', (event) => {
    if (!els.modelSelector.contains(event.target)) {
      els.modelSelector.classList.remove('open');
    }
  });

  els.hamburgerBtn.addEventListener('click', (event) => {
    event.preventDefault();
    openSidebar();
  });
  els.sidebarCloseBtn.addEventListener('click', (event) => {
    event.preventDefault();
    closeSidebar();
  });
  els.sidebarOverlay.addEventListener('click', closeSidebar);

  els.conversationsList.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('.conversation-delete-btn');
    if (deleteBtn) {
      event.stopPropagation();
      deleteConversation(deleteBtn.dataset.id);
      return;
    }

    const item = event.target.closest('.conversation-item');
    if (item) {
      switchConversation(item.dataset.id);
      closeSidebar();
    }
  });

  els.suggestionCards.forEach((card) => {
    card.addEventListener('click', () => {
      els.chatInput.value = card.dataset.text || '';
      autoResizeTextarea();
      updateSendButtonState();
      els.chatInput.focus();
    });
  });

  els.themeButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      applyTheme(btn.dataset.theme, true);
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  });
}

function applyTheme(theme, shouldNotify = false) {
  const resolvedTheme = theme === 'light' ? 'light' : 'dark';
  const themeVars = THEMES[resolvedTheme];

  Object.entries(themeVars).forEach(([key, value]) => {
    if (key === 'colorScheme') return;
    els.html.style.setProperty(key, value);
  });

  els.html.dataset.theme = resolvedTheme;
  els.body.dataset.theme = resolvedTheme;
  els.html.style.colorScheme = themeVars.colorScheme;
  state.settings.theme = resolvedTheme;

  els.themeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === resolvedTheme);
  });

  saveState();
  if (shouldNotify) {
    showToast(`已切换为${resolvedTheme === 'light' ? '浅色' : '深色'}主题`, 'success');
  }
}

function handleInputKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

function autoResizeTextarea() {
  els.chatInput.style.height = 'auto';
  const nextHeight = Math.min(els.chatInput.scrollHeight, 200);
  els.chatInput.style.height = `${nextHeight}px`;
}

function updateSendButtonState() {
  const hasText = Boolean(els.chatInput.value.trim());
  els.sendBtn.disabled = !hasText || state.isStreaming;
}

function generateId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createConversationObject() {
  return {
    id: generateId(),
    title: '新对话',
    messages: [],
    model: DEFAULT_MODEL,
    protocol: state.settings.protocol,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createNewConversation(options = {}) {
  const conversation = createConversationObject();
  state.conversations.set(conversation.id, conversation);
  state.currentConvId = conversation.id;
  saveState();
  renderConversationList();
  renderCurrentConversation();
  updateModelUI(conversation.model);
  updateProtocolButtons(conversation.protocol);

  if (!options.silent) {
    els.chatInput.focus();
    showToast('已创建新的对话', 'success');
  }
  return conversation;
}

function getCurrentConversation() {
  if (!state.currentConvId || !state.conversations.has(state.currentConvId)) {
    const firstConv = state.conversations.values().next().value;
    if (firstConv) state.currentConvId = firstConv.id;
    else return createNewConversation({ silent: true });
  }
  return state.conversations.get(state.currentConvId);
}

function switchConversation(id) {
  if (!state.conversations.has(id)) return;
  state.currentConvId = id;
  saveState();
  renderConversationList();
  renderCurrentConversation();
  const conv = getCurrentConversation();
  updateModelUI(conv.model);
  updateProtocolButtons(conv.protocol);
}

function deleteConversation(id) {
  if (!state.conversations.has(id)) return;

  state.conversations.delete(id);

  if (state.currentConvId === id) {
    const next = Array.from(state.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    state.currentConvId = next?.id || null;
  }

  if (!state.currentConvId) {
    createNewConversation({ silent: true });
    return;
  }

  saveState();
  renderConversationList();
  renderCurrentConversation();
  const conv = getCurrentConversation();
  updateModelUI(conv.model);
  updateProtocolButtons(conv.protocol);
  showToast('对话已删除', 'success');
}

function autoTitle(conversation) {
  const firstUser = conversation.messages.find((msg) => msg.role === 'user');
  if (!firstUser) return;
  const text = getMessageText(firstUser).replace(/\s+/g, ' ').trim();
  if (!text) return;
  conversation.title = text.slice(0, 20) + (text.length > 20 ? '…' : '');
}

function renderConversationList() {
  const conversations = Array.from(state.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);

  if (!conversations.length) {
    els.conversationsList.innerHTML = '<div class="empty-conversations">暂无历史对话，点击“新建对话”开始使用。</div>';
    return;
  }

  els.conversationsList.innerHTML = conversations.map((conv) => {
    const activeClass = conv.id === state.currentConvId ? 'active' : '';
    const updated = formatTime(conv.updatedAt);
    return `
      <div class="conversation-item ${activeClass}" data-id="${conv.id}">
        <div class="conversation-main">
          <div class="conversation-title">${escapeHtml(conv.title || '新对话')}</div>
          <div class="conversation-meta">${escapeHtml(updated)} · ${escapeHtml(conv.model)}</div>
        </div>
        <button class="conversation-delete-btn" data-id="${conv.id}" title="删除对话">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

function renderCurrentConversation() {
  const conv = getCurrentConversation();
  els.messagesList.innerHTML = '';

  if (!conv.messages.length) {
    els.welcomeScreen.classList.remove('hidden');
  } else {
    els.welcomeScreen.classList.add('hidden');
    conv.messages.forEach((msg) => {
      els.messagesList.appendChild(renderMessage(msg));
    });
    enhanceRenderedContent(els.messagesList);
  }

  els.footerModelHint.textContent = `${conv.model} · ${conv.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI'}`;
  scrollToBottom();
}

function renderMessage(message) {
  const row = document.createElement('div');
  const isUser = message.role === 'user';
  row.className = `message-row ${isUser ? 'user' : 'assistant'}`;

  const text = document.createElement('div');
  text.className = 'message-text';

  if (message.isError) {
    text.innerHTML = `<p style="color: var(--danger);">${escapeHtml(getMessageText(message))}</p>`;
  } else if (isUser) {
    text.textContent = getMessageText(message);
  } else if (message.loading) {
    text.innerHTML = `
      <div class="loading-dots" aria-label="思考中">
        <span></span><span></span><span></span>
      </div>
    `;
  } else {
    text.innerHTML = renderMarkdown(getMessageText(message));
  }

  if (isUser) {
    const userAvatar = document.createElement('div');
    userAvatar.className = 'user-avatar';
    userAvatar.innerHTML = `<img src="xhz.jpg" alt="头像" draggable="false" />`;

    const bubble = document.createElement('div');
    bubble.className = 'user-bubble';
    bubble.appendChild(text);

    row.appendChild(bubble);
    row.appendChild(userAvatar);
  } else {
    const aiAvatar = document.createElement('div');
    aiAvatar.className = 'ai-avatar';
    aiAvatar.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="8" fill="url(#ag1)"/>
        <path d="M7 14C7 10.134 10.134 7 14 7s7 3.134 7 7-3.134 7-7 7-7-3.134-7-7z" fill="white" opacity="0.9"/>
        <path d="M11 14c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3z" fill="url(#ag1)"/>
        <defs>
          <linearGradient id="ag1" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stop-color="#4f94ef"/>
            <stop offset="1" stop-color="#7c3aed"/>
          </linearGradient>
        </defs>
      </svg>
    `;

    const aiContent = document.createElement('div');
    aiContent.className = 'ai-content';
    aiContent.appendChild(text);

    row.appendChild(aiAvatar);
    row.appendChild(aiContent);
  }

  return row;
}

function appendAIMessage() {
  const message = { role: 'assistant', content: '', loading: true };
  const node = renderMessage(message);
  els.messagesList.appendChild(node);
  els.welcomeScreen.classList.add('hidden');
  scrollToBottom();

  const textEl = node.querySelector('.message-text');

  return {
    update(content) {
      message.loading = false;
      message.content = content;
      textEl.innerHTML = renderMarkdown(content || '');
      enhanceRenderedContent(node);
      scrollToBottom();
    },
    finish(finalContent) {
      message.loading = false;
      message.content = finalContent;
      textEl.innerHTML = renderMarkdown(finalContent || '');
      enhanceRenderedContent(node);
      scrollToBottom();
    },
    error(errorText) {
      message.loading = false;
      message.content = errorText;
      textEl.innerHTML = `<p style="color: var(--danger);">${escapeHtml(errorText)}</p>`;
      scrollToBottom();
    },
  };
}

function renderMarkdown(content) {
  if (!content) return '<p></p>';
  if (!window.marked) return `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
  return marked.parse(content);
}

function enhanceRenderedContent(root) {
  if (!root) return;

  root.querySelectorAll('pre code').forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    if (pre.parentElement?.classList.contains('code-block')) return;

    if (window.hljs) hljs.highlightElement(codeBlock);

    const langClass = Array.from(codeBlock.classList).find((cls) => cls.startsWith('language-'));
    const language = langClass ? langClass.replace('language-', '') : 'code';

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="code-lang">${escapeHtml(language)}</span>
      <button class="copy-code-btn" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        复制
      </button>
    `;

    const clonePre = pre.cloneNode(true);
    wrapper.appendChild(header);
    wrapper.appendChild(clonePre);
    pre.replaceWith(wrapper);
  });

  root.querySelectorAll('.copy-code-btn').forEach((btn) => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', async () => {
      const code = btn.closest('.code-block')?.querySelector('code')?.innerText || '';
      try {
        await navigator.clipboard.writeText(code);
        showToast('代码已复制', 'success');
      } catch {
        showToast('复制失败，请手动复制', 'error');
      }
    });
  });
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    els.messagesArea.scrollTop = els.messagesArea.scrollHeight;
  });
}

async function handleSend() {
  if (state.isStreaming) return;
  const content = els.chatInput.value.trim();
  if (!content) return;

  const conv = getCurrentConversation();
  const modelMeta = getModelMeta(conv.model);

  if (modelMeta.mode === 'tts' && !conv.messages.some((msg) => msg.role === 'assistant' && !msg.isError)) {
    showToast('TTS 模型需要已有 assistant 消息，建议先切换到普通聊天模型开始对话', 'error');
    return;
  }

  const userMessage = { role: 'user', content };
  conv.messages.push(userMessage);
  conv.updatedAt = Date.now();
  autoTitle(conv);
  saveState();
  renderConversationList();

  const userNode = renderMessage(userMessage);
  els.messagesList.appendChild(userNode);
  els.welcomeScreen.classList.add('hidden');
  scrollToBottom();

  els.chatInput.value = '';
  autoResizeTextarea();
  state.isStreaming = true;
  updateSendButtonState();

  const aiRenderer = appendAIMessage();
  let assistantContent = '';

  try {
    const protocol = conv.protocol || state.settings.protocol;
    const normalizedMessages = normalizeMessagesForSending(conv.messages);

    const onChunk = (chunk) => {
      assistantContent += chunk;
      aiRenderer.update(assistantContent);
    };

    if (protocol === 'anthropic') {
      await sendAnthropic(normalizedMessages, conv.model, onChunk);
    } else {
      await sendOpenAI(normalizedMessages, conv.model, onChunk);
    }

    const assistantMessage = { role: 'assistant', content: assistantContent || '（空响应）' };
    conv.messages.push(assistantMessage);
    conv.updatedAt = Date.now();
    aiRenderer.finish(assistantMessage.content);
  } catch (error) {
    const errorText = formatRequestError(error);
    aiRenderer.error(errorText);
    showToast(errorText, 'error');
  } finally {
    state.isStreaming = false;
    saveState();
    renderConversationList();
    updateSendButtonState();
    scrollToBottom();
  }
}

function normalizeMessagesForSending(messages) {
  return messages
    .filter((msg) => ['system', 'user', 'assistant'].includes(msg.role))
    .filter((msg) => !msg.isError)
    .filter((msg) => !msg.loading)
    .map((msg) => ({ role: msg.role, content: getMessageText(msg) }))
    .filter((msg) => msg.content.trim());
}

async function sendOpenAI(messages, model, onChunk) {
  const response = await fetch(`${normalizeApiBase(state.settings.apiBase)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(state.settings.apiKey ? { Authorization: `Bearer ${state.settings.apiKey}` } : {}),
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  await ensureResponseOk(response);

  await readSSEStream(response, (data) => {
    const delta = data?.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) onChunk(delta);
  });
}

async function sendAnthropic(messages, model, onChunk) {
  const systemMessages = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n');
  const convertedMessages = messages
    .filter((item) => item.role !== 'system')
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: item.content }],
    }));

  const payload = { model, messages: convertedMessages, stream: true, max_tokens: 4096 };
  if (systemMessages) payload.system = systemMessages;

  const response = await fetch(`${normalizeApiBase(state.settings.apiBase)}/anthropic/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(state.settings.apiKey ? { 'x-api-key': state.settings.apiKey } : {}),
    },
    body: JSON.stringify(payload),
  });

  await ensureResponseOk(response);

  await readSSEStream(response, (data) => {
    const deltaType = data?.delta?.type;
    const deltaText = data?.delta?.text;
    if (data?.type === 'content_block_delta' && deltaType === 'text_delta' && typeof deltaText === 'string' && deltaText) {
      onChunk(deltaText);
    }
  });
}

async function readSSEStream(response, onData) {
  if (!response.body) throw new Error('当前浏览器不支持流式响应');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) processSSEChunk(buffer, onData);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) processSSEChunk(part, onData);
  }
}

function processSSEChunk(chunk, onData) {
  const lines = chunk.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      onData(JSON.parse(data));
    } catch {
      // 忽略非 JSON 数据块
    }
  }
}

async function ensureResponseOk(response) {
  if (response.ok) return;
  let errorText = `${response.status} ${response.statusText}`;
  try {
    const text = await response.text();
    if (text) errorText = text;
  } catch {
    // ignore
  }
  throw new Error(errorText);
}

function updateProtocol(protocol) {
  const conv = getCurrentConversation();
  conv.protocol = protocol;
  conv.updatedAt = Date.now();
  state.settings.protocol = protocol;
  saveState();
  updateProtocolButtons(protocol);
  renderConversationList();
  updateModelUI(conv.model);
}

function updateProtocolButtons(protocol) {
  const resolvedProtocol = protocol || state.conversations.get(state.currentConvId)?.protocol || state.settings.protocol || 'openai';
  els.protoOpenAI.classList.toggle('active', resolvedProtocol === 'openai');
  els.protoAnthropic.classList.toggle('active', resolvedProtocol === 'anthropic');
  els.radioOpenAI.checked = resolvedProtocol === 'openai';
  els.radioAnthropic.checked = resolvedProtocol === 'anthropic';
}

function selectModel(model) {
  const target = getModelMeta(model);
  if (!target || state.isStreaming) return;

  const conv = getCurrentConversation();
  conv.model = target.id;
  conv.updatedAt = Date.now();
  saveState();
  updateModelUI(target.id);
  renderConversationList();
  els.modelSelector.classList.remove('open');

  if (target.mode === 'tts') {
    showToast(`${target.name} 属于 TTS 模型，普通聊天场景可能受接口限制`, 'error');
  } else {
    showToast(`已切换到 ${target.name}`, 'success');
  }
}

function updateModelUI(model) {
  const target = getModelMeta(model) || getModelMeta(DEFAULT_MODEL);
  els.currentModelName.textContent = target.name;
  els.footerModelHint.textContent = `${target.id} · ${(getCurrentConversation().protocol || state.settings.protocol) === 'anthropic' ? 'Anthropic' : 'OpenAI'}`;
  document.querySelectorAll('.model-option').forEach((item) => {
    item.classList.toggle('active', item.dataset.model === target.id);
  });
}

function getModelMeta(modelId) {
  return MODELS.find((item) => item.id === modelId) || null;
}

function openSettingsModal() {
  syncSettingsToUI();
  els.settingsModal.classList.add('open');
}

function closeSettingsModal() {
  els.settingsModal.classList.remove('open');
}

function syncSettingsToUI() {
  els.apiBaseInput.value = state.settings.apiBase || DEFAULT_API_BASE;
  els.apiKeyInput.value = state.settings.apiKey || '';
  els.radioOpenAI.checked = state.settings.protocol === 'openai';
  els.radioAnthropic.checked = state.settings.protocol === 'anthropic';
  els.themeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
  });
}

function saveSettingsFromModal() {
  const apiBase = normalizeApiBase(els.apiBaseInput.value || DEFAULT_API_BASE);
  const protocol = els.radioAnthropic.checked ? 'anthropic' : 'openai';

  state.settings.apiBase = apiBase;
  state.settings.apiKey = els.apiKeyInput.value.trim();
  state.settings.protocol = protocol;

  const conv = getCurrentConversation();
  conv.protocol = protocol;
  conv.updatedAt = Date.now();

  saveState();
  updateProtocolButtons(protocol);
  updateModelUI(conv.model);
  renderConversationList();
  closeSettingsModal();
  showToast('设置已保存', 'success');
}

function toggleApiKeyVisibility() {
  els.apiKeyInput.type = els.apiKeyInput.type === 'password' ? 'text' : 'password';
}

function openSidebar() {
  els.sidebar.classList.add('open');
  els.sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.sidebarOverlay.classList.remove('active');
}

function saveState() {
  const payload = {
    conversations: Array.from(state.conversations.values()),
    currentConvId: state.currentConvId,
    settings: state.settings,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed.conversations)) {
      parsed.conversations.forEach((conv) => {
        state.conversations.set(conv.id, {
          id: conv.id,
          title: conv.title || '新对话',
          messages: Array.isArray(conv.messages) ? conv.messages : [],
          model: getModelMeta(conv.model)?.id || DEFAULT_MODEL,
          protocol: conv.protocol || parsed?.settings?.protocol || 'openai',
          createdAt: conv.createdAt || Date.now(),
          updatedAt: conv.updatedAt || Date.now(),
        });
      });
    }

    state.currentConvId = parsed.currentConvId || null;
    state.settings = {
      apiBase: parsed?.settings?.apiBase || DEFAULT_API_BASE,
      apiKey: parsed?.settings?.apiKey || '',
      protocol: parsed?.settings?.protocol || 'openai',
      theme: parsed?.settings?.theme === 'light' ? 'light' : 'dark',
    };
  } catch (error) {
    console.warn('loadState failed:', error);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeApiBase(base) {
  return (base || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
  els.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function getMessageText(message) {
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.content)) return message.content.map((item) => item?.text || '').join('');
  return '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRequestError(error) {
  const raw = String(error?.message || '未知错误');

  if (/Failed to fetch/i.test(raw)) {
    return '请求失败：无法连接到接口，请确认你是通过 http://localhost:4174 打开的页面，并且 node proxy.js 正在运行';
  }

  if (/messages must contain an assistant role for TTS model/i.test(raw)) {
    return '请求失败：当前 TTS 模型不支持直接首轮文本对话，请切回 mimo-v2.5-pro 或 mimo-v2.5';
  }

  if (/Unexpected token|JSON/i.test(raw)) {
    return '请求失败：接口返回了无法解析的数据';
  }

  return `请求失败：${raw}`;
}

document.addEventListener('DOMContentLoaded', init);

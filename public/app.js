// wterm - クライアントサイドアプリケーション

class WtermApp {
  constructor() {
    // 状態管理
    this.sessions = [];
    this.terminals = new Map(); // sessionId -> { terminal, fitAddon }
    this.activeSessionId = null;
    this.config = null;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.viewMode = 'tab'; // 'tab' or 'split'
    this.splitLayout = null;
    this.splitPanes = new Map(); // sessionId -> pane element
    this.pendingSessionId = null; // 作成中のセッションID（選択待ち）

    // DOM要素
    this.elements = {
      sessionList: document.getElementById('session-list'),
      terminalContainer: document.getElementById('terminal-container'),
      welcomeMessage: document.getElementById('welcome-message'),
      historyList: document.getElementById('history-list'),
      connectionStatus: document.getElementById('connection-status'),
      statusSessions: document.getElementById('status-sessions'),
      statusActive: document.getElementById('status-active'),
      shortcutsMenu: document.getElementById('shortcuts-menu'),
      sidebar: document.getElementById('sidebar'),
      historyPanel: document.getElementById('history-panel'),
      contextMenu: document.getElementById('context-menu'),
    };

    // ダイアログ
    this.dialogs = {
      settings: document.getElementById('settings-dialog'),
      shortcut: document.getElementById('shortcut-dialog'),
    };

    // 初期化
    this.init();
  }

  async init() {
    // 設定を読み込み
    await this.loadConfig();

    // WebSocket接続
    this.connectWebSocket();

    // イベントリスナー設定
    this.setupEventListeners();

    // キーボードショートカット
    this.setupKeyboardShortcuts();

    // UIを初期化
    this.applyUILayout();
  }

  // ================== 設定管理 ==================

  async loadConfig() {
    try {
      const response = await fetch('/config');
      this.config = await response.json();
      this.renderShortcuts();
    } catch (e) {
      console.error('設定の読み込みに失敗しました:', e);
    }
  }

  async saveConfig(config) {
    try {
      const response = await fetch('/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        this.config = config;
        this.renderShortcuts();
        this.applyUILayout();
      }
    } catch (e) {
      console.error('設定の保存に失敗しました:', e);
    }
  }

  applyUILayout() {
    if (!this.config) return;

    const { showSidebar, showHistoryPanel, sidebarPosition } = this.config.uiLayout;

    // サイドバー
    this.elements.sidebar.classList.toggle('hidden', !showSidebar);
    this.elements.sidebar.classList.toggle('right', sidebarPosition === 'right');

    // 履歴パネル
    this.elements.historyPanel.classList.toggle('hidden', !showHistoryPanel);
  }

  // ================== WebSocket ==================

  connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket接続成功');
      this.updateConnectionStatus('connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = () => {
      console.log('WebSocket切断');
      this.updateConnectionStatus('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleServerMessage(message);
      } catch (e) {
        console.error('メッセージ解析エラー:', e);
      }
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateConnectionStatus('disconnected');
      return;
    }

    this.reconnectAttempts++;
    this.updateConnectionStatus('reconnecting');

    setTimeout(() => {
      console.log(`再接続試行 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connectWebSocket();
    }, 5000);
  }

  updateConnectionStatus(status) {
    const el = this.elements.connectionStatus;
    el.className = `status status-${status}`;
    el.textContent = status === 'connected' ? '接続中' : status === 'reconnecting' ? '再接続中...' : '切断中';
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleServerMessage(message) {
    switch (message.type) {
      case 'sessions':
        this.sessions = message.sessions;
        this.renderSessionList();
        this.updateTerminalHeader();
        this.updateStatusBar();

        // 作成待ちのセッションがあれば選択
        if (this.pendingSessionId) {
          const session = this.sessions.find(s => s.id === this.pendingSessionId);
          if (session) {
            this.selectSession(this.pendingSessionId);
            this.pendingSessionId = null;
          }
        }
        break;

      case 'output':
        this.handleTerminalOutput(message.sessionId, message.data);
        break;

      case 'history':
        this.handleTerminalHistory(message.sessionId, message.data);
        break;

      case 'exit':
        this.handleSessionExit(message.sessionId, message.exitCode);
        break;

      case 'message':
        this.addMessageToHistory(message.message);
        break;

      case 'error':
        console.error('サーバーエラー:', message.message);
        break;
    }
  }

  // ================== セッション管理 ==================

  async createSession(command = '') {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await response.json();

      // セッションIDを保存して、WebSocketのsessionsメッセージを待つ
      this.pendingSessionId = data.sessionId;
    } catch (e) {
      console.error('セッション作成に失敗しました:', e);
      this.pendingSessionId = null;
    }
  }

  async deleteSession(sessionId) {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      
      // 分割ビューからペインを削除
      if (this.splitPanes.has(sessionId)) {
        const pane = this.splitPanes.get(sessionId);
        const container = pane.parentElement;
        
        // 前のディバイダーを削除
        const prevSibling = pane.previousElementSibling;
        if (prevSibling && prevSibling.classList.contains('split-divider')) {
          prevSibling.remove();
        } else {
          // 後ろのディバイダーを削除
          const nextSibling = pane.nextElementSibling;
          if (nextSibling && nextSibling.classList.contains('split-divider')) {
            nextSibling.remove();
          }
        }
        
        pane.remove();
        this.splitPanes.delete(sessionId);
        
        // ペインが1つ以下ならタブビューに戻る
        if (this.splitPanes.size <= 1) {
          this.switchToTabView();
        }
      }
      
      // ターミナルを破棄
      const termData = this.terminals.get(sessionId);
      if (termData) {
        termData.terminal.dispose();
        this.terminals.delete(sessionId);
      }

      // ターミナルラッパーを削除
      const wrapper = document.getElementById(`terminal-${sessionId}`);
      if (wrapper) {
        wrapper.remove();
      }

      // アクティブセッションが削除された場合
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = null;
        const remaining = this.sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          this.selectSession(remaining[0].id);
        } else {
          this.elements.welcomeMessage.style.display = 'flex';
        }
      }
    } catch (e) {
      console.error('セッション削除に失敗しました:', e);
    }
  }

  async restartSession(sessionId) {
    try {
      await fetch(`/api/sessions/${sessionId}/restart`, { method: 'POST' });
    } catch (e) {
      console.error('セッション再起動に失敗しました:', e);
    }
  }

  selectSession(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return;

    this.activeSessionId = sessionId;

    // ターミナルが未作成なら作成
    if (!this.terminals.has(sessionId)) {
      this.createTerminal(sessionId);
    }

    // 全ターミナルを非表示にして、対象のみ表示
    this.elements.terminalContainer.querySelectorAll('.terminal-wrapper').forEach((el) => {
      el.classList.remove('active');
    });

    const wrapper = document.getElementById(`terminal-${sessionId}`);
    if (wrapper) {
      wrapper.classList.add('active');
      this.elements.welcomeMessage.style.display = 'none';

      // フィット
      const termData = this.terminals.get(sessionId);
      if (termData) {
        // DOMの再描画を待ってからfitを実行
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            termData.fitAddon.fit();
            termData.terminal.focus();
          });
        });
      }
    }

    // WebSocketでattach
    this.sendMessage({ type: 'attach', sessionId });

    // UI更新
    this.renderSessionList();
    this.updateTerminalHeader();
    this.updateStatusBar();
  }

  createTerminal(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId);

    // ターミナルラッパー作成
    const wrapper = document.createElement('div');
    wrapper.id = `terminal-${sessionId}`;
    wrapper.className = 'terminal-wrapper';

    // ヘッダー作成
    const header = document.createElement('div');
    header.className = 'terminal-header';
    header.innerHTML = `
      <div class="terminal-header-left">
        <span class="terminal-header-session">${sessionId}</span>
        <span class="terminal-header-status ${session?.status || 'running'}">
          ${session?.status === 'running' ? '実行中' : '終了'}
        </span>
        <span class="terminal-header-command">${session?.command || 'PowerShell'}</span>
      </div>
      <div class="terminal-header-right">
        <button class="btn-icon btn-terminal-restart" title="再起動" style="display: ${session?.status === 'exited' ? 'inline-flex' : 'none'};">
          <span>↻</span>
        </button>
        <button class="btn-icon btn-terminal-close" title="セッション削除">
          <span>✕</span>
        </button>
      </div>
    `;

    // ターミナルコンテンツ
    const content = document.createElement('div');
    content.className = 'terminal-content';

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    this.elements.terminalContainer.appendChild(wrapper);

    // ヘッダーボタンのイベントリスナー
    const restartBtn = header.querySelector('.btn-terminal-restart');
    const closeBtn = header.querySelector('.btn-terminal-close');

    restartBtn.addEventListener('click', () => this.restartSession(sessionId));
    closeBtn.addEventListener('click', () => this.deleteSession(sessionId));

    // xterm.js初期化
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(content);
    // fitAddon.fit()は表示されるまで遅延（selectSession内で実行）

    // 入力をWebSocketへ送信
    terminal.onData((data) => {
      this.sendMessage({
        type: 'input',
        sessionId,
        data,
      });
    });

    // リサイズ時に通知
    terminal.onResize(({ cols, rows }) => {
      this.sendMessage({
        type: 'resize',
        sessionId,
        cols,
        rows,
      });
    });

    this.terminals.set(sessionId, { terminal, fitAddon });

    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => {
      if (this.activeSessionId === sessionId) {
        fitAddon.fit();
      }
    });

    return terminal;
  }

  handleTerminalOutput(sessionId, data) {
    const termData = this.terminals.get(sessionId);
    if (termData) {
      termData.terminal.write(data);
    }
  }

  handleTerminalHistory(sessionId, data) {
    const termData = this.terminals.get(sessionId);
    if (termData) {
      termData.terminal.write(data);
    }
  }

  handleSessionExit(sessionId, exitCode) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.status = 'exited';
      session.exitCode = exitCode;
    }
    this.renderSessionList();
    this.updateTerminalHeader();
  }

  // ================== UI レンダリング ==================

  renderSessionList() {
    const list = this.elements.sessionList;
    list.innerHTML = '';

    this.sessions.forEach((session) => {
      const li = document.createElement('li');
      li.className = `session-item${session.id === this.activeSessionId ? ' active' : ''}`;
      li.innerHTML = `
        <div class="session-item-header">
          <span class="session-name">${session.id}</span>
          <span class="session-status ${session.status}"></span>
        </div>
        <div class="session-command">${session.command || 'PowerShell'}</div>
        ${
          session.status === 'exited'
            ? `
          <div class="session-actions">
            <button class="btn btn-restart" data-session="${session.id}">再起動</button>
          </div>
        `
            : ''
        }
      `;

      li.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn-restart')) {
          this.selectSession(session.id);
        }
      });

      li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, session.id);
      });

      const restartBtn = li.querySelector('.btn-restart');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => this.restartSession(session.id));
      }

      list.appendChild(li);
    });
  }

  updateTerminalHeader(sessionId = null) {
    // 特定のセッションまたは全セッションのヘッダーを更新
    const sessionsToUpdate = sessionId ? [sessionId] : this.sessions.map(s => s.id);

    sessionsToUpdate.forEach(sid => {
      const wrapper = document.getElementById(`terminal-${sid}`);
      if (!wrapper) return;

      const session = this.sessions.find((s) => s.id === sid);
      if (!session) return;

      const header = wrapper.querySelector('.terminal-header');
      if (!header) return;

      const sessionSpan = header.querySelector('.terminal-header-session');
      const statusSpan = header.querySelector('.terminal-header-status');
      const commandSpan = header.querySelector('.terminal-header-command');
      const restartBtn = header.querySelector('.btn-terminal-restart');

      if (sessionSpan) sessionSpan.textContent = session.id;
      if (statusSpan) {
        statusSpan.textContent = session.status === 'running' ? '実行中' : '終了';
        statusSpan.className = `terminal-header-status ${session.status}`;
      }
      if (commandSpan) commandSpan.textContent = session.command || 'PowerShell';
      if (restartBtn) {
        restartBtn.style.display = session.status === 'exited' ? 'inline-flex' : 'none';
      }
    });
  }

  renderShortcuts() {
    if (!this.config) return;

    const menu = this.elements.shortcutsMenu;
    menu.innerHTML = '';

    this.config.shortcuts.forEach((shortcut) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.innerHTML = `
        <span class="shortcut-icon">${shortcut.icon}</span>
        <span>${shortcut.name}</span>
      `;
      item.addEventListener('click', () => {
        this.createSession(shortcut.command);
        menu.classList.remove('show');
      });
      menu.appendChild(item);
    });
  }

  updateStatusBar() {
    this.elements.statusSessions.textContent = `セッション: ${this.sessions.length}`;
    this.elements.statusActive.textContent = `アクティブ: ${this.activeSessionId || 'なし'}`;
  }

  // ================== 履歴パネル ==================

  addMessageToHistory(message) {
    const item = document.createElement('div');
    item.className = 'history-item';

    const time = new Date(message.timestamp).toLocaleTimeString('ja-JP');
    const to = message.to === 'all' ? 'broadcast' : message.to;

    item.innerHTML = `
      <div class="history-header">
        <span class="history-route">${message.from} → ${to}</span>
        <span class="history-time">${time}</span>
      </div>
      <div class="history-content">${this.escapeHtml(message.content)}</div>
    `;

    this.elements.historyList.prepend(item);

    // 最大50件まで保持
    while (this.elements.historyList.children.length > 50) {
      this.elements.historyList.lastChild.remove();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ================== コンテキストメニュー ==================

  showContextMenu(event, sessionId) {
    const menu = this.elements.contextMenu;
    menu.style.display = 'block';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.dataset.sessionId = sessionId;

    const session = this.sessions.find((s) => s.id === sessionId);
    const restartItem = menu.querySelector('[data-action="restart"]');
    if (session && session.status === 'exited') {
      restartItem.classList.remove('disabled');
    } else {
      restartItem.classList.add('disabled');
    }
  }

  hideContextMenu() {
    this.elements.contextMenu.style.display = 'none';
  }

  handleContextMenuAction(action, sessionId) {
    switch (action) {
      case 'split-vertical':
        this.addToSplitView(sessionId, 'vertical');
        break;
      case 'split-horizontal':
        this.addToSplitView(sessionId, 'horizontal');
        break;
      case 'restart':
        this.restartSession(sessionId);
        break;
      case 'delete':
        this.deleteSession(sessionId);
        break;
    }
    this.hideContextMenu();
  }

  // ================== 分割ビュー ==================

  toggleViewMode() {
    if (this.viewMode === 'tab') {
      this.switchToSplitView();
    } else {
      this.switchToTabView();
    }
  }

  switchToSplitView() {
    if (this.sessions.length === 0) {
      alert('分割表示するセッションがありません');
      return;
    }

    this.viewMode = 'split';
    
    // 現在のセッションを分割ビューに追加
    const container = this.elements.terminalContainer;
    
    // ウェルカムメッセージを非表示
    this.elements.welcomeMessage.style.display = 'none';
    
    // 既存のターミナルラッパーを非表示
    container.querySelectorAll('.terminal-wrapper').forEach(el => {
      el.classList.remove('active');
    });
    
    // 分割コンテナを作成
    let splitContainer = container.querySelector('.split-container');
    if (!splitContainer) {
      splitContainer = document.createElement('div');
      splitContainer.className = 'split-container vertical';
      container.appendChild(splitContainer);
    }
    splitContainer.innerHTML = '';
    splitContainer.style.display = 'flex';
    
    // アクティブなセッションを分割ビューに追加
    const runningSessions = this.sessions.filter(s => s.status === 'running').slice(0, 4); // 最大4つ
    
    if (runningSessions.length === 0) {
      alert('実行中のセッションがありません');
      this.viewMode = 'tab';
      return;
    }

    runningSessions.forEach((session, index) => {
      const pane = document.createElement('div');
      pane.className = 'split-pane';
      pane.dataset.sessionId = session.id;
      
      // ターミナルラッパーを移動
      let wrapper = document.getElementById(`terminal-${session.id}`);
      if (!wrapper) {
        this.createTerminal(session.id);
        wrapper = document.getElementById(`terminal-${session.id}`);
      }

      if (wrapper) {
        wrapper.classList.add('active');
        pane.appendChild(wrapper);
      }
      
      splitContainer.appendChild(pane);
      this.splitPanes.set(session.id, pane);
      
      // 最後のペイン以外にはディバイダーを追加
      if (index < runningSessions.length - 1) {
        const divider = document.createElement('div');
        divider.className = 'split-divider';
        this.setupDividerDrag(divider, splitContainer);
        splitContainer.appendChild(divider);
      }
      
      // WebSocketでattach
      this.sendMessage({ type: 'attach', sessionId: session.id });
    });

    // 全ターミナルをリサイズ
    setTimeout(() => {
      this.fitAllTerminals();
    }, 100);
    
    // ボタンアイコンを更新
    document.getElementById('btn-toggle-view').querySelector('.icon').textContent = '⊟';
  }

  switchToTabView() {
    this.viewMode = 'tab';
    
    const container = this.elements.terminalContainer;
    
    // 分割コンテナを非表示
    const splitContainer = container.querySelector('.split-container');
    if (splitContainer) {
      // ターミナルラッパーをコンテナに戻す
      this.splitPanes.forEach((pane, sessionId) => {
        const wrapper = pane.querySelector('.terminal-wrapper');
        if (wrapper) {
          wrapper.classList.remove('active');
          container.appendChild(wrapper);
        }
      });
      splitContainer.style.display = 'none';
    }
    
    this.splitPanes.clear();
    
    // アクティブセッションを表示
    if (this.activeSessionId) {
      this.selectSession(this.activeSessionId);
    } else if (this.sessions.length > 0) {
      this.selectSession(this.sessions[0].id);
    } else {
      this.elements.welcomeMessage.style.display = 'flex';
    }
    
    // ボタンアイコンを更新
    document.getElementById('btn-toggle-view').querySelector('.icon').textContent = '⊞';
  }

  addToSplitView(sessionId, direction) {
    if (this.viewMode !== 'split') {
      // 分割ビューに切り替え
      this.viewMode = 'split';
      
      const container = this.elements.terminalContainer;
      this.elements.welcomeMessage.style.display = 'none';
      
      // 既存のターミナルラッパーを非表示
      container.querySelectorAll('.terminal-wrapper').forEach(el => {
        el.classList.remove('active');
      });
      
      // 分割コンテナを作成
      let splitContainer = container.querySelector('.split-container');
      if (!splitContainer) {
        splitContainer = document.createElement('div');
        splitContainer.className = `split-container ${direction}`;
        container.appendChild(splitContainer);
      }
      splitContainer.innerHTML = '';
      splitContainer.className = `split-container ${direction}`;
      splitContainer.style.display = 'flex';
      
      // 現在アクティブなセッションを追加
      if (this.activeSessionId && this.activeSessionId !== sessionId) {
        this.addPaneToSplit(splitContainer, this.activeSessionId);
        
        const divider = document.createElement('div');
        divider.className = 'split-divider';
        this.setupDividerDrag(divider, splitContainer);
        splitContainer.appendChild(divider);
      }
      
      // 選択されたセッションを追加
      this.addPaneToSplit(splitContainer, sessionId);
      
      document.getElementById('btn-toggle-view').querySelector('.icon').textContent = '⊟';
    } else {
      // 既存の分割ビューにセッションを追加
      const container = this.elements.terminalContainer;
      const splitContainer = container.querySelector('.split-container');
      
      if (splitContainer && !this.splitPanes.has(sessionId)) {
        const divider = document.createElement('div');
        divider.className = 'split-divider';
        this.setupDividerDrag(divider, splitContainer);
        splitContainer.appendChild(divider);
        
        this.addPaneToSplit(splitContainer, sessionId);
      }
    }
    
    setTimeout(() => {
      this.fitAllTerminals();
    }, 100);
  }

  addPaneToSplit(splitContainer, sessionId) {
    const pane = document.createElement('div');
    pane.className = 'split-pane';
    pane.dataset.sessionId = sessionId;

    let wrapper = document.getElementById(`terminal-${sessionId}`);
    if (!wrapper) {
      this.createTerminal(sessionId);
      wrapper = document.getElementById(`terminal-${sessionId}`);
    }

    if (wrapper) {
      wrapper.classList.add('active');
      pane.appendChild(wrapper);
    }

    splitContainer.appendChild(pane);
    this.splitPanes.set(sessionId, pane);

    this.sendMessage({ type: 'attach', sessionId });
  }

  setupDividerDrag(divider, container) {
    let isDragging = false;
    let startPos = 0;
    let startSizes = [];
    
    divider.addEventListener('mousedown', (e) => {
      isDragging = true;
      const isVertical = container.classList.contains('vertical');
      startPos = isVertical ? e.clientX : e.clientY;
      
      const panes = container.querySelectorAll('.split-pane');
      startSizes = Array.from(panes).map(p => isVertical ? p.offsetWidth : p.offsetHeight);
      
      document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const isVertical = container.classList.contains('vertical');
      const currentPos = isVertical ? e.clientX : e.clientY;
      const delta = currentPos - startPos;
      
      const panes = container.querySelectorAll('.split-pane');
      const dividerIndex = Array.from(container.querySelectorAll('.split-divider')).indexOf(divider);
      
      if (dividerIndex >= 0 && panes[dividerIndex] && panes[dividerIndex + 1]) {
        const newSize1 = startSizes[dividerIndex] + delta;
        const newSize2 = startSizes[dividerIndex + 1] - delta;
        
        if (newSize1 > 100 && newSize2 > 100) {
          panes[dividerIndex].style.flex = `0 0 ${newSize1}px`;
          panes[dividerIndex + 1].style.flex = `0 0 ${newSize2}px`;
          this.fitAllTerminals();
        }
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        
        // フレックスをリセット
        const panes = container.querySelectorAll('.split-pane');
        panes.forEach(p => {
          const isVertical = container.classList.contains('vertical');
          const size = isVertical ? p.offsetWidth : p.offsetHeight;
          p.style.flex = `1 1 ${size}px`;
        });
        
        this.fitAllTerminals();
      }
    });
  }

  fitAllTerminals() {
    this.terminals.forEach((termData, sessionId) => {
      const wrapper = document.getElementById(`terminal-${sessionId}`);
      if (wrapper && wrapper.classList.contains('active')) {
        termData.fitAddon.fit();
      }
    });
  }

  // ================== ダイアログ ==================

  openSettingsDialog() {
    const dialog = this.dialogs.settings;
    
    // 現在の設定を反映
    document.getElementById('setting-sidebar').checked = this.config.uiLayout.showSidebar;
    document.getElementById('setting-history').checked = this.config.uiLayout.showHistoryPanel;
    document.getElementById('setting-sidebar-position').value = this.config.uiLayout.sidebarPosition;

    // ショートカット一覧を表示
    this.renderShortcutList();

    dialog.showModal();
  }

  closeSettingsDialog() {
    this.dialogs.settings.close();
  }

  saveSettings() {
    this.config.uiLayout.showSidebar = document.getElementById('setting-sidebar').checked;
    this.config.uiLayout.showHistoryPanel = document.getElementById('setting-history').checked;
    this.config.uiLayout.sidebarPosition = document.getElementById('setting-sidebar-position').value;

    this.saveConfig(this.config);
    this.closeSettingsDialog();
  }

  renderShortcutList() {
    const list = document.getElementById('shortcut-list');
    list.innerHTML = '';

    this.config.shortcuts.forEach((shortcut) => {
      const li = document.createElement('li');
      li.className = 'shortcut-list-item';
      li.innerHTML = `
        <div class="shortcut-info">
          <span>${shortcut.icon}</span>
          <span>${shortcut.name}</span>
          <span style="color: var(--text-muted)">(${shortcut.command || 'shell'})</span>
        </div>
        <div class="shortcut-actions">
          <button class="btn-icon btn-edit" data-id="${shortcut.id}" title="編集">✏</button>
          <button class="btn-icon btn-delete" data-id="${shortcut.id}" title="削除">🗑</button>
        </div>
      `;

      li.querySelector('.btn-edit').addEventListener('click', () => this.openShortcutDialog(shortcut));
      li.querySelector('.btn-delete').addEventListener('click', () => this.deleteShortcut(shortcut.id));

      list.appendChild(li);
    });
  }

  openShortcutDialog(shortcut = null) {
    const dialog = this.dialogs.shortcut;
    const isEdit = shortcut !== null;

    document.getElementById('shortcut-dialog-title').textContent = isEdit ? 'ショートカット編集' : 'ショートカット追加';
    document.getElementById('shortcut-id').value = shortcut?.id || '';
    document.getElementById('shortcut-id').disabled = isEdit;
    document.getElementById('shortcut-name').value = shortcut?.name || '';
    document.getElementById('shortcut-command').value = shortcut?.command || '';
    document.getElementById('shortcut-icon').value = shortcut?.icon || '🚀';

    dialog.dataset.editMode = isEdit ? 'true' : 'false';
    dialog.dataset.originalId = shortcut?.id || '';
    dialog.showModal();
  }

  closeShortcutDialog() {
    this.dialogs.shortcut.close();
  }

  saveShortcut() {
    const dialog = this.dialogs.shortcut;
    const isEdit = dialog.dataset.editMode === 'true';

    const shortcut = {
      id: document.getElementById('shortcut-id').value.trim(),
      name: document.getElementById('shortcut-name').value.trim(),
      command: document.getElementById('shortcut-command').value.trim(),
      icon: document.getElementById('shortcut-icon').value.trim() || '🚀',
    };

    if (!shortcut.id || !shortcut.name) {
      alert('IDと名前は必須です');
      return;
    }

    if (isEdit) {
      const index = this.config.shortcuts.findIndex((s) => s.id === dialog.dataset.originalId);
      if (index !== -1) {
        this.config.shortcuts[index] = shortcut;
      }
    } else {
      if (this.config.shortcuts.find((s) => s.id === shortcut.id)) {
        alert('このIDは既に使用されています');
        return;
      }
      this.config.shortcuts.push(shortcut);
    }

    this.saveConfig(this.config);
    this.renderShortcutList();
    this.closeShortcutDialog();
  }

  deleteShortcut(id) {
    if (!confirm('このショートカットを削除しますか？')) return;

    this.config.shortcuts = this.config.shortcuts.filter((s) => s.id !== id);
    this.saveConfig(this.config);
    this.renderShortcutList();
  }

  // ================== イベントリスナー ==================

  setupEventListeners() {
    // 新規セッション
    document.getElementById('btn-new-session').addEventListener('click', () => this.createSession());

    // ショートカットメニュー
    document.getElementById('btn-shortcuts').addEventListener('click', (e) => {
      e.stopPropagation();
      this.elements.shortcutsMenu.classList.toggle('show');
    });

    // 設定
    document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsDialog());
    document.getElementById('btn-close-settings').addEventListener('click', () => this.closeSettingsDialog());
    document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('btn-cancel-settings').addEventListener('click', () => this.closeSettingsDialog());

    // ショートカット編集
    document.getElementById('btn-add-shortcut').addEventListener('click', () => this.openShortcutDialog());
    document.getElementById('btn-close-shortcut').addEventListener('click', () => this.closeShortcutDialog());
    document.getElementById('btn-save-shortcut').addEventListener('click', () => this.saveShortcut());
    document.getElementById('btn-cancel-shortcut').addEventListener('click', () => this.closeShortcutDialog());

    // サイドバートグル
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
      this.elements.sidebar.classList.toggle('hidden');
    });

    // 履歴パネルトグル
    document.getElementById('btn-toggle-history').addEventListener('click', () => {
      this.elements.historyPanel.classList.toggle('collapsed');
    });

    // レイアウト切替
    document.getElementById('btn-toggle-view').addEventListener('click', () => {
      this.toggleViewMode();
    });

    // コンテキストメニュー
    this.elements.contextMenu.querySelectorAll('.context-menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const sessionId = this.elements.contextMenu.dataset.sessionId;
        this.handleContextMenuAction(action, sessionId);
      });
    });

    // クリックでメニューを閉じる
    document.addEventListener('click', () => {
      this.elements.shortcutsMenu.classList.remove('show');
      this.hideContextMenu();
    });

    // ウィンドウリサイズ
    window.addEventListener('resize', () => {
      if (this.viewMode === 'split') {
        this.fitAllTerminals();
      } else if (this.activeSessionId) {
        const termData = this.terminals.get(this.activeSessionId);
        if (termData) {
          termData.fitAddon.fit();
        }
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+T: 新規セッション
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.createSession();
      }

      // Ctrl+Shift+W: セッション削除
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        if (this.activeSessionId) {
          this.deleteSession(this.activeSessionId);
        }
      }

      // Ctrl+Shift+L: レイアウト切替
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        this.toggleViewMode();
      }

      // Escape: メニューを閉じる
      if (e.key === 'Escape') {
        this.elements.shortcutsMenu.classList.remove('show');
        this.hideContextMenu();
      }
    });
  }
}

// アプリケーション起動
window.addEventListener('DOMContentLoaded', () => {
  window.app = new WtermApp();
});

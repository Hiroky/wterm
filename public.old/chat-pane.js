// wterm - チャット入力欄モジュール

class ChatPane {
  constructor() {
    this.textarea = null;
    this.bufferButtons = null;
    this.sendCurrentBtn = null;
    this.sendAllBtn = null;
    this.clearBtn = null;

    // 状態管理
    this.history = []; // 入力履歴
    this.historyIndex = -1; // 現在の履歴位置
    this.currentDraft = ''; // 履歴閲覧中の下書き
    this.bufferPositions = {}; // セッションIDごとのバッファ取得位置
    this.maxHistorySize = 50;
    this.sessionCount = 0;

    // WebSocketとアプリへの参照（app.jsから注入される）
    this.app = null;
  }

  /**
   * 初期化
   */
  init(app) {
    this.app = app;

    // DOM要素を取得
    this.textarea = document.getElementById('chat-textarea');
    this.bufferButtons = document.getElementById('buffer-buttons');
    this.sendCurrentBtn = document.getElementById('btn-send-current');
    this.sendAllBtn = document.getElementById('btn-send-all');
    this.clearBtn = document.getElementById('btn-clear-chat');

    if (!this.textarea || !this.bufferButtons) {
      console.error('チャット入力欄の要素が見つかりません');
      return;
    }

    // 履歴をlocalStorageから読み込み
    this.loadHistory();

    // イベントリスナーを設定
    this.setupEventListeners();

    // バッファボタンを初期化（1-9）
    this.updateBufferButtons(0);

    // テキストエリアの高さを初期化
    this.adjustTextareaHeight();

    console.log('チャット入力欄を初期化しました');
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // テキストエリアのキーボードイベント
    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.addEventListener('input', () => this.adjustTextareaHeight());

    // ボタンイベント
    this.sendCurrentBtn.addEventListener('click', () => this.sendToCurrentSession());
    this.sendAllBtn.addEventListener('click', () => this.sendToAllSessions());
    this.clearBtn.addEventListener('click', () => this.clearTextarea());

    // バッファボタンは動的に生成されるため、イベント委譲を使用
    this.bufferButtons.addEventListener('click', (e) => {
      const button = e.target.closest('[data-session-number]');
      if (button) {
        const sessionNumber = parseInt(button.dataset.sessionNumber);
        this.fetchBuffer(sessionNumber);
      }
    });
  }

  /**
   * キーボードイベント処理
   */
  handleKeyDown(e) {
    // Ctrl+Enter: 現在のセッションに送信
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      this.sendToCurrentSession();
      return;
    }

    // Ctrl+1-9: セッション1-9に送信
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const sessionNumber = parseInt(e.key);
      this.sendToSession(sessionNumber);
      return;
    }

    // ↑: 前の履歴
    if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey) {
      // カーソルが先頭にある場合のみ履歴を表示
      if (this.textarea.selectionStart === 0 && this.textarea.selectionEnd === 0) {
        e.preventDefault();
        this.showPreviousHistory();
      }
      return;
    }

    // ↓: 次の履歴
    if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey) {
      // カーソルが末尾にある場合のみ履歴を表示
      const atEnd = this.textarea.selectionStart === this.textarea.value.length;
      if (atEnd) {
        e.preventDefault();
        this.showNextHistory();
      }
      return;
    }

    // Esc: フォーカス解除
    if (e.key === 'Escape') {
      this.textarea.blur();
      return;
    }
  }

  /**
   * 現在のセッションに送信
   */
  sendToCurrentSession() {
    const text = this.textarea.value.trim();
    if (!text) return;

    const activeSessionId = this.app?.activeSessionId;
    if (!activeSessionId) {
      this.showToast('アクティブなセッションがありません', 'warning');
      return;
    }

    // WebSocket経由で送信
    // 複数行入力対応ツール（Copilot CLI、Claude Code等）対応:
    // 1. テキストを送信
    // 2. 少し待つ
    // 3. 単独でEnterを送信（空プロンプトでEnter = 送信トリガー）
    if (this.app?.ws?.readyState === WebSocket.OPEN) {
      // ステップ1: テキストを送信
      this.app.ws.send(JSON.stringify({
        type: 'input',
        sessionId: activeSessionId,
        data: text
      }));

      // ステップ2: 50ms待機後、Enterを送信
      setTimeout(() => {
        if (this.app?.ws?.readyState === WebSocket.OPEN) {
          this.app.ws.send(JSON.stringify({
            type: 'input',
            sessionId: activeSessionId,
            data: '\r'
          }));
        }
      }, 50);

      this.addToHistory(text);
      this.clearTextarea();
    } else {
      this.showToast('WebSocket接続がありません', 'error');
    }
  }

  /**
   * 特定のセッション番号に送信
   */
  sendToSession(sessionNumber) {
    const text = this.textarea.value.trim();
    if (!text) return;

    const sessionId = `session-${sessionNumber}`;
    const session = this.app?.sessions?.find(s => s.id === sessionId);

    if (!session) {
      // セッションが存在しない場合は無視（エラー表示なし）
      return;
    }

    // WebSocket経由で送信
    // 複数行入力対応ツール（Copilot CLI、Claude Code等）対応:
    // 1. テキストを送信
    // 2. 少し待つ
    // 3. 単独でEnterを送信（空プロンプトでEnter = 送信トリガー）
    if (this.app?.ws?.readyState === WebSocket.OPEN) {
      // ステップ1: テキストを送信
      this.app.ws.send(JSON.stringify({
        type: 'input',
        sessionId: sessionId,
        data: text
      }));

      // ステップ2: 50ms待機後、Enterを送信
      setTimeout(() => {
        if (this.app?.ws?.readyState === WebSocket.OPEN) {
          this.app.ws.send(JSON.stringify({
            type: 'input',
            sessionId: sessionId,
            data: '\r'
          }));
        }
      }, 50);

      this.addToHistory(text);
      this.clearTextarea();
    } else {
      this.showToast('WebSocket接続がありません', 'error');
    }
  }

  /**
   * 全セッションに送信
   */
  async sendToAllSessions() {
    const text = this.textarea.value.trim();
    if (!text) return;

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'browser',
          to: 'all',
          message: text
        })
      });

      if (response.ok) {
        this.addToHistory(text);
        this.clearTextarea();
      } else {
        this.showToast('送信に失敗しました', 'error');
      }
    } catch (error) {
      console.error('全セッション送信エラー:', error);
      this.showToast('送信に失敗しました', 'error');
    }
  }

  /**
   * バッファを取得（xterm.js APIを使用）
   */
  async fetchBuffer(sessionNumber) {
    const sessionId = `session-${sessionNumber}`;
    const session = this.app?.sessions?.find(s => s.id === sessionId);

    if (!session) {
      this.showToast(`セッション${sessionNumber}は存在しません`, 'error');
      return;
    }

    try {
      // xterm.jsのターミナルインスタンスを取得
      const terminalData = this.app?.terminals?.get(sessionId);
      if (!terminalData || !terminalData.terminal) {
        this.showToast('ターミナルが初期化されていません', 'error');
        return;
      }

      const terminal = terminalData.terminal;
      const buffer = terminal.buffer.active;

      // 前回取得した行番号を取得（初回は0）
      const lastLineIndex = this.bufferPositions[sessionId] || 0;
      const currentLineCount = buffer.length;

      // 差分がない場合はサイレント
      if (currentLineCount <= lastLineIndex) {
        return;
      }

      // 差分の行を取得してテキストに変換
      let newContent = '';
      for (let i = lastLineIndex; i < currentLineCount; i++) {
        const line = buffer.getLine(i);
        if (line) {
          // translateToString(true) = 右側の空白を削除
          newContent += line.translateToString(true) + '\n';
        }
      }

      // テキストエリアに追加
      if (newContent.length > 0) {
        const currentText = this.textarea.value;
        this.textarea.value = currentText + newContent;
        this.adjustTextareaHeight();

        // バッファ位置（行番号）を更新
        this.bufferPositions[sessionId] = currentLineCount;
      }

    } catch (error) {
      console.error('バッファ取得エラー:', error);
      this.showToast('バッファ取得に失敗しました', 'error');
    }
  }

  /**
   * テキストエリアをクリア
   */
  clearTextarea() {
    this.textarea.value = '';
    this.historyIndex = -1;
    this.currentDraft = '';
    this.adjustTextareaHeight();
    this.textarea.focus();
  }

  /**
   * テキストエリアの高さを自動調整
   */
  adjustTextareaHeight() {
    // 一旦リセット
    this.textarea.style.height = 'auto';

    // scrollHeightに基づいて調整
    const maxHeight = window.innerHeight * 0.3; // 画面の30%
    const newHeight = Math.min(this.textarea.scrollHeight, maxHeight);

    this.textarea.style.height = newHeight + 'px';
  }

  /**
   * 前の履歴を表示
   */
  showPreviousHistory() {
    if (this.history.length === 0) return;

    // 初回の場合、現在の入力を保存
    if (this.historyIndex === -1) {
      this.currentDraft = this.textarea.value;
      this.historyIndex = this.history.length;
    }

    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.textarea.value = this.history[this.historyIndex];
      this.adjustTextareaHeight();
    }
  }

  /**
   * 次の履歴を表示
   */
  showNextHistory() {
    if (this.historyIndex === -1) return;

    this.historyIndex++;

    if (this.historyIndex >= this.history.length) {
      // 履歴の末尾を超えたら、下書きに戻る
      this.textarea.value = this.currentDraft;
      this.historyIndex = -1;
      this.currentDraft = '';
    } else {
      this.textarea.value = this.history[this.historyIndex];
    }

    this.adjustTextareaHeight();
  }

  /**
   * 履歴に追加
   */
  addToHistory(text) {
    // 同じテキストが最後にある場合は追加しない
    if (this.history.length > 0 && this.history[this.history.length - 1] === text) {
      return;
    }

    this.history.push(text);

    // 最大サイズを超えたら古いものを削除
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.historyIndex = -1;
    this.currentDraft = '';

    // localStorageに保存
    this.saveHistory();
  }

  /**
   * 履歴をlocalStorageに保存
   */
  saveHistory() {
    try {
      localStorage.setItem('wterm-chat-history', JSON.stringify(this.history));
    } catch (error) {
      console.error('履歴保存エラー:', error);
    }
  }

  /**
   * 履歴をlocalStorageから読み込み
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem('wterm-chat-history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
      this.history = [];
    }
  }

  /**
   * バッファボタンを更新（セッション数に応じて1-9のボタンを生成）
   */
  updateBufferButtons(sessionCount) {
    this.sessionCount = Math.min(sessionCount, 9); // 最大9セッション
    this.bufferButtons.innerHTML = '';

    for (let i = 1; i <= 9; i++) {
      const button = document.createElement('button');
      button.className = 'buffer-btn';
      button.dataset.sessionNumber = i;
      button.setAttribute('aria-label', `セッション${i}のバッファを取得`);
      button.title = `セッション${i}のバッファを取得`;
      button.textContent = i;

      // セッションが存在しない場合は無効化
      if (i > this.sessionCount) {
        button.disabled = true;
        button.classList.add('buffer-btn-disabled');
      }

      this.bufferButtons.appendChild(button);
    }
  }

  /**
   * セッション数を更新
   */
  updateSessionCount(sessions) {
    const sessionCount = sessions?.length || 0;
    this.updateBufferButtons(sessionCount);
  }

  /**
   * トースト通知を表示
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // アニメーション用のクラスを追加
    toast.style.animation = 'slideInUp 0.3s ease-out';

    container.appendChild(toast);

    // 3秒後に削除
    setTimeout(() => {
      toast.style.animation = 'slideOutDown 0.3s ease-out';
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, 3000);
  }
}

// グローバルインスタンスを作成
window.chatPane = new ChatPane();

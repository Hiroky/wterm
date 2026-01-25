import { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../../store';
import { sendFromBrowser, broadcastFromBrowser } from '../../utils/sendMessage';

// バッファ取得API（バックエンドで追跡データを使用）
async function fetchBufferFromApi(sessionId: string): Promise<string> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/buffer?clean=true`);
    if (!response.ok) {
      return '';
    }
    const result = await response.json();
    return result.content || '';
  } catch {
    return '';
  }
}

// バッファプレビューツールチップコンポーネント（非同期対応）
function BufferPreviewTooltip({
  children,
  sessionId,
}: {
  children: React.ReactNode;
  sessionId: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [maxHeight, setMaxHeight] = useState(200);
  const [alignment, setAlignment] = useState<'center' | 'left' | 'right'>('center');
  const hideTimeoutRef = useRef<number | null>(null);

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  const handleMouseEnter = async (e: React.MouseEvent) => {
    clearHideTimeout();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const buttonCenterX = rect.left + rect.width / 2;
    const viewportWidth = window.innerWidth;
    const tooltipMaxWidth = viewportWidth * 0.8;
    const margin = 16;

    let xPos = buttonCenterX;
    let align: 'center' | 'left' | 'right' = 'center';

    if (buttonCenterX < tooltipMaxWidth / 2 + margin) {
      xPos = margin;
      align = 'left';
    } else if (buttonCenterX > viewportWidth - tooltipMaxWidth / 2 - margin) {
      xPos = viewportWidth - margin;
      align = 'right';
    }

    setPosition({ x: xPos, y: rect.top - 8 });
    setAlignment(align);

    const availableHeight = rect.top - 32;
    setMaxHeight(Math.max(100, Math.min(availableHeight, 400)));

    setIsVisible(true);
    setIsLoading(true);

    // APIからバッファを取得
    const bufferContent = await fetchBufferFromApi(sessionId);
    setContent(bufferContent || '(新しい内容なし)');
    setIsLoading(false);
  };

  const handleTooltipMouseEnter = () => {
    clearHideTimeout();
  };

  const handleTooltipMouseLeave = () => {
    setIsVisible(false);
  };

  const getTransformClass = () => {
    switch (alignment) {
      case 'left':
        return '-translate-y-full';
      case 'right':
        return '-translate-x-full -translate-y-full';
      default:
        return '-translate-x-1/2 -translate-y-full';
    }
  };

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={scheduleHide} className="relative">
      {children}
      {isVisible && (
        <div
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          className={`fixed z-50 rounded-lg border border-blue-500/30 bg-gray-900 px-3 py-2 text-xs shadow-xl ${getTransformClass()}`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            maxWidth: '80vw',
          }}
        >
          <div
            className="overflow-y-auto whitespace-pre-wrap break-words text-gray-200"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {isLoading ? '読み込み中...' : content}
          </div>
          <div
            className={`absolute top-full border-4 border-transparent border-t-gray-900 ${
              alignment === 'left'
                ? 'left-4'
                : alignment === 'right'
                  ? 'right-4'
                  : 'left-1/2 -translate-x-1/2'
            }`}
          />
        </div>
      )}
    </div>
  );
}

// localStorage keys
const HISTORY_KEY = 'wterm-chat-history';
const MAX_HISTORY = 50;

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed.items) ? parsed.items : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function saveHistory(items: string[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ items }));
}

export default function ChatPane() {
  const sessions = useStore((state) => state.sessions);
  const activeSessionId = useStore((state) => state.activeSessionId);

  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tempInputRef = useRef<string>('');

  // テキストエリアの高さ自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = window.innerHeight * 0.3;
      const minHeight = 80;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [inputValue]);

  // Toast表示
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // 履歴に追加
  const addToHistory = useCallback((text: string) => {
    if (!text.trim()) return;
    setHistory((prev) => {
      const newHistory = [text, ...prev.filter((h) => h !== text)].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      return newHistory;
    });
    setHistoryIndex(-1);
  }, []);

  // セッション番号からセッションIDを取得
  const getSessionIdFromNumber = (num: number): string => `session-${num}`;

  // セッションが存在するか確認
  const sessionExists = (sessionId: string): boolean => {
    return sessions.some((s) => s.id === sessionId);
  };

  // 特定のセッションに送信（バックエンドで位置追跡される）
  const sendToSession = useCallback(
    async (sessionId: string) => {
      if (!sessionExists(sessionId) || !inputValue.trim() || isSending) return;

      setIsSending(true);
      try {
        const result = await sendFromBrowser(sessionId, inputValue);
        if (result.success) {
          addToHistory(inputValue);
          setInputValue('');
        } else {
          showToast(result.error || '送信に失敗しました');
        }
      } finally {
        setIsSending(false);
      }
    },
    [inputValue, isSending, addToHistory, sessions, showToast]
  );

  // 現在のセッションに送信
  const sendToCurrentSession = useCallback(async () => {
    if (!activeSessionId) return;
    await sendToSession(activeSessionId);
  }, [activeSessionId, sendToSession]);

  // セッション番号で送信
  const sendToSessionByNumber = useCallback(
    async (sessionNum: number) => {
      const sessionId = getSessionIdFromNumber(sessionNum);
      await sendToSession(sessionId);
    },
    [sendToSession]
  );

  // 全セッションにブロードキャスト（バックエンドで全セッションの位置追跡される）
  const broadcastToAll = useCallback(async () => {
    if (!inputValue.trim() || isSending || sessions.length === 0) return;

    setIsSending(true);
    try {
      const result = await broadcastFromBrowser(inputValue);
      if (result.success) {
        addToHistory(inputValue);
        setInputValue('');
      } else {
        showToast(result.error || '送信に失敗しました');
      }
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, sessions, addToHistory, showToast]);

  // バッファ取得（API経由）
  const fetchBuffer = useCallback(
    async (sessionNum: number) => {
      const sessionId = getSessionIdFromNumber(sessionNum);
      if (!sessionExists(sessionId)) {
        showToast(`セッション${sessionNum}は存在しません`);
        return;
      }

      const content = await fetchBufferFromApi(sessionId);

      if (content && content.length > 0) {
        // テキストエリアの末尾に追加
        setInputValue((prev) => prev + content);
      }

      // フォーカスをテキストエリアに移動
      textareaRef.current?.focus();
    },
    [sessions, showToast]
  );

  // クリア
  const clearInput = useCallback(() => {
    setInputValue('');
    setHistoryIndex(-1);
    tempInputRef.current = '';
    textareaRef.current?.focus();
  }, []);

  // キーボードショートカット処理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // F1〜F9: セッション1〜9に送信
      const fKeyMatch = e.key.match(/^F(\d)$/);
      if (fKeyMatch) {
        const sessionNum = parseInt(fKeyMatch[1], 10);
        if (sessionNum >= 1 && sessionNum <= 9 && inputValue.trim()) {
          e.preventDefault();
          sendToSessionByNumber(sessionNum);
        }
        return;
      }

      // Ctrl+Enter: 現在のセッションに送信
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendToCurrentSession();
        return;
      }

      // Escape: フォーカスを解除
      if (e.key === 'Escape') {
        e.preventDefault();
        textareaRef.current?.blur();
        return;
      }

      // 上キー: 前の履歴（キャレットが先頭にいる時のみ）
      if (e.key === 'ArrowUp' && !e.shiftKey) {
        const cursorPosition = e.currentTarget.selectionStart;

        // キャレットが先頭にある場合のみ履歴をたどる
        if (cursorPosition === 0) {
          e.preventDefault();
          if (historyIndex === -1) {
            // 現在の入力を一時保存
            tempInputRef.current = inputValue;
          }
          if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setInputValue(history[newIndex]);
            // キャレットを先頭に配置
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.selectionStart = 0;
                textareaRef.current.selectionEnd = 0;
              }
            }, 0);
          }
        }
        return;
      }

      // 下キー: 次の履歴（キャレットが末尾にいる時のみ）
      if (e.key === 'ArrowDown' && !e.shiftKey) {
        if (historyIndex >= 0) {
          const cursorPosition = e.currentTarget.selectionStart;
          const textLength = inputValue.length;

          // キャレットが末尾にある場合のみ履歴を進める
          if (cursorPosition === textLength) {
            e.preventDefault();
            if (historyIndex === 0) {
              // 一時保存した入力に戻る
              setHistoryIndex(-1);
              setInputValue(tempInputRef.current);
            } else {
              const newIndex = historyIndex - 1;
              setHistoryIndex(newIndex);
              setInputValue(history[newIndex]);
            }
            // キャレットを末尾に配置
            setTimeout(() => {
              if (textareaRef.current) {
                const length = textareaRef.current.value.length;
                textareaRef.current.selectionStart = length;
                textareaRef.current.selectionEnd = length;
              }
            }, 0);
          }
        }
        return;
      }
    },
    [sendToSessionByNumber, sendToCurrentSession, historyIndex, history, inputValue]
  );

  // バッファ取得ボタン群を生成（最大9個）
  const bufferButtons = Array.from({ length: 9 }, (_, i) => i + 1).filter((num) =>
    sessionExists(getSessionIdFromNumber(num))
  );

  return (
    <div className="flex flex-col border-t border-gray-700 bg-gray-800">
      {/* Toast通知 */}
      {toast && (
        <div className="absolute bottom-24 left-1/2 z-50 -translate-x-1/2 transform rounded bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* ツールバー */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-700 px-3 py-1">
        {/* 左側: 現在のセッション表示 + バッファ取得ボタン */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* 現在のセッション表示 */}
          {activeSessionId && (
            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
              <span className="text-gray-400">現在:</span>
              <span className="font-medium text-blue-400">{activeSessionId}</span>
              {historyIndex >= 0 && (
                <span className="text-yellow-500">
                  (履歴 {historyIndex + 1}/{history.length})
                </span>
              )}
            </div>
          )}

          {/* セパレーター */}
          {activeSessionId && bufferButtons.length > 0 && (
            <div className="h-4 w-px bg-gray-600" />
          )}

          {/* バッファ取得ボタン */}
          {bufferButtons.length > 0 ? (
            bufferButtons.map((num) => {
              const sessionId = getSessionIdFromNumber(num);
              return (
                <BufferPreviewTooltip key={num} sessionId={sessionId}>
                  <button
                    onClick={() => fetchBuffer(num)}
                    aria-label={`セッション${num}のバッファを取得`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-700 text-xs font-medium hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {num}
                  </button>
                </BufferPreviewTooltip>
              );
            })
          ) : (
            !activeSessionId && <span className="text-xs text-gray-500">セッションなし</span>
          )}
        </div>

        {/* 右側: アクションボタン */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={sendToCurrentSession}
            disabled={!activeSessionId || !inputValue.trim() || isSending}
            title="現在のセッションに送信 (Ctrl+Enter)"
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
          <button
            onClick={broadcastToAll}
            disabled={sessions.length === 0 || !inputValue.trim() || isSending}
            title="全セッションに送信"
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Broadcast
          </button>
          <button
            onClick={clearInput}
            disabled={!inputValue}
            title="クリア"
            className="rounded bg-gray-700 px-2 py-1 text-xs font-medium hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>
      </div>

      {/* テキストエリア */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            activeSessionId
              ? 'メッセージを入力... (Ctrl+Enter: 送信, F1〜F9: セッションN送信, ↑↓: 履歴)'
              : 'セッションを選択してください...'
          }
          disabled={sessions.length === 0}
          className="w-full resize-none rounded bg-gray-700 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: '80px', maxHeight: '30vh' }}
          aria-label="メッセージ入力欄"
        />
      </div>
    </div>
  );
}

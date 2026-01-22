import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store';
import type { ServerMessage } from '../types';
import { removeSessionFromTree, getAllSessionIds } from '../utils/layoutTree';

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useWebSocket() {
  const setWebSocket = useStore((state) => state.setWebSocket);
  const setConnected = useStore((state) => state.setConnected);
  const setReconnecting = useStore((state) => state.setReconnecting);
  const addToast = useStore((state) => state.addToast);
  const syncInProgressRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    // In development, connect to backend directly (localhost:3000)
    // In production, connect to same host
    const isDev = import.meta.env.DEV;
    const wsUrl = isDev
      ? 'ws://localhost:3000'
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) {
        ws.close();
        return;
      }
      console.log('WebSocket connected');
      setWebSocket(ws);
      setConnected(true);
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;

      // Show success toast if reconnected
      if (reconnectAttemptsRef.current > 0) {
        addToast({
          type: 'success',
          message: 'Reconnected to server',
        });
      }
    };

    ws.onclose = (event) => {
      if (!isMountedRef.current) return;

      console.log('WebSocket disconnected', event.code, event.reason);
      setConnected(false);

      // Don't reconnect if the close was clean (code 1000) or intentional
      if (event.code === 1000) {
        return;
      }

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(true);

        // Calculate delay with exponential backoff
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY
        );

        console.log(
          `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        setReconnecting(false);
        addToast({
          type: 'error',
          message: 'Failed to connect to server. Please reload the page.',
          duration: 10000,
        });
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        handleServerMessage(message, syncInProgressRef);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [setWebSocket, setConnected, setReconnecting, addToast]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);
}

/**
 * サーバーからのメッセージを処理
 */
function handleServerMessage(message: ServerMessage, syncInProgressRef: React.MutableRefObject<boolean>) {
  const { setSessions, updateSessionStatus, addMessage, workspaces, updateWorkspace, updateLayout } = useStore.getState();

  switch (message.type) {
    case 'sessions': {
      const newSessions = message.sessions;
      setSessions(newSessions);

      // ワークスペースとの整合性を取る（削除されたセッションをワークスペースから削除）
      if (!syncInProgressRef.current) {
        syncInProgressRef.current = true;
        syncWorkspacesWithSessions(newSessions, workspaces, updateWorkspace, updateLayout);
        syncInProgressRef.current = false;
      }
      break;
    }
    case 'exit':
      updateSessionStatus(message.sessionId, 'exited', message.exitCode);
      break;
    case 'message':
      addMessage(message.message);
      break;
    case 'error':
      console.error('Server error:', message.message);
      break;
    case 'output':
    case 'history':
      // These are handled by individual components
      break;
  }
}

/**
 * ワークスペースとセッション一覧の整合性を取る
 */
function syncWorkspacesWithSessions(
  sessions: { id: string }[],
  workspaces: any[],
  updateWorkspace: (id: string, updates: any) => void,
  updateLayout: (workspaceId: string, layout: any) => void
) {
  const activeSessionIds = new Set(sessions.map((s) => s.id));

  workspaces.forEach((workspace) => {
    // ワークスペースのセッション配列から存在しないセッションを削除
    const validSessions = workspace.sessions.filter((sessionId: string) => activeSessionIds.has(sessionId));
    const hasInvalidSessions = validSessions.length !== workspace.sessions.length;

    // レイアウトから存在しないセッションを削除
    let cleanedLayout = workspace.layout;
    if (cleanedLayout) {
      const layoutSessionIds = getAllSessionIds(cleanedLayout);
      layoutSessionIds.forEach((sessionId) => {
        if (!activeSessionIds.has(sessionId)) {
          if (cleanedLayout) {
            cleanedLayout = removeSessionFromTree(cleanedLayout, sessionId);
          }
        }
      });
    }

    const hasLayoutChanges = JSON.stringify(cleanedLayout) !== JSON.stringify(workspace.layout);

    if (hasInvalidSessions || hasLayoutChanges) {
      console.log(`Syncing workspace ${workspace.id}: removing invalid sessions`);
      updateWorkspace(workspace.id, { sessions: validSessions });
      if (cleanedLayout !== undefined) {
        updateLayout(workspace.id, cleanedLayout);
      }

      // サーバーにも保存
      fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: validSessions, layout: cleanedLayout }),
      }).catch((err) => console.error('Failed to sync workspace:', err));
    }
  });
}

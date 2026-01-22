import { useEffect, useRef } from 'react';
import useStore from '../store';
import type { ServerMessage } from '../types';
import { removeSessionFromTree, getAllSessionIds } from '../utils/layoutTree';

export function useWebSocket() {
  const setWebSocket = useStore((state) => state.setWebSocket);
  const setConnected = useStore((state) => state.setConnected);
  const syncInProgressRef = useRef(false);

  useEffect(() => {
    // In development, connect to backend directly (localhost:3000)
    // In production, connect to same host
    const isDev = import.meta.env.DEV;
    const wsUrl = isDev
      ? 'ws://localhost:3000'
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWebSocket(ws);
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
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

    return () => {
      ws.close();
    };
  }, [setWebSocket, setConnected]);
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

import { useState, useCallback } from 'react';
import useStore from '../../store';
import { insertSessionIntoTree, getAllSessionIds } from '../../utils/layoutTree';
import type { LayoutNode } from '../../types';
import ShortcutsMenu from './ShortcutsMenu';
import SettingsDialog from '../Dialogs/SettingsDialog';

export default function Header() {
  const isConnected = useStore((state) => state.isConnected);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const updateWorkspace = useStore((state) => state.updateWorkspace);
  const updateLayout = useStore((state) => state.updateLayout);
  const setActiveSession = useStore((state) => state.setActiveSession);
  const [isCreating, setIsCreating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const createNewSession = useCallback(async () => {
    if (isCreating || !activeWorkspaceId) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      const sessionId = data.sessionId;
      console.log('Session created:', sessionId);

      // セッションをアクティブにする（WebSocketで実際のセッションが来るまで待たない）
      setActiveSession(sessionId);

      // 現在のアクティブワークスペースを取得（最新の状態を取得）
      const currentWorkspaces = useStore.getState().workspaces;
      const workspace = currentWorkspaces.find((w) => w.id === activeWorkspaceId);

      if (workspace) {
        // 既にこのセッションがワークスペースに含まれていないか確認
        if (workspace.sessions.includes(sessionId)) {
          console.log('Session already in workspace, skipping update');
          return;
        }

        const updatedSessions = [...workspace.sessions, sessionId];

        // レイアウトを更新
        let newLayout: LayoutNode;

        if (!workspace.layout) {
          // レイアウトが空の場合、新しいターミナルノードを作成
          newLayout = { type: 'terminal', sessionId: sessionId };
        } else {
          // 既存のレイアウトがある場合、右側に分割
          const existingSessionIds = getAllSessionIds(workspace.layout);
          const lastSessionId = existingSessionIds[existingSessionIds.length - 1];
          newLayout = insertSessionIntoTree(workspace.layout, lastSessionId, sessionId, 'right');
        }

        // ローカル状態を先に更新
        updateWorkspace(activeWorkspaceId, { sessions: updatedSessions });
        updateLayout(activeWorkspaceId, newLayout);

        // バックエンドに更新
        await fetch(`/api/workspaces/${activeWorkspaceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: updatedSessions, layout: newLayout }),
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, activeWorkspaceId, updateWorkspace, updateLayout, setActiveSession]);

  return (
    <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">wterm</h1>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={createNewSession}
          disabled={isCreating || !isConnected}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : '+ New Session'}
        </button>
        <ShortcutsMenu />
        <button
          className="rounded bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600"
          onClick={() => setIsSettingsOpen(true)}
        >
          Settings
        </button>
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </header>
  );
}

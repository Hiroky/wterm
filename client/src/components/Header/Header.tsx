import { useState } from 'react';
import useStore from '../../store';
import { insertSessionIntoTree, getAllSessionIds } from '../../utils/layoutTree';
import type { LayoutNode } from '../../types';
import ShortcutsMenu from './ShortcutsMenu';

export default function Header() {
  const { isConnected, activeWorkspaceId, workspaces, updateWorkspace, updateLayout, setActiveSession, addSession } = useStore();
  const [isCreating, setIsCreating] = useState(false);

  async function createNewSession() {
    if (isCreating) return;

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
      console.log('Session created:', data.sessionId);

      // 楽観的更新: セッションリストに追加（WebSocketで更新されるまでのプレースホルダー）
      addSession({
        id: data.sessionId,
        status: 'running',
        createdAt: new Date().toISOString(),
        command: '',
      });

      // 新しいセッションをアクティブにする
      setActiveSession(data.sessionId);

      // セッションをアクティブなワークスペースに追加
      if (activeWorkspaceId) {
        const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
        if (workspace) {
          const updatedSessions = [...workspace.sessions, data.sessionId];

          // レイアウトを更新
          let newLayout: LayoutNode;

          if (!workspace.layout) {
            // レイアウトが空の場合、新しいターミナルノードを作成
            newLayout = { type: 'terminal', sessionId: data.sessionId };
          } else {
            // 既存のレイアウトがある場合、右側に分割
            const existingSessionIds = getAllSessionIds(workspace.layout);
            const lastSessionId = existingSessionIds[existingSessionIds.length - 1];
            newLayout = insertSessionIntoTree(workspace.layout, lastSessionId, data.sessionId, 'right');
          }

          // バックエンドに更新
          await fetch(`/api/workspaces/${activeWorkspaceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessions: updatedSessions, layout: newLayout }),
          });

          // ローカル状態も更新
          updateWorkspace(activeWorkspaceId, { sessions: updatedSessions });
          updateLayout(activeWorkspaceId, newLayout);
        }
      }
    } catch (error) {
      console.error('Error creating session:', error);
      console.error('Failed to create new session');
    } finally {
      setIsCreating(false);
    }
  }

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
          onClick={() => console.log('Settings coming soon!')}
        >
          Settings
        </button>
      </div>
    </header>
  );
}

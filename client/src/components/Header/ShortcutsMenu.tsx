import { useState, useRef, useEffect } from 'react';
import useStore from '../../store';
import { insertSessionIntoTree, getAllSessionIds } from '../../utils/layoutTree';
import type { LayoutNode } from '../../types';

export default function ShortcutsMenu() {
  const { config, activeWorkspaceId, workspaces, updateWorkspace, updateLayout, setActiveSession, addSession } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function executeShortcut(command: string, shortcutId: string) {
    setIsExecuting(shortcutId);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute shortcut');
      }

      const data = await response.json();
      console.log('Shortcut executed, created session:', data.sessionId);

      // 楽観的更新: セッションリストに追加（WebSocketで更新されるまでのプレースホルダー）
      addSession({
        id: data.sessionId,
        status: 'running',
        createdAt: new Date().toISOString(),
        command: command,
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

      setIsOpen(false);
    } catch (error) {
      console.error('Error executing shortcut:', error);
      console.error('Failed to execute shortcut');
    } finally {
      setIsExecuting(null);
    }
  }

  const shortcuts = config?.shortcuts || [];

  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600"
      >
        Shortcuts ▾
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-600 bg-gray-800 shadow-xl">
          <div className="border-b border-gray-700 px-4 py-2">
            <h3 className="text-sm font-semibold">Quick Commands</h3>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                onClick={() => executeShortcut(shortcut.command, shortcut.id)}
                disabled={isExecuting === shortcut.id}
                className="flex w-full items-center gap-3 rounded p-3 text-left hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-2xl">{shortcut.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{shortcut.name}</div>
                  <div className="text-xs text-gray-400">
                    {shortcut.command}
                  </div>
                </div>
                {isExecuting === shortcut.id && (
                  <span className="text-xs text-blue-400">Running...</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

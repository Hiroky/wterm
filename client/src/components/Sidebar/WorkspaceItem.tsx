import { useState, useMemo, useCallback } from 'react';
import useStore from '../../store';
import type { Workspace, LayoutNode } from '../../types';
import { removeSessionFromTree, insertSessionIntoTree, getAllSessionIds } from '../../utils/layoutTree';

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive: boolean;
}

export default function WorkspaceItem({ workspace, isActive }: WorkspaceItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workspace.name);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const sessions = useStore((state) => state.sessions);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const setActiveWorkspace = useStore((state) => state.setActiveWorkspace);
  const setActiveSession = useStore((state) => state.setActiveSession);
  const updateWorkspace = useStore((state) => state.updateWorkspace);
  const deleteWorkspace = useStore((state) => state.deleteWorkspace);
  const updateLayout = useStore((state) => state.updateLayout);

  // ワークスペースに属するセッションのみフィルタ（メモ化）
  const workspaceSessions = useMemo(() => {
    return sessions.filter((s) => workspace.sessions.includes(s.id));
  }, [sessions, workspace.sessions]);

  function handleToggleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  }

  async function handleSetActive() {
    if (!isActive) {
      setActiveWorkspace(workspace.id);

      // ワークスペース内の最初のセッションに切り替え、または空ならクリア
      if (workspace.sessions.length > 0) {
        const firstSession = sessions.find((s) => s.id === workspace.sessions[0]);
        if (firstSession) {
          setActiveSession(firstSession.id);
        } else {
          setActiveSession(null);
        }
      } else {
        setActiveSession(null);
      }

      try {
        await fetch('/api/workspaces/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: workspace.id }),
        });
      } catch (error) {
        console.error('Failed to set active workspace:', error);
      }
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete workspace');
      }

      deleteWorkspace(workspace.id);
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      console.error(error.message || 'Failed to delete workspace');
    }
  }

  async function handleSaveEdit() {
    const trimmedName = editName.trim();

    if (trimmedName === '') {
      setEditName(workspace.name);
      setIsEditing(false);
      return;
    }

    if (trimmedName === workspace.name) {
      setIsEditing(false);
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error:', response.status, errorData);
        throw new Error('Failed to update workspace');
      }

      updateWorkspace(workspace.id, { name: trimmedName });
      setEditName(trimmedName);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating workspace:', error);
      setEditName(workspace.name);
      setIsEditing(false);
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditing(true);
  }

  async function handleSessionClick(sessionId: string) {
    // アクティブセッションを設定
    setActiveSession(sessionId);

    // このワークスペースがアクティブでない場合、アクティブ化
    if (!isActive) {
      setActiveWorkspace(workspace.id);
      try {
        await fetch('/api/workspaces/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: workspace.id }),
        });
      } catch (error) {
        console.error('Failed to set active workspace:', error);
      }
    }
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      // セッションが存在しない場合（404）でも、レイアウトから削除する
      const isNotFound = response.status === 404;

      if (!response.ok && !isNotFound) {
        throw new Error('Failed to delete session');
      }

      // Update workspace sessions list
      const updatedSessions = workspace.sessions.filter((s) => s !== sessionId);

      // Update layout tree to remove the session
      let updatedLayout = workspace.layout;
      if (updatedLayout) {
        updatedLayout = removeSessionFromTree(updatedLayout, sessionId);
      }

      await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: updatedSessions, layout: updatedLayout }),
      });

      updateWorkspace(workspace.id, { sessions: updatedSessions });
      updateLayout(workspace.id, updatedLayout);
    } catch (error) {
      console.error('Error deleting session:', error);
      console.error('Failed to delete session');
    }
  }

  const handleAddSession = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingSession) return;

    setIsCreatingSession(true);
    try {
      // ワークスペースの cwd を使用
      const cwd = workspace.cwd;

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      const sessionId = data.sessionId;
      console.log('Session created:', sessionId);

      // セッションをアクティブにする
      setActiveSession(sessionId);

      // このワークスペースがアクティブでない場合、アクティブ化
      if (!isActive) {
        setActiveWorkspace(workspace.id);
        await fetch('/api/workspaces/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: workspace.id }),
        });
      }

      // ワークスペースを再取得（最新の状態を使用）
      const currentWorkspaces = useStore.getState().workspaces;
      const currentWorkspace = currentWorkspaces.find((w) => w.id === workspace.id);

      if (currentWorkspace) {
        // 既にこのセッションがワークスペースに含まれていないか確認
        if (currentWorkspace.sessions.includes(sessionId)) {
          console.log('Session already in workspace, skipping update');
          return;
        }

        const updatedSessions = [...currentWorkspace.sessions, sessionId];

        // レイアウトを更新
        let newLayout: LayoutNode;

        if (!currentWorkspace.layout) {
          // レイアウトが空の場合、新しいターミナルノードを作成
          newLayout = { type: 'terminal', sessionId: sessionId };
        } else {
          // 既存のレイアウトがある場合、右側に分割
          const existingSessionIds = getAllSessionIds(currentWorkspace.layout);
          const lastSessionId = existingSessionIds[existingSessionIds.length - 1];
          newLayout = insertSessionIntoTree(currentWorkspace.layout, lastSessionId, sessionId, 'right');
        }

        // ローカル状態を先に更新
        updateWorkspace(workspace.id, { sessions: updatedSessions });
        updateLayout(workspace.id, newLayout);

        // バックエンドに更新
        await fetch(`/api/workspaces/${workspace.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: updatedSessions, layout: newLayout }),
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession, workspace, isActive, setActiveSession, setActiveWorkspace, updateWorkspace, updateLayout]);

  return (
    <div className="rounded bg-gray-700">
      {/* Workspace Header */}
      <div
        onClick={handleSetActive}
        title={workspace.cwd ? `Working Directory: ${workspace.cwd}` : 'Working Directory: (default)'}
        className={`group flex cursor-pointer items-center justify-between rounded p-3 transition-colors ${
          isActive ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
        }`}
      >
        <div className="flex flex-1 items-center gap-2">
          <span
            onClick={handleToggleExpand}
            className="cursor-pointer text-lg hover:text-blue-400"
          >
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="text-lg">{workspace.icon}</span>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') {
                  setEditName(workspace.name);
                  setIsEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="flex-1 rounded bg-gray-800 px-2 py-1 text-sm text-white outline-none"
            />
          ) : (
            <span
              onDoubleClick={handleDoubleClick}
              className="flex-1 text-sm font-medium"
            >
              {workspace.name}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {workspaceSessions.length}
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="ml-2 rounded p-1 opacity-0 hover:bg-red-600 group-hover:opacity-100"
          title="Delete workspace"
        >
          ✕
        </button>
      </div>

      {/* Sessions List */}
      {isExpanded && (
        <div className="ml-4 space-y-1 border-l border-gray-600 p-2">
          {workspaceSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              className={`group flex cursor-pointer items-center justify-between rounded p-2 transition-colors ${
                activeSessionId === session.id
                  ? 'bg-blue-500'
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{session.id}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      session.status === 'running'
                        ? 'bg-green-600'
                        : 'bg-red-600'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-300">
                  {session.currentProcess || session.command || 'PowerShell'}
                </p>
              </div>
              <button
                onClick={(e) => handleDeleteSession(session.id, e)}
                className="ml-2 rounded p-1 text-xs opacity-0 hover:bg-red-600 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add Session Button */}
          <button
            onClick={handleAddSession}
            disabled={isCreatingSession}
            className="flex w-full items-center gap-2 rounded p-2 text-xs text-gray-400 transition-colors hover:bg-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-base">+</span>
            <span>{isCreatingSession ? 'Creating...' : 'Add Session'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

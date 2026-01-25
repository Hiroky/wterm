import { useMemo, useState, useCallback, useEffect } from 'react';
import useStore from '../../store';
import type { Workspace, LayoutNode } from '../../types';
import { insertSessionIntoTree, getAllSessionIds } from '../../utils/layoutTree';

export default function CompactWorkspaceList() {
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const sessions = useStore((state) => state.sessions);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const setActiveWorkspace = useStore((state) => state.setActiveWorkspace);
  const setActiveSession = useStore((state) => state.setActiveSession);
  const addWorkspace = useStore((state) => state.addWorkspace);

  async function handleAddWorkspace() {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新規ワークスペース',
          icon: '📁',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const data = await response.json();
      addWorkspace(data.workspace);
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  }

  async function handleWorkspaceClick(workspaceId: string) {
    setActiveWorkspace(workspaceId);

    // ワークスペース内の最初のセッションに切り替え、または空ならクリア
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (workspace) {
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
    }

    try {
      await fetch('/api/workspaces/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
    } catch (error) {
      console.error('Failed to set active workspace:', error);
    }
  }

  async function handleSessionClick(sessionId: string, workspaceId: string) {
    setActiveSession(sessionId);

    // セッションをクリックしたら、そのワークスペースもアクティブにする
    if (activeWorkspaceId !== workspaceId) {
      setActiveWorkspace(workspaceId);
      try {
        await fetch('/api/workspaces/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId }),
        });
      } catch (error) {
        console.error('Failed to set active workspace:', error);
      }
    }
  }

  function WorkspaceWithSessions({ workspace }: { workspace: Workspace }) {
    const workspaceSessions = useMemo(() => {
      return sessions.filter((s) => workspace.sessions.includes(s.id));
    }, [workspace.sessions]);

    const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
    const [isWorkspaceHovered, setIsWorkspaceHovered] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const [hideTimeoutId, setHideTimeoutId] = useState<number | null>(null);
    const isActive = activeWorkspaceId === workspace.id;
    const updateWorkspace = useStore((state) => state.updateWorkspace);
    const updateLayout = useStore((state) => state.updateLayout);
    const wsSetActiveSession = useStore((state) => state.setActiveSession);
    const wsSetActiveWorkspace = useStore((state) => state.setActiveWorkspace);
    const deleteWorkspace = useStore((state) => state.deleteWorkspace);

    function handleWorkspaceMouseEnter(event: React.MouseEvent<HTMLButtonElement>) {
      // 既存のタイムアウトをクリア
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        setHideTimeoutId(null);
      }

      // セッションのツールチップを閉じる
      setHoveredSessionId(null);

      const rect = event.currentTarget.getBoundingClientRect();
      setIsWorkspaceHovered(true);
      setTooltipPosition({
        top: rect.top,
        left: rect.right + 8,
      });
    }

    function handleWorkspaceMouseLeave() {
      // 200ms後にツールチップを閉じる
      const timeoutId = setTimeout(() => {
        setIsWorkspaceHovered(false);
        setTooltipPosition(null);
        setHideTimeoutId(null);
      }, 200);
      setHideTimeoutId(timeoutId);
    }

    function handleTooltipMouseEnter() {
      // ツールチップにマウスが入ったら、タイムアウトをクリア
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        setHideTimeoutId(null);
      }
      // セッションのツールチップを閉じる
      setHoveredSessionId(null);
      setIsWorkspaceHovered(true);
    }

    function handleSessionMouseEnter(sessionId: string, event: React.MouseEvent<HTMLDivElement>) {
      // 既存のタイムアウトをクリア
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        setHideTimeoutId(null);
      }

      // ワークスペースのツールチップを閉じる
      setIsWorkspaceHovered(false);

      const rect = event.currentTarget.getBoundingClientRect();
      setHoveredSessionId(sessionId);
      setTooltipPosition({
        top: rect.top,
        left: rect.right + 8, // 8px gap from the icon
      });
    }

    function handleSessionMouseLeave() {
      // 200ms後にツールチップを閉じる
      const timeoutId = setTimeout(() => {
        setHoveredSessionId(null);
        setTooltipPosition(null);
        setHideTimeoutId(null);
      }, 200);
      setHideTimeoutId(timeoutId);
    }

    function handleSessionTooltipMouseEnter(sessionId: string) {
      // ツールチップにマウスが入ったら、タイムアウトをクリア
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        setHideTimeoutId(null);
      }
      // ワークスペースのツールチップを閉じる
      setIsWorkspaceHovered(false);
      setHoveredSessionId(sessionId);
    }

    async function handleDeleteWorkspace() {
      try {
        const response = await fetch(`/api/workspaces/${workspace.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete workspace');
        }

        deleteWorkspace(workspace.id);
        setIsWorkspaceHovered(false);
        setTooltipPosition(null);
      } catch (error: any) {
        console.error('Error deleting workspace:', error);
      }
    }

    // クリーンアップ: コンポーネントがアンマウントされる時にタイムアウトをクリア
    useEffect(() => {
      return () => {
        if (hideTimeoutId) {
          clearTimeout(hideTimeoutId);
        }
      };
    }, [hideTimeoutId]);

    const handleAddSession = useCallback(async () => {
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
        wsSetActiveSession(sessionId);

        // このワークスペースがアクティブでない場合、アクティブ化
        if (!isActive) {
          wsSetActiveWorkspace(workspace.id);
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
    }, [isCreatingSession, workspace, isActive, wsSetActiveSession, wsSetActiveWorkspace, updateWorkspace, updateLayout]);

    return (
      <div className="flex flex-col items-end gap-1 pr-2">
        {/* Workspace Icon */}
        <button
          onClick={() => handleWorkspaceClick(workspace.id)}
          onMouseEnter={handleWorkspaceMouseEnter}
          onMouseLeave={handleWorkspaceMouseLeave}
          className={`flex h-12 w-12 items-center justify-center rounded transition-colors ${
            isActive ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <span className="text-xl">{workspace.icon}</span>
        </button>

        {/* Workspace Tooltip */}
        {isWorkspaceHovered && tooltipPosition && (
          <div
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleWorkspaceMouseLeave}
            className="fixed z-50 w-56 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-xl"
            style={{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{workspace.icon}</span>
                <span className="text-sm font-semibold">{workspace.name}</span>
              </div>
              <button
                onClick={handleDeleteWorkspace}
                className="rounded p-1 text-xs text-gray-400 transition-colors hover:bg-red-600 hover:text-white"
                title="Delete workspace"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-xs text-gray-300">
              <div>
                <span className="text-gray-400">Sessions: </span>
                {workspaceSessions.length}
              </div>
              {workspace.cwd && (
                <div>
                  <span className="text-gray-400">Path: </span>
                  <div className="break-all">{workspace.cwd}</div>
                </div>
              )}
              <div>
                <span className="text-gray-400">Created: </span>
                {new Date(workspace.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Session Icons */}
        <div className="flex flex-wrap justify-end gap-1">
          {workspaceSessions.map((session) => {
            const isSessionActive = activeSessionId === session.id;
            const isHovered = hoveredSessionId === session.id;
            return (
              <div
                key={session.id}
                className="relative"
                onMouseEnter={(e) => handleSessionMouseEnter(session.id, e)}
                onMouseLeave={handleSessionMouseLeave}
              >
                <button
                  onClick={() => handleSessionClick(session.id, workspace.id)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-colors ${
                    isSessionActive ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {session.id.replace('session-', '')}
                  {/* Status indicator */}
                  <div
                    className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-gray-800 ${
                      session.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                </button>

                {/* Custom tooltip */}
                {isHovered && tooltipPosition && (
                  <div
                    onMouseEnter={() => handleSessionTooltipMouseEnter(session.id)}
                    onMouseLeave={handleSessionMouseLeave}
                    className="fixed z-50 w-56 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-xl"
                    style={{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{session.id}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          session.status === 'running' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-300">
                      <div>
                        <span className="text-gray-400">Process: </span>
                        {session.currentProcess || session.command || 'PowerShell'}
                      </div>
                      {session.cwd && (
                        <div>
                          <span className="text-gray-400">Path: </span>
                          <div className="break-all">{session.cwd}</div>
                        </div>
                      )}
                      {session.status === 'exited' && session.exitCode !== undefined && (
                        <div>
                          <span className="text-gray-400">Exit code: </span>
                          {session.exitCode}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Session Button */}
          <button
            onClick={handleAddSession}
            disabled={isCreatingSession}
            title={isCreatingSession ? 'Creating...' : 'Add session to workspace'}
            className="flex h-8 w-8 items-center justify-center rounded bg-gray-700 text-base transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
      {workspaces.map((workspace) => (
        <WorkspaceWithSessions key={workspace.id} workspace={workspace} />
      ))}

      {/* Add Workspace Button */}
      <div className="flex flex-col items-end pr-2">
        <button
          onClick={handleAddWorkspace}
          title="Add new workspace"
          className="flex h-12 w-12 items-center justify-center rounded bg-gray-700 text-2xl transition-colors hover:bg-gray-600"
        >
          +
        </button>
      </div>

      {workspaces.length === 0 && (
        <div className="px-2 text-center text-xs text-gray-400">
          <p>No workspaces</p>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import useStore from '../../store';
import type { Workspace } from '../../types';

export default function CompactWorkspaceList() {
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const sessions = useStore((state) => state.sessions);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const setActiveWorkspace = useStore((state) => state.setActiveWorkspace);
  const setActiveSession = useStore((state) => state.setActiveSession);

  async function handleWorkspaceClick(workspaceId: string) {
    setActiveWorkspace(workspaceId);

    // ワークスペース内の最初のセッションに切り替え
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (workspace && workspace.sessions.length > 0) {
      const firstSession = sessions.find((s) => s.id === workspace.sessions[0]);
      if (firstSession) {
        setActiveSession(firstSession.id);
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
    const isActive = activeWorkspaceId === workspace.id;

    function handleWorkspaceMouseEnter(event: React.MouseEvent<HTMLButtonElement>) {
      const rect = event.currentTarget.getBoundingClientRect();
      setIsWorkspaceHovered(true);
      setTooltipPosition({
        top: rect.top,
        left: rect.right + 8,
      });
    }

    function handleWorkspaceMouseLeave() {
      setIsWorkspaceHovered(false);
      setTooltipPosition(null);
    }

    function handleSessionMouseEnter(sessionId: string, event: React.MouseEvent<HTMLDivElement>) {
      const rect = event.currentTarget.getBoundingClientRect();
      setHoveredSessionId(sessionId);
      setTooltipPosition({
        top: rect.top,
        left: rect.right + 8, // 8px gap from the icon
      });
    }

    function handleSessionMouseLeave() {
      setHoveredSessionId(null);
      setTooltipPosition(null);
    }

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
            className="fixed z-50 w-56 rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-xl"
            style={{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{workspace.icon}</span>
              <span className="text-sm font-semibold">{workspace.name}</span>
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
        {workspaceSessions.length > 0 && (
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
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
      {workspaces.map((workspace) => (
        <WorkspaceWithSessions key={workspace.id} workspace={workspace} />
      ))}
      {workspaces.length === 0 && (
        <div className="px-2 text-center text-xs text-gray-400">
          <p>No workspaces</p>
        </div>
      )}
    </div>
  );
}

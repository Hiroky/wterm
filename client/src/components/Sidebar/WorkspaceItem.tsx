import { useState } from 'react';
import useStore from '../../store';
import type { Workspace } from '../../types';

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive: boolean;
}

export default function WorkspaceItem({ workspace, isActive }: WorkspaceItemProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workspace.name);

  const { sessions, activeSessionId, setActiveWorkspace, setActiveSession, updateWorkspace, deleteWorkspace } = useStore();

  const workspaceSessions = sessions.filter((s) => workspace.sessions.includes(s.id));

  async function handleSetActive() {
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
    setIsExpanded(!isExpanded);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm(`Delete workspace "${workspace.name}"?`)) return;

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
      alert(error.message || 'Failed to delete workspace');
    }
  }

  async function handleSaveEdit() {
    if (editName.trim() === '') {
      setEditName(workspace.name);
      setIsEditing(false);
      return;
    }

    if (editName === workspace.name) {
      setIsEditing(false);
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workspace');
      }

      updateWorkspace(workspace.id, { name: editName });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating workspace:', error);
      alert('Failed to update workspace');
      setEditName(workspace.name);
      setIsEditing(false);
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditing(true);
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm(`Delete session ${sessionId}?`)) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      // Update workspace sessions list
      const updatedSessions = workspace.sessions.filter((s) => s !== sessionId);
      await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: updatedSessions }),
      });

      updateWorkspace(workspace.id, { sessions: updatedSessions });
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }
  }

  return (
    <div className="rounded bg-gray-700">
      {/* Workspace Header */}
      <div
        onClick={handleSetActive}
        className={`group flex cursor-pointer items-center justify-between rounded p-3 transition-colors ${
          isActive ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
        }`}
      >
        <div className="flex flex-1 items-center gap-2">
          <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
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
      {isExpanded && workspaceSessions.length > 0 && (
        <div className="ml-4 space-y-1 border-l border-gray-600 p-2">
          {workspaceSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSession(session.id)}
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
                  {session.command || 'PowerShell'}
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
        </div>
      )}

      {isExpanded && workspaceSessions.length === 0 && (
        <div className="ml-4 p-2 text-center text-xs text-gray-400">
          No sessions in this workspace
        </div>
      )}
    </div>
  );
}

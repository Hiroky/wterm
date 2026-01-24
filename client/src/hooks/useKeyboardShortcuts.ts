import { useEffect, useCallback } from 'react';
import useStore from '../store';
import { insertSessionIntoTree, getAllSessionIds } from '../utils/layoutTree';
import type { LayoutNode } from '../types';

interface KeyboardShortcutsOptions {
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);
  const setActiveWorkspace = useStore((state) => state.setActiveWorkspace);
  const updateWorkspace = useStore((state) => state.updateWorkspace);
  const updateLayout = useStore((state) => state.updateLayout);
  const setActiveSession = useStore((state) => state.setActiveSession);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const addWorkspace = useStore((state) => state.addWorkspace);
  const toggleSidebar = useStore((state) => state.toggleSidebar);

  // Create new session
  const createNewSession = useCallback(async () => {
    if (!activeWorkspaceId) return;

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
      setActiveSession(sessionId);

      const currentWorkspaces = useStore.getState().workspaces;
      const workspace = currentWorkspaces.find((w) => w.id === activeWorkspaceId);

      if (workspace) {
        if (workspace.sessions.includes(sessionId)) {
          return;
        }

        const updatedSessions = [...workspace.sessions, sessionId];
        let newLayout: LayoutNode;

        if (!workspace.layout) {
          newLayout = { type: 'terminal', sessionId: sessionId };
        } else {
          const existingSessionIds = getAllSessionIds(workspace.layout);
          const lastSessionId = existingSessionIds[existingSessionIds.length - 1];
          newLayout = insertSessionIntoTree(workspace.layout, lastSessionId, sessionId, 'right');
        }

        updateWorkspace(activeWorkspaceId, { sessions: updatedSessions });
        updateLayout(activeWorkspaceId, newLayout);

        await fetch(`/api/workspaces/${activeWorkspaceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: updatedSessions, layout: newLayout }),
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }, [activeWorkspaceId, setActiveSession, updateWorkspace, updateLayout]);

  // Delete current session
  const deleteCurrentSession = useCallback(async () => {
    if (!activeSessionId || !activeWorkspaceId) return;

    try {
      const response = await fetch(`/api/sessions/${activeSessionId}`, {
        method: 'DELETE',
      });

      const isNotFound = response.status === 404;
      if (!response.ok && !isNotFound) {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }, [activeSessionId, activeWorkspaceId]);

  // Switch to workspace by index (1-9)
  const switchToWorkspace = useCallback(
    async (index: number) => {
      if (index < 0 || index >= workspaces.length) return;

      const workspace = workspaces[index];
      setActiveWorkspace(workspace.id);

      // Save to server
      try {
        await fetch('/api/workspaces/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: workspace.id }),
        });
      } catch (error) {
        console.error('Error switching workspace:', error);
      }
    },
    [workspaces, setActiveWorkspace]
  );

  // Create new workspace
  const createNewWorkspace = useCallback(async () => {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Workspace' }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const data = await response.json();
      addWorkspace(data.workspace);
      setActiveWorkspace(data.workspace.id);
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  }, [addWorkspace, setActiveWorkspace]);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Ctrl+Shift shortcuts (work everywhere)
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toUpperCase()) {
          case 'T':
            // Ctrl+Shift+T: New session
            e.preventDefault();
            createNewSession();
            break;
          case 'W':
            // Ctrl+Shift+W: Delete current session
            e.preventDefault();
            deleteCurrentSession();
            break;
          case 'N':
            // Ctrl+Shift+N: New workspace
            e.preventDefault();
            createNewWorkspace();
            break;
          case '?':
            // Ctrl+Shift+?: Open help
            e.preventDefault();
            options.onOpenHelp?.();
            break;
        }
        return;
      }

      // Skip other shortcuts if in input
      if (isInInput) {
        return;
      }

      // Ctrl+, for settings (only when not in input)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault();
        options.onOpenSettings?.();
        return;
      }

      // Ctrl+B for sidebar toggle (only when not in input)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    createNewSession,
    deleteCurrentSession,
    switchToWorkspace,
    createNewWorkspace,
    toggleSidebar,
    options,
  ]);

  return {
    createNewSession,
    deleteCurrentSession,
    switchToWorkspace,
    createNewWorkspace,
  };
}

import { useRef, useCallback } from 'react';
import useStore from '../../store';
import Terminal from './Terminal';
import LayoutRenderer from './LayoutRenderer';
import { updateSizesInTree } from '../../utils/layoutTree';

export default function TerminalArea() {
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const updateLayout = useStore((state) => state.updateLayout);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get active workspace
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Handle layout change (resize)
  const handleLayoutChange = useCallback(
    (path: number[], newSizes: number[]) => {
      if (!workspace || !workspace.layout) return;

      // Update layout tree with new sizes
      const updatedLayout = updateSizesInTree(workspace.layout, path, newSizes);
      if (!updatedLayout) return;

      // Update local state immediately
      updateLayout(workspace.id, updatedLayout);

      // Debounce server save (500ms)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`/api/workspaces/${workspace.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout: updatedLayout }),
          });

          if (!response.ok) {
            console.error('Failed to save layout to server');
          }
        } catch (error) {
          console.error('Error saving layout:', error);
        }
      }, 500);
    },
    [workspace, updateLayout]
  );

  // If no active workspace, show placeholder
  if (!workspace) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-lg">No active workspace</p>
          <p className="mt-2 text-sm">Create a workspace to get started</p>
        </div>
      </div>
    );
  }

  // If workspace has a layout, render it
  if (workspace.layout) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <LayoutRenderer layout={workspace.layout} onLayoutChange={handleLayoutChange} />
      </div>
    );
  }

  // Otherwise, render single terminal (backward compatibility)
  if (!activeSessionId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-lg">No active session</p>
          <p className="mt-2 text-sm">Select a session from the sidebar or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Terminal sessionId={activeSessionId} />
    </div>
  );
}

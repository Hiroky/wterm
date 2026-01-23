import { useRef, useCallback, useEffect } from 'react';
import useStore from '../../store';
import Terminal from './Terminal';
import LayoutRenderer from './LayoutRenderer';
import { updateSizesInTree } from '../../utils/layoutTree';
import type { Workspace } from '../../types';

export default function TerminalArea() {
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const updateLayout = useStore((state) => state.updateLayout);

  const saveTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Get active workspace
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Handle layout change (resize)
  const handleLayoutChange = useCallback(
    (workspace: Workspace, path: number[], newSizes: number[]) => {
      if (!workspace.layout) return;

      // Update layout tree with new sizes
      const updatedLayout = updateSizesInTree(workspace.layout, path, newSizes);
      if (!updatedLayout) return;

      // Update local state immediately
      updateLayout(workspace.id, updatedLayout);

      // Debounce server save (500ms) per workspace
      const existingTimeout = saveTimeoutsRef.current.get(workspace.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeoutId = setTimeout(async () => {
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

      saveTimeoutsRef.current.set(workspace.id, timeoutId);
    },
    [updateLayout]
  );

  useEffect(() => {
    return () => {
      saveTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      saveTimeoutsRef.current.clear();
    };
  }, []);

  // If no active workspace, show placeholder
  if (!activeWorkspace) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-lg">No active workspace</p>
          <p className="mt-2 text-sm">Create a workspace to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {workspaces.map((workspace) => {
        const isActive = workspace.id === activeWorkspaceId;
        const layerClass = `absolute inset-0 flex flex-col overflow-hidden ${
          isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`;

        if (workspace.layout) {
          return (
            <div key={workspace.id} className={layerClass} aria-hidden={!isActive}>
              <LayoutRenderer
                layout={workspace.layout}
                onLayoutChange={(path, newSizes) => handleLayoutChange(workspace, path, newSizes)}
                isActive={isActive}
              />
            </div>
          );
        }

        // Backward compatibility: show active session only for the active workspace
        if (isActive) {
          if (!activeSessionId) {
            return (
              <div key={workspace.id} className={layerClass} aria-hidden={!isActive}>
                <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
                  <div className="text-center">
                    <p className="text-lg">No active session</p>
                    <p className="mt-2 text-sm">Select a session from the sidebar or create a new one</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={workspace.id} className={layerClass} aria-hidden={!isActive}>
              <Terminal sessionId={activeSessionId} isVisible={isActive} />
            </div>
          );
        }

        return (
          <div key={workspace.id} className={layerClass} aria-hidden={!isActive} />
        );
      })}
    </div>
  );
}

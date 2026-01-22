import useStore from '../../store';
import Terminal from './Terminal';
import LayoutRenderer from './LayoutRenderer';

export default function TerminalArea() {
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);
  const activeSessionId = useStore((state) => state.activeSessionId);

  // Get active workspace
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

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
        <LayoutRenderer layout={workspace.layout} />
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

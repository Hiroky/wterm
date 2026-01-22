import { useEffect } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useWebSocket } from './hooks/useWebSocket';
import useStore from './store';
import { insertSessionIntoTree, removeSessionFromTree } from './utils/layoutTree';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import TerminalArea from './components/TerminalArea/TerminalArea';
import ChatPane from './components/ChatPane/ChatPane';
import StatusBar from './components/StatusBar/StatusBar';

function App() {
  useWebSocket();
  const config = useStore((state) => state.config);
  const setConfig = useStore((state) => state.setConfig);
  const setWorkspaces = useStore((state) => state.setWorkspaces);
  const setActiveWorkspace = useStore((state) => state.setActiveWorkspace);
  const activeDragId = useStore((state) => state.activeDragId);
  const setActiveDragId = useStore((state) => state.setActiveDragId);
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const updateLayout = useStore((state) => state.updateLayout);

  useEffect(() => {
    // Load config from server
    fetch('/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Failed to load config:', err));
  }, [setConfig]);

  useEffect(() => {
    // Load workspaces from server
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((data) => {
        if (data.workspaces) {
          setWorkspaces(data.workspaces);
        }
        if (data.activeWorkspaceId) {
          setActiveWorkspace(data.activeWorkspaceId);
        }
      })
      .catch((err) => console.error('Failed to load workspaces:', err));
  }, [setWorkspaces, setActiveWorkspace]);

  // Note: セッションとワークスペースの同期はuseWebSocket内で行われます

  function handleDragStart(event: any) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;

    setActiveDragId(null);

    if (!over) return;

    const draggedSessionId = active.id as string;
    const dropData = over.data.current;

    // Check if dropped on a drop zone
    if (!dropData || !dropData.position || !dropData.sessionId) {
      console.log('Not dropped on a valid drop zone');
      return;
    }

    const targetSessionId = dropData.sessionId as string;
    const position = dropData.position as 'top' | 'bottom' | 'left' | 'right';

    // Don't allow dropping on itself
    if (draggedSessionId === targetSessionId) {
      return;
    }

    // Get active workspace
    if (!activeWorkspaceId) {
      console.error('No active workspace');
      return;
    }

    const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
    if (!workspace) {
      console.error('Active workspace not found');
      return;
    }

    // Get current layout
    let currentLayout = workspace.layout;

    // Remove dragged session from current layout
    if (currentLayout) {
      const layoutAfterRemoval = removeSessionFromTree(currentLayout, draggedSessionId);
      currentLayout = layoutAfterRemoval;
    }

    // Insert session at new position
    const newLayout = insertSessionIntoTree(
      currentLayout,
      targetSessionId,
      draggedSessionId,
      position
    );

    console.log('Updated layout:', newLayout);

    // Update Zustand store
    updateLayout(activeWorkspaceId, newLayout);

    // Save to server
    fetch(`/api/workspaces/${activeWorkspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: newLayout }),
    }).catch((err) => console.error('Failed to save layout:', err));
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4 text-2xl">Loading wterm...</div>
          <div className="text-sm text-gray-400">Connecting to server...</div>
        </div>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col bg-gray-900 text-white">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <TerminalArea />
            <ChatPane />
          </div>
        </div>
        <StatusBar />
      </div>

      {/* Drag Overlay for visual feedback */}
      <DragOverlay>
        {activeDragId ? (
          <div className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold shadow-lg">
            {activeDragId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;

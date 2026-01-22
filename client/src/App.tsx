import { useEffect, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useWebSocket } from './hooks/useWebSocket';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import useStore from './store';
import { insertSessionIntoTree, removeSessionFromTree } from './utils/layoutTree';
import { setDebugEnabled } from './utils/logger';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import TerminalArea from './components/TerminalArea/TerminalArea';
import ChatPane from './components/ChatPane/ChatPane';
import StatusBar from './components/StatusBar/StatusBar';
import HelpDialog from './components/Dialogs/HelpDialog';
import Toast from './components/Toast/Toast';

function App() {
  useWebSocket();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenHelp: () => setIsHelpOpen(true),
  });

  const config = useStore((state) => state.config);
  const setConfig = useStore((state) => state.setConfig);
  const setWorkspaces = useStore((state) => state.setWorkspaces);
  const setActiveWorkspace = useStore((state) => state.setActiveWorkspace);
  const activeDragId = useStore((state) => state.activeDragId);
  const setActiveDragId = useStore((state) => state.setActiveDragId);
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const updateLayout = useStore((state) => state.updateLayout);
  const isReconnecting = useStore((state) => state.isReconnecting);

  useEffect(() => {
    // Load config from server
    fetch('/config')
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        // デバッグログの有効/無効を設定
        setDebugEnabled(data.debugLog === true);
      })
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

  const showSidebar = config.uiLayout?.showSidebar !== false;
  const showHistoryPanel = config.uiLayout?.showHistoryPanel !== false;
  const sidebarPosition = config.uiLayout?.sidebarPosition || 'left';

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col bg-gray-900 text-white">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          {showSidebar && sidebarPosition === 'left' && <Sidebar />}
          <div className="flex flex-1 flex-col">
            <TerminalArea />
            {showHistoryPanel && <ChatPane />}
          </div>
          {showSidebar && sidebarPosition === 'right' && <Sidebar />}
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

      {/* Help Dialog */}
      <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Toast notifications */}
      <Toast />

      {/* Reconnecting overlay */}
      {isReconnecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="rounded-lg bg-gray-800 p-8 text-center">
            <div className="mb-4 text-4xl animate-pulse">...</div>
            <h2 className="mb-2 text-xl font-semibold">Reconnecting</h2>
            <p className="text-sm text-gray-400">
              Connection lost. Attempting to reconnect...
            </p>
          </div>
        </div>
      )}
    </DndContext>
  );
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;

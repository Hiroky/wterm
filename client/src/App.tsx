import { useEffect } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useWebSocket } from './hooks/useWebSocket';
import useStore from './store';
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

  function handleDragStart(event: any) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;

    setActiveDragId(null);

    if (!over) return;

    console.log('Drag ended:', {
      draggedSessionId: active.id,
      droppedOn: over.id,
      dropData: over.data.current,
    });

    // TODO: Implement layout update logic in Week 2 Day 12-13
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

import { useEffect } from 'react';
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

  useEffect(() => {
    // Load config from server
    fetch('/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Failed to load config:', err));
  }, [setConfig]);

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
  );
}

export default App;

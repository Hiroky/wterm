import { useState, useEffect } from 'react';
import useStore from '../../store';

export default function StatusBar() {
  const { sessions, activeSessionId, isConnected } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <footer className="flex items-center justify-between border-t border-gray-700 bg-gray-800 px-4 py-1 text-xs">
      <div className="flex items-center gap-4">
        <span className="text-gray-400">
          Sessions: <span className="text-white">{sessions.length}</span>
        </span>
        {activeSession && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">
              Active:{' '}
              <span className="text-white">{activeSession.id}</span>
            </span>
            <span
              className={`rounded px-2 py-0.5 ${
                activeSession.status === 'running'
                  ? 'bg-green-600'
                  : 'bg-red-600'
              }`}
            >
              {activeSession.status}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-gray-400">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">
          {currentTime.toLocaleTimeString()}
        </span>
      </div>
    </footer>
  );
}

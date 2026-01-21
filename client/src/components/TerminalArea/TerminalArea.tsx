import useStore from '../../store';
import Terminal from './Terminal';

export default function TerminalArea() {
  const { activeSessionId, sessions } = useStore();

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

  const session = sessions.find((s) => s.id === activeSessionId);

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-lg">Session not found</p>
          <p className="mt-2 text-sm">The selected session may have been deleted</p>
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

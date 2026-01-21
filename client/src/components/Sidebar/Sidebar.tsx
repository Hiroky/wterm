import useStore from '../../store';

export default function Sidebar() {
  const { sessions, activeSessionId, setActiveSession } = useStore();

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm(`Delete session ${id}?`)) return;

    try {
      const response = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }
  }

  return (
    <aside className="w-64 border-r border-gray-700 bg-gray-800 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <p className="text-xs text-gray-400">{sessions.length} active</p>
      </div>

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center text-sm text-gray-400">
            <p>No sessions</p>
            <p className="mt-1 text-xs">Create one to get started</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`group flex cursor-pointer items-center justify-between rounded p-3 transition-colors ${
                activeSessionId === session.id
                  ? 'bg-blue-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{session.id}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      session.status === 'running'
                        ? 'bg-green-600'
                        : 'bg-red-600'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-400">
                  {session.command || 'PowerShell'}
                </p>
              </div>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                className="ml-2 rounded p-1 opacity-0 hover:bg-red-600 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

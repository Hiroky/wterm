import useStore from '../../store';

export default function AddWorkspaceButton() {
  const addWorkspace = useStore((state) => state.addWorkspace);

  async function handleAddWorkspace() {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新規ワークスペース',
          icon: '📁',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const data = await response.json();
      addWorkspace(data.workspace);
    } catch (error) {
      console.error('Error creating workspace:', error);
      console.error('Failed to create workspace');
    }
  }

  return (
    <button
      onClick={handleAddWorkspace}
      className="w-full rounded bg-blue-600 p-3 text-sm font-medium transition-colors hover:bg-blue-700"
    >
      + New Workspace
    </button>
  );
}

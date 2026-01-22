import useStore from '../../store';
import WorkspaceItem from './WorkspaceItem';
import AddWorkspaceButton from './AddWorkspaceButton';

export default function WorkspaceList() {
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Workspaces</h2>
        <p className="text-xs text-gray-400">{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {workspaces.length === 0 ? (
          <div className="text-center text-sm text-gray-400">
            <p>No workspaces</p>
            <p className="mt-1 text-xs">Create one to get started</p>
          </div>
        ) : (
          workspaces.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              isActive={activeWorkspaceId === workspace.id}
            />
          ))
        )}
      </div>

      <div className="mt-4">
        <AddWorkspaceButton />
      </div>
    </div>
  );
}

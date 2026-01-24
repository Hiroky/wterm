import useStore from '../../store';
import WorkspaceList from './WorkspaceList';
import CompactWorkspaceList from './CompactWorkspaceList';

export default function Sidebar() {
  const isSidebarCollapsed = useStore((state) => state.isSidebarCollapsed);

  if (isSidebarCollapsed) {
    return (
      <aside className="flex w-16 flex-col border-r border-gray-700 bg-gray-800">
        <CompactWorkspaceList />
      </aside>
    );
  }

  return (
    <aside className="flex w-64 flex-col border-r border-gray-700 bg-gray-800 p-4">
      <WorkspaceList />
    </aside>
  );
}

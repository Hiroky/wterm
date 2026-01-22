import WorkspaceList from './WorkspaceList';

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-gray-700 bg-gray-800 p-4 flex flex-col">
      <WorkspaceList />
    </aside>
  );
}

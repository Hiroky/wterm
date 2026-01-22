import type { LayoutNode } from '../../types';
import Terminal from './Terminal';
import SplitPane from './SplitPane';

interface LayoutRendererProps {
  layout: LayoutNode | null;
}

export default function LayoutRenderer({ layout }: LayoutRendererProps) {
  if (!layout) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-lg">No layout defined</p>
          <p className="mt-2 text-sm">Create a new session to get started</p>
        </div>
      </div>
    );
  }

  return <LayoutNodeRenderer node={layout} />;
}

function LayoutNodeRenderer({ node }: { node: LayoutNode }) {
  if (node.type === 'terminal') {
    return <Terminal sessionId={node.sessionId} />;
  }

  if (node.type === 'split') {
    return (
      <SplitPane direction={node.direction} sizes={node.sizes}>
        {node.children.map((child, index) => (
          <LayoutNodeRenderer key={index} node={child} />
        ))}
      </SplitPane>
    );
  }

  return null;
}

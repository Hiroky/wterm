import type { LayoutNode } from '../../types';
import Terminal from './Terminal';
import SplitPane from './SplitPane';

interface LayoutRendererProps {
  layout: LayoutNode | null;
  onLayoutChange?: (path: number[], newSizes: number[]) => void;
}

export default function LayoutRenderer({ layout, onLayoutChange }: LayoutRendererProps) {
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

  return <LayoutNodeRenderer node={layout} path={[]} onLayoutChange={onLayoutChange} />;
}

interface LayoutNodeRendererProps {
  node: LayoutNode;
  path: number[];
  onLayoutChange?: (path: number[], newSizes: number[]) => void;
}

function LayoutNodeRenderer({ node, path, onLayoutChange }: LayoutNodeRendererProps) {
  if (node.type === 'terminal') {
    return <Terminal key={node.sessionId} sessionId={node.sessionId} />;
  }

  if (node.type === 'split') {
    return (
      <SplitPane
        direction={node.direction}
        sizes={node.sizes}
        onSizesChange={(newSizes) => onLayoutChange?.(path, newSizes)}
      >
        {node.children.map((child, index) => {
          // Generate a unique key based on the child type
          const childKey = child.type === 'terminal'
            ? child.sessionId
            : `split-${path.join('-')}-${index}`;

          return (
            <LayoutNodeRenderer
              key={childKey}
              node={child}
              path={[...path, index]}
              onLayoutChange={onLayoutChange}
            />
          );
        })}
      </SplitPane>
    );
  }

  return null;
}

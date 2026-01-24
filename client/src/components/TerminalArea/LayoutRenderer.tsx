import { useMemo } from 'react';
import type { LayoutNode } from '../../types';
import useStore from '../../store';
import Terminal from './Terminal';
import SplitPane from './SplitPane';

interface LayoutRendererProps {
  layout: LayoutNode | null;
  onLayoutChange?: (path: number[], newSizes: number[]) => void;
  isActive?: boolean;
  workspaceSessionIds?: string[];
}

export default function LayoutRenderer({ layout, onLayoutChange, isActive = true, workspaceSessionIds }: LayoutRendererProps) {
  const sessions = useStore((state) => state.sessions);

  // ワークスペースに属するセッションのみをフィルタリング
  const sessionIds = useMemo(() => {
    if (workspaceSessionIds) {
      // ワークスペースに属し、かつ実際に存在するセッションのみ
      const existingSessionIds = new Set(sessions.map((s) => s.id));
      return new Set(workspaceSessionIds.filter((id) => existingSessionIds.has(id)));
    }
    // フォールバック: 全セッション
    return new Set(sessions.map((s) => s.id));
  }, [sessions, workspaceSessionIds]);

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

  // ワークスペースに属するセッションがない場合
  if (sessionIds.size === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-lg">No sessions in this workspace</p>
          <p className="mt-2 text-sm">Create a new session to get started</p>
        </div>
      </div>
    );
  }

  return (
    <LayoutNodeRenderer
      node={layout}
      path={[]}
      onLayoutChange={onLayoutChange}
      sessionIds={sessionIds}
      isActive={isActive}
    />
  );
}

interface LayoutNodeRendererProps {
  node: LayoutNode;
  path: number[];
  onLayoutChange?: (path: number[], newSizes: number[]) => void;
  sessionIds: Set<string>;
  isActive: boolean;
}

function LayoutNodeRenderer({ node, path, onLayoutChange, sessionIds, isActive }: LayoutNodeRendererProps) {
  if (node.type === 'terminal') {
    // セッションが存在しない場合はプレースホルダーを表示
    if (!sessionIds.has(node.sessionId)) {
      return (
        <div className="flex h-full items-center justify-center bg-gray-900 text-gray-500">
          <p className="text-sm">Session {node.sessionId} not available</p>
        </div>
      );
    }
    return <Terminal key={node.sessionId} sessionId={node.sessionId} isVisible={isActive} />;
  }

  if (node.type === 'split') {
    // 有効な子ノードのみをフィルタリング
    const validChildren = node.children.filter((child) => {
      if (child.type === 'terminal') {
        return sessionIds.has(child.sessionId);
      }
      return true; // splitノードは常に有効
    });

    // 有効な子がない場合
    if (validChildren.length === 0) {
      return (
        <div className="flex h-full items-center justify-center bg-gray-900 text-gray-500">
          <p className="text-sm">No valid sessions in this split</p>
        </div>
      );
    }

    // 有効な子が1つだけの場合はSplitPaneを使わず直接レンダリング
    if (validChildren.length === 1) {
      return (
        <LayoutNodeRenderer
          node={validChildren[0]}
          path={path}
          onLayoutChange={onLayoutChange}
          sessionIds={sessionIds}
          isActive={isActive}
        />
      );
    }

    // サイズを再計算（フィルタリングされた子に合わせて）
    const validIndices = node.children
      .map((child, index) => ({ child, index }))
      .filter(({ child }) => {
        if (child.type === 'terminal') {
          return sessionIds.has(child.sessionId);
        }
        return true;
      })
      .map(({ index }) => index);

    const validSizes = validIndices.map((i) => node.sizes[i] || 50);
    const totalSize = validSizes.reduce((a, b) => a + b, 0);
    const normalizedSizes = validSizes.map((s) => (s / totalSize) * 100);

    return (
      <SplitPane
        direction={node.direction}
        sizes={normalizedSizes}
        onSizesChange={(newSizes) => onLayoutChange?.(path, newSizes)}
      >
        {validChildren.map((child, index) => {
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
              sessionIds={sessionIds}
              isActive={isActive}
            />
          );
        })}
      </SplitPane>
    );
  }

  return null;
}

import type { LayoutNode } from '../types';

/**
 * セッションをツリーに挿入
 * @param tree 現在のレイアウトツリー
 * @param targetSessionId 挿入位置の基準となるセッションID
 * @param newSessionId 新しく追加するセッションID
 * @param position 挿入位置 ('top' | 'bottom' | 'left' | 'right')
 * @returns 新しいレイアウトツリー
 */
export function insertSessionIntoTree(
  tree: LayoutNode | null,
  targetSessionId: string,
  newSessionId: string,
  position: 'top' | 'bottom' | 'left' | 'right'
): LayoutNode {
  const newTerminalNode: LayoutNode = { type: 'terminal', sessionId: newSessionId };

  // ツリーが空の場合
  if (!tree) {
    return newTerminalNode;
  }

  // ターゲットセッションを探して分割
  function insertNode(node: LayoutNode): LayoutNode {
    // ターゲットセッションが見つかった場合
    if (node.type === 'terminal' && node.sessionId === targetSessionId) {
      const direction = position === 'left' || position === 'right' ? 'horizontal' : 'vertical';
      const children =
        position === 'left' || position === 'top'
          ? [newTerminalNode, node]
          : [node, newTerminalNode];

      return {
        type: 'split',
        direction,
        children,
        sizes: [50, 50],
      };
    }

    // 分割ノードの場合は子ノードを再帰的に探索
    if (node.type === 'split') {
      const updatedChildren = node.children.map(insertNode);
      // 子ノードのいずれかが変更された場合
      const hasChanged = updatedChildren.some((child, i) => child !== node.children[i]);
      if (hasChanged) {
        return {
          ...node,
          children: updatedChildren,
        };
      }
    }

    return node;
  }

  return simplifyTree(insertNode(tree));
}

/**
 * セッションをツリーから削除
 * @param tree 現在のレイアウトツリー
 * @param sessionId 削除するセッションID
 * @returns 新しいレイアウトツリー（nullの場合はツリーが空）
 */
export function removeSessionFromTree(tree: LayoutNode, sessionId: string): LayoutNode | null {
  // ターミナルノードで該当セッションの場合は削除
  if (tree.type === 'terminal') {
    return tree.sessionId === sessionId ? null : tree;
  }

  // 分割ノードの場合は子ノードを再帰的に処理
  if (tree.type === 'split') {
    const updatedChildren = tree.children
      .map((child) => removeSessionFromTree(child, sessionId))
      .filter((child): child is LayoutNode => child !== null);

    // すべての子が削除された場合
    if (updatedChildren.length === 0) {
      return null;
    }

    // 子が1つだけ残った場合は、その子を直接返す（簡略化）
    if (updatedChildren.length === 1) {
      return updatedChildren[0];
    }

    // サイズを再計算
    const newSizes = recalculateSizes(updatedChildren.length);

    return {
      ...tree,
      children: updatedChildren,
      sizes: newSizes,
    };
  }

  return tree;
}

/**
 * ツリーを簡略化
 * - 単一の子を持つ分割ノードを削除
 * - 同じ方向の連続した分割ノードを統合
 */
function simplifyTree(node: LayoutNode): LayoutNode {
  if (node.type === 'terminal') {
    return node;
  }

  // 子ノードを再帰的に簡略化
  let simplifiedChildren = node.children.map(simplifyTree);

  // 単一の子を持つ場合は、その子を直接返す
  if (simplifiedChildren.length === 1) {
    return simplifiedChildren[0];
  }

  // 同じ方向の子ノードを統合
  const flattenedChildren: LayoutNode[] = [];
  for (const child of simplifiedChildren) {
    if (child.type === 'split' && child.direction === node.direction) {
      // 同じ方向の分割ノードの場合は、子を展開
      flattenedChildren.push(...child.children);
    } else {
      flattenedChildren.push(child);
    }
  }

  // サイズを再計算
  const newSizes = recalculateSizes(flattenedChildren.length);

  return {
    ...node,
    children: flattenedChildren,
    sizes: newSizes,
  };
}

/**
 * 子ノード数に応じてサイズを均等に再計算
 */
function recalculateSizes(count: number): number[] {
  const size = 100 / count;
  return Array(count).fill(size);
}

/**
 * ツリー内の全セッションIDを取得
 */
export function getAllSessionIds(tree: LayoutNode | null): string[] {
  if (!tree) return [];

  if (tree.type === 'terminal') {
    return [tree.sessionId];
  }

  return tree.children.flatMap(getAllSessionIds);
}

/**
 * セッションがツリーに存在するか確認
 */
export function hasSession(tree: LayoutNode | null, sessionId: string): boolean {
  if (!tree) return false;

  if (tree.type === 'terminal') {
    return tree.sessionId === sessionId;
  }

  return tree.children.some((child) => hasSession(child, sessionId));
}

/**
 * ツリー内の特定パスにあるノードのsizes配列を更新
 * @param tree 現在のレイアウトツリー
 * @param path ノードへのパス（数値配列、例: [0, 1]）
 * @param newSizes 新しいsizes配列
 * @returns 更新されたレイアウトツリー
 */
export function updateSizesInTree(
  tree: LayoutNode | null,
  path: number[],
  newSizes: number[]
): LayoutNode | null {
  if (!tree) return null;

  // パスが空の場合、現在のノードを更新
  if (path.length === 0) {
    if (tree.type === 'split') {
      return {
        ...tree,
        sizes: newSizes,
      };
    }
    return tree;
  }

  // 分割ノードの場合、パスの最初の要素をインデックスとして使用
  if (tree.type === 'split') {
    const [index, ...restPath] = path;
    const updatedChildren = tree.children.map((child, i) =>
      i === index ? updateSizesInTree(child, restPath, newSizes) : child
    );

    return {
      ...tree,
      children: updatedChildren.filter((child): child is LayoutNode => child !== null),
      sizes: tree.sizes,
    };
  }

  return tree;
}

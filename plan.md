# wterm Phase 2 & 3 実装計画

## Phase 1 完了状況 ✅

Phase 1（React基本機能）は完了しました：
- ✅ React 18 + Vite + Tailwind CSS 4環境構築
- ✅ Zustand状態管理
- ✅ WebSocket通信
- ✅ xterm.js統合
- ✅ セッション管理（作成・削除・切り替え）
- ✅ ターミナル入出力
- ✅ ChatPane（セッション間メッセージング）
- ✅ ShortcutsMenu
- ✅ StatusBar

**現在アクセス可能**: http://localhost:5173

---

## Phase 2: ワークスペース + ドッキングレイアウト (2週間)

### Week 1: ワークスペース基盤

#### Day 1-2: バックエンドAPI実装

**src/types.ts に型追加**:
```typescript
// ワークスペース
export interface Workspace {
  id: string;
  name: string;
  icon: string;
  sessions: string[];
  layout: LayoutNode | null;
  createdAt: string;
  updatedAt: string;
}

// レイアウトノード
export type LayoutNode =
  | { type: 'terminal'; sessionId: string }
  | {
      type: 'split';
      direction: 'horizontal' | 'vertical';
      children: LayoutNode[];
      sizes: number[];
    };

// Config に追加
export interface Config {
  // ... 既存フィールド
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
}
```

**src/server.ts にAPI追加**:
- `GET /api/workspaces` - ワークスペース一覧取得
- `POST /api/workspaces` - 新規ワークスペース作成
- `PATCH /api/workspaces/:id` - ワークスペース更新（名前、レイアウト）
- `DELETE /api/workspaces/:id` - ワークスペース削除
- `POST /api/workspaces/active` - アクティブワークスペース設定

**src/config.ts にマイグレーション追加**:
```typescript
// workspaces が存在しない場合、デフォルトを作成
if (!parsed.workspaces || parsed.workspaces.length === 0) {
  parsed.workspaces = [{
    id: 'workspace-default',
    name: 'メイン',
    icon: '📁',
    sessions: [],
    layout: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }];
  parsed.activeWorkspaceId = 'workspace-default';
  saveConfig(parsed);
}
```

#### Day 3-4: Zustand ワークスペース状態

**client/src/store/index.ts 拡張**:
```typescript
interface AppState {
  // ... 既存
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  // Workspace Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  updateLayout: (workspaceId: string, layout: LayoutNode) => void;
}
```

**API統合**:
- App.tsx でワークスペース一覧をロード
- useWebSocket.ts でワークスペース更新を受信

#### Day 5-6: サイドバーUI更新

**components/Sidebar/Sidebar.tsx 改修**:
```tsx
// ワークスペースリスト + 各ワークスペース内のセッション一覧
<div>
  {workspaces.map(workspace => (
    <WorkspaceItem key={workspace.id} workspace={workspace}>
      {workspace.sessions.map(sessionId => (
        <SessionItem sessionId={sessionId} />
      ))}
    </WorkspaceItem>
  ))}
</div>
```

**新規コンポーネント**:
- `WorkspaceList.tsx` - ワークスペース一覧
- `WorkspaceItem.tsx` - ワークスペース項目（インライン編集可能）
- `AddWorkspaceButton.tsx` - ワークスペース追加ボタン

#### Day 7: レイアウトツリー基礎

**client/src/utils/layoutTree.ts 作成**:
```typescript
// セッションをツリーに挿入
export function insertSessionIntoTree(
  tree: LayoutNode,
  targetSessionId: string,
  newSessionId: string,
  position: 'top' | 'bottom' | 'left' | 'right'
): LayoutNode

// セッションをツリーから削除
export function removeSessionFromTree(
  tree: LayoutNode,
  sessionId: string
): LayoutNode | null
```

**components/TerminalArea/LayoutRenderer.tsx 作成**:
- 再帰的にLayoutNodeをレンダリング
- `type: 'terminal'` → Terminal コンポーネント
- `type: 'split'` → SplitPane コンポーネント

---

### Week 2: ドラッグ&ドロップ

#### Day 8-9: dnd-kit 統合

**App.tsx 更新**:
```tsx
import { DndContext, DragOverlay } from '@dnd-kit/core';

<DndContext onDragStart={...} onDragEnd={...}>
  {/* 既存UI */}
  <DragOverlay>
    {activeDragId ? <TerminalDragPreview /> : null}
  </DragOverlay>
</DndContext>
```

**Terminal.tsx 更新**:
```tsx
import { useDraggable } from '@dnd-kit/core';

const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
  id: sessionId,
});

// ヘッダーをドラッグハンドルにする
<div {...listeners} {...attributes}>
  {sessionId}
</div>
```

#### Day 10-11: DropZone実装

**components/TerminalArea/DropZone.tsx 作成**:
```tsx
import { useDroppable } from '@dnd-kit/core';

// 4方向のドロップゾーン（上下左右）
<div className={positionStyles[position]}>
  {isOver && '青いハイライト'}
</div>
```

**Terminal.tsx にドロップゾーン追加**:
```tsx
{showDropZones && (
  <>
    <DropZone position="top" onDrop={...} />
    <DropZone position="bottom" onDrop={...} />
    <DropZone position="left" onDrop={...} />
    <DropZone position="right" onDrop={...} />
  </>
)}
```

#### Day 12-13: レイアウト更新ロジック

**App.tsx handleDragEnd 実装**:
```typescript
function handleDragEnd(event) {
  const { active, over } = event;
  const draggedSessionId = active.id;
  const dropPosition = over.data.current?.position;

  if (dropPosition) {
    const currentLayout = getCurrentWorkspaceLayout();
    const newLayout = insertSessionIntoTree(
      currentLayout,
      targetSessionId,
      draggedSessionId,
      dropPosition
    );
    updateWorkspaceLayout(newLayout);
  }
}
```

**API連携**:
- レイアウト更新時に `PATCH /api/workspaces/:id` でサーバーに保存
- useAutoSave フック（500ms debounce）

#### Day 14: SplitPane + リサイズ

**components/TerminalArea/SplitPane.tsx 作成**:
```tsx
// direction: 'horizontal' | 'vertical'
// sizes: number[] (各子要素のサイズ%)
<div className={direction === 'horizontal' ? 'flex-row' : 'flex-col'}>
  {children.map((child, i) => (
    <>
      <div style={{ flex: sizes[i] }}>{child}</div>
      {i < children.length - 1 && (
        <Divider onResize={(delta) => updateSizes(i, delta)} />
      )}
    </>
  ))}
</div>
```

**components/TerminalArea/Divider.tsx 作成**:
- マウスドラッグでリサイズ
- `onMouseDown` + `onMouseMove` + `onMouseUp`
- sizes 配列を更新

---

## Phase 3: 既存機能移植 + 仕上げ (1週間)

### Day 15: ショートカット機能拡張

**現在の実装を拡張**:
- ショートカット実行時、現在のワークスペースにセッション追加
- ワークスペースが空の場合は新規レイアウト作成
- 既存セッションがある場合は右側に分割

### Day 16: 設定ダイアログ実装

**components/Dialogs/SettingsDialog.tsx 作成**:
```tsx
<Dialog>
  <Tabs>
    <Tab label="ターミナル">
      <input type="number" label="フォントサイズ" />
      <select label="フォント">...</select>
    </Tab>
    <Tab label="ワークスペース">
      <toggle label="デフォルトビュー" />
    </Tab>
  </Tabs>
</Dialog>
```

**設定変更の即時反映**:
- `PATCH /config` でサーバーに保存
- Zustand store 更新
- 全ターミナルに反映

### Day 17: 履歴パネル

**components/HistoryPanel.tsx 作成**:
- メッセージ履歴表示（既に ChatPane に実装済み）
- フィルタリング機能（送信元・送信先）
- クリア機能

### Day 18: キーボードショートカット

**グローバルショートカット実装**:
```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      createNewSession();
    }
    // ...
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**ショートカット一覧**:
- `Ctrl+Shift+T`: 新規セッション
- `Ctrl+Shift+W`: セッション削除
- `Ctrl+1-9`: ワークスペース切り替え
- `Ctrl+Shift+N`: 新規ワークスペース
- `Esc`: メニュー閉じる

### Day 19: エラーハンドリング

**ErrorBoundary 追加**:
```tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <ErrorScreen />;
    }
    return this.props.children;
  }
}
```

**トースト通知実装**:
- 成功/エラーメッセージ表示
- 自動消去（3秒）
- 複数メッセージのキュー管理

### Day 20-21: 最終テスト + ドキュメント

**テストチェックリスト**:
- [ ] ワークスペース作成・削除
- [ ] ワークスペース名変更（ダブルクリック）
- [ ] セッションをドラッグして4方向に分割
- [ ] ディバイダーでリサイズ
- [ ] セッション削除（レイアウト簡略化）
- [ ] ブラウザリロード（レイアウト復元）
- [ ] ショートカット実行
- [ ] ターミナル設定変更
- [ ] チャット送信・受信
- [ ] バッファ取得
- [ ] エッジケース（最後のワークスペース削除など）

**ドキュメント更新**:
- README.md - React版の使い方
- CLAUDE.md - React アーキテクチャ追加
- 移行ガイド（Vanilla JS → React）

---

## 重要な技術的決定事項

### 1. 状態管理: Zustand
- Redux より軽量（~1KB）
- Provider 不要
- TypeScript サポート良好

### 2. ドラッグ&ドロップ: dnd-kit
- ネイティブ HTML5 D&D より UX 優れる
- ドラッグプレビューとドロップゾーンを完全制御
- アクセシビリティ対応（キーボード操作）

### 3. レイアウトツリー構造
```typescript
// 単一ターミナル
{ type: 'terminal', sessionId: 'session-1' }

// 水平分割（左右）
{
  type: 'split',
  direction: 'horizontal',
  children: [
    { type: 'terminal', sessionId: 'session-1' },
    { type: 'terminal', sessionId: 'session-2' }
  ],
  sizes: [50, 50]
}

// ネストした分割
{
  type: 'split',
  direction: 'horizontal',
  children: [
    { type: 'terminal', sessionId: 'session-1' },
    {
      type: 'split',
      direction: 'vertical',
      children: [
        { type: 'terminal', sessionId: 'session-2' },
        { type: 'terminal', sessionId: 'session-3' }
      ],
      sizes: [50, 50]
    }
  ],
  sizes: [50, 50]
}
```

### 4. 自動保存戦略
- レイアウト変更時に500ms debounce
- `PATCH /api/workspaces/:id` でサーバーに保存
- config.json に永続化

---

## リスク軽減策

### xterm.js パフォーマンス (4+ 分割時)
- IntersectionObserver で非表示ターミナルを一時停止
- 最大同時表示数の推奨（6個まで）
- 設定で制限可能

### レイアウトツリーのバグ
- ユニットテスト（insertSessionIntoTree, removeSessionFromTree）
- 簡略化ロジック徹底（単一子ノードは親に統合）
- 深さ制限の警告（4階層以上で警告）

### config.json 破損
- アトミックライト（一時ファイル → リネーム）
- 自動バックアップ（最新3世代保存）
- バリデーション（ロード時に構造チェック）

### WebSocket 切断
- 自動再接続（エクスポネンシャルバックオフ）
- 接続状態を UI 表示
- 「再接続中...」オーバーレイ

---

## 成功基準

### Phase 2 完了判定
- [ ] ワークスペースCRUD操作が動作
- [ ] ターミナルをドラッグ&ドロップで4方向分割可能
- [ ] レイアウトがブラウザリロード後も復元
- [ ] config.json に自動保存

### Phase 3 完了判定
- [ ] すべての既存機能がReact版で動作
- [ ] エラーハンドリングが適切
- [ ] ドキュメントが最新

### 最終成功基準
- **機能**: layout-plan.md の全要件を満たす
- **パフォーマンス**: 4分割表示でも快適に動作
- **安定性**: エラー発生時に適切に復旧
- **保守性**: コードが整理され、拡張しやすい

---

## 開発コマンド

```bash
# 開発サーバー起動（バックエンド + フロントエンド同時）
npm run dev

# フロントエンドのみビルド
npm run build:client

# 本番起動（ビルド後）
npm start
```

**アクセスURL**:
- 開発: http://localhost:5173
- 本番: http://localhost:3000

---

## 次のステップ

Phase 2の実装を開始する準備ができました。

**開始前の確認**:
1. Phase 1が正常に動作している
2. WebSocket接続が安定している
3. 既存機能（セッション管理、チャット）が動作している

Phase 2を開始しますか？

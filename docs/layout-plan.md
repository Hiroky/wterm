# wterm ワークスペース機能 実装仕様書

**作成日**: 2026-01-21
**対象バージョン**: wterm 2.0.0
**技術スタック**: React + Tailwind CSS 4 + Vite

---

## 1. 概要

### 1.1 目的

wtermに「ワークスペース」概念を導入し、以下を実現する：

- **プロジェクト単位での作業環境の整理**: 各ワークスペースに複数のターミナルセッションをグループ化
- **柔軟なレイアウト管理**: VS Code風のドラッグ&ドロップによるドッキング操作
- **永続化**: ワークスペースとレイアウトの自動保存・復元
- **モダンな技術スタックへの移行**: Vanilla JSからReactへの全面書き換え

### 1.2 背景

現在のwtermは以下の課題を抱えている：

- 全セッションが単一の名前空間に混在し、プロジェクトごとの整理が困難
- 分割ビュー機能はあるが、レイアウトの保存や柔軟な配置変更ができない
- Vanilla JSでの実装により、複雑な状態管理とUI更新が煩雑

ワークスペース機能により、これらを解決し、マルチプロジェクト開発での使いやすさを向上させる。

### 1.3 対象ユーザー

- 複数のプロジェクトを並行して開発するソフトウェアエンジニア
- AIエージェント（Claude Code、GitHub Copilotなど）を複数同時に利用するユーザー
- ターミナル作業を効率化したいパワーユーザー

---

## 2. 主要機能仕様

### 2.1 ワークスペース概念

#### 2.1.1 ワークスペースとは

- **定義**: 複数のターミナルセッションとそのレイアウト情報をまとめた作業単位
- **例**:
  - "Frontend開発" ワークスペース: Viteサーバー、Tailwind監視、npm run test
  - "Backend開発" ワークスペース: Django runserver、Celery worker、ログ監視

#### 2.1.2 ワークスペースが持つ情報

| 項目 | 説明 | 必須 |
|------|------|------|
| `id` | 一意識別子（例: `workspace-1`） | ✓ |
| `name` | 表示名（ユーザーが編集可能） | ✓ |
| `icon` | 絵文字アイコン（例: `🚀`, `💻`） | ✓ |
| `sessions` | 含まれるセッションIDのリスト | ✓ |
| `layout` | ドッキングレイアウト情報（後述） | ✓ |
| `createdAt` | 作成日時 | ✓ |
| `updatedAt` | 最終更新日時 | ✓ |

---

### 2.2 ワークスペース操作

#### 2.2.1 作成

**トリガー**:
- サイドバーの「+新規ワークスペース」ボタン

**動作**:
1. サイドバーのワークスペース一覧に新しいエントリが追加される
2. インライン編集状態で表示され、名前を即座に入力可能
3. デフォルト値:
   - 名前: "新規ワークスペース"
   - アイコン: "📁"
   - セッション: 空配列
   - レイアウト: 空

**UI状態**:
- 作成直後は名前が選択状態（input要素にフォーカス）
- Enter押下またはフォーカス喪失で確定
- Escキャンセル不可（必ず1つ以上のワークスペースが存在）

#### 2.2.2 名前・アイコン変更

**トリガー**:
- サイドバーのワークスペース名をダブルクリック

**動作**:
1. インライン編集モードに切り替わる
2. 名前とアイコンを編集可能
3. Enter押下またはフォーカス喪失で保存
4. Esc押下でキャンセル

**UI**:
```
[🚀] Frontend開発
  ↓ ダブルクリック
[📝][input: Frontend開発]
```

#### 2.2.3 切り替え

**トリガー**:
- サイドバーのワークスペースをクリック

**動作**:
1. アクティブなワークスペースを切り替え
2. メインエリアに選択したワークスペースのレイアウトとセッションを表示
3. 前のワークスペースのレイアウト状態は保存される

**UI状態**:
- アクティブなワークスペースはハイライト表示

#### 2.2.4 削除

**トリガー**:
- ワークスペースを右クリック → 「削除」
- またはワークスペースにホバー時に表示される×ボタン

**動作**:
1. セッションが1つでも含まれている場合、確認ダイアログを表示:
   ```
   「Frontend開発」を削除しますか？
   このワークスペース内の3個のセッションも終了されます。

   [キャンセル] [削除]
   ```
2. 削除実行時:
   - 含まれる全セッションを終了
   - ワークスペースをconfig.jsonから削除
   - 別のワークスペースに切り替え（存在する場合）
3. 最後のワークスペースは削除不可（最低1つは保持）

---

### 2.3 ドッキングレイアウト機能

#### 2.3.1 レイアウトの構造

レイアウトは**ツリー構造**で表現される：

```typescript
type LayoutNode =
  | { type: 'terminal'; sessionId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; children: LayoutNode[]; sizes: number[] };
```

**例**:
```
┌─────────────┬─────────────┐
│  session-1  │  session-2  │  ← horizontal split
├─────────────┴─────────────┤
│       session-3           │
└───────────────────────────┘

ツリー表現:
{
  type: 'split',
  direction: 'vertical',
  children: [
    {
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'terminal', sessionId: 'session-1' },
        { type: 'terminal', sessionId: 'session-2' }
      ],
      sizes: [50, 50]  // パーセント
    },
    { type: 'terminal', sessionId: 'session-3' }
  ],
  sizes: [60, 40]
}
```

#### 2.3.2 ドラッグ＆ドロップ操作

**VS Code風のドッキング動作を実装**

##### ドラッグ開始

**トリガー**: ターミナルヘッダー（セッション名・ステータス表示部分）をマウスダウン

**視覚フィードバック**:
- ドラッグ開始と同時に、ターミナル全体が半透明になる
- カーソルが「掴んでいる」状態（grab cursor）に変化

##### ドラッグ中

**ドロップゾーン表示**:

1. **ターミナル上にホバー**した場合:
   - ホバーしているターミナルの上に半透明オーバーレイが表示される
   - オーバーレイは5つのゾーンに分割:
     ```
     ┌───────────────────┐
     │       ↑ Top       │  ← 上端25%
     ├───┬───────────┬───┤
     │ ← │           │ → │  ← 左右各20%
     │ L │  Center   │ R │
     │   │           │   │
     ├───┴───────────┴───┤
     │      ↓ Bottom     │  ← 下端25%
     └───────────────────┘
     ```
   - マウス位置に応じて該当ゾーンがハイライト（青色半透明）

2. **空白エリア**（ワークスペースが空の場合）:
   - 画面全体に「ここにドロップ」というメッセージ表示

**ドロップゾーンの意味**:
- **Top/Bottom**: ホバー中のターミナルと垂直分割（上下）
- **Left/Right**: ホバー中のターミナルと水平分割（左右）
- **Center**: ホバー中のターミナルとタブグループ化（未実装、将来の拡張用）

##### ドロップ

**動作**:
1. マウスボタンを離すと、ハイライトされたゾーンに応じてレイアウトを再構築
2. 分割の場合、既存のターミナルと新しいターミナルが指定方向に並ぶ
3. 初期サイズは50:50
4. レイアウトツリーを更新し、config.jsonに自動保存

**例: session-1の右に session-2をドロップ**
```
変更前:                  変更後:
┌───────────────┐        ┌────────┬────────┐
│  session-1    │   →    │ s1     │ s2     │
└───────────────┘        └────────┴────────┘

ツリー変更:
{ type: 'terminal', sessionId: 'session-1' }
  ↓
{
  type: 'split',
  direction: 'horizontal',
  children: [
    { type: 'terminal', sessionId: 'session-1' },
    { type: 'terminal', sessionId: 'session-2' }
  ],
  sizes: [50, 50]
}
```

#### 2.3.3 リサイズ操作

**トリガー**: 分割線（divider）をドラッグ

**動作**:
1. 分割線をマウスダウン → ドラッグ開始
2. ドラッグ中、分割線が移動し、隣接するターミナルのサイズが変化
3. マウスアップでサイズ確定
4. `sizes`配列を更新し、config.jsonに自動保存

**制約**:
- 最小サイズ: 各ペインは最低100px（設定可能）
- リサイズ中、xterm.jsの`fit()`を呼び出してターミナルサイズを調整

---

### 2.4 セッション管理

#### 2.4.1 セッション作成

**トリガー**:
- サイドバーの各ワークスペース内に表示される「+ セッション追加」ボタン

**動作**:
1. 既存のセッション作成API（`POST /api/sessions`）を呼び出し
2. 作成されたセッションIDを現在のワークスペースの`sessions`配列に追加
3. レイアウトに新しいターミナルを追加:
   - ワークスペースが空の場合: 単一ターミナルとして表示
   - 既存のターミナルがある場合: 最後のターミナルの右側に追加（水平分割）

**ショートカット機能との連携**:
- ヘッダーの「ショートカット」メニューから選択した場合も、現在のワークスペースにセッションが追加される

#### 2.4.2 セッション削除

**トリガー**:
- ターミナルヘッダーの×ボタン
- セッション一覧（サイドバー内）から右クリック → 削除

**動作**:
1. 既存のセッション削除API（`DELETE /api/sessions/:id`）を呼び出し
2. レイアウトツリーから該当ターミナルノードを削除
3. 親の分割ノードに子が1つだけ残った場合、ツリーを簡略化
4. ワークスペースの`sessions`配列から削除

**ツリー簡略化の例**:
```
削除前:
{
  type: 'split',
  children: [
    { type: 'terminal', sessionId: 'session-1' },
    { type: 'terminal', sessionId: 'session-2' }  ← 削除
  ]
}

削除後:
{ type: 'terminal', sessionId: 'session-1' }  ← 分割が不要になったので簡略化
```

---

## 3. データ構造とAPI

### 3.1 データモデル

#### 3.1.1 Workspace型定義

```typescript
interface Workspace {
  id: string;                    // 例: "workspace-1"
  name: string;                  // 例: "Frontend開発"
  icon: string;                  // 例: "🚀"
  sessions: string[];            // セッションIDの配列
  layout: LayoutNode;            // レイアウトツリー
  createdAt: string;             // ISO 8601形式
  updatedAt: string;             // ISO 8601形式
}

type LayoutNode =
  | { type: 'terminal'; sessionId: string }
  | {
      type: 'split';
      direction: 'horizontal' | 'vertical';
      children: LayoutNode[];
      sizes: number[];  // パーセント（合計100）
    };
```

#### 3.1.2 Config構造の変更

```typescript
// 変更前（既存）
interface Config {
  port: number;
  maxHistorySize: number;
  bufferSize: number;
  shortcuts: Shortcut[];
  uiLayout: UILayout;
  terminal: TerminalSettings;
}

// 変更後
interface Config {
  port: number;
  maxHistorySize: number;
  bufferSize: number;
  shortcuts: Shortcut[];
  uiLayout: UILayout;
  terminal: TerminalSettings;
  workspaces: Workspace[];        // ← 追加
  activeWorkspaceId: string;      // ← 追加
}
```

#### 3.1.3 初期データ

初回起動時、`config.json`に以下のデフォルトワークスペースが作成される：

```json
{
  "workspaces": [
    {
      "id": "workspace-default",
      "name": "メイン",
      "icon": "📁",
      "sessions": [],
      "layout": null,
      "createdAt": "2026-01-21T00:00:00.000Z",
      "updatedAt": "2026-01-21T00:00:00.000Z"
    }
  ],
  "activeWorkspaceId": "workspace-default"
}
```

### 3.2 APIエンドポイント（新規追加）

#### 3.2.1 ワークスペース一覧取得

```
GET /api/workspaces
```

**レスポンス**:
```json
{
  "workspaces": [
    {
      "id": "workspace-1",
      "name": "Frontend開発",
      "icon": "🚀",
      "sessions": ["session-1", "session-2"],
      "layout": { ... },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "activeWorkspaceId": "workspace-1"
}
```

#### 3.2.2 ワークスペース作成

```
POST /api/workspaces
Content-Type: application/json

{
  "name": "新規ワークスペース",
  "icon": "📁"
}
```

**レスポンス**:
```json
{
  "workspace": {
    "id": "workspace-2",
    "name": "新規ワークスペース",
    "icon": "📁",
    "sessions": [],
    "layout": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### 3.2.3 ワークスペース更新

```
PATCH /api/workspaces/:id
Content-Type: application/json

{
  "name": "Frontend開発（更新後）",
  "icon": "💻",
  "layout": { ... }
}
```

**レスポンス**:
```json
{
  "workspace": { ... }
}
```

#### 3.2.4 ワークスペース削除

```
DELETE /api/workspaces/:id
```

**レスポンス**:
```json
{
  "success": true,
  "deletedSessions": ["session-1", "session-2"]
}
```

#### 3.2.5 アクティブワークスペース変更

```
POST /api/workspaces/active
Content-Type: application/json

{
  "workspaceId": "workspace-2"
}
```

**レスポンス**:
```json
{
  "success": true
}
```

### 3.3 永続化

#### 3.3.1 自動保存タイミング

以下の操作時に`config.json`を自動更新：

1. ワークスペース作成・削除・名前変更
2. セッション追加・削除
3. ドッキングレイアウト変更（ドロップ時、リサイズ完了時）
4. ワークスペース切り替え

#### 3.3.2 保存処理

- デバウンス: 連続した変更は500ms間隔でまとめて保存
- エラーハンドリング: 保存失敗時はトースト通知

---

## 4. UIレイアウト設計

### 4.1 画面構成（ワイヤーフレーム）

```
┌────────────────────────────────────────────────────────────┐
│ ヘッダー                                                    │
│ [wterm] [+ 新規セッション] [⚡ ショートカット] [⚙ 設定]   │
└────────────────────────────────────────────────────────────┘
┌──────────┬─────────────────────────────────────────────────┐
│          │                                                 │
│ サイド   │  メインエリア（ターミナル表示）                │
│ バー     │                                                 │
│          │  ┌──────────────┬──────────────┐               │
│ ワーク   │  │ session-1    │ session-2    │               │
│ スペース │  │ [実行中]     │ [実行中]     │               │
│          │  │              │              │               │
│ 🚀 FE    │  │ $ npm run dev│ $ npm test   │               │
│ + session│  │              │              │               │
│ - s1     │  │              │              │               │
│ - s2     │  │              │              │               │
│          │  └──────────────┴──────────────┘               │
│ 💻 BE    │                                                 │
│          │                                                 │
│ + 新規WS │                                                 │
└──────────┴─────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ チャット入力欄（セッション間通信）                          │
│ [メッセージ入力...] [送信] [全送信]                         │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ ステータスバー                                              │
│ セッション: 2 | アクティブ: session-1                       │
└────────────────────────────────────────────────────────────┘
```

### 4.2 サイドバー詳細

#### 4.2.1 構造

```
┌────────────────┐
│ ワークスペース │
│                │
│ 🚀 Frontend開発│ ← アクティブ（背景色あり）
│  + セッション  │ ← ホバー時に表示
│  - session-1   │ ← セッション一覧（折りたたみ可能）
│  - session-2   │
│                │
│ 💻 Backend開発 │ ← 非アクティブ
│  - session-3   │
│                │
│ + 新規ワーク   │ ← 新規作成ボタン
│   スペース     │
└────────────────┘
```

#### 4.2.2 インライン編集

ワークスペース名をダブルクリックすると、以下のように変化：

```
変更前:
🚀 Frontend開発

変更中（input要素）:
[📝] [                ]
      ↑ 入力フィールド（フォーカス状態）
```

### 4.3 ドロップゾーン表示

#### 4.3.1 ドラッグ中のオーバーレイ

```
ターミナル上にホバー:

┌─────────────────────────────┐
│       ↑ Top (25%)          │ ← ここにドロップで上に分割
├──────┬─────────────┬────────┤
│ Left │   Center    │ Right  │
│(20%) │   (40%)     │ (20%)  │ ← Left/Rightで左右分割
├──────┴─────────────┴────────┤
│      ↓ Bottom (25%)         │ ← ここにドロップで下に分割
└─────────────────────────────┘
```

マウス位置に応じて該当ゾーンが青色半透明（`bg-blue-500/30`）でハイライト。

---

## 5. Reactコンポーネント設計

### 5.1 コンポーネント階層

```
<App>
  ├─ <Header>
  │   ├─ <NewSessionButton>
  │   ├─ <ShortcutsMenu>
  │   └─ <SettingsButton>
  ├─ <MainLayout>
  │   ├─ <Sidebar>
  │   │   ├─ <WorkspaceList>
  │   │   │   └─ <WorkspaceItem> (複数)
  │   │   │       ├─ <SessionList>
  │   │   │       │   └─ <SessionItem> (複数)
  │   │   │       └─ <AddSessionButton>
  │   │   └─ <AddWorkspaceButton>
  │   └─ <TerminalArea>
  │       └─ <LayoutRenderer>  ← レイアウトツリーを再帰的にレンダリング
  │           └─ <Terminal> or <SplitPane>
  ├─ <ChatPane>
  └─ <StatusBar>
```

### 5.2 主要コンポーネント

#### 5.2.1 App

**責務**:
- グローバル状態管理（Context APIまたはZustand）
- WebSocket接続管理
- ルーティング（必要に応じて）

**State**:
```typescript
{
  workspaces: Workspace[];
  activeWorkspaceId: string;
  sessions: Session[];  // 全セッション情報
  config: Config;
}
```

#### 5.2.2 LayoutRenderer

**責務**:
- レイアウトツリーを再帰的にレンダリング
- ドラッグ＆ドロップのコンテキスト管理

**Props**:
```typescript
interface LayoutRendererProps {
  layout: LayoutNode;
  onLayoutChange: (newLayout: LayoutNode) => void;
}
```

**実装概要**:
```typescript
function LayoutRenderer({ layout, onLayoutChange }) {
  if (layout.type === 'terminal') {
    return <Terminal sessionId={layout.sessionId} />;
  }

  if (layout.type === 'split') {
    return (
      <SplitPane direction={layout.direction} sizes={layout.sizes}>
        {layout.children.map(child => (
          <LayoutRenderer layout={child} onLayoutChange={onLayoutChange} />
        ))}
      </SplitPane>
    );
  }
}
```

#### 5.2.3 Terminal

**責務**:
- xterm.jsの統合
- ターミナル入出力の管理
- ドラッグハンドルの提供

**Props**:
```typescript
interface TerminalProps {
  sessionId: string;
}
```

**ドラッグハンドル**:
- ターミナルヘッダーに`draggable`属性を付与
- `onDragStart`でドラッグ元のsessionIdをDataTransferに設定

#### 5.2.4 DropZone

**責務**:
- ドロップ可能なエリアの表示
- ドラッグオーバー時のハイライト

**Props**:
```typescript
interface DropZoneProps {
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  onDrop: (draggedSessionId: string) => void;
}
```

### 5.3 状態管理

#### 5.3.1 推奨ライブラリ

**Zustand**を推奨（理由: シンプルで学習コストが低い）

**ストア設計**:
```typescript
import create from 'zustand';

interface AppState {
  // State
  workspaces: Workspace[];
  activeWorkspaceId: string;
  sessions: Session[];

  // Actions
  addWorkspace: (name: string, icon: string) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  addSessionToWorkspace: (workspaceId: string, sessionId: string) => void;
  updateLayout: (workspaceId: string, layout: LayoutNode) => void;
}

const useStore = create<AppState>((set) => ({
  workspaces: [],
  activeWorkspaceId: '',
  sessions: [],

  addWorkspace: (name, icon) => set((state) => ({
    workspaces: [
      ...state.workspaces,
      {
        id: `workspace-${Date.now()}`,
        name,
        icon,
        sessions: [],
        layout: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ]
  })),

  // ... 他のアクション
}));
```

### 5.4 ドラッグ＆ドロップ実装

#### 5.4.1 推奨ライブラリ

**dnd-kit**を推奨（理由: モダンで軽量、アクセシビリティ対応）

#### 5.4.2 実装概要

```typescript
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';

function Terminal({ sessionId }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: sessionId,
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }}>
      <div className="terminal-header" {...listeners} {...attributes}>
        {/* ドラッグハンドル */}
      </div>
      <div className="terminal-body">
        {/* xterm.js */}
      </div>
    </div>
  );
}

function DropZone({ position, onDrop }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `dropzone-${position}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`dropzone ${isOver ? 'dropzone-active' : ''}`}
    >
      {/* ドロップゾーン表示 */}
    </div>
  );
}
```

---

## 6. 技術スタック詳細

### 6.1 フロントエンド

| 項目 | 技術 | バージョン |
|------|------|-----------|
| UIフレームワーク | React | 18.x |
| CSSフレームワーク | Tailwind CSS | 4.x |
| ビルドツール | Vite | 5.x |
| 状態管理 | Zustand | 4.x |
| ドラッグ＆ドロップ | dnd-kit | 最新 |
| ターミナル | xterm.js | 5.x |
| 型定義 | TypeScript | 5.x |

### 6.2 バックエンド

- 既存のNode.js + TypeScriptサーバーを継続
- API追加のみ（大きな変更なし）

### 6.3 開発環境セットアップ

#### 6.3.1 依存関係のインストール

```bash
# フロントエンド
npm install react react-dom
npm install -D @vitejs/plugin-react vite
npm install tailwindcss@next @tailwindcss/vite@next
npm install zustand
npm install @dnd-kit/core @dnd-kit/sortable

# 型定義
npm install -D @types/react @types/react-dom
```

#### 6.3.2 Vite設定

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
```

#### 6.3.3 Tailwind CSS 4設定

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

---

## 7. 実装フェーズ

### Phase 1: React環境構築と基本機能（1週間目安）

**目標**: Vanilla JSからReactへの移行基盤を構築

**タスク**:
1. Vite + React + Tailwind 4のセットアップ
2. 既存のHTMLをReactコンポーネントに分割
   - Header
   - Sidebar（ワークスペース機能なし、セッション一覧のみ）
   - TerminalArea（単一ターミナル表示）
   - ChatPane
   - StatusBar
3. WebSocket接続をReact Contextで管理
4. xterm.jsの統合（単一ターミナル）
5. セッション作成・削除・切り替え機能の実装

**完了条件**:
- React版で既存の基本機能（セッション管理、ターミナル表示）が動作する
- ワークスペース機能はまだ未実装

---

### Phase 2: ワークスペース機能とドッキングレイアウト（2週間目安）

**目標**: ワークスペース概念とドラッグ＆ドロップレイアウトを実装

**タスク**:
1. ワークスペース用API実装（バックエンド）
   - `GET /api/workspaces`
   - `POST /api/workspaces`
   - `PATCH /api/workspaces/:id`
   - `DELETE /api/workspaces/:id`
   - `POST /api/workspaces/active`
2. Config構造の変更（`workspaces`配列追加）
3. Zustandストアの実装
4. サイドバーのワークスペース一覧表示
5. ワークスペースの作成・削除・切り替え
6. インライン編集機能
7. LayoutRenderer実装（再帰的なレイアウト表示）
8. dnd-kitの統合
9. ドラッグ＆ドロップによるドッキング
10. ドロップゾーンの表示
11. レイアウトツリーの構築・更新ロジック
12. 分割線のリサイズ機能
13. 自動保存機能（デバウンス付き）

**完了条件**:
- ワークスペースの作成・削除・切り替えができる
- ターミナルをドラッグ＆ドロップで自由に配置できる
- レイアウトが永続化され、ブラウザリロード後も復元される

---

### Phase 3: 既存機能の移植と仕上げ（1週間目安）

**目標**: 既存の便利機能をReact版に移植し、完成度を高める

**タスク**:
1. ショートカット機能の実装
   - ショートカットメニュー
   - ショートカット編集ダイアログ
2. チャット入力欄（セッション間通信）の実装
   - バッファボタン（Ctrl+1-9）
   - 送信・全送信機能
3. 受信履歴パネルの実装
4. ターミナル設定の実装
   - フォントファミリー・サイズ設定
   - 設定ダイアログ
5. UI/UXの改善
   - アニメーション（Tailwind CSS Transition）
   - トースト通知
   - キーボードショートカット
6. エラーハンドリングとバリデーション
7. テスト（手動テスト + 必要に応じてユニットテスト）
8. ドキュメント更新（README.md、CLAUDE.md）

**完了条件**:
- 既存機能が全てReact版で動作する
- ユーザー体験が滑らか（アニメーション、フィードバック）
- エラーが適切にハンドリングされる

---

## 8. エッジケースと制約

### 8.1 エッジケース

#### 8.1.1 ワークスペースが空

**状況**: ワークスペースにセッションが1つもない

**表示**: ウェルカムメッセージ
```
┌─────────────────────────────────┐
│  このワークスペースは空です      │
│                                 │
│  [+ セッション追加]              │
│  または                          │
│  [⚡ ショートカットから開始]      │
└─────────────────────────────────┘
```

#### 8.1.2 最後のワークスペースを削除

**動作**: 削除をブロック、またはエラーメッセージ表示
```
最後のワークスペースは削除できません
```

#### 8.1.3 ドラッグ中に元の場所にドロップ

**動作**: レイアウト変更なし（何も起こらない）

#### 8.1.4 サーバー再起動時

**既存動作**: セッションは全て終了
**新動作**: ワークスペースとレイアウト情報は保持（config.jsonから復元）

**注意**: セッションの完全な復元（プロセス復元）はPhase 1-3では対象外（将来の拡張）

### 8.2 制約事項

#### 8.2.1 ブラウザ対応

- モダンブラウザのみ（Chrome、Edge、Firefox、Safari最新版）
- IE11は非対応

#### 8.2.2 ドッキング操作

- 最大ネスト深度: 制限なし（ただし、実用上は3-4階層まで推奨）
- 最小ペインサイズ: 100px（設定で変更可能）

#### 8.2.3 パフォーマンス

- 推奨ワークスペース数: 10以下
- 推奨セッション数（1ワークスペース内）: 10以下
- 同時表示ターミナル数: 6以下（それ以上はパフォーマンス低下の可能性）

---

## 9. 今後の拡張可能性

Phase 1-3では実装しないが、将来的に追加可能な機能：

### 9.1 タブグループ化

- 複数のターミナルを1つのペインにタブ表示
- ドロップゾーンの「Center」を実装

### 9.2 セッション復元

- サーバー再起動時にプロセスも復元
- tmuxのようなセッション永続化

### 9.3 ワークスペーステンプレート

- よく使うワークスペース構成をテンプレート化
- 「Railsプロジェクト」「React開発」などのプリセット

### 9.4 リモートセッション

- SSH接続でリモートサーバーのターミナルを表示
- WSL統合の強化

### 9.5 テーマカスタマイズ

- ダークモード・ライトモードの切り替え
- Tailwind CSSのカラーパレットカスタマイズ

---

## 10. 参考資料

### 10.1 類似プロダクト

- **VS Code**: ドッキングレイアウトのUX参考
- **Zellij**: Rust製ターミナルマルチプレクサー（ワークスペース概念）
- **tmux**: セッション管理のUX参考

### 10.2 技術ドキュメント

- [React公式ドキュメント](https://react.dev/)
- [Tailwind CSS 4ドキュメント](https://tailwindcss.com/docs)
- [dnd-kit公式ドキュメント](https://dndkit.com/)
- [xterm.js API](https://xtermjs.org/docs/)
- [Zustand GitHub](https://github.com/pmndrs/zustand)

---

## 11. 備考

### 11.1 既存機能の扱い

以下の既存機能は、Phase 1-3で実装する：

- ✅ セッション管理（作成・削除・再起動）
- ✅ ターミナル表示（xterm.js統合）
- ✅ ショートカット機能
- ✅ チャット入力欄（セッション間通信）
- ✅ 受信履歴パネル
- ✅ ターミナル設定（フォント等）

詳細な仕様は既存のCLAUDE.mdと現在の実装を参照。

### 11.2 実装時の注意点

- **段階的な動作確認**: 各Phaseで必ず動作確認を行い、次のPhaseに進む
- **型安全性**: TypeScriptの型を活用し、ランタイムエラーを防ぐ
- **パフォーマンス**: xterm.jsの`fit()`呼び出しを最小限に（リサイズ時のみ）
- **ユーザビリティ**: ドラッグ操作が直感的か、ドロップゾーンが分かりやすいか確認

---

**以上、wtermワークスペース機能実装仕様書（docs/layout-plan.md）**

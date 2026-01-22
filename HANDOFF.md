# wterm 開発引き継ぎドキュメント

**最終更新**: 2026-01-22
**現在のフェーズ**: Phase 2 Week 2 (Day 8-11完了) ✅
**次のステップ**: Phase 2 Week 2 Day 12-13（レイアウト更新ロジック実装）

---

## 📋 プロジェクト概要

**wterm** は、複数のAIエージェント（Claude Code、GitHub Copilot CLI、Codexなど）がコンソールアプリケーションとして相互にやり取りできるマルチセッションターミナル環境です。

**目標**: Vanilla JSからReactへ全面書き換え + ワークスペース機能 + VS Code風ドッキングレイアウトの実装

---

## ✅ Phase 1 完了状況

Phase 1（React基本機能）は**完全に実装済み**です。

### 実装済み機能

#### 環境セットアップ
- ✅ Vite + React 18 + TypeScript
- ✅ Tailwind CSS 4（正式版、`@theme`ディレクティブ使用）
- ✅ Zustand（状態管理）
- ✅ xterm.js（ターミナルUI）
- ✅ WebSocket通信（開発環境でlocalhost:3000に接続）

#### コンポーネント
- ✅ **Header** (`client/src/components/Header/Header.tsx`)
  - 新規セッション作成ボタン
  - ShortcutsMenu（ドロップダウン）
  - 設定ボタン（モック）
  - 接続状態表示

- ✅ **Sidebar** (`client/src/components/Sidebar/Sidebar.tsx`)
  - セッション一覧表示
  - セッション選択（クリック）
  - セッション削除（ホバー時表示）
  - アクティブセッションのハイライト

- ✅ **TerminalArea** (`client/src/components/TerminalArea/`)
  - `TerminalArea.tsx` - 単一ターミナル表示
  - `Terminal.tsx` - xterm.js統合、入出力、リサイズ対応
  - WebSocket経由の双方向通信

- ✅ **ChatPane** (`client/src/components/ChatPane/ChatPane.tsx`)
  - セッション間メッセージ送信
  - ブロードキャスト機能
  - メッセージ履歴表示（最新50件）
  - バッファ取得機能

- ✅ **StatusBar** (`client/src/components/StatusBar/StatusBar.tsx`)
  - セッション数表示
  - アクティブセッション情報
  - 接続状態
  - 現在時刻

#### Zustand Store (`client/src/store/index.ts`)
```typescript
interface AppState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  config: Config | null;
  wsConnection: WebSocket | null;
  isConnected: boolean;
  messages: Message[];

  // Actions: setSessions, addSession, removeSession, updateSessionStatus,
  // setActiveSession, addMessage, setMessages, setConfig, updateConfig,
  // setWebSocket, setConnected
}
```

#### WebSocket Hook (`client/src/hooks/useWebSocket.ts`)
- 開発環境: `ws://localhost:3000` に接続
- 本番環境: 同一ホストに接続
- 自動再接続は実装していない（手動リロード必要）
- メッセージタイプ処理: sessions, exit, message, error, output, history

---

## ✅ Phase 2 実装状況（進行中）

Phase 2（ワークスペース + ドラッキングレイアウト）の実装が進行中です。

### Week 1: ワークスペース基盤 ✅ 完了

#### Day 1-2: バックエンドAPI実装 ✅
- **型定義追加** (`src/types.ts`)
  - `Workspace` インターフェース（id, name, icon, sessions, layout, createdAt, updatedAt）
  - `LayoutNode` 型（terminal または split）
  - `Config` に workspaces と activeWorkspaceId を追加

- **ワークスペースAPI** (`src/server.ts`)
  - `GET /api/workspaces` - ワークスペース一覧取得
  - `POST /api/workspaces` - 新規ワークスペース作成
  - `PATCH /api/workspaces/:id` - ワークスペース更新（名前、レイアウト、セッションリスト）
  - `DELETE /api/workspaces/:id` - ワークスペース削除
  - `POST /api/workspaces/active` - アクティブワークスペース設定

- **マイグレーション** (`src/config.ts`)
  - 初回起動時にデフォルトワークスペース「メイン」を自動作成
  - 既存config.jsonの後方互換性維持

#### Day 3-4: Zustand状態管理 ✅
- **フロントエンド型定義** (`client/src/types/index.ts`)
  - バックエンドと同じWorkspace, LayoutNode型を追加

- **Zustandストア拡張** (`client/src/store/index.ts`)
  - `workspaces: Workspace[]`
  - `activeWorkspaceId: string | null`
  - `activeDragId: string | null` (ドラッグ状態管理)
  - アクション: setWorkspaces, addWorkspace, updateWorkspace, deleteWorkspace, setActiveWorkspace, updateLayout, setActiveDragId

- **App.tsx統合**
  - 起動時にワークスペース一覧をロード
  - アクティブワークスペースIDを復元

#### Day 5-6: サイドバーUI更新 ✅
- **新規コンポーネント**
  - `WorkspaceList.tsx` - ワークスペース一覧表示
  - `WorkspaceItem.tsx` - ワークスペース項目
    - 展開/折りたたみ機能（▶/▼アイコン）
    - ダブルクリックで名前インライン編集
    - ワークスペース削除ボタン（最後のワークスペースは削除不可）
    - 配下のセッション一覧表示
  - `AddWorkspaceButton.tsx` - 新規ワークスペース作成ボタン

- **Sidebar.tsx改修**
  - WorkspaceListを表示するシンプルな構造に変更

- **セッション作成の統合**
  - `Header.tsx` - 新規セッション作成時、アクティブワークスペースに自動追加
  - `ShortcutsMenu.tsx` - ショートカット実行時も同様

#### Day 7: レイアウトツリー基礎 ✅
- **レイアウトユーティリティ** (`client/src/utils/layoutTree.ts`)
  - `insertSessionIntoTree()` - セッションをツリーに挿入（4方向: top/bottom/left/right）
  - `removeSessionFromTree()` - セッションをツリーから削除
  - `simplifyTree()` - ツリーの簡略化（単一子ノードの除去、同方向分割の統合）
  - `getAllSessionIds()` - ツリー内の全セッションID取得
  - `hasSession()` - セッション存在確認

### Week 2: ドラッグ&ドロップ（進行中）

#### Day 8-9: dnd-kit統合 ✅
- **パッケージ**
  - `@dnd-kit/core` - 既にインストール済み
  - `@dnd-kit/sortable` - 既にインストール済み

- **App.tsx DndContext設定**
  - DndContextでアプリ全体をラップ
  - `handleDragStart()` - activeDragIdを設定
  - `handleDragEnd()` - ドロップ処理（TODO: レイアウト更新ロジックは未実装）
  - DragOverlay - ドラッグ中のセッション名をプレビュー表示

- **Terminal.tsx ドラッグ対応**
  - `useDraggable()` フック統合
  - ヘッダー部分（⋮⋮ アイコン）をドラッグハンドルに設定
  - `cursor-move` スタイル適用
  - ドラッグ中は `opacity-50` で半透明化

#### Day 10-11: DropZone実装 ✅
- **DropZoneコンポーネント** (`client/src/components/TerminalArea/DropZone.tsx`)
  - `useDroppable()` フック使用
  - 4方向（top, bottom, left, right）のドロップゾーン
  - ホバー時に青いハイライト（`bg-blue-500 bg-opacity-30`）
  - 位置ごとの絶対配置スタイル

- **Terminal.tsx DropZone統合**
  - `showDropZones` 条件判定（他のターミナルをドラッグ中のみ表示）
  - 4方向のDropZoneを条件付きレンダリング

- **動作確認完了**
  - ターミナルヘッダーをドラッグ可能
  - ドラッグ中のプレビュー表示
  - 他のターミナル上でドロップゾーンが表示される（将来の分割表示時）

#### Day 12-13: レイアウト更新ロジック 🚧 次のステップ
**未実装 - これから実装する機能:**
- App.tsx handleDragEnd()の完全実装
  - ドロップ位置判定
  - layoutTree.ts の insertSessionIntoTree() 呼び出し
  - 新しいレイアウトをワークスペースに保存
  - サーバーへの自動保存（500ms debounce）

- LayoutRendererコンポーネント作成
  - LayoutNodeを再帰的にレンダリング
  - type: 'terminal' → Terminal表示
  - type: 'split' → SplitPane表示

- SplitPaneコンポーネント作成
  - horizontal/vertical分割対応
  - sizes配列に基づいて子要素を配置

#### Day 14: SplitPane + リサイズ 🔜 未着手
- Dividerコンポーネント（マウスドラッグでリサイズ）
- sizes配列の更新処理

---

## 🏗️ プロジェクト構造

```
wterm/
├── client/                    # React フロントエンド
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header/       (Header.tsx, ShortcutsMenu.tsx)
│   │   │   ├── Sidebar/      (Sidebar.tsx, WorkspaceList.tsx, WorkspaceItem.tsx, AddWorkspaceButton.tsx)
│   │   │   ├── TerminalArea/ (TerminalArea.tsx, Terminal.tsx, DropZone.tsx)
│   │   │   ├── ChatPane/     (ChatPane.tsx)
│   │   │   └── StatusBar/    (StatusBar.tsx)
│   │   ├── store/            (index.ts - Zustand store)
│   │   ├── hooks/            (useWebSocket.ts)
│   │   ├── utils/            (layoutTree.ts - レイアウトツリー操作)
│   │   ├── types/            (index.ts - Workspace, LayoutNode 追加)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css         (Tailwind CSS 4)
│   ├── index.html
│   ├── vite.config.ts        (プロキシ設定: /api, /config, /ws → localhost:3000)
│   └── package.json
│
├── src/                       # Node.js バックエンド
│   ├── server.ts             (HTTP + WebSocket サーバー)
│   ├── sessions.ts           (セッション管理)
│   ├── config.ts             (設定管理)
│   └── types.ts              (TypeScript型定義)
│
├── bin/                       # CLI ツール（変更なし）
│   ├── wterm-send.js, wterm-send.cmd, wterm-send
│   ├── wterm-broadcast.js, wterm-broadcast.cmd, wterm-broadcast
│   └── wterm-list.js, wterm-list.cmd, wterm-list
│
├── public.old/                # 旧 Vanilla JS版（バックアップ）
├── dist/client/               # ビルド出力先
├── config.json                # 設定ファイル
├── package.json               # ルートpackage.json（開発スクリプト）
├── plan.md                    # Phase 2 & 3 詳細計画
├── HANDOFF.md                 # このファイル
├── CLAUDE.md                  # プロジェクト技術仕様
└── README.md
```

---

## 🚀 開発環境

### 起動方法

```bash
# バックエンド + フロントエンドを同時起動（推奨）
npm run dev

# 別々に起動する場合
npm run dev:backend  # Node.js サーバー (localhost:3000)
npm run dev:client   # Vite dev server (localhost:5173)
```

### アクセスURL
- **開発**: http://localhost:5173+ （Vite dev server - ポートが使用中の場合は自動的に次の空きポートを使用）
- **本番**: http://localhost:3000 （ビルド後、Node.jsが配信）
- **バックエンド**: http://localhost:3000 （常に固定）

### ビルド
```bash
npm run build:client  # client/ をビルド → dist/client/
npm run build         # 同上
npm start             # ビルド + Node.js起動
```

### 依存関係
**フロントエンド** (`client/package.json`):
- react@18, react-dom@18
- zustand@4
- xterm@5, xterm-addon-fit, xterm-addon-web-links
- tailwindcss@latest, @tailwindcss/vite@latest
- vite@5, @vitejs/plugin-react

**バックエンド** (`package.json`):
- node-pty@1
- ws@8
- tsx@4, typescript@5
- concurrently@9

---

## ⚠️ 重要な技術的決定と注意事項

### 1. Tailwind CSS 4の設定
- ❌ **設定ファイル不要** - `tailwind.config.ts`は削除済み
- ✅ **CSSで直接カスタマイズ** - `client/src/index.css`の`@theme`ディレクティブ使用
```css
@import "tailwindcss";

@theme {
  --color-terminal-bg: #1e1e1e;
  --color-terminal-fg: #cccccc;
}
```

### 2. WebSocket接続
- 開発環境では `ws://localhost:3000` に直接接続（Viteプロキシ経由ではない）
- `import.meta.env.DEV` で環境判定
- 無限リロードループ対策済み（依存配列を正しく設定）

### 3. Zustand の使い方
- ❌ `const { foo, bar } = useStore()` - 再レンダリング多発
- ✅ `const foo = useStore((state) => state.foo)` - セレクター関数推奨
- useEffect の依存配列にも個別に指定

### 4. TypeScript型共有
- `client/src/types/index.ts` は `src/types.ts` のコピー
- シンボリックリンクではなくコピーを使用（Windows環境の互換性）
- 変更時は手動でコピーが必要

### 5. xterm.js の使用
- 非推奨の `xterm@5` を使用（`@xterm/xterm` ではない）
- ビルド時に警告が出るが動作に問題なし
- `xterm/css/xterm.css` のインポートが必須

---

## 🐛 既知の問題と解決済み

### 解決済み
- ✅ WebSocket無限リロードループ → useStoreのセレクター関数使用で解決
- ✅ Tailwind CSS 4ビルドエラー → 設定ファイル削除、@theme使用で解決
- ✅ WebSocket接続先が間違っている → 開発環境でlocalhost:3000に直接接続

### 未解決（Phase 2で対応予定）
- ⚠️ 自動再接続機能未実装（WebSocket切断時は手動リロード必要）
- ⚠️ ワークスペース機能未実装
- ⚠️ ドラッグ&ドロップレイアウト未実装

---

## 📝 次のステップ: Phase 2実装

**詳細**: `plan.md` を参照

### Phase 2の目標（2週間）
1. **Week 1**: ワークスペース基盤
   - バックエンドAPI実装（`/api/workspaces`）
   - Zustand storeにworkspace状態追加
   - サイドバーUIをワークスペース対応に改修

2. **Week 2**: ドラッグ&ドロップ
   - dnd-kit統合
   - LayoutRenderer（再帰的レイアウト描画）
   - DropZone（4方向ドロップ）
   - SplitPane + リサイズ機能

### Phase 2開始前の確認事項
1. ✅ Phase 1が正常に動作している
2. ✅ WebSocket接続が安定している
3. ✅ 既存機能（セッション管理、チャット）が動作している
4. ⚠️ 開発サーバーが起動している（`npm run dev`）

---

## 🔧 トラブルシューティング

### 開発サーバーが起動しない
```bash
# ポートが使用中の場合
netstat -ano | findstr :3000
netstat -ano | findstr :5173
# プロセスをkillしてから再起動
```

### ビルドエラー
```bash
# 依存関係を再インストール
cd client && rm -rf node_modules && npm install
cd .. && rm -rf node_modules && npm install
```

### WebSocket接続エラー
1. バックエンドが起動しているか確認（`http://localhost:3000`）
2. ブラウザコンソールで接続状態確認（F12）
3. `client/src/hooks/useWebSocket.ts` の接続先確認

### Tailwind CSSが効かない
1. `@import "tailwindcss";` が `client/src/index.css` にあるか確認
2. `client/vite.config.ts` に `tailwindcss()` プラグインがあるか確認
3. 開発サーバーを再起動

---

## 📚 参考ドキュメント

- **CLAUDE.md** - プロジェクト技術仕様（Phase 1時点の内容）
- **plan.md** - Phase 2 & 3 詳細実装計画
- **docs/layout-plan.md** - 元々の要件定義（ワークスペース機能の仕様）
- **README.md** - ユーザー向け使用方法

---

## 🎯 引き継ぎ後の最初の作業

### Phase 2を開始する場合

1. **現在の動作確認**
   ```bash
   npm run dev
   # http://localhost:5173 を開く
   # セッション作成・削除・切り替えが動作するか確認
   ```

2. **plan.mdを読む**
   - Phase 2の詳細な実装手順を確認
   - Week 1 Day 1-2から開始

3. **バックエンドAPIから実装開始**
   ```bash
   # src/types.ts に Workspace, LayoutNode 型を追加
   # src/server.ts にワークスペースAPIを追加
   # src/config.ts にマイグレーションを追加
   ```

### バグ修正や改善を行う場合

1. **既存コードの確認**
   ```bash
   # 主要ファイルを確認
   client/src/App.tsx
   client/src/store/index.ts
   client/src/hooks/useWebSocket.ts
   ```

2. **問題の特定**
   - ブラウザコンソール（F12）でエラー確認
   - 開発サーバーのログ確認
   - `npm run build` でビルドエラー確認

3. **修正後のテスト**
   ```bash
   npm run build:client  # ビルドが通るか確認
   ```

---

## 💡 開発のヒント

### コンポーネント作成時
- 既存コンポーネントのスタイルを参考にする（Tailwind CSS使用）
- Zustandは必ずセレクター関数で取得
- TypeScript型は `client/src/types/index.ts` から import

### API追加時
- `src/server.ts` の `handleApiRequest()` にルーティング追加
- CORS ヘッダーを忘れずに設定
- エラーハンドリングを適切に実装

### デバッグ方法
- ブラウザ DevTools (F12) - React DevTools, Network, Console
- `console.log()` でデバッグ（本番前に削除）
- Zustand DevTools で状態確認（Reduxと同様）

---

## ✅ Phase 1 完了チェックリスト

- [x] React 18 + Vite環境構築
- [x] Tailwind CSS 4設定
- [x] Zustand状態管理実装
- [x] WebSocket通信実装
- [x] xterm.js統合
- [x] Header実装（セッション作成、ショートカット）
- [x] Sidebar実装（セッション一覧）
- [x] TerminalArea実装（入出力）
- [x] ChatPane実装（メッセージング）
- [x] StatusBar実装
- [x] ビルド成功確認
- [x] 開発サーバー起動確認
- [x] 旧Vanilla JS版をバックアップ（public.old/）

---

## 🎯 次回の開始ポイント

### 現在の状況
- ✅ Phase 2 Week 1 完了（ワークスペース基盤）
- ✅ Phase 2 Week 2 Day 8-11 完了（dnd-kit統合、ドラッグ&ドロップ基本機能）
- 🚧 Phase 2 Week 2 Day 12-13（レイアウト更新ロジック）← **次はここから**

### 開発サーバー起動
```bash
npm run dev
# バックエンド: http://localhost:3000
# フロントエンド: http://localhost:5173+ （空きポートを自動検出）
```

### 次に実装する機能（Day 12-13）

1. **LayoutRendererコンポーネント作成** (`client/src/components/TerminalArea/LayoutRenderer.tsx`)
   - LayoutNodeを再帰的にレンダリング
   - type: 'terminal' → Terminal表示
   - type: 'split' → SplitPane表示

2. **SplitPaneコンポーネント作成** (`client/src/components/TerminalArea/SplitPane.tsx`)
   - horizontal/vertical分割対応
   - sizes配列に基づいてflexレイアウト

3. **App.tsx handleDragEnd()完全実装**
   - ドロップ位置判定（over.data.current.position）
   - insertSessionIntoTree()呼び出し
   - updateLayout()でワークスペースに保存
   - サーバーにPATCH（500ms debounce推奨）

4. **TerminalArea.tsx更新**
   - 単一ターミナル表示からLayoutRenderer表示に変更
   - アクティブワークスペースのlayoutを参照

### 実装参考
- `client/src/utils/layoutTree.ts` - レイアウトツリー操作関数
- `plan.md` Day 12-13セクション - 詳細実装手順

---

**Phase 2 Week 2実装中！Day 12-13から継続してください。**

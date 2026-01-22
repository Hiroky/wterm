# CLAUDE.md - wtermプロジェクト開発ガイド

このドキュメントは、Claude CodeがwtermプロジェクトをAIエージェントとして開発・保守する際に必要な技術情報をまとめたものです。

## プロジェクト概要

**wterm**は、複数のAIエージェント（Claude Code、GitHub Copilot CLI、Codexなど）がコンソールアプリケーションとして相互にやり取りできるマルチセッションターミナル環境です。

**重要**: 2026年1月にVanilla JSから**React + TypeScript**への全面書き換えを実施。Phase 2（ワークスペース + ドラッグ&ドロップレイアウト）を実装中。

### 主な特徴

- **マルチセッション管理** - 複数の独立したターミナルセッション
- **セッション間通信** - 専用コマンド（`wterm-send`, `wterm-broadcast`）によるメッセージ送受信
- **ワークスペース機能** - セッションをワークスペース単位で管理
- **ドラッグ&ドロップレイアウト** - VS Code風の分割ビュー（実装中）
- **ブラウザベースUI** - React + xterm.js + Tailwind CSS 4

### ターゲット環境

- **OS**: Windows 10/11専用（WSL対応）
- **Node.js**: v18以上
- **シェル**: PowerShell（node-ptyで起動）

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────┐
│  開発: http://localhost:5173+      │
│  本番: http://localhost:3000       │
│  ┌─────────────────────────────┐   │
│  │  React 18 + Vite            │   │
│  │  ├─ Zustand (状態管理)      │   │
│  │  ├─ xterm.js (ターミナルUI) │   │
│  │  ├─ dnd-kit (D&D)          │   │
│  │  └─ Tailwind CSS 4         │   │
│  └─────────────────────────────┘   │
└──────────┬──────────────────────────┘
           │ WebSocket (ws://localhost:3000)
┌──────────▼──────────────────────────┐
│  Node.js バックエンド (:3000)      │
│  ├─ HTTP/WebSocket サーバー        │
│  ├─ REST API (/api/*, /config)     │
│  └─ セッション管理 (node-pty)      │
└─────────────────────────────────────┘
```

### ディレクトリ構成

```
wterm/
├── client/                 # React フロントエンド
│   ├── src/
│   │   ├── components/     # Header, Sidebar, TerminalArea, ChatPane, StatusBar
│   │   ├── store/          # Zustand store
│   │   ├── hooks/          # useWebSocket
│   │   ├── utils/          # layoutTree
│   │   ├── types/          # 型定義（src/types.tsのコピー）
│   │   └── App.tsx
│   └── vite.config.ts
├── src/                    # Node.js バックエンド
│   ├── server.ts           # HTTP/WebSocket + REST API
│   ├── sessions.ts         # セッション管理（PTY）
│   ├── config.ts           # 設定管理
│   └── types.ts            # 型定義（共通）
├── bin/                    # CLI ツール（wterm-send, wterm-broadcast, wterm-list）
├── dist/client/            # ビルド出力先
├── config.json             # 設定ファイル
├── HANDOFF.md              # 開発引き継ぎドキュメント
└── plan.md                 # Phase 2 & 3 詳細計画
```

## 技術スタック

### フロントエンド
- **React 19** + **TypeScript** - UI
- **Vite 5** - ビルドツール
- **Zustand 5** - 状態管理
- **Tailwind CSS 4** - スタイリング（`@theme`使用、設定ファイル不要）
- **xterm.js 5** - ターミナルUI
- **dnd-kit** - ドラッグ&ドロップ

### バックエンド
- **Node.js** + **TypeScript**
- **node-pty 1.0** - 疑似端末（PTY）管理
- **ws 8** - WebSocketサーバー
- **tsx 4** - TypeScript実行環境

### ネットワーク
- バックエンド: `0.0.0.0:3000`
- Vite dev: `localhost:5173+` (ポート自動検出)
- WebSocket: `ws://localhost:3000` (開発環境は直接接続)

## 開発フロー

### 起動方法

```bash
# バックエンド + フロントエンドを同時起動（推奨）
npm run dev

# 別々に起動
npm run dev:backend  # Node.js (localhost:3000)
npm run dev:client   # Vite (localhost:5173+)
```

**重要:** 開発中は基本的に開発ユーザーがnpm run devをすでに起動中であるため勝手に起動するとポート競合を引き起こすため勝手に開発サーバーを起動しないこと

### アクセスURL
- **開発**: http://localhost:5173+
- **本番**: http://localhost:3000

### ビルド

```bash
npm run build        # フロントエンドビルド (client/ → dist/client/)
npm start            # ビルド + バックエンド起動
```

## 主要コンポーネント

### 1. Zustand状態管理 (`client/src/store/index.ts`)

```typescript
interface AppState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeDragId: string | null;      // ドラッグ&ドロップ
  messages: Message[];
  config: Config | null;
  wsConnection: WebSocket | null;
  isConnected: boolean;
}
```

**重要**: セレクター関数を使用して不要な再レンダリングを防止
```typescript
// ❌ 非推奨（再レンダリング多発）
const { sessions, activeSessionId } = useStore();

// ✅ 推奨
const sessions = useStore((state) => state.sessions);
const activeSessionId = useStore((state) => state.activeSessionId);
```

### 2. ワークスペース機能

```typescript
interface Workspace {
  id: string;
  name: string;
  icon: string;
  sessions: string[];        // セッションID配列
  layout: LayoutNode | null; // レイアウトツリー（実装中）
  createdAt: string;
  updatedAt: string;
}

type LayoutNode =
  | { type: 'terminal'; sessionId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; children: LayoutNode[]; sizes: number[] };
```

### 3. HTTP API

#### セッションAPI
- `GET /api/sessions` - 一覧取得
- `POST /api/sessions` - 作成
- `DELETE /api/sessions/:id` - 削除

#### ワークスペースAPI (Phase 2)
- `GET /api/workspaces` - 一覧取得
- `POST /api/workspaces` - 作成
- `PATCH /api/workspaces/:id` - 更新（名前、レイアウト、セッション）
- `DELETE /api/workspaces/:id` - 削除
- `POST /api/workspaces/active` - アクティブ設定

### 4. セッション間通信

**CLIコマンド** (`bin/`)
```powershell
wterm-send session-2 メッセージ      # 特定セッションへ送信
wterm-broadcast メッセージ           # 全セッションへ送信
wterm-list                          # セッション一覧
```

**内部コマンド** (セッション内)
```
/send session-2 メッセージ
/broadcast メッセージ
/list
/help
```

## 重要な技術的決定

### 1. Tailwind CSS 4

**設定ファイル不要** - `client/src/index.css`に直接記述

```css
@import "tailwindcss";

@theme {
  --color-terminal-bg: #1e1e1e;
  --color-terminal-fg: #cccccc;
}
```

**Vite設定** (`client/vite.config.ts`):
```typescript
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### 2. WebSocket接続

- 開発環境: `ws://localhost:3000`に**直接接続**（Viteプロキシ不可）
- `useWebSocket.ts`で`import.meta.env.DEV`により環境判定
- 自動再接続は未実装（手動リロード必要）

### 3. TypeScript型共有

- `client/src/types/index.ts`は`src/types.ts`のコピー
- シンボリックリンクではなくコピー使用（Windows互換性）
- **変更時は手動でコピーが必要**

### 4. xterm.js

- `xterm@5`使用（非推奨だが動作可）
- `xterm/css/xterm.css`のインポートが必須

### 5. Windows特有の問題

#### node-pty Socket closedエラー
- PowerShell終了時に`ERR_SOCKET_CLOSED`発生
- 正常動作として無視（`attachPtyErrorHandler()`で処理）

#### 環境変数設定
```typescript
pty.spawn('powershell.exe', [
  '-NoLogo', '-NoProfile', '-NoExit', '-Command',
  `$env:PATH += ';${binPath}'; $env:WTERM_API_URL = '${apiUrl}'; ...`
], { ... })
```

## トラブルシューティング

### 開発サーバーが起動しない
```bash
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```

### Zustandの無限レンダリング
セレクター関数を使用
```typescript
const foo = useStore((state) => state.foo);
```

### Tailwind CSSが効かない
1. `@import "tailwindcss";`が`client/src/index.css`にあるか確認
2. `tailwind.config.ts`が存在する場合は削除
3. 開発サーバーを再起動

### WebSocket接続エラー
1. バックエンドが起動しているか確認（`http://localhost:3000`）
2. `useWebSocket.ts`で`ws://localhost:3000`に接続しているか確認

### ビルドエラー
```bash
cd client && rm -rf node_modules && npm install
cd .. && rm -rf node_modules && npm install
```

## 開発ロードマップ

### Phase 1: React基本機能 ✅ 完了（2026-01-21）
- React 18 + Vite + TypeScript環境構築
- Tailwind CSS 4設定
- Zustand状態管理実装
- WebSocket通信、xterm.js統合
- 基本コンポーネント実装

### Phase 2: ワークスペース + ドラッグ&ドロップ 🚧 進行中
- **Week 1**: ワークスペース基盤 ✅ 完了
  - バックエンドAPI実装
  - Zustand store拡張
  - サイドバーUI更新

- **Week 2**: ドラッグ&ドロップ 🚧 進行中
  - Day 8-11: dnd-kit統合、基本機能 ✅ 完了
  - Day 12-13: レイアウト更新ロジック 🚧 **次のステップ**
  - Day 14: SplitPane + リサイズ 🔜 未着手

### Phase 3: 高度な機能 🔜 計画中
- タブ機能、テーマシステム、設定画面

## 参考リンク

### フロントエンド
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Zustand](https://docs.pmnd.rs/zustand)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [xterm.js](https://xtermjs.org/)
- [dnd-kit](https://dndkit.com/)

### バックエンド
- [node-pty](https://github.com/microsoft/node-pty)
- [ws](https://github.com/websockets/ws)

---

**最終更新**: 2026-01-22
**対象バージョン**: wterm 2.0.0 (React版)
**Phase**: Phase 2 Week 2 進行中

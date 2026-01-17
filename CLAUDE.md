# CLAUDE.md - wtermプロジェクト開発ガイド

このドキュメントは、Claude CodeがwtermプロジェクトをAIエージェントとして開発・保守する際に必要な技術情報をまとめたものです。

## プロジェクト概要

**wterm**は、複数のAIエージェント（Claude Code、GitHub Copilot CLI、Codexなど）がコンソールアプリケーションとして相互にやり取りできるマルチセッションターミナル環境です。

### 主な特徴

- マルチセッション管理（複数の独立したターミナルセッション）
- セッション間通信（専用コマンドによるメッセージ送受信）
- ブラウザベースUI（xterm.js）
- セッション永続化（サーバープロセス実行中）
- ショートカット機能

### ターゲット環境

- **OS**: Windows 10/11専用
- **Node.js**: v18以上
- **シェル**: PowerShell（node-ptyで起動）

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────┐
│  ブラウザ (http://localhost:3000)      │
│  ┌───────────────────────────────────┐ │
│  │  xterm.js (ターミナルUI)         │ │
│  │  WebSocket Client                │ │
│  └───────────────────────────────────┘ │
└─────────────────┬───────────────────────┘
                  │ WebSocket
┌─────────────────▼───────────────────────┐
│  Node.js サーバー (src/server.ts)      │
│  ┌───────────────────────────────────┐ │
│  │  HTTPサーバー (静的ファイル配信) │ │
│  │  WebSocketサーバー (リアルタイム)│ │
│  └───────────────────────────────────┘ │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  セッション管理 (src/sessions.ts)      │
│  ┌───────────────────────────────────┐ │
│  │  node-pty (PTY管理)              │ │
│  │  PowerShell プロセス × N         │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### レイヤー構造

1. **プレゼンテーション層** (`public/`)
   - `index.html`: メインHTML
   - `app.js`: クライアントアプリロジック
   - `style.css`: スタイルシート
   - xterm.jsによるターミナルレンダリング

2. **アプリケーション層** (`src/`)
   - `server.ts`: HTTPサーバー + WebSocketサーバー
   - `sessions.ts`: セッション管理、PTY管理、メッセージング
   - `config.ts`: 設定ファイル管理
   - `types.ts`: TypeScript型定義

3. **CLI層** (`bin/`)
   - `wterm-send.js`: 特定セッションへメッセージ送信
   - `wterm-broadcast.js`: 全セッションへブロードキャスト
   - `wterm-list.js`: セッション一覧表示

## 技術スタック

### コア依存関係

```json
{
  "dependencies": {
    "node-pty": "^1.0.0",  // 疑似端末（PTY）管理
    "ws": "^8.16.0"        // WebSocketサーバー
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0",       // TypeScript実行環境
    "typescript": "^5.0.0"
  }
}
```

### TypeScript設定

- **ターゲット**: ES2022
- **モジュール**: ESNext（ESModules使用）
- **モジュール解決**: bundler
- **厳格モード**: 有効

### 実行環境

- **推奨ランタイム**: Node.js（tsxで実行）
- **実験的サポート**: Bun（Windows環境ではnode-ptyの入力エコー問題あり）

## 主要コンポーネント詳細

### 1. セッション管理 (`src/sessions.ts`)

#### セッションライフサイクル

```typescript
createSession(command?: string)
  ↓
  node-ptyでPowerShellプロセス起動
  ↓
  環境変数設定（WTERM_API_URL, WTERM_SESSION_ID, PATH）
  ↓
  PTYイベントハンドラ設定（onData, onExit, error）
  ↓
  セッションマップに登録
  ↓
  初期コマンド実行（あれば）
```

#### 重要な実装ポイント

**環境変数の設定**
- `WTERM_API_URL`: APIエンドポイント（例: `http://localhost:3000`）
- `WTERM_SESSION_ID`: セッション識別子（例: `session-1`）
- `PATH`: binディレクトリを追加（CLIコマンドを利用可能にする）

**PTY初期化タイミング**
- PTYからの最初のデータ出力で初期化完了と判断
- タイムアウト（1秒）でフォールバック処理
- 理由: WebSocketクライアントへのセッション一覧通知タイミング制御

**エラーハンドリング**
- `ERR_SOCKET_CLOSED`エラーは無視（Windows特有の既知の問題）
- 予期しないエラーのみログ出力
- エラーリスナーを2つ設定（node-pty Windows版の要件）

**入力バッファリング**
- 内部コマンド（`/send`, `/broadcast`, `/list`, `/help`）の検出
- Enterキー押下時にコマンド判定
- バックスペース処理

### 2. WebSocket通信 (`src/server.ts`)

#### メッセージ型

**クライアント → サーバー**
```typescript
type ClientMessage =
  | { type: 'attach'; sessionId: string }
  | { type: 'input'; sessionId: string; data: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'detach'; sessionId: string }
```

**サーバー → クライアント**
```typescript
type ServerMessage =
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'sessions'; sessions: SessionInfo[] }
  | { type: 'message'; message: Message }
  | { type: 'exit'; sessionId: string; exitCode: number }
  | { type: 'error'; message: string }
  | { type: 'history'; sessionId: string; data: string }
```

#### 接続管理

- クライアントごとに接続されているセッションを追跡（`attachedSessions: Set<string>`）
- セッションごとに接続しているクライアントを追跡（`connectedClients: Set<string>`）
- 双方向参照で効率的なメッセージルーティング

### 3. HTTP API (`src/server.ts`)

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/sessions` | GET | セッション一覧取得 |
| `/api/sessions` | POST | 新規セッション作成 |
| `/api/sessions/:id` | DELETE | セッション削除 |
| `/api/sessions/:id/restart` | POST | セッション再起動 |
| `/api/send` | POST | メッセージ送信 |
| `/api/history` | GET | メッセージ履歴取得 |
| `/config` | GET | 設定取得 |
| `/config` | POST | 設定更新 |

**CORS対応**: すべてのAPIで`Access-Control-Allow-Origin: *`

### 4. セッション間通信

#### CLIコマンド方式

セッション内から以下のコマンドが利用可能：

```powershell
# 特定セッションへ送信
wterm-send session-2 メッセージ内容

# 全セッションへブロードキャスト
wterm-broadcast メッセージ内容

# セッション一覧表示
wterm-list
```

**実装メカニズム**:
1. `bin/`配下のNode.jsスクリプトとして実装
2. 環境変数`WTERM_API_URL`と`WTERM_SESSION_ID`を使用
3. HTTP API（`/api/send`）にPOSTリクエスト
4. サーバーがターゲットセッションのPTYに書き込み

#### 内部コマンド方式

セッション内から`/`プレフィックスで実行：

```
/send session-2 メッセージ
/broadcast メッセージ
/list
/help
```

**実装メカニズム**:
- `sessions.ts`の`handleInternalCommand()`で処理
- 入力バッファを監視してコマンド検出
- Enter押下時に判定・実行

### 5. 設定管理 (`src/config.ts`)

#### 設定ファイル構造 (`config.json`)

```typescript
interface Config {
  port: number;              // サーバーポート（デフォルト: 3000）
  maxHistorySize: number;    // メッセージ履歴の最大数
  bufferSize: number;        // セッション出力バッファサイズ
  shortcuts: Shortcut[];     // ショートカット定義
  uiLayout: UILayout;        // UIレイアウト設定
}
```

#### ショートカット機能

設定ファイルで定義されたコマンドをワンクリックで実行可能：

```json
{
  "id": "claude",
  "name": "Claude Code",
  "command": "claude",
  "icon": "🤖"
}
```

## 開発時の重要な考慮事項

### Windows特有の問題

1. **node-ptyのSocket closedエラー**
   - PowerShellプロセス終了時に`ERR_SOCKET_CLOSED`が発生
   - これは正常動作の一部として無視する必要がある
   - `attachPtyErrorHandler()`で処理

2. **環境変数の設定方法**
   - node-ptyの`env`オプションだけでは不十分
   - PowerShell起動時に`-Command`で明示的に設定
   ```typescript
   pty.spawn('powershell.exe', [
     '-NoLogo', '-NoProfile', '-NoExit', '-Command',
     `$env:PATH += ';${binPath}'; $env:WTERM_API_URL = '${apiUrl}'; ...`
   ], { ... })
   ```

3. **PATHの追加**
   - `bin/`ディレクトリをPATHに追加してCLIコマンドを利用可能にする
   - セミコロン区切りで追加（Windows形式）

### タイミングとレースコンディション

1. **PTY初期化待機**
   - PTYからの最初の出力まで待つ
   - 1秒のタイムアウトでフォールバック
   - セッション一覧の早すぎる通知を防ぐ

2. **コマンド実行の遅延**
   - セッション作成時のコマンド実行は500ms遅延
   - 理由: PowerShellの初期化完了を待つため

### エラーハンドリング

1. **グローバルエラーハンドラ**
   ```typescript
   process.on('uncaughtException', (err) => {
     if (isSocketClosedError(err)) return; // 無視
     console.error('未処理例外:', err);
   });
   ```

2. **安全な書き込み**
   - `safeWrite()`関数でPTY書き込みをラップ
   - エラー時は`session.status = 'exited'`に設定
   - Socket closedエラーは静かに失敗

### バッファ管理

1. **出力バッファ**
   - セッションごとに`outputBuffer: string[]`を保持
   - `bufferSize`（デフォルト10000文字）を超えたら古いデータを削除
   - 新規接続クライアントへの履歴送信に使用

2. **メッセージ履歴**
   - グローバルな`messageHistory: Message[]`
   - `maxHistorySize`（デフォルト50）を超えたら古いメッセージを削除

## ファイル構成

```
wterm/
├── src/
│   ├── server.ts       # メインサーバー（HTTP + WebSocket）
│   ├── sessions.ts     # セッション管理、PTY管理
│   ├── config.ts       # 設定ファイル管理
│   └── types.ts        # TypeScript型定義
├── public/
│   ├── index.html      # メインHTML
│   ├── app.js          # クライアントアプリ
│   └── style.css       # スタイルシート
├── bin/
│   ├── wterm-send.js        # セッション間送信コマンド
│   ├── wterm-send.cmd       # Windows用ラッパー
│   ├── wterm-broadcast.js   # ブロードキャストコマンド
│   ├── wterm-broadcast.cmd  # Windows用ラッパー
│   ├── wterm-list.js        # セッション一覧コマンド
│   └── wterm-list.cmd       # Windows用ラッパー
├── config.json         # 設定ファイル
├── package.json
├── tsconfig.json
├── start.cmd           # 起動スクリプト
└── README.md
```

## 開発フロー

### 起動方法

```bash
# Node.js（推奨）
npm start

# 開発モード（自動再起動）
npm run dev

# Bun（実験的）
npm run start:bun
```

### ビルド

現在ビルドステップなし（tsxでTypeScriptを直接実行）

### デバッグ

1. **サーバーログ**
   - `console.log()`でターミナルに出力
   - セッション作成/削除、WebSocket接続/切断をログ

2. **ブラウザDevTools**
   - WebSocketメッセージの監視
   - xterm.jsのデバッグ

3. **環境変数の確認**
   - セッション内で`$env:WTERM_API_URL`などを確認

## よくある開発タスク

### 新しいAPIエンドポイントの追加

1. `src/types.ts`にリクエスト/レスポンス型を定義
2. `src/server.ts`の`handleApiRequest()`にルーティング追加
3. 必要に応じて`src/sessions.ts`にロジック実装

### 新しい内部コマンドの追加

1. `src/sessions.ts`の`handleInternalCommand()`に処理追加
2. `/help`コマンドの出力にヘルプテキスト追加

### 新しいWebSocketメッセージタイプの追加

1. `src/types.ts`の`ClientMessage`または`ServerMessage`に型追加
2. `src/server.ts`の`handleWebSocketMessage()`に処理追加
3. クライアント（`public/app.js`）に対応する処理を実装

### ショートカットの追加

UIから追加するか、`config.json`を直接編集：

```json
{
  "id": "custom-tool",
  "name": "My Tool",
  "command": "mytool --flag",
  "icon": "⚡"
}
```

## トラブルシューティング

### PTY入力が反映されない

- PowerShellの初期化が完了していない可能性
- `sessions.ts`のコマンド実行遅延（500ms）を調整

### セッション間通信ができない

1. 環境変数が正しく設定されているか確認
   ```powershell
   echo $env:WTERM_API_URL
   echo $env:WTERM_SESSION_ID
   echo $env:PATH
   ```
2. APIサーバーが起動しているか確認
3. CORSエラーがないか確認

### WebSocket接続が切れる

- ブラウザのDevToolsでWebSocketステータス確認
- サーバーログで`WebSocket切断`メッセージ確認
- ファイアウォール設定確認

### Bunで入力エコーが動作しない

- Windows環境ではnode-ptyとBunの互換性問題
- Node.js（tsx）での実行を推奨

## セキュリティ考慮事項

1. **パストラバーサル防止**
   - `serveStaticFile()`で`publicDir`外へのアクセス禁止

2. **XSS対策**
   - ターミナル出力はxterm.jsが適切にエスケープ
   - 設定ファイルの入力検証は未実装（内部ツールのため）

3. **CORS**
   - 開発用途のため`*`許可
   - 本番環境では適切に制限すべき

4. **認証/認可**
   - 現在未実装
   - ローカルホスト専用の想定

## パフォーマンス最適化

1. **バッファサイズ調整**
   - `config.json`の`bufferSize`を調整
   - 大量出力時のメモリ使用量とのトレードオフ

2. **履歴サイズ制限**
   - `maxHistorySize`でメモリ使用量を制御

3. **WebSocket圧縮**
   - 現在未実装
   - 必要に応じて`ws`のperMessageDeflate設定

## 拡張ポイント

### 将来的な機能追加の候補

1. **セッション永続化**
   - サーバー再起動時のセッション復元
   - ファイルシステムまたはDBへの保存

2. **認証機能**
   - マルチユーザー対応
   - セッション分離

3. **プラグインシステム**
   - カスタムコマンドの動的追加
   - セッション間通信の拡張

4. **分割ビュー**
   - 複数セッションの同時表示
   - `config.json`の`defaultView: 'split'`の実装

5. **ログ記録**
   - セッション出力のファイル保存
   - 検索・再生機能

6. **リモートセッション**
   - SSH接続
   - WSL統合

## コーディング規約

### TypeScript

- 厳格モード有効
- 明示的な型注釈を推奨（interfaceで定義）
- `any`は最小限（node-pty型定義の不完全性により許容）

### 命名規則

- ファイル名: kebab-case（例: `wterm-send.js`）
- 関数名: camelCase（例: `createSession`）
- 型名: PascalCase（例: `SessionInfo`）
- 定数: UPPER_SNAKE_CASE（例: `CONFIG_PATH`）

### エラーハンドリング

- try-catchで捕捉
- 既知のエラー（Socket closed）は無視
- 予期しないエラーはログ出力
- ユーザーへのエラーメッセージは日本語

### ログ出力

- サーバー起動/停止: 必須
- セッション作成/削除: 必須
- WebSocket接続/切断: 必須
- メッセージ送信: オプション（デバッグ用）
- 既知エラー: 出力不要
- 予期しないエラー: 必須

## 参考リンク

- [node-pty](https://github.com/microsoft/node-pty) - PTYライブラリ
- [ws](https://github.com/websockets/ws) - WebSocketライブラリ
- [xterm.js](https://xtermjs.org/) - ターミナルUIライブラリ
- [tsx](https://github.com/esbuild-kit/tsx) - TypeScript実行環境

---

**最終更新**: 2026-01-17
**対象バージョン**: wterm 1.0.0

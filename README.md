# wterm - マルチセッションターミナル

複数のAIエージェント（Claude Code、GitHub Copilot CLI、Codexなど）がコンソールアプリケーションとして相互にやり取りできるマルチセッションターミナル環境です。

## 特徴

- 🖥️ **マルチセッション管理**: 複数の独立したターミナルセッションを作成・管理
- 📨 **セッション間通信**: 専用コマンドによるセッション間のメッセージ送受信
- 🌐 **ブラウザUI**: xterm.jsによるターミナル表示とレイアウト管理
- 💾 **セッション永続化**: サーバープロセス実行中はセッションを維持
- ⚡ **ショートカット機能**: よく使うコマンドをワンクリックで実行

## 必要条件

- Windows 10/11
- [Node.js](https://nodejs.org/) v18以上

## インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd wterm

# 依存関係をインストール
npm install
```

## 使い方

### 起動

```bash
# 方法1: バッチファイルで実行（推奨）
start.bat

# 方法2: ビルド込みで起動
start.bat --build
```

サーバーが起動すると、自動的にブラウザが開きます（http://localhost:3000）。

### 基本操作

1. **新規セッション作成**: 「+ 新規セッション」ボタンをクリック
2. **ショートカット**: 「ショートカット」メニューから選択（Claude Code、Copilot CLI等）
3. **セッション切り替え**: タブまたはサイドバーでセッションを選択
4. **セッション削除**: タブの × ボタンまたは右クリックメニュー

### セッション間通信

各セッション内から以下のコマンドが使用可能です：

```powershell
# 特定セッションにメッセージを送信
wterm-send <session-id> <message>

# 例
wterm-send session-2 このコードをレビューしてください

# 全セッションにブロードキャスト
wterm-broadcast <message>

# 例
wterm-broadcast ビルドが完了しました

# セッション一覧を表示
wterm-list
```

### キーボードショートカット

| キー | 機能 |
|------|------|
| `Ctrl+Shift+T` | 新規セッション作成 |
| `Ctrl+Shift+W` | アクティブセッション削除 |
| `Ctrl+Shift+L` | レイアウト切替（開発中） |

## 設定

`config.json` で各種設定をカスタマイズできます：

```json
{
  "port": 3000,
  "maxHistorySize": 50,
  "bufferSize": 10000,
  "shortcuts": [
    {
      "id": "claude",
      "name": "Claude Code",
      "command": "claude",
      "icon": "🤖"
    }
  ],
  "uiLayout": {
    "showSidebar": true,
    "showHistoryPanel": true,
    "sidebarPosition": "left",
    "defaultView": "tab"
  }
}
```

### ショートカットの追加

UIの設定画面（⚙ボタン）から追加・編集できます。または `config.json` を直接編集してください。

## プロジェクト構成

```
wterm/
├── src/
│   ├── server.ts      # メインサーバー
│   ├── sessions.ts    # セッション管理
│   ├── config.ts      # 設定管理
│   └── types.ts       # 型定義
├── public/
│   ├── index.html     # メインHTML
│   ├── app.js         # クライアントアプリ
│   └── style.css      # スタイルシート
├── bin/
│   ├── wterm-send.js      # 送信コマンド
│   ├── wterm-broadcast.js # ブロードキャストコマンド
│   └── wterm-list.js      # 一覧表示コマンド
├── config.json        # 設定ファイル
├── package.json
├── build.bat          # インストール + ビルド
└── start.bat          # 起動スクリプト
```

## 技術スタック

- **サーバー**: Node.js + ws（HTTPサーバー + WebSocketサーバー）
- **PTY管理**: node-pty（Windows対応の疑似端末）
- **クライアント**: xterm.js（ブラウザベースターミナルUI）
- **通信**: WebSocket（リアルタイム双方向通信）
- **TypeScript実行**: tsx

## Bunでの実行（実験的）

Bunでも実行可能ですが、Windows環境ではnode-ptyとの相性問題により入力エコーが正常に動作しない場合があります。

```bash
# Bunで実行する場合
npm run start:bun
```

## ライセンス

MIT License

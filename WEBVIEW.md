# WebView2モード - 使い方ガイド

wtermをネイティブアプリのような独立ウィンドウで起動します。

## 概要

**WebView2モード**は、ブラウザのアドレスバーやタブバーを非表示にし、ネイティブアプリのような見た目でwtermを起動します。

**特徴:**
- **Edge(WebView2)のApp Mode（`--app`フラグ）を使用**
- ブラウザUI完全非表示
- タスクバーに独立表示
- ウィンドウサイズ・位置を自動設定

---

## 起動方法

### 方法1：start.bat（推奨）

デスクトップまたはエクスプローラーから`start.bat`をダブルクリック。

```cmd
start.bat
```

これにより：
1. （必要な場合は）`build.bat`で依存関係をインストール/ビルド
2. バックエンドを起動
3. **自動的にWebViewウィンドウが開く**
4. **起動プロンプトは自動でクローズ**

### 方法2：コマンドライン

```powershell
# WebView2モードで起動（ビルドなし）
start.bat

# ビルド込みで起動
start.bat --build

# 開発モード（ブラウザは開かない）
npm run dev
```

### 方法3：直接引数指定

```powershell
tsx src/server.ts -- --webview
```

---

## WebViewウィンドウの特徴

### ✅ できること

- **ブラウザUIなし** - アドレスバー・タブバー・ブックマークバーが非表示
- **独立ウィンドウ** - タスクバーに単独で表示
- **ウィンドウ操作** - 最小化・最大化・閉じる・リサイズが可能
- **デフォルトサイズ** - 1400x900、位置(100,100)で起動
- **ショートカット作成** - デスクトップショートカット可能
- **ウィンドウを閉じるとサーバーも終了**

### ❌ できないこと

- **ブラウザ履歴** - 戻る/進むボタンなし（不要）
- **開発者ツール** - 右クリック→検証は可能
- **マルチタブ** - 単一ウィンドウのみ

---

## カスタマイズ

### ウィンドウサイズ・位置の変更

`src/server.ts`の712-719行目を編集：

```typescript
const edgeArgs = [
  '--app=' + url,
  '--window-size=1600,1000',      // 幅1600、高さ1000
  '--window-position=0,0',        // 左上に配置
  '--disable-features=TranslateUI',
  '--no-first-run',
  '--no-default-browser-check',
].join(' ');
```

### 常にWebView2モードで起動

現在の`start.bat`は既にWebView2モードがデフォルトです。

通常モードに戻したい場合：
```cmd
call npm start
```

---

## トラブルシューティング

### Edge(WebView2)が見つからない

**エラー:**
```
Edge(WebView2)が見つかりません。通常のブラウザで開きます。
```

**解決策:**
- Edgeをインストール
- パスが通っているか確認（`where msedge`）
- 自動的にデフォルトブラウザで開きます（フォールバック）

### ウィンドウが開かない

**原因1: 開発モードで起動している**
```powershell
npm run dev  # WebViewは開かない
```

**解決策:**
```powershell
start.bat --build  # これを使う
```

**原因2: 既にサーバーが起動中**

別のターミナルやバックグラウンドでサーバーが起動していると、ポート競合で起動失敗します。

**解決策:**
```powershell
# プロセスを確認
netstat -ano | findstr :3000

# タスクマネージャーでNode.jsプロセスを終了
```

### ブラウザUIが表示される

**原因:** 通常モードで起動している

**確認:**
```powershell
# コンソールに "WebView2モードで起動中..." が表示されるか確認
start.bat --build
```

---

## 技術詳細

### Edge App Modeとは

Edgeの`--app`フラグを使用すると、ブラウザUIを非表示にして特定のURLを独立ウィンドウで開けます。

**使用フラグ:**
- `--app=URL` - アプリモード起動
- `--window-size=幅,高さ` - ウィンドウサイズ
- `--window-position=X,Y` - ウィンドウ位置
- `--disable-features=TranslateUI` - 翻訳UI無効化
- `--no-first-run` - 初回起動メッセージ非表示
- `--no-default-browser-check` - デフォルトブラウザチェック無効化

---

## 推奨フロー

### 初回セットアップ

1. リポジトリをクローン
2. `start.bat`をダブルクリック
3. 自動的にWebViewウィンドウが開く
4. （オプション）`start.bat`のショートカットをデスクトップに作成

### 日常使用

1. デスクトップの`start.bat`ショートカットをダブルクリック
2. すぐにwtermが使える

### 開発時

```powershell
# バックエンド + フロントエンドを同時起動（ブラウザは開かない）
npm run dev

# ブラウザで http://localhost:5173 にアクセス
```

---

## 参考リンク

- [Microsoft Edge - command-line options](https://learn.microsoft.com/microsoft-edge/devtools-guide-chromium/command-line-options)
- [Chromium Command Line Switches](https://peter.sh/experiments/chromium-command-line-switches/)

---

**最終更新:** 2026-01-24
**対象バージョン:** wterm 2.0.0 (React版)

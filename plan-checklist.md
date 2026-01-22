# wterm 開発進捗管理チェックシート

**最終更新**: 2026-01-22
**現在のフェーズ**: Phase 2 完了 ✅
**次のタスク**: Phase 3 (既存機能移植 + 仕上げ)

---

## 📊 全体進捗サマリー

- ✅ **Phase 1**: React基本機能 - **100%完了**
- ✅ **Phase 2**: ワークスペース + ドラッグ&ドロップ - **100%完了** (14/14日)
  - ✅ Week 1: ワークスペース基盤 (7/7日)
  - ✅ Week 2: ドラッグ&ドロップ (7/7日)
- 🔜 **Phase 3**: 既存機能移植 + 仕上げ - **0%完了** (0/7日)

**全体進捗**: 21/28日 完了 (75%)

---

## ✅ Phase 1: React基本機能 (100%完了)

### 環境セットアップ
- [x] Vite + React 18 + TypeScript環境構築
- [x] Tailwind CSS 4設定（@themeディレクティブ使用）
- [x] Zustand状態管理導入
- [x] xterm.js統合
- [x] WebSocket通信実装（開発環境でlocalhost:3000接続）

### コンポーネント実装
- [x] **Header** - 新規セッション作成、ShortcutsMenu、設定ボタン
- [x] **Sidebar** - セッション一覧、選択、削除
- [x] **TerminalArea** - 単一ターミナル表示、xterm.js統合
- [x] **Terminal** - 入出力、WebSocket双方向通信、リサイズ対応
- [x] **ChatPane** - セッション間メッセージング、ブロードキャスト
- [x] **StatusBar** - セッション数、アクティブセッション、接続状態

### Zustand Store
- [x] AppState基本実装（sessions, activeSessionId, config, messages）
- [x] WebSocket状態管理（wsConnection, isConnected）
- [x] 各種Actions実装

### WebSocket Hook
- [x] useWebSocket.ts実装
- [x] メッセージタイプ処理（sessions, exit, message, error, output, history）
- [x] 開発/本番環境の接続先切り替え

### 動作確認
- [x] 開発サーバー起動確認
- [x] ビルド成功確認
- [x] 旧Vanilla JS版のバックアップ（public.old/）

---

## ✅ Phase 2: ワークスペース + ドラッグ&ドロップ (100%完了)

### Week 1: ワークスペース基盤 (100%完了) ✅

#### Day 1-2: バックエンドAPI実装 ✅
- [x] 型定義追加（src/types.ts）
  - [x] Workspaceインターフェース
  - [x] LayoutNode型（terminal / split）
  - [x] Config拡張（workspaces, activeWorkspaceId）
- [x] ワークスペースAPI実装（src/server.ts）
  - [x] GET /api/workspaces - 一覧取得
  - [x] POST /api/workspaces - 新規作成
  - [x] PATCH /api/workspaces/:id - 更新
  - [x] DELETE /api/workspaces/:id - 削除
  - [x] POST /api/workspaces/active - アクティブ設定
- [x] マイグレーション（src/config.ts）
  - [x] デフォルトワークスペース自動作成
  - [x] 後方互換性維持

#### Day 3-4: Zustand状態管理 ✅
- [x] フロントエンド型定義（client/src/types/index.ts）
  - [x] Workspace, LayoutNode型追加
- [x] Zustandストア拡張（client/src/store/index.ts）
  - [x] workspaces配列追加
  - [x] activeWorkspaceId追加
  - [x] activeDragId追加
  - [x] ワークスペースActions実装
    - [x] setWorkspaces, addWorkspace
    - [x] updateWorkspace, deleteWorkspace
    - [x] setActiveWorkspace, updateLayout
    - [x] setActiveDragId
- [x] App.tsx統合
  - [x] 起動時にワークスペース一覧ロード
  - [x] アクティブワークスペースID復元

#### Day 5-6: サイドバーUI更新 ✅
- [x] 新規コンポーネント作成
  - [x] WorkspaceList.tsx - ワークスペース一覧
  - [x] WorkspaceItem.tsx - ワークスペース項目
    - [x] 展開/折りたたみ機能（▶/▼アイコン）
    - [x] ダブルクリックで名前インライン編集
    - [x] ワークスペース削除ボタン（最後は削除不可）
    - [x] 配下セッション一覧表示
  - [x] AddWorkspaceButton.tsx - 新規作成ボタン
- [x] Sidebar.tsx改修
  - [x] WorkspaceListを表示する構造に変更
- [x] セッション作成統合
  - [x] Header.tsx - アクティブワークスペースに追加
  - [x] ShortcutsMenu.tsx - 同上

#### Day 7: レイアウトツリー基礎 ✅
- [x] レイアウトユーティリティ（client/src/utils/layoutTree.ts）
  - [x] insertSessionIntoTree() - 4方向挿入
  - [x] removeSessionFromTree() - セッション削除
  - [x] simplifyTree() - ツリー簡略化
  - [x] getAllSessionIds() - 全セッションID取得
  - [x] hasSession() - セッション存在確認

---

### Week 2: ドラッグ&ドロップ (100%完了) ✅

#### Day 8-9: dnd-kit統合 ✅
- [x] パッケージインストール確認
  - [x] @dnd-kit/core
  - [x] @dnd-kit/sortable
- [x] App.tsx DndContext設定
  - [x] DndContextでアプリ全体をラップ
  - [x] handleDragStart() - activeDragId設定
  - [x] handleDragEnd() - ドロップ処理スケルトン
  - [x] DragOverlay - ドラッグプレビュー表示
- [x] Terminal.tsx ドラッグ対応
  - [x] useDraggable() フック統合
  - [x] ヘッダー部分（⋮⋮）をドラッグハンドルに設定
  - [x] cursor-move スタイル適用
  - [x] ドラッグ中の半透明化（opacity-50）

#### Day 10-11: DropZone実装 ✅
- [x] DropZoneコンポーネント（client/src/components/TerminalArea/DropZone.tsx）
  - [x] useDroppable() フック使用
  - [x] 4方向対応（top, bottom, left, right）
  - [x] ホバー時の青いハイライト
  - [x] 位置ごとの絶対配置スタイル
- [x] Terminal.tsx DropZone統合
  - [x] showDropZones条件判定
  - [x] 4方向のDropZone条件付きレンダリング
- [x] 動作確認
  - [x] ターミナルヘッダードラッグ可能
  - [x] ドラッグ中プレビュー表示
  - [x] ドロップゾーン表示確認

#### Day 12-13: レイアウト更新ロジック ✅
- [x] **LayoutRendererコンポーネント作成** (`client/src/components/TerminalArea/LayoutRenderer.tsx`)
  - [x] LayoutNodeを再帰的にレンダリング
  - [x] type: 'terminal' → Terminal表示
  - [x] type: 'split' → SplitPane表示
  - [x] セッションID取得ロジック

- [x] **SplitPaneコンポーネント作成** (`client/src/components/TerminalArea/SplitPane.tsx`)
  - [x] horizontal/vertical分割対応
  - [x] sizes配列に基づいてflexレイアウト
  - [x] 子要素の再帰レンダリング

- [x] **App.tsx handleDragEnd()完全実装**
  - [x] ドロップ位置判定（over.data.current.position）
  - [x] targetSessionId取得
  - [x] insertSessionIntoTree()呼び出し
  - [x] updateLayout()でワークスペースに保存
  - [x] サーバーにPATCH実装

- [x] **TerminalArea.tsx更新**
  - [x] 単一ターミナル表示からLayoutRenderer表示に変更
  - [x] アクティブワークスペースのlayout参照
  - [x] layoutがnullの場合の処理

- [x] **セッション作成時のレイアウト初期化**
  - [x] Header.tsx更新
  - [x] ShortcutsMenu.tsx更新
  - [x] 空レイアウト時は単一ターミナルノード作成
  - [x] 既存レイアウトがある場合は右側に分割

- [x] **動作確認**
  - [x] 実装完了（ユーザーテスト待ち）

#### Day 14: SplitPane + リサイズ ✅ **完了**
- [x] **Dividerコンポーネント作成** (`client/src/components/TerminalArea/Divider.tsx`)
  - [x] マウスドラッグでリサイズ
  - [x] onMouseDown + onMouseMove + onMouseUp
  - [x] ドラッグ中のビジュアルフィードバック

- [x] **SplitPane.tsxリサイズ統合**
  - [x] Divider配置（子要素間）
  - [x] sizes配列の更新処理
  - [x] リサイズ中のパフォーマンス最適化
  - [x] 最小サイズ制限（10%）

- [x] **自動保存実装**
  - [x] TerminalArea.tsxで500ms debounce実装
  - [x] レイアウト変更時に自動保存
  - [x] updateSizesInTree関数追加（layoutTree.ts）

- [x] **追加修正**
  - [x] 確認alert/confirmを全て削除
  - [x] セッション削除時にレイアウトツリーを更新

---

## 🔜 Phase 3: 既存機能移植 + 仕上げ (0%完了)

### Day 15: ショートカット機能拡張 🔜
- [ ] ショートカット実行時のワークスペース統合
  - [ ] 現在のワークスペースにセッション追加
  - [ ] ワークスペースが空の場合は新規レイアウト作成
  - [ ] 既存セッションがある場合は右側に分割
- [ ] ShortcutsMenu.tsx更新
  - [ ] レイアウト更新ロジック統合

### Day 16: 設定ダイアログ実装 🔜
- [ ] **SettingsDialogコンポーネント** (`client/src/components/Dialogs/SettingsDialog.tsx`)
  - [ ] ダイアログUI実装
  - [ ] タブ切り替え（ターミナル、ワークスペース）
  - [ ] ターミナル設定（フォントサイズ、フォント）
  - [ ] ワークスペース設定（デフォルトビュー）
- [ ] 設定変更の即時反映
  - [ ] PATCH /config でサーバー保存
  - [ ] Zustand store更新
  - [ ] 全ターミナルに反映
- [ ] Header.tsx統合
  - [ ] 設定ボタンクリックでダイアログ表示

### Day 17: 履歴パネル 🔜
- [ ] **HistoryPanelコンポーネント** (`client/src/components/HistoryPanel.tsx`)
  - [ ] メッセージ履歴表示（ChatPane拡張）
  - [ ] フィルタリング機能（送信元・送信先）
  - [ ] クリア機能
  - [ ] 検索機能（オプション）

### Day 18: キーボードショートカット 🔜
- [ ] グローバルショートカット実装
  - [ ] Ctrl+Shift+T: 新規セッション
  - [ ] Ctrl+Shift+W: セッション削除
  - [ ] Ctrl+1-9: ワークスペース切り替え
  - [ ] Ctrl+Shift+N: 新規ワークスペース
  - [ ] Esc: メニュー閉じる
- [ ] ショートカット一覧表示
  - [ ] ヘルプモーダル実装

### Day 19: エラーハンドリング 🔜
- [ ] **ErrorBoundary追加**
  - [ ] エラーキャッチとログ
  - [ ] ErrorScreen表示
  - [ ] 復旧ボタン
- [ ] **トースト通知実装**
  - [ ] 成功/エラーメッセージ表示
  - [ ] 自動消去（3秒）
  - [ ] 複数メッセージのキュー管理
- [ ] WebSocket自動再接続
  - [ ] エクスポネンシャルバックオフ
  - [ ] 「再接続中...」オーバーレイ

### Day 20-21: 最終テスト + ドキュメント 🔜
- [ ] **テストチェックリスト**
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
  - [ ] パフォーマンス（4分割表示で快適動作）
- [ ] **ドキュメント更新**
  - [ ] README.md - React版の使い方
  - [ ] CLAUDE.md - Reactアーキテクチャ追加
  - [ ] 移行ガイド（Vanilla JS → React）
  - [ ] トラブルシューティング更新

---

## 🎯 次回作業開始ポイント

### 現在の状況
- **Phase**: 2 完了 ✅
- **Day**: 14完了（SplitPane + リサイズ機能実装）
- **完了**: Phase 2 Week 2 Day 14まで全て完了
- **次のタスク**: Phase 3 (既存機能移植 + 仕上げ)

### 作業開始手順

1. **開発サーバー起動**
   ```bash
   npm run dev
   # バックエンド: http://localhost:3000
   # フロントエンド: http://localhost:5174
   ```

2. **Phase 2の動作確認（推奨）**
   - [ ] ブラウザで http://localhost:5175 にアクセス
   - [ ] 新規セッションを2つ作成（自動で右側に分割）
   - [ ] ターミナルヘッダー（⋮⋮）をドラッグ
   - [ ] ドロップゾーン（青いハイライト）が表示されることを確認
   - [ ] 4方向のいずれかにドロップして分割を確認
   - [ ] 分割されたパネル間のディバイダー（グレーの線）をドラッグしてリサイズ
   - [ ] セッション削除ボタン（✕）でパネルを削除
   - [ ] ブラウザリロードでレイアウトが復元されることを確認

3. **次のタスク（Phase 3）**
   - [ ] Day 15: ショートカット機能拡張
   - [ ] Day 16: 設定ダイアログ実装
   - [ ] Day 17-21: 履歴パネル、キーボードショートカット、エラーハンドリング、最終テスト

4. **参考ファイル**
   - `plan.md` - Phase 3詳細計画
   - `plan-checklist.md` - Phase 3チェックリスト
   - `HANDOFF.md` - 引き継ぎドキュメント

---

## 📝 進捗更新ルール

このチェックリストを更新する際は:
1. 完了した項目に `[x]` をマーク
2. 「全体進捗サマリー」のパーセンテージを更新
3. 「最終更新」日付を更新
4. 「次回作業開始ポイント」を更新

---

## ⚠️ 重要な注意事項

### 技術的制約
- Zustandは必ずセレクター関数で取得（`useStore((state) => state.foo)`）
- Tailwind CSS 4は設定ファイル不要（`@theme`使用）
- WebSocketは開発環境で`ws://localhost:3000`に直接接続
- TypeScript型は`client/src/types/index.ts`と`src/types.ts`を手動同期

### 既知の問題
- WebSocket自動再接続未実装（Phase 3で対応）
- xterm.js非推奨バージョン使用（動作は問題なし）

### リスク管理
- レイアウトツリーのユニットテストが必要
- 4分割以上でのパフォーマンステストが必要
- config.json破損対策（自動バックアップ）が必要

---

**開発開始準備完了！** 🚀

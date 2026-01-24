// wterm - 型定義ファイル

// セッション状態
export type SessionStatus = 'running' | 'exited';

// セッション情報
export interface Session {
  id: string;
  pid: number;
  pty: any; // node-pty IPty
  status: SessionStatus;
  exitCode?: number;
  createdAt: Date;
  command: string;
  outputBuffer: string[];
  connectedClients: Set<string>;
}

// セッション間メッセージ
export interface Message {
  id: string;
  from: string;
  to: string | 'all';
  content: string;
  timestamp: Date;
}

// ショートカット定義
export interface Shortcut {
  id: string;
  name: string;
  command: string;
  icon: string;
}

// UIレイアウト設定
export interface UILayout {
  showSidebar: boolean;
  showHistoryPanel: boolean;
  sidebarPosition: 'left' | 'right';
  defaultView: 'tab' | 'split';
}

// ターミナル表示設定
export interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
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

// ワークスペース
export interface Workspace {
  id: string;
  name: string;
  icon: string;
  sessions: string[];
  layout: LayoutNode | null;
  cwd?: string; // 初期カレントディレクトリ
  createdAt: string;
  updatedAt: string;
}

// 設定ファイル構造
export interface Config {
  port: number;
  maxHistorySize: number;
  bufferSize: number;
  shortcuts: Shortcut[];
  uiLayout: UILayout;
  terminal: TerminalSettings;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  debugLog?: boolean; // デバッグログの有効/無効
  processPollingInterval?: number; // プロセス監視間隔（ミリ秒）、0で無効
}

// WebSocketメッセージ型（クライアント→サーバー）
export type ClientMessage =
  | { type: 'attach'; sessionId: string }
  | { type: 'input'; sessionId: string; data: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'detach'; sessionId: string };

// WebSocketメッセージ型（サーバー→クライアント）
export type ServerMessage =
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'sessions'; sessions: SessionInfo[] }
  | { type: 'message'; message: Message }
  | { type: 'exit'; sessionId: string; exitCode: number }
  | { type: 'error'; message: string }
  | { type: 'history'; sessionId: string; data: string };

// セッション情報（API用）
export interface SessionInfo {
  id: string;
  status: SessionStatus;
  createdAt: string;
  command: string;
  exitCode?: number;
  currentProcess?: string;  // 現在実行中のプロセス名
  cwd?: string;  // カレントディレクトリ
}

// API リクエスト/レスポンス型
export interface CreateSessionRequest {
  command?: string;
  cwd?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export interface SendMessageRequest {
  from: string;
  to: string;
  message: string;
  waitForResponse?: boolean;  // レスポンス待機フラグ
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  message?: string;
  availableSessions?: string[];
  output?: string;  // レスポンス待機時の出力
}

export interface SessionListResponse {
  sessions: SessionInfo[];
}

export interface HistoryResponse {
  messages: Message[];
}

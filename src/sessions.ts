// wterm - セッション管理モジュール
import * as pty from 'node-pty';
import { getConfig } from './config';
import type { Session, SessionInfo, Message } from './types';
import { resolve } from 'path';

// セッション管理用マップ
const sessions = new Map<string, Session>();

// メッセージ履歴
const messageHistory: Message[] = [];

// セッションIDカウンター
let sessionCounter = 0;

// WebSocket broadcast関数（サーバーから注入）
let broadcastFn: ((message: any) => void) | null = null;

/**
 * broadcast関数を設定
 */
export function setBroadcastFunction(fn: (message: any) => void): void {
  broadcastFn = fn;
}

/**
 * 新しいセッションIDを生成
 */
function generateSessionId(): string {
  sessionCounter++;
  return `session-${sessionCounter}`;
}

/**
 * プロジェクトルートのbinディレクトリパスを取得
 */
function getBinPath(): string {
  return resolve(process.cwd(), 'bin');
}

/**
 * 新しいセッションを作成
 */
export function createSession(command: string = ''): Session {
  const config = getConfig();
  const sessionId = generateSessionId();

  // 環境変数を設定
  const env = {
    ...process.env,
    WTERM_API_URL: `http://localhost:${config.port}`,
    WTERM_SESSION_ID: sessionId,
    PATH: `${process.env.PATH};${getBinPath()}`,
  };

  const binPath = getBinPath();

  // PowerShellを起動（環境変数を-Commandで設定）
  const ptyProcess = pty.spawn('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NoExit',
    '-Command',
    `$env:PATH += ';${binPath}'; $env:WTERM_API_URL = '${env.WTERM_API_URL}'; $env:WTERM_SESSION_ID = '${sessionId}'`
  ], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: process.cwd(),
    env: env as { [key: string]: string },
  });

  const session: Session = {
    id: sessionId,
    pid: ptyProcess.pid,
    pty: ptyProcess,
    status: 'running',
    createdAt: new Date(),
    command,
    outputBuffer: [],
    connectedClients: new Set(),
  };

    attachPtyErrorHandler(session, ptyProcess);

  // PTYの初期化完了フラグ
  let ptyInitialized = false;

  // PTY出力をバッファリングしてWebSocketへ転送
  ptyProcess.onData((data: string) => {
    // 初回の出力でPTYが初期化されたと判断
    if (!ptyInitialized) {
      ptyInitialized = true;
      // セッション一覧を更新（PTY初期化完了後）
      if (broadcastFn) {
        broadcastFn({
          type: 'sessions',
          sessions: getSessionList(),
        });
      }
    }

    // バッファに追加（サイズ制限）
    session.outputBuffer.push(data);
    const totalSize = session.outputBuffer.join('').length;
    while (totalSize > config.bufferSize && session.outputBuffer.length > 1) {
      session.outputBuffer.shift();
    }

    // WebSocketに送信
    if (broadcastFn) {
      broadcastFn({
        type: 'output',
        sessionId,
        data,
      });
    }
  });

  // プロセス終了時の処理
  ptyProcess.onExit(({ exitCode }) => {
    session.status = 'exited';
    session.exitCode = exitCode;

    // WebSocketに通知
    if (broadcastFn) {
      broadcastFn({
        type: 'exit',
        sessionId,
        exitCode,
      });
      // セッション一覧も更新
      broadcastFn({
        type: 'sessions',
        sessions: getSessionList(),
      });
    }

    console.log(`セッション ${sessionId} が終了しました (exit code: ${exitCode})`);
  });

  sessions.set(sessionId, session);

  // コマンドが指定されていれば実行
  if (command) {
    setTimeout(() => {
      safeWrite(session, `${command}\r`);
    }, 500); // 少し待ってから実行
  }

  console.log(`セッション ${sessionId} を作成しました`);

  // PTYの初期化を待つためのタイムアウト（フォールバック）
  // PTYが何も出力しない場合に備えて、1秒後に強制的にブロードキャスト
  setTimeout(() => {
    if (!ptyInitialized) {
      ptyInitialized = true;
      if (broadcastFn) {
        broadcastFn({
          type: 'sessions',
          sessions: getSessionList(),
        });
      }
    }
  }, 1000);

  return session;
}

/**
 * セッションを取得
 */
export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

/**
 * 全セッションを取得
 */
export function getAllSessions(): Map<string, Session> {
  return sessions;
}

/**
 * セッション一覧を取得（API用）
 */
export function getSessionList(): SessionInfo[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    command: s.command,
    exitCode: s.exitCode,
  }));
}

/**
 * セッションを削除
 */
export function deleteSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    return false;
  }

  // PTYプロセスを終了
  if (session.status === 'running') {
    session.pty.kill();
  }

  sessions.delete(sessionId);
  console.log(`セッション ${sessionId} を削除しました`);

  // セッション一覧を更新
  if (broadcastFn) {
    broadcastFn({
      type: 'sessions',
      sessions: getSessionList(),
    });
  }

  return true;
}

/**
 * セッションを再起動
 */
export function restartSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    return false;
  }

  if (session.status !== 'exited') {
    return false; // 実行中のセッションは再起動できない
  }

  const config = getConfig();

  // 環境変数を設定
  const env = {
    ...process.env,
    WTERM_API_URL: `http://localhost:${config.port}`,
    WTERM_SESSION_ID: sessionId,
    PATH: `${process.env.PATH};${getBinPath()}`,
  };

  const binPath = getBinPath();

  // 新しいPTYを起動（環境変数を-Commandで設定）
  const ptyProcess = pty.spawn('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NoExit',
    '-Command',
    `$env:PATH += ';${binPath}'; $env:WTERM_API_URL = '${env.WTERM_API_URL}'; $env:WTERM_SESSION_ID = '${sessionId}'`
  ], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: process.cwd(),
    env: env as { [key: string]: string },
  });

  // セッションを更新
  session.pid = ptyProcess.pid;
  session.pty = ptyProcess;
  session.status = 'running';
  session.exitCode = undefined;
  session.outputBuffer = [];

  attachPtyErrorHandler(session, ptyProcess);

  // PTY出力をバッファリングしてWebSocketへ転送
  ptyProcess.onData((data: string) => {
    session.outputBuffer.push(data);
    const totalSize = session.outputBuffer.join('').length;
    while (totalSize > config.bufferSize && session.outputBuffer.length > 1) {
      session.outputBuffer.shift();
    }

    if (broadcastFn) {
      broadcastFn({
        type: 'output',
        sessionId,
        data,
      });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    session.status = 'exited';
    session.exitCode = exitCode;

    if (broadcastFn) {
      broadcastFn({
        type: 'exit',
        sessionId,
        exitCode,
      });
      broadcastFn({
        type: 'sessions',
        sessions: getSessionList(),
      });
    }
  });

  // コマンドが指定されていれば実行
  if (session.command) {
    setTimeout(() => {
      safeWrite(session, `${session.command}\r`);
    }, 500);
  }

  console.log(`セッション ${sessionId} を再起動しました`);

  // セッション一覧を更新
  if (broadcastFn) {
    broadcastFn({
      type: 'sessions',
      sessions: getSessionList(),
    });
  }

  return true;
}

// 入力バッファ（コマンド検出用）
const inputBuffers = new Map<string, string>();

/**
 * PTYのエラーを処理（Socket closedなどでプロセスが落ちないようにする）
 */
function attachPtyErrorHandler(session: Session, ptyProcess: pty.IPty): void {
  // node-pty (Windows) は error リスナーが2つ未満だと throw するため、noop を追加
  ptyProcess.on('error', () => {});

  ptyProcess.on('error', (e: unknown) => {
    const err = e as { code?: string; message?: string } | undefined;
    const isSocketClosed =
      err?.code === 'ERR_SOCKET_CLOSED' ||
      (typeof err?.message === 'string' && /socket is closed/i.test(err.message));

    if (!isSocketClosed) {
      console.error(`PTYエラー (${session.id}):`, e);
    }

    session.status = 'exited';
  });
}

/**
 * PTYに安全に書き込む
 */
function safeWrite(session: Session, data: string): boolean {
  try {
    if (session.status !== 'running') {
      return false;
    }
    session.pty.write(data);
    return true;
  } catch (e) {
    const err = e as { code?: string; message?: string } | undefined;
    const isSocketClosed =
      err?.code === 'ERR_SOCKET_CLOSED' ||
      (typeof err?.message === 'string' && /socket is closed/i.test(err.message));

    if (!isSocketClosed) {
      // 予期しないエラーのみログ
      console.error(`PTY書き込みエラー (${session.id}):`, e);
    }

    session.status = 'exited';
    return false;
  }
}

/**
 * 内部コマンドを処理
 */
function handleInternalCommand(sessionId: string, command: string): boolean {
  // /send コマンド
  const sendMatch = command.match(/^\/send\s+(\S+)\s+(.+)$/);
  if (sendMatch) {
    const targetId = sendMatch[1];
    const message = sendMatch[2];
    const result = sendMessage(sessionId, targetId, message);
    
    // 結果をセッションに出力
    const session = sessions.get(sessionId);
    if (session && session.status === 'running') {
      if (result.success) {
        safeWrite(session, `\r\n✓ メッセージを ${targetId} に送信しました\r\n`);
      } else {
        safeWrite(session, `\r\n✗ ${result.error}\r\n`);
        if (result.availableSessions && result.availableSessions.length > 0) {
          safeWrite(session, `利用可能なセッション: ${result.availableSessions.join(', ')}\r\n`);
        }
      }
    }
    return true;
  }

  // /broadcast コマンド
  const broadcastMatch = command.match(/^\/broadcast\s+(.+)$/);
  if (broadcastMatch) {
    const message = broadcastMatch[1];
    const result = sendMessage(sessionId, 'all', message);
    
    const session = sessions.get(sessionId);
    if (session && session.status === 'running') {
      if (result.success) {
        safeWrite(session, `\r\n✓ メッセージを全セッションに送信しました\r\n`);
      } else {
        safeWrite(session, `\r\n✗ ${result.error}\r\n`);
      }
    }
    return true;
  }

  // /list コマンド
  if (command.match(/^\/list\s*$/)) {
    const session = sessions.get(sessionId);
    if (session && session.status === 'running') {
      safeWrite(session, '\r\n');
      safeWrite(session, 'アクティブセッション一覧:\r\n');
      safeWrite(session, '─'.repeat(50) + '\r\n');
      
      sessions.forEach((s) => {
        const status = s.status === 'running' ? '🟢' : '🔴';
        const current = s.id === sessionId ? ' (現在)' : '';
        const cmd = s.command || 'PowerShell';
        const exitInfo = s.status === 'exited' ? ` [exit: ${s.exitCode}]` : '';
        
        safeWrite(session, `  ${status} ${s.id}${current}\r\n`);
        safeWrite(session, `     コマンド: ${cmd}${exitInfo}\r\n`);
        safeWrite(session, '\r\n');
      });
    }
    return true;
  }

  // /help コマンド
  if (command.match(/^\/help\s*$/)) {
    const session = sessions.get(sessionId);
    if (session && session.status === 'running') {
      safeWrite(session, '\r\n');
      safeWrite(session, 'wterm 内部コマンド:\r\n');
      safeWrite(session, '─'.repeat(50) + '\r\n');
      safeWrite(session, '  /send <session-id> <message>  - 指定セッションにメッセージ送信\r\n');
      safeWrite(session, '  /broadcast <message>          - 全セッションにメッセージ送信\r\n');
      safeWrite(session, '  /list                         - アクティブセッション一覧\r\n');
      safeWrite(session, '  /help                         - このヘルプを表示\r\n');
      safeWrite(session, '\r\n');
      safeWrite(session, 'CLIコマンド (PowerShellから実行):\r\n');
      safeWrite(session, '─'.repeat(50) + '\r\n');
      safeWrite(session, '  wterm-send <session-id> <message>\r\n');
      safeWrite(session, '  wterm-broadcast <message>\r\n');
      safeWrite(session, '  wterm-list\r\n');
      safeWrite(session, '\r\n');
    }
    return true;
  }

  return false;
}

/**
 * セッションに入力を送信
 */
export function writeToSession(sessionId: string, data: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'running') {
    return false;
  }

  // 入力バッファを管理（コマンド検出用）
  let buffer = inputBuffers.get(sessionId) || '';
  
  for (const char of data) {
    if (char === '\r' || char === '\n') {
      // Enter押下時にコマンドをチェック
      const command = buffer.trim();
      if (command.startsWith('/')) {
        if (handleInternalCommand(sessionId, command)) {
          // 内部コマンドとして処理された場合、改行のみ送信
          safeWrite(session, '\r\n');
          buffer = '';
          inputBuffers.set(sessionId, buffer);
          continue;
        }
      }
      buffer = '';
    } else if (char === '\x7f' || char === '\b') {
      // バックスペース
      buffer = buffer.slice(0, -1);
    } else {
      buffer += char;
    }
  }
  
  inputBuffers.set(sessionId, buffer);
  return safeWrite(session, data);
}

/**
 * セッションのターミナルサイズを変更
 */
export function resizeSession(sessionId: string, cols: number, rows: number): boolean {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'running') {
    return false;
  }

  try {
    session.pty.resize(cols, rows);
    return true;
  } catch (e) {
    console.error(`PTYリサイズエラー (${sessionId}):`, e);
    return false;
  }
}

/**
 * セッションの出力バッファを取得
 */
export function getSessionBuffer(sessionId: string): string {
  const session = sessions.get(sessionId);
  if (!session) {
    return '';
  }
  return session.outputBuffer.join('');
}

/**
 * メッセージを送信（セッション間通信）
 */
export function sendMessage(from: string, to: string, content: string): { success: boolean; messageId?: string; error?: string; availableSessions?: string[] } {
  const config = getConfig();

  // 送信先の検証
  if (to !== 'all') {
    const targetSession = sessions.get(to);
    if (!targetSession) {
      return {
        success: false,
        error: `セッション '${to}' が見つかりません`,
        availableSessions: Array.from(sessions.keys()),
      };
    }
    if (targetSession.status !== 'running') {
      return {
        success: false,
        error: `セッション '${to}' は終了しています`,
        availableSessions: Array.from(sessions.keys()).filter(id => sessions.get(id)?.status === 'running'),
      };
    }
  }

  // メッセージを作成
  const message: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from,
    to,
    content,
    timestamp: new Date(),
  };

  // 履歴に追加
  messageHistory.push(message);
  while (messageHistory.length > config.maxHistorySize) {
    messageHistory.shift();
  }

  // 送信先にメッセージを転送
  if (to === 'all') {
    // ブロードキャスト
    sessions.forEach((session, sessionId) => {
      if (sessionId !== from && session.status === 'running') {
        safeWrite(session, `${content}\r`);
      }
    });
  } else {
    // 特定セッションへ送信
    const targetSession = sessions.get(to);
    if (targetSession && targetSession.status === 'running') {
      safeWrite(targetSession, `${content}\r`);
    }
  }

  // WebSocketでメッセージ通知
  if (broadcastFn) {
    broadcastFn({
      type: 'message',
      message,
    });
  }

  console.log(`メッセージ送信: ${from} → ${to}: ${content.substring(0, 50)}...`);

  return {
    success: true,
    messageId: message.id,
  };
}

/**
 * メッセージ履歴を取得
 */
export function getMessageHistory(limit?: number, sessionId?: string): Message[] {
  let filtered = messageHistory;

  if (sessionId) {
    filtered = filtered.filter((m) => m.from === sessionId || m.to === sessionId || m.to === 'all');
  }

  if (limit) {
    filtered = filtered.slice(-limit);
  }

  return filtered;
}

/**
 * 利用可能なセッションIDリストを取得
 */
export function getAvailableSessionIds(): string[] {
  return Array.from(sessions.keys());
}

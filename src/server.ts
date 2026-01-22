// wterm - メインサーバー (Node.js版)
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, getConfig, saveConfig } from './config';
import {
  createSession,
  getSession,
  getSessionList,
  deleteSession,
  restartSession,
  writeToSession,
  resizeSession,
  getSessionBuffer,
  getSessionBufferRange,
  sendMessage,
  getMessageHistory,
  getAvailableSessionIds,
  setBroadcastFunction,
} from './sessions';
import type { ClientMessage, ServerMessage } from './types';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';

// Bun + node-pty で Socket closed が未処理例外になるケースの回避
function isKnownPtyError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  const message = e?.message || '';

  // Socket closed エラー（PTYプロセス終了時）
  if (e?.code === 'ERR_SOCKET_CLOSED' || /socket is closed/i.test(message)) {
    return true;
  }

  // AttachConsole failed エラー（Windows conpty終了時）
  if (/AttachConsole failed/i.test(message)) {
    return true;
  }

  // getConsoleProcessList エラー
  if (/getConsoleProcessList/i.test(message)) {
    return true;
  }

  return false;
}

process.on('uncaughtException', (err) => {
  if (isKnownPtyError(err)) {
    // 既知のPTYエラーは無視（正常終了時に発生する）
    return;
  }
  console.error('未処理例外:', err);
});

process.on('unhandledRejection', (err) => {
  if (isKnownPtyError(err)) {
    return;
  }
  console.error('未処理のPromise拒否:', err);
});

// 設定を読み込み
const config = loadConfig();
console.log(`wterm - 設定を読み込みました (port: ${config.port})`);

// WebSocketクライアント管理
const wsClients = new Map<string, { ws: WebSocket; attachedSessions: Set<string> }>();
let clientIdCounter = 0;

/**
 * 全クライアントにメッセージをブロードキャスト
 */
function broadcast(message: ServerMessage): void {
  const data = JSON.stringify(message);
  wsClients.forEach((client) => {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    } catch (e) {
      // 送信エラーは無視
    }
  });
}

/**
 * 特定セッションに接続しているクライアントにメッセージを送信
 */
function sendToSessionClients(sessionId: string, message: ServerMessage): void {
  const data = JSON.stringify(message);
  wsClients.forEach((client) => {
    if (client.attachedSessions.has(sessionId)) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(data);
        }
      } catch (e) {
        // 送信エラーは無視
      }
    }
  });
}

// セッション管理にbroadcast関数を設定
setBroadcastFunction(broadcast);

/**
 * 静的ファイルを読み込む
 */
function serveStaticFile(path: string): { statusCode: number; headers: Record<string, string>; content: Buffer | string } {
  const publicDir = resolve(process.cwd(), 'public');
  const filePath = resolve(publicDir, path);

  // パストラバーサル防止
  if (!filePath.startsWith(publicDir)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'text/plain' },
      content: 'Forbidden',
    };
  }

  if (!existsSync(filePath)) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      content: 'Not Found',
    };
  }

  const content = readFileSync(filePath);
  const ext = path.split('.').pop()?.toLowerCase();

  const contentTypes: { [key: string]: string } = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    png: 'image/png',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentTypes[ext || ''] || 'application/octet-stream',
    },
    content,
  };
}

/**
 * HTTPリクエストを処理
 */
async function handleRequest(req: any, res: any): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  // CORS ヘッダー
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS リクエスト（CORS preflight）
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // API ルーティング
  if (path.startsWith('/api/')) {
    await handleApiRequest(req, res, path, corsHeaders);
    return;
  }

  // 設定API
  if (path === '/config') {
    if (req.method === 'GET') {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getConfig()));
      return;
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      await handleConfigUpdate(req, res, corsHeaders);
      return;
    }
  }

  // 静的ファイル
  const filePath = path === '/' || path === '/index.html' ? 'index.html' : path.slice(1);
  const fileResponse = serveStaticFile(filePath);
  res.writeHead(fileResponse.statusCode, fileResponse.headers);
  res.end(fileResponse.content);
}

/**
 * APIリクエストを処理
 */
async function handleApiRequest(req: any, res: any, path: string, corsHeaders: { [key: string]: string }): Promise<void> {
  // セッション一覧取得
  if (path === '/api/sessions' && req.method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: getSessionList() }));
    return;
  }

  // セッション作成
  if (path === '/api/sessions' && req.method === 'POST') {
    await handleCreateSession(req, res, corsHeaders);
    return;
  }

  // セッション削除
  const deleteMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const sessionId = deleteMatch[1];
    const success = deleteSession(sessionId);
    res.writeHead(success ? 200 : 404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(success ? { success: true } : { success: false, message: 'セッションが見つかりません' }));
    return;
  }

  // セッション再起動
  const restartMatch = path.match(/^\/api\/sessions\/([^/]+)\/restart$/);
  if (restartMatch && req.method === 'POST') {
    const sessionId = restartMatch[1];
    const success = restartSession(sessionId);
    res.writeHead(success ? 200 : 400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        success ? { success: true } : { success: false, message: 'セッションが見つからないか、まだ実行中です' }
      )
    );
    return;
  }

  // セッションバッファ取得
  const bufferMatch = path.match(/^\/api\/sessions\/([^/]+)\/buffer$/);
  if (bufferMatch && req.method === 'GET') {
    const sessionId = bufferMatch[1];
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const fromPositionParam = url.searchParams.get('fromPosition');
    const fromPosition = fromPositionParam ? parseInt(fromPositionParam, 10) : 0;

    const result = getSessionBufferRange(sessionId, fromPosition);

    if (result === null) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'セッションが見つかりません' }));
      return;
    }

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sessionId,
      content: result.content,
      currentPosition: result.currentPosition
    }));
    return;
  }

  // メッセージ送信
  if (path === '/api/send' && req.method === 'POST') {
    await handleSendMessage(req, res, corsHeaders);
    return;
  }

  // メッセージ履歴取得
  if (path === '/api/history' && req.method === 'GET') {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sessionId = url.searchParams.get('sessionId') || undefined;
    const messages = getMessageHistory(limit, sessionId);
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages }));
    return;
  }

  // ワークスペース一覧取得
  if (path === '/api/workspaces' && req.method === 'GET') {
    const config = getConfig();
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      workspaces: config.workspaces || [],
      activeWorkspaceId: config.activeWorkspaceId
    }));
    return;
  }

  // ワークスペース作成
  if (path === '/api/workspaces' && req.method === 'POST') {
    await handleCreateWorkspace(req, res, corsHeaders);
    return;
  }

  // ワークスペース更新
  const workspaceUpdateMatch = path.match(/^\/api\/workspaces\/([^/]+)$/);
  if (workspaceUpdateMatch && req.method === 'PATCH') {
    await handleUpdateWorkspace(req, res, corsHeaders, workspaceUpdateMatch[1]);
    return;
  }

  // ワークスペース削除
  if (workspaceUpdateMatch && req.method === 'DELETE') {
    await handleDeleteWorkspace(req, res, corsHeaders, workspaceUpdateMatch[1]);
    return;
  }

  // アクティブワークスペース設定
  if (path === '/api/workspaces/active' && req.method === 'POST') {
    await handleSetActiveWorkspace(req, res, corsHeaders);
    return;
  }

  res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

/**
 * リクエストボディを読み込む
 */
function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

/**
 * セッション作成を処理
 */
async function handleCreateSession(req: any, res: any, corsHeaders: { [key: string]: string }): Promise<void> {
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    const command = parsed.command || '';
    const cwd = parsed.cwd;
    const session = createSession(command, cwd);
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessionId: session.id }));
  } catch (e) {
    console.error('セッション作成エラー:', e);
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request', details: String(e) }));
  }
}

/**
 * メッセージ送信を処理
 */
async function handleSendMessage(req: any, res: any, corsHeaders: { [key: string]: string }): Promise<void> {
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    const { from, to, message, waitForResponse } = parsed;

    if (!from || !to || !message) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '必須パラメータが不足しています' }));
      return;
    }

    const result = await sendMessage(from, to, message, { waitForResponse });

    if (result.success) {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, messageId: result.messageId, output: result.output }));
    } else {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          message: result.error,
          availableSessions: getAvailableSessionIds(),
        })
      );
    }
  } catch (e) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request' }));
  }
}

/**
 * 設定更新を処理
 */
async function handleConfigUpdate(req: any, res: any, corsHeaders: { [key: string]: string }): Promise<void> {
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    saveConfig(parsed);
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid config' }));
  }
}

/**
 * ワークスペース作成を処理
 */
async function handleCreateWorkspace(req: any, res: any, corsHeaders: { [key: string]: string }): Promise<void> {
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    const config = getConfig();

    const newWorkspace = {
      id: `workspace-${Date.now()}`,
      name: parsed.name || '新規ワークスペース',
      icon: parsed.icon || '📁',
      sessions: [],
      layout: null,
      cwd: parsed.cwd || process.cwd(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    config.workspaces = config.workspaces || [];
    config.workspaces.push(newWorkspace);
    saveConfig(config);

    res.writeHead(201, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ workspace: newWorkspace }));
  } catch (e) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request' }));
  }
}

/**
 * ワークスペース更新を処理
 */
async function handleUpdateWorkspace(
  req: any,
  res: any,
  corsHeaders: { [key: string]: string },
  workspaceId: string
): Promise<void> {
  try {
    const body = await readBody(req);
    const updates = JSON.parse(body);
    const config = getConfig();

    const workspace = config.workspaces?.find((w) => w.id === workspaceId);
    if (!workspace) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workspace not found' }));
      return;
    }

    // 更新可能なフィールド
    if (updates.name !== undefined) workspace.name = updates.name;
    if (updates.icon !== undefined) workspace.icon = updates.icon;
    if (updates.layout !== undefined) workspace.layout = updates.layout;
    if (updates.sessions !== undefined) workspace.sessions = updates.sessions;
    if (updates.cwd !== undefined) workspace.cwd = updates.cwd;
    workspace.updatedAt = new Date().toISOString();

    saveConfig(config);

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ workspace }));
  } catch (e) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request' }));
  }
}

/**
 * ワークスペース削除を処理
 */
async function handleDeleteWorkspace(
  req: any,
  res: any,
  corsHeaders: { [key: string]: string },
  workspaceId: string
): Promise<void> {
  try {
    const config = getConfig();

    if (!config.workspaces || config.workspaces.length <= 1) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cannot delete the last workspace' }));
      return;
    }

    const index = config.workspaces.findIndex((w) => w.id === workspaceId);
    if (index === -1) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workspace not found' }));
      return;
    }

    config.workspaces.splice(index, 1);

    // アクティブワークスペースが削除された場合、最初のワークスペースをアクティブにする
    if (config.activeWorkspaceId === workspaceId) {
      config.activeWorkspaceId = config.workspaces[0]?.id;
    }

    saveConfig(config);

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request' }));
  }
}

/**
 * アクティブワークスペース設定を処理
 */
async function handleSetActiveWorkspace(req: any, res: any, corsHeaders: { [key: string]: string }): Promise<void> {
  try {
    const body = await readBody(req);
    const { workspaceId } = JSON.parse(body);
    const config = getConfig();

    const workspace = config.workspaces?.find((w) => w.id === workspaceId);
    if (!workspace) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workspace not found' }));
      return;
    }

    config.activeWorkspaceId = workspaceId;
    saveConfig(config);

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request' }));
  }
}

/**
 * WebSocketメッセージを処理
 */
async function handleWebSocketMessage(clientId: string, message: ClientMessage): Promise<void> {
  const client = wsClients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'attach': {
      const session = getSession(message.sessionId);
      if (session) {
        client.attachedSessions.add(message.sessionId);
        session.connectedClients.add(clientId);

        // 既存の出力バッファを送信
        const buffer = getSessionBuffer(message.sessionId);
        if (buffer && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(
            JSON.stringify({
              type: 'history',
              sessionId: message.sessionId,
              data: buffer,
            })
          );
        }
      }
      break;
    }

    case 'detach': {
      const session = getSession(message.sessionId);
      if (session) {
        client.attachedSessions.delete(message.sessionId);
        session.connectedClients.delete(clientId);
      }
      break;
    }

    case 'input': {
      await writeToSession(message.sessionId, message.data);
      break;
    }

    case 'resize': {
      resizeSession(message.sessionId, message.cols, message.rows);
      break;
    }
  }
}

// HTTPサーバー作成
const httpServer = createServer(handleRequest);

// WebSocketサーバー作成
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  const clientId = `client-${++clientIdCounter}`;
  wsClients.set(clientId, {
    ws,
    attachedSessions: new Set(),
  });
  console.log(`WebSocket接続: ${clientId}`);

  // 現在のセッション一覧を送信
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: 'sessions',
        sessions: getSessionList(),
      })
    );
  }

  ws.on('message', async (data: Buffer) => {
    try {
      const parsed = JSON.parse(data.toString()) as ClientMessage;
      await handleWebSocketMessage(clientId, parsed);
    } catch (e) {
      console.error('WebSocketメッセージ解析エラー:', e);
    }
  });

  ws.on('close', () => {
    const client = wsClients.get(clientId);

    // 全セッションからクライアントを削除
    if (client) {
      client.attachedSessions.forEach((sessionId) => {
        const session = getSession(sessionId);
        if (session) {
          session.connectedClients.delete(clientId);
        }
      });
    }

    wsClients.delete(clientId);
    console.log(`WebSocket切断: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocketエラー (${clientId}):`, error);
  });
});

// サーバー起動
httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`wterm サーバーが起動しました: http://localhost:${config.port}`);
  console.log(`  ローカル: http://localhost:${config.port}`);
  console.log(`  ネットワーク: http://0.0.0.0:${config.port} (WSL2からもアクセス可能)`);

  // ブラウザを自動で開く（Windows、開発モード以外）
  if (process.platform === 'win32' && process.env.NODE_ENV !== 'development') {
    exec(`start http://localhost:${config.port}`);
  }
});

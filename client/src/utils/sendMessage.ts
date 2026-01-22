/**
 * セッションへのメッセージ送信ユーティリティ
 * 送信方法を統一し、サーバー側で適切な遅延処理を行う
 */

import { debug, debugError } from './logger';

interface SendMessageOptions {
  /** レスポンスを待機するか */
  waitForResponse?: boolean;
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  availableSessions?: string[];
  output?: string;
}

/**
 * 特定のセッションにメッセージを送信
 * @param from 送信元セッションID
 * @param to 送信先セッションID
 * @param message 送信するメッセージ
 * @param options オプション
 */
export async function sendToSession(
  from: string,
  to: string,
  message: string,
  options: SendMessageOptions = {}
): Promise<SendMessageResult> {
  if (!message.trim()) {
    return { success: false, error: 'メッセージが空です' };
  }

  try {
    debug(`送信: ${from} → ${to}:`, message.substring(0, 50) + (message.length > 50 ? '...' : ''));

    const response = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        message,
        waitForResponse: options.waitForResponse,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      debugError('送信失敗:', data.message || data.error);
      return {
        success: false,
        error: data.message || data.error || 'Failed to send message',
        availableSessions: data.availableSessions,
      };
    }

    debug('送信成功:', data.messageId);
    return {
      success: true,
      messageId: data.messageId,
      output: data.output,
    };
  } catch (error) {
    debugError('送信エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '送信に失敗しました',
    };
  }
}

/**
 * 全セッションにメッセージをブロードキャスト
 * @param from 送信元セッションID
 * @param message 送信するメッセージ
 */
export async function broadcastMessage(
  from: string,
  message: string
): Promise<SendMessageResult> {
  return sendToSession(from, 'all', message);
}

/**
 * ブラウザ（UI）から特定のセッションにメッセージを送信
 * @param to 送信先セッションID
 * @param message 送信するメッセージ
 * @param options オプション
 */
export async function sendFromBrowser(
  to: string,
  message: string,
  options: SendMessageOptions = {}
): Promise<SendMessageResult> {
  return sendToSession('browser', to, message, options);
}

/**
 * ブラウザ（UI）から全セッションにメッセージをブロードキャスト
 * @param message 送信するメッセージ
 */
export async function broadcastFromBrowser(
  message: string
): Promise<SendMessageResult> {
  return sendToSession('browser', 'all', message);
}

/**
 * ターミナルインスタンスのグローバルレジストリ
 * xterm.jsインスタンスへのアクセスを提供
 */

import type { Terminal } from 'xterm';

// セッションIDをキーにしたターミナルインスタンスのマップ
const terminals = new Map<string, Terminal>();

/**
 * ターミナルインスタンスを登録
 */
export function registerTerminal(sessionId: string, terminal: Terminal): void {
  terminals.set(sessionId, terminal);
}

/**
 * ターミナルインスタンスを解除
 */
export function unregisterTerminal(sessionId: string): void {
  terminals.delete(sessionId);
}

/**
 * ターミナルインスタンスを取得
 */
export function getTerminal(sessionId: string): Terminal | undefined {
  return terminals.get(sessionId);
}

/**
 * ターミナルのバッファからテキストを取得（エスケープシーケンス除去済み）
 * @param sessionId セッションID
 * @param fromLine 取得開始行（0-indexed）
 * @returns { content: string, currentLine: number } | null
 */
export function getTerminalBuffer(
  sessionId: string,
  fromLine: number = 0
): { content: string; currentLine: number } | null {
  const terminal = terminals.get(sessionId);
  if (!terminal) {
    return null;
  }

  const buffer = terminal.buffer.active;
  const currentLineCount = buffer.length;

  // 差分がない場合
  if (currentLineCount <= fromLine) {
    return { content: '', currentLine: currentLineCount };
  }

  // 差分の行を取得してテキストに変換
  let content = '';
  for (let i = fromLine; i < currentLineCount; i++) {
    const line = buffer.getLine(i);
    if (line) {
      // translateToString(true) = 右側の空白を削除、エスケープシーケンスも除去
      content += line.translateToString(true) + '\n';
    }
  }

  return { content, currentLine: currentLineCount };
}

/**
 * 登録されている全セッションIDを取得
 */
export function getRegisteredSessionIds(): string[] {
  return Array.from(terminals.keys());
}

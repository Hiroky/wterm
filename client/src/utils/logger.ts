/**
 * デバッグログラッパー
 * config.debugLog が有効な場合のみログを出力
 */

let debugEnabled = false;

/**
 * デバッグログの有効/無効を設定
 */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * デバッグログの状態を取得
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * デバッグログを出力
 */
export function debug(...args: unknown[]): void {
  if (debugEnabled) {
    console.log('[wterm]', ...args);
  }
}

/**
 * デバッグ警告を出力
 */
export function debugWarn(...args: unknown[]): void {
  if (debugEnabled) {
    console.warn('[wterm]', ...args);
  }
}

/**
 * デバッグエラーを出力
 */
export function debugError(...args: unknown[]): void {
  if (debugEnabled) {
    console.error('[wterm]', ...args);
  }
}

/**
 * グループ化されたデバッグログを出力
 */
export function debugGroup(label: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.group(`[wterm] ${label}`);
    args.forEach((arg) => console.log(arg));
    console.groupEnd();
  }
}

/**
 * テーブル形式でデバッグログを出力
 */
export function debugTable(data: unknown): void {
  if (debugEnabled) {
    console.log('[wterm] Table:');
    console.table(data);
  }
}

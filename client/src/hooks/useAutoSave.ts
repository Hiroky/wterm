import { useEffect, useRef } from 'react';

/**
 * 自動保存フック（debounce付き）
 * @param value 保存する値
 * @param onSave 保存処理のコールバック
 * @param delay debounce遅延（ミリ秒）
 */
export function useAutoSave<T>(
  value: T,
  onSave: (value: T) => void | Promise<void>,
  delay: number = 500
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRenderRef = useRef(true);

  useEffect(() => {
    // 初回レンダリング時はスキップ
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 新しいタイマーを設定
    timeoutRef.current = setTimeout(() => {
      onSave(value);
    }, delay);

    // クリーンアップ
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, onSave, delay]);
}

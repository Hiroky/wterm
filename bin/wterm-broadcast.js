#!/usr/bin/env node
// wterm-broadcast - 全セッションへメッセージ送信コマンド

const apiUrl = process.env.WTERM_API_URL;
const fromSessionId = process.env.WTERM_SESSION_ID;
const message = process.argv.slice(2).join(' ');

if (!apiUrl) {
  console.error('エラー: WTERM_API_URL 環境変数が設定されていません');
  console.error('このコマンドはwterm内のセッションから実行してください');
  process.exit(1);
}

if (!fromSessionId) {
  console.error('エラー: WTERM_SESSION_ID 環境変数が設定されていません');
  console.error('このコマンドはwterm内のセッションから実行してください');
  process.exit(1);
}

if (!message) {
  console.error('使用法: wterm-broadcast <message>');
  console.error('');
  console.error('例: wterm-broadcast ビルドが完了しました');
  process.exit(1);
}

try {
  const response = await fetch(`${apiUrl}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromSessionId,
      to: 'all',
      message: message
    })
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error(`エラー: ${result.message || '送信に失敗しました'}`);
    process.exit(1);
  }

  console.log('メッセージを全セッションに送信しました');
} catch (err) {
  console.error(`送信失敗: ${err.message}`);
  process.exit(1);
}

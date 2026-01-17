#!/usr/bin/env node
// wterm-send - セッション間メッセージ送信コマンド

const apiUrl = process.env.WTERM_API_URL;
const fromSessionId = process.env.WTERM_SESSION_ID;
const targetSessionId = process.argv[2];
const message = process.argv.slice(3).join(' ');

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

if (!targetSessionId || !message) {
  console.error('使用法: wterm-send <session-id> <message>');
  console.error('');
  console.error('例: wterm-send session-2 こんにちは');
  process.exit(1);
}

try {
  const response = await fetch(`${apiUrl}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromSessionId,
      to: targetSessionId,
      message: message
    })
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error(`エラー: ${result.message || '送信に失敗しました'}`);
    if (result.availableSessions && result.availableSessions.length > 0) {
      console.error(`利用可能なセッション: ${result.availableSessions.join(', ')}`);
    }
    process.exit(1);
  }

  console.log(`メッセージを ${targetSessionId} に送信しました`);
} catch (err) {
  console.error(`送信失敗: ${err.message}`);
  process.exit(1);
}

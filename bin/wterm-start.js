#!/usr/bin/env node
// wterm-start - 新しいセッション作成コマンド

const apiUrl = process.env.WTERM_API_URL;
const command = process.argv.slice(2).join(' ');

if (!apiUrl) {
  console.error('エラー: WTERM_API_URL 環境変数が設定されていません');
  console.error('このコマンドはwterm内のセッションから実行してください');
  process.exit(1);
}

try {
  const cwd = process.cwd();

  const response = await fetch(`${apiUrl}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: command || '',
      cwd: cwd
    })
  });

  const result = await response.json();

  if (!response.ok || !result.sessionId) {
    console.error(`エラー: ${result.error || 'セッション作成に失敗しました'}`);
    process.exit(1);
  }

  console.log(`新しいセッションを作成しました: ${result.sessionId}`);
} catch (err) {
  console.error(`セッション作成失敗: ${err.message}`);
  process.exit(1);
}

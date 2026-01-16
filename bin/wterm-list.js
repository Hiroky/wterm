#!/usr/bin/env bun
// wterm-list - アクティブセッション一覧表示コマンド

const apiUrl = process.env.WTERM_API_URL;

if (!apiUrl) {
  console.error('エラー: WTERM_API_URL 環境変数が設定されていません');
  console.error('このコマンドはwterm内のセッションから実行してください');
  process.exit(1);
}

try {
  const response = await fetch(`${apiUrl}/api/sessions`);
  const result = await response.json();

  if (!response.ok) {
    console.error('エラー: セッション一覧の取得に失敗しました');
    process.exit(1);
  }

  const sessions = result.sessions;

  if (sessions.length === 0) {
    console.log('アクティブなセッションはありません');
    process.exit(0);
  }

  console.log('アクティブセッション一覧:');
  console.log('─'.repeat(50));

  const currentSessionId = process.env.WTERM_SESSION_ID;

  sessions.forEach((session) => {
    const status = session.status === 'running' ? '🟢' : '🔴';
    const current = session.id === currentSessionId ? ' (現在)' : '';
    const command = session.command || 'PowerShell';
    const exitInfo = session.status === 'exited' ? ` [exit: ${session.exitCode}]` : '';
    
    console.log(`  ${status} ${session.id}${current}`);
    console.log(`     コマンド: ${command}${exitInfo}`);
    console.log(`     作成日時: ${new Date(session.createdAt).toLocaleString('ja-JP')}`);
    console.log('');
  });

} catch (err) {
  console.error(`取得失敗: ${err.message}`);
  process.exit(1);
}

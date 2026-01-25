#!/usr/bin/env node
// wterm-buffer - セッションのバッファ内容を取得するコマンド
// 送信時にバックエンドで位置が記録されるため、CLIでは単純にAPIを呼ぶだけ

const apiUrl = process.env.WTERM_API_URL;
const currentSessionId = process.env.WTERM_SESSION_ID;

// コマンドライン引数の解析
let targetSessionId = null;
let showHelp = false;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--help' || arg === '-h') {
    showHelp = true;
  } else if (!targetSessionId && !arg.startsWith('-')) {
    targetSessionId = arg;
  }
}

if (showHelp) {
  console.log('使用法: wterm-buffer [session-id]');
  console.log('');
  console.log('セッションのバッファ内容を取得します。');
  console.log('前回送信時点からの出力をエスケープシーケンス除去済みで返します。');
  console.log('session-idを省略すると現在のセッションが対象になります。');
  console.log('');
  console.log('オプション:');
  console.log('  --help, -h          このヘルプを表示');
  console.log('');
  console.log('例:');
  console.log('  wterm-buffer                    # 現在のセッションのバッファを取得');
  console.log('  wterm-buffer session-2          # session-2のバッファを取得');
  console.log('');
  console.log('注意: バッファ位置はwterm-sendまたはWebチャットから送信時に');
  console.log('      バックエンドで自動的に記録されます。');
  process.exit(0);
}

if (!apiUrl) {
  console.error('エラー: WTERM_API_URL 環境変数が設定されていません');
  console.error('このコマンドはwterm内のセッションから実行してください');
  process.exit(1);
}

// セッションIDが指定されていない場合は現在のセッションを使用
if (!targetSessionId) {
  if (!currentSessionId) {
    console.error('エラー: セッションIDを指定するか、wterm内で実行してください');
    process.exit(1);
  }
  targetSessionId = currentSessionId;
}

async function main() {
  try {
    // APIを呼び出し（clean=trueで追跡データを使用）
    const response = await fetch(`${apiUrl}/api/sessions/${targetSessionId}/buffer?clean=true`);
    const result = await response.json();

    if (!response.ok) {
      console.error(`エラー: ${result.error || 'バッファの取得に失敗しました'}`);
      process.exit(1);
    }

    // バッファ内容を出力
    if (result.content) {
      process.stdout.write(result.content);
      // 末尾に改行がなければ追加
      if (!result.content.endsWith('\n')) {
        process.stdout.write('\n');
      }
    }
  } catch (err) {
    console.error(`バッファ取得失敗: ${err.message}`);
    process.exit(1);
  }
}

main();

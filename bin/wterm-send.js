#!/usr/bin/env node
// wterm-send - セッション間メッセージ送信コマンド

const apiUrl = process.env.WTERM_API_URL;
const fromSessionId = process.env.WTERM_SESSION_ID;

// コマンドライン引数の解析
let waitForResponse = true;
let targetSessionId = null;
let messageStartIndex = 2;

if (process.argv[2] === '--no-wait' || process.argv[2] === '-n') {
  waitForResponse = false;
  targetSessionId = process.argv[3];
  messageStartIndex = 4;
} else {
  targetSessionId = process.argv[2];
}

const message = process.argv.slice(messageStartIndex).join(' ');

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
  console.error('使用法: wterm-send [--no-wait|-n] <session-id> <message>');
  console.error('');
  console.error('オプション:');
  console.error('  --no-wait, -n    レスポンスを待たずに終了（投げっぱなしモード）');
  console.error('');
  console.error('例:');
  console.error('  wterm-send session-2 こんにちは');
  console.error('  wterm-send --no-wait session-2 ビルド開始');
  process.exit(1);
}

try {
  const response = await fetch(`${apiUrl}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromSessionId,
      to: targetSessionId,
      message: message,
      waitForResponse: waitForResponse
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

  // 投げっぱなしモードの場合はここで終了
  if (!waitForResponse) {
    console.log('メッセージを送信しました');
    process.exit(0);
  }

  // レスポンス出力を整形して表示
  if (result.output) {
    // ANSIエスケープシーケンスを除去
    // eslint-disable-next-line no-control-regex
    const cleanOutput = result.output
      // カーソル位置移動シーケンス (ESC[row;colH) を改行に変換
      .replace(/\x1b\[[0-9]+;[0-9]+H/g, '\n')
      // カラーコードを除去
      .replace(/\x1b\[[^m]*m/g, '')
      // その他の制御シーケンスを除去
      .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
      // OSC シーケンスを除去
      .replace(/\x1b\][^\x07]*\x07/g, '')
      // その他のエスケープシーケンス
      .replace(/\x1b[=>]/g, '');

    // \r\n を \n に統一し、\r のみの場合も \n に変換
    const normalizedOutput = cleanOutput.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 行ごとに分割
    const lines = normalizedOutput.split('\n');

    // 送信したコマンド行とプロンプト行を除去
    const outputLines = [];
    let foundCommand = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 空行はスキップ（ただし出力の途中の空行は保持）
      if (!trimmedLine && outputLines.length === 0) {
        continue;
      }

      // 送信したコマンドを含む行をスキップ
      if (!foundCommand && line.includes(message)) {
        foundCommand = true;
        continue;
      }

      // プロンプト行をスキップ
      if (/^PS\s+[A-Z]?:?.*>\s*$/.test(trimmedLine)) {
        continue;
      }

      // それ以外は出力に追加
      outputLines.push(line);
    }

    // 末尾の空行を削除
    while (outputLines.length > 0 && !outputLines[outputLines.length - 1].trim()) {
      outputLines.pop();
    }

    // 出力を表示（改行なしで終わる）
    if (outputLines.length > 0) {
      process.stdout.write(outputLines.join('\n') + '\n');
    }
  }
} catch (err) {
  console.error(`送信失敗: ${err.message}`);
  process.exit(1);
}

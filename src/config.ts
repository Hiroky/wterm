// wterm - 設定管理モジュール
import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { Config, Shortcut, UILayout } from './types';

const CONFIG_PATH = './config.json';

// デフォルト設定
const DEFAULT_CONFIG: Config = {
  port: 3000,
  maxHistorySize: 50,
  bufferSize: 10000,
  processPollingInterval: 2000, // 2秒間隔でプロセス監視
  shortcuts: [
    {
      id: 'powershell',
      name: 'PowerShell',
      command: '',
      icon: '💻',
    },
  ],
  uiLayout: {
    showSidebar: true,
    sidebarPosition: 'left',
  },
  terminal: {
    fontFamily: 'Cascadia Code',
    fontSize: 14,
  },
};

let currentConfig: Config = { ...DEFAULT_CONFIG };

/**
 * 設定ファイルを読み込む
 */
export function loadConfig(): Config {
  try {
    if (!existsSync(CONFIG_PATH)) {
      // 設定ファイルがない場合はデフォルトで作成
      saveConfig(DEFAULT_CONFIG);
      currentConfig = { ...DEFAULT_CONFIG };
      return currentConfig;
    }

    const data = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(data) as Partial<Config>;

    // デフォルト値とマージ
    currentConfig = {
      ...DEFAULT_CONFIG,
      ...parsed,
      uiLayout: {
        ...DEFAULT_CONFIG.uiLayout,
        ...parsed.uiLayout,
      },
      terminal: {
        ...DEFAULT_CONFIG.terminal,
        ...parsed.terminal,
      },
    };

    // ワークスペースマイグレーション
    if (!currentConfig.workspaces || currentConfig.workspaces.length === 0) {
      currentConfig.workspaces = [{
        id: 'workspace-default',
        name: 'メイン',
        icon: '📁',
        sessions: [],
        layout: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
      currentConfig.activeWorkspaceId = 'workspace-default';
      saveConfig(currentConfig);
    }

    return currentConfig;
  } catch (error) {
    console.error('設定ファイルの読み込みに失敗しました:', error);
    throw new Error('設定ファイルの読み込みに失敗しました。config.jsonを確認してください。');
  }
}

/**
 * 設定ファイルに保存する
 */
export function saveConfig(config: Config): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    currentConfig = config;
  } catch (error) {
    console.error('設定ファイルの保存に失敗しました:', error);
    throw new Error('設定ファイルの保存に失敗しました。');
  }
}

/**
 * 現在の設定を取得
 */
export function getConfig(): Config {
  return currentConfig;
}

/**
 * ショートカットを追加
 */
export function addShortcut(shortcut: Shortcut): void {
  const config = getConfig();
  // 重複チェック
  if (config.shortcuts.find((s) => s.id === shortcut.id)) {
    throw new Error(`ショートカットID '${shortcut.id}' は既に存在します`);
  }
  config.shortcuts.push(shortcut);
  saveConfig(config);
}

/**
 * ショートカットを削除
 */
export function removeShortcut(id: string): void {
  const config = getConfig();
  const index = config.shortcuts.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error(`ショートカットID '${id}' が見つかりません`);
  }
  config.shortcuts.splice(index, 1);
  saveConfig(config);
}

/**
 * UIレイアウト設定を更新
 */
export function updateUILayout(layout: Partial<UILayout>): void {
  const config = getConfig();
  config.uiLayout = { ...config.uiLayout, ...layout };
  saveConfig(config);
}

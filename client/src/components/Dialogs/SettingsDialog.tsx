import { useState, useEffect, useCallback } from 'react';
import useStore from '../../store';
import type { TerminalSettings, UILayout } from '../../types';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'terminal' | 'ui' | 'workspaces' | 'shortcuts';

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const config = useStore((state) => state.config);
  const updateConfig = useStore((state) => state.updateConfig);
  const workspaces = useStore((state) => state.workspaces);
  const updateWorkspace = useStore((state) => state.updateWorkspace);

  const [activeTab, setActiveTab] = useState<TabType>('terminal');
  const [isSaving, setIsSaving] = useState(false);

  // ターミナル設定
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>({
    fontFamily: 'Consolas',
    fontSize: 14,
  });

  // UI設定
  const [uiLayout, setUiLayout] = useState<UILayout>({
    showSidebar: true,
    showHistoryPanel: true,
    sidebarPosition: 'left',
    defaultView: 'split',
  });

  // ワークスペース設定（cwdの編集用）
  const [workspaceSettings, setWorkspaceSettings] = useState<Record<string, string>>({});

  // configが変更されたら設定を更新
  useEffect(() => {
    if (config) {
      setTerminalSettings(config.terminal);
      setUiLayout(config.uiLayout);
    }
  }, [config]);

  // ワークスペースが変更されたら設定を更新
  useEffect(() => {
    const cwdMap: Record<string, string> = {};
    workspaces.forEach((ws) => {
      cwdMap[ws.id] = ws.cwd || '';
    });
    setWorkspaceSettings(cwdMap);
  }, [workspaces]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const updatedConfig = {
        terminal: terminalSettings,
        uiLayout: uiLayout,
      };

      const response = await fetch('/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      // ワークスペースの cwd を更新
      for (const ws of workspaces) {
        const newCwd = workspaceSettings[ws.id];
        if (newCwd !== undefined && newCwd !== ws.cwd) {
          await fetch(`/api/workspaces/${ws.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cwd: newCwd }),
          });
          updateWorkspace(ws.id, { cwd: newCwd });
        }
      }

      // ローカル状態を更新
      updateConfig(updatedConfig);
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [terminalSettings, uiLayout, workspaces, workspaceSettings, updateConfig, updateWorkspace, onClose]);

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'ui', label: 'UI Layout' },
    { id: 'workspaces', label: 'Workspaces' },
    { id: 'shortcuts', label: 'Shortcuts' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-lg border border-gray-600 bg-gray-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            x
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'terminal' && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Font Family
                </label>
                <select
                  value={terminalSettings.fontFamily}
                  onChange={(e) =>
                    setTerminalSettings({
                      ...terminalSettings,
                      fontFamily: e.target.value,
                    })
                  }
                  className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="Consolas">Consolas</option>
                  <option value="BIZ UDゴシック">BIZ UDゴシック</option>
                  <option value="monospace">Monospace</option>
                  <option value="Cascadia Code">Cascadia Code</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Source Code Pro">Source Code Pro</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Font Size: {terminalSettings.fontSize}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={terminalSettings.fontSize}
                  onChange={(e) =>
                    setTerminalSettings({
                      ...terminalSettings,
                      fontSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>10px</span>
                  <span>24px</span>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Preview
                </label>
                <div
                  className="rounded border border-gray-600 bg-gray-900 p-4"
                  style={{
                    fontFamily: terminalSettings.fontFamily,
                    fontSize: `${terminalSettings.fontSize}px`,
                  }}
                >
                  <span className="text-green-400">PS C:\Users\wterm&gt;</span>{' '}
                  <span className="text-white">echo "Hello World"</span>
                  <br />
                  <span className="text-gray-300">Hello World</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ui' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  Show Sidebar
                </label>
                <input
                  type="checkbox"
                  checked={uiLayout.showSidebar}
                  onChange={(e) =>
                    setUiLayout({ ...uiLayout, showSidebar: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  Show History Panel
                </label>
                <input
                  type="checkbox"
                  checked={uiLayout.showHistoryPanel}
                  onChange={(e) =>
                    setUiLayout({
                      ...uiLayout,
                      showHistoryPanel: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Sidebar Position
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="sidebarPosition"
                      value="left"
                      checked={uiLayout.sidebarPosition === 'left'}
                      onChange={() =>
                        setUiLayout({ ...uiLayout, sidebarPosition: 'left' })
                      }
                      className="text-blue-500"
                    />
                    <span className="text-sm text-gray-300">Left</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="sidebarPosition"
                      value="right"
                      checked={uiLayout.sidebarPosition === 'right'}
                      onChange={() =>
                        setUiLayout({ ...uiLayout, sidebarPosition: 'right' })
                      }
                      className="text-blue-500"
                    />
                    <span className="text-sm text-gray-300">Right</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Default View
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="defaultView"
                      value="split"
                      checked={uiLayout.defaultView === 'split'}
                      onChange={() =>
                        setUiLayout({ ...uiLayout, defaultView: 'split' })
                      }
                      className="text-blue-500"
                    />
                    <span className="text-sm text-gray-300">Split View</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="defaultView"
                      value="tab"
                      checked={uiLayout.defaultView === 'tab'}
                      onChange={() =>
                        setUiLayout({ ...uiLayout, defaultView: 'tab' })
                      }
                      className="text-blue-500"
                    />
                    <span className="text-sm text-gray-300">Tab View</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workspaces' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Configure the initial working directory for each workspace.
                New sessions will start in this directory.
              </p>
              {workspaces.length > 0 ? (
                <div className="space-y-3">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className="rounded border border-gray-600 bg-gray-700 p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-lg">{ws.icon}</span>
                        <span className="font-medium">{ws.name}</span>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">
                          Working Directory
                        </label>
                        <input
                          type="text"
                          value={workspaceSettings[ws.id] || ''}
                          onChange={(e) =>
                            setWorkspaceSettings({
                              ...workspaceSettings,
                              [ws.id]: e.target.value,
                            })
                          }
                          placeholder="C:\Users\..."
                          className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No workspaces configured.</p>
              )}
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Shortcuts configuration is read from config.json.
                Edit the file directly to add or modify shortcuts.
              </p>
              {config?.shortcuts && config.shortcuts.length > 0 ? (
                <div className="space-y-2">
                  {config.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center gap-3 rounded border border-gray-600 bg-gray-700 p-3"
                    >
                      <span className="text-2xl">{shortcut.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{shortcut.name}</div>
                        <div className="text-xs text-gray-400">
                          {shortcut.command || '(default shell)'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No shortcuts configured.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

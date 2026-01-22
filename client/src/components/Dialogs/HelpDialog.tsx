interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['Ctrl', 'Shift', 'T'], description: 'Create new session' },
  { keys: ['Ctrl', 'Shift', 'W'], description: 'Delete current session' },
  { keys: ['Ctrl', 'Shift', 'N'], description: 'Create new workspace' },
  { keys: ['Ctrl', ','], description: 'Open settings' },
  { keys: ['F1-F9'], description: 'Send message to session-N (in chat input)' },
];

const terminalCommands = [
  { command: '/send <session> <message>', description: 'Send message to specific session' },
  { command: '/broadcast <message>', description: 'Send message to all sessions' },
  { command: '/list', description: 'List all active sessions' },
  { command: '/help', description: 'Show available commands' },
];

const cliCommands = [
  { command: 'wterm-send <session> <message>', description: 'Send message to session (from CLI)' },
  { command: 'wterm-broadcast <message>', description: 'Broadcast message to all sessions' },
  { command: 'wterm-list', description: 'List all active sessions' },
];

export default function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-600 bg-gray-800 shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold">Help & Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            x
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-blue-400">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded bg-gray-700 px-3 py-2"
                >
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={keyIndex} className="flex items-center gap-1">
                        <kbd className="rounded bg-gray-600 px-2 py-0.5 text-xs font-mono">
                          {key}
                        </kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="text-gray-500">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-gray-300">
                    {shortcut.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Terminal Commands */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-green-400">
              Terminal Commands
            </h3>
            <div className="space-y-2">
              {terminalCommands.map((cmd, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 rounded bg-gray-700 px-3 py-2"
                >
                  <code className="text-xs text-yellow-300 font-mono whitespace-nowrap">
                    {cmd.command}
                  </code>
                  <span className="text-sm text-gray-300 text-right">
                    {cmd.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* CLI Commands */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-purple-400">
              CLI Commands (from other terminals)
            </h3>
            <div className="space-y-2">
              {cliCommands.map((cmd, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 rounded bg-gray-700 px-3 py-2"
                >
                  <code className="text-xs text-yellow-300 font-mono whitespace-nowrap">
                    {cmd.command}
                  </code>
                  <span className="text-sm text-gray-300 text-right">
                    {cmd.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-orange-400">Tips</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-orange-400">*</span>
                Drag terminal headers to rearrange the layout
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400">*</span>
                Drag the dividers between panels to resize
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400">*</span>
                Double-click workspace names to rename them
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400">*</span>
                Layout and settings are auto-saved
              </li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-6 py-4 text-center">
          <button
            onClick={onClose}
            className="rounded bg-blue-600 px-6 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

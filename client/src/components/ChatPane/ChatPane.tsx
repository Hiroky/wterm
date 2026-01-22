import { useState, useRef, useEffect } from 'react';
import useStore from '../../store';

export default function ChatPane() {
  const { sessions, activeSessionId, messages } = useStore();
  const [inputValue, setInputValue] = useState('');
  const [targetSession, setTargetSession] = useState<string>('all');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || !activeSessionId || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: activeSessionId,
          to: targetSession,
          message: inputValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setInputValue('');
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }

  async function getBuffer(sessionId: string) {
    try {
      const response = await fetch(`/api/history?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to get buffer');
      }
      const data = await response.json();
      console.log(`Buffer for ${sessionId}:`, data);
    } catch (error) {
      console.error('Error getting buffer:', error);
    }
  }

  return (
    <div className="flex h-64 flex-col border-t border-gray-700 bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <h3 className="font-semibold">Messages</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
            <div>
              <p>No messages yet</p>
              <p className="mt-1 text-xs">
                Send messages between sessions using the form below
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded bg-gray-700 p-3 text-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-400">
                      {msg.from}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="font-semibold text-green-400">
                      {msg.to === 'all' ? 'ALL' : msg.to}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-200">{msg.content}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={sendMessage}
        className="border-t border-gray-700 p-3"
      >
        <div className="mb-2 flex items-center gap-2">
          <label className="text-xs text-gray-400">To:</label>
          <select
            value={targetSession}
            onChange={(e) => setTargetSession(e.target.value)}
            className="flex-1 rounded bg-gray-700 px-3 py-1 text-sm"
          >
            <option value="all">All Sessions (Broadcast)</option>
            {sessions
              .filter((s) => s.id !== activeSessionId)
              .map((session) => (
                <option key={session.id} value={session.id}>
                  {session.id}
                </option>
              ))}
          </select>
          {sessions.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const sessionId = prompt('Enter session ID to get buffer:');
                if (sessionId) getBuffer(sessionId);
              }}
              className="rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
            >
              Get Buffer
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              activeSessionId
                ? 'Type a message...'
                : 'Select a session first...'
            }
            disabled={!activeSessionId || isSending}
            className="flex-1 rounded bg-gray-700 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!activeSessionId || !inputValue.trim() || isSending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Tip: Use Ctrl+Enter to send quickly
        </p>
      </form>
    </div>
  );
}

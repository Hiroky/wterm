import { useEffect } from 'react';
import useStore from '../../store';
import type { ToastMessage } from '../../store';

export default function Toast() {
  const toasts = useStore((state) => state.toasts);
  const removeToast = useStore((state) => state.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastMessage;
  onClose: () => void;
}) {
  useEffect(() => {
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  }[toast.type];

  const icon = {
    success: 'o',
    error: 'x',
    info: 'i',
    warning: '!',
  }[toast.type];

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg ${bgColor} animate-slide-in`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white bg-opacity-20 text-sm font-bold">
        {icon}
      </span>
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-white opacity-70 hover:opacity-100"
      >
        x
      </button>
    </div>
  );
}

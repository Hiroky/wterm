import { useDroppable } from '@dnd-kit/core';

interface DropZoneProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  sessionId: string;
}

export default function DropZone({ position, sessionId }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `dropzone-${sessionId}-${position}`,
    data: {
      sessionId,
      position,
    },
  });

  const positionStyles = {
    top: 'absolute top-0 left-0 right-0 h-1/4',
    bottom: 'absolute bottom-0 left-0 right-0 h-1/4',
    left: 'absolute top-0 bottom-0 left-0 w-1/4',
    right: 'absolute top-0 bottom-0 right-0 w-1/4',
  };

  return (
    <div
      ref={setNodeRef}
      className={`${positionStyles[position]} pointer-events-auto transition-colors ${
        isOver ? 'bg-blue-500 bg-opacity-30 border-2 border-blue-500' : ''
      }`}
    />
  );
}

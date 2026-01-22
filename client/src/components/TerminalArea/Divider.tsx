import { useRef, useState, useEffect } from 'react';

interface DividerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

export default function Divider({ direction, onResize }: DividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<number>(0);
  const isHorizontal = direction === 'horizontal';

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = isHorizontal ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;

      if (delta !== 0) {
        onResize(delta);
        startPosRef.current = currentPos;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isHorizontal, onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = isHorizontal ? e.clientX : e.clientY;
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        ${isDragging ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}
        flex-shrink-0
        transition-colors
        select-none
      `}
      style={{
        userSelect: 'none',
      }}
    />
  );
}

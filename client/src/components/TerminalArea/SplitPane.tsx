import { useState, useRef, Fragment } from 'react';
import type { ReactNode } from 'react';
import Divider from './Divider';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  sizes: number[];
  children: ReactNode[];
  onSizesChange?: (newSizes: number[]) => void;
}

export default function SplitPane({ direction, sizes: initialSizes, children, onSizesChange }: SplitPaneProps) {
  const [sizes, setSizes] = useState<number[]>(initialSizes);
  const containerRef = useRef<HTMLDivElement>(null);
  const isHorizontal = direction === 'horizontal';

  const MIN_SIZE_PERCENT = 10;

  const handleResize = (index: number, delta: number) => {
    if (!containerRef.current) return;

    const containerSize = isHorizontal
      ? containerRef.current.offsetWidth
      : containerRef.current.offsetHeight;

    // Convert delta to percentage
    const deltaPercent = (delta / containerSize) * 100;

    setSizes((prevSizes) => {
      const newSizes = [...prevSizes];

      // Update the two adjacent panes
      const leftSize = newSizes[index] + deltaPercent;
      const rightSize = newSizes[index + 1] - deltaPercent;

      // Check minimum size constraints
      if (leftSize < MIN_SIZE_PERCENT || rightSize < MIN_SIZE_PERCENT) {
        return prevSizes;
      }

      newSizes[index] = leftSize;
      newSizes[index + 1] = rightSize;

      // Notify parent of size change
      onSizesChange?.(newSizes);

      return newSizes;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full`}
    >
      {children.map((child, index) => (
        <Fragment key={index}>
          <div
            style={{
              flex: `${sizes[index] || 50} 1 0%`,
            }}
            className="relative overflow-hidden"
          >
            {child}
          </div>
          {index < children.length - 1 && (
            <Divider
              direction={direction}
              onResize={(delta) => handleResize(index, delta)}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

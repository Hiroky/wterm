import { ReactNode } from 'react';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  sizes: number[];
  children: ReactNode[];
}

export default function SplitPane({ direction, sizes, children }: SplitPaneProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full`}>
      {children.map((child, index) => (
        <div
          key={index}
          style={{
            flex: `${sizes[index] || 50} 1 0%`,
          }}
          className="relative overflow-hidden"
        >
          {child}
        </div>
      ))}
    </div>
  );
}

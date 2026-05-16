// ============================================================
// NEUROTEK AI — Slider Component
// ============================================================
import React, { useRef, useCallback, useState } from 'react';
import clsx from 'clsx';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  color?: string;
  label?: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
  vertical?: boolean;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  color = '#7c3aed',
  label,
  showValue = false,
  formatValue = (v) => String(v),
  vertical = false,
  className,
  disabled = false,
}: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) onChange?.(Number(e.target.value));
    },
    [disabled, onChange]
  );

  return (
    <div className={clsx('flex', vertical ? 'flex-col items-center gap-1' : 'flex-col gap-1', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-xs text-text-muted">{label}</span>}
          {showValue && <span className="text-xs font-mono text-text-accent">{formatValue(value)}</span>}
        </div>
      )}
      <div className="relative flex items-center" style={{ height: vertical ? 120 : 'auto' }}>
        <div
          className={clsx(
            'relative flex-1',
            vertical ? 'h-full w-4 flex flex-col justify-center' : 'h-4 w-full flex items-center'
          )}
        >
          <div
            className={clsx('absolute rounded-full', vertical ? 'w-1.5 h-full left-1/2 -translate-x-1/2' : 'h-1.5 w-full top-1/2 -translate-y-1/2')}
            style={{ background: 'rgba(255,255,255,0.08)' }}
          />
          <div
            className={clsx('absolute rounded-full transition-all duration-75', vertical ? 'w-1.5 left-1/2 -translate-x-1/2 bottom-0' : 'h-1.5 top-1/2 -translate-y-1/2 left-0')}
            style={{
              background: `linear-gradient(${vertical ? '0deg' : '90deg'}, ${color}80, ${color})`,
              boxShadow: isDragging ? `0 0 8px ${color}60` : 'none',
              [vertical ? 'height' : 'width']: `${pct}%`,
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            className={clsx('absolute inset-0 opacity-0 cursor-pointer w-full h-full', disabled && 'cursor-not-allowed')}
            style={{ direction: vertical ? 'rtl' : 'ltr' }}
          />
          <div
            className={clsx('absolute w-3.5 h-3.5 rounded-full border-2 pointer-events-none transition-transform duration-75', isDragging ? 'scale-125' : 'scale-100')}
            style={{
              background: '#fff',
              borderColor: color,
              boxShadow: `0 0 6px ${color}80`,
              [vertical ? 'bottom' : 'left']: `calc(${pct}% - 7px)`,
              [vertical ? 'left' : 'top']: '50%',
              transform: vertical ? `translateX(-50%) ${isDragging ? 'scale(1.25)' : ''}` : `translateY(-50%) ${isDragging ? 'scale(1.25)' : ''}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  color?: string;
  size?: number;
  onChange?: (v: number) => void;
}

export function Knob({ value, min = 0, max = 100, label, color = '#7c3aed', size = 40, onChange }: KnobProps) {
  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative rounded-full border-2 cursor-pointer"
        style={{ width: size, height: size, borderColor: `${color}40`, background: 'rgba(15,15,26,0.8)' }}
      >
        <div
          className="absolute inset-1.5 rounded-full"
          style={{ background: `conic-gradient(${color} 0%, ${color}30 ${pct * 100}%, transparent ${pct * 100}%)` }}
        />
        <div
          className="absolute w-1 rounded-full"
          style={{
            height: size * 0.3,
            background: color,
            top: '10%',
            left: '50%',
            transformOrigin: `50% ${size * 0.4}px`,
            transform: `translateX(-50%) rotate(${angle}deg)`,
          }}
        />
      </div>
      {label && <span className="text-[9px] text-text-muted uppercase tracking-wider">{label}</span>}
    </div>
  );
}

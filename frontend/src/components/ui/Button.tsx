// ============================================================
// NEUROTEK AI — Button Component
// ============================================================
import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'cyan';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  glow?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-primary hover:bg-violet-600 text-white border border-violet-600 hover:border-violet-500 shadow-glow-purple',
  secondary:
    'bg-bg-card hover:bg-bg-hover text-text-primary border border-border-default hover:border-border-accent',
  ghost:
    'bg-transparent hover:bg-white/5 text-text-secondary hover:text-text-primary border border-transparent',
  danger:
    'bg-red-900/30 hover:bg-red-800/40 text-red-400 hover:text-red-300 border border-red-800/50 hover:border-red-600/60',
  success:
    'bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-400 hover:text-emerald-300 border border-emerald-800/50',
  cyan:
    'bg-cyan-900/30 hover:bg-cyan-800/40 text-cyan-400 hover:text-cyan-300 border border-cyan-800/50 hover:border-cyan-600/60',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-base gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  glow = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
        'cursor-pointer select-none outline-none',
        variantClasses[variant],
        sizeClasses[size],
        glow && variant === 'primary' && 'animate-glow',
        fullWidth && 'w-full',
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && <span className="flex-shrink-0">{iconRight}</span>}
    </motion.button>
  );
}

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconRight'> {
  icon: React.ReactNode;
  tooltip?: string;
}

export function IconButton({ icon, tooltip, size = 'md', className, ...props }: IconButtonProps) {
  const sizeMap: Record<ButtonSize, string> = {
    xs: 'w-6 h-6',
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <Button size={size} className={clsx('!p-0 flex-shrink-0', sizeMap[size], className)} title={tooltip} {...props}>
      {icon}
    </Button>
  );
}

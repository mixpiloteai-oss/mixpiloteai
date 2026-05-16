// ============================================================
// NEUROTEK AI — Card Component
// ============================================================
import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  active?: boolean;
  glow?: 'purple' | 'cyan' | 'amber' | 'none';
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  gradient?: string;
}

const glowClasses = {
  purple: 'hover:shadow-glow-purple hover:border-violet-500/40',
  cyan: 'hover:shadow-glow-cyan hover:border-cyan-500/40',
  amber: 'hover:shadow-glow-amber hover:border-amber-500/40',
  none: '',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  className,
  hover = false,
  active = false,
  glow = 'none',
  onClick,
  padding = 'md',
  gradient,
}: CardProps) {
  const isInteractive = hover || !!onClick;

  return (
    <motion.div
      whileHover={isInteractive ? { y: -2 } : {}}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={clsx(
        'rounded-xl border transition-all duration-200',
        'bg-bg-card/70 backdrop-blur-md',
        'border-border-subtle',
        paddingClasses[padding],
        isInteractive && 'cursor-pointer',
        isInteractive && glowClasses[glow],
        active && 'border-accent-primary/40 bg-accent-primary/10 shadow-glow-purple',
        className
      )}
      style={gradient ? { background: gradient } : undefined}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
}

export function CardHeader({ title, subtitle, action, icon, accent }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: accent ? `${accent}20` : 'rgba(124,58,237,0.15)', color: accent ?? '#7c3aed' }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  positive?: boolean;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
}

export function StatCard({ label, value, change, positive, icon, accent = '#7c3aed', className }: StatCardProps) {
  return (
    <Card className={clsx('relative overflow-hidden', className)} hover glow="purple">
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-8 translate-x-8"
        style={{ background: accent }}
      />
      <div className="relative">
        {icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ background: `${accent}20`, color: accent }}
          >
            {icon}
          </div>
        )}
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        {change && (
          <p className={clsx('text-xs mt-1', positive ? 'text-emerald-400' : 'text-red-400')}>
            {positive ? '+' : ''}{change}
          </p>
        )}
      </div>
    </Card>
  );
}

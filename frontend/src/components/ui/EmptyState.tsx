// ============================================================
// NEUROTEK AI — Reusable Empty State
// ============================================================
import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: compact ? '24px 16px' : '48px 24px',
        gap: compact ? 8 : 16,
        color: 'rgba(255,255,255,0.4)',
      }}
    >
      {icon && (
        <div style={{
          width: compact ? 40 : 56, height: compact ? 40 : 56,
          borderRadius: compact ? 10 : 14,
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(167,139,250,0.5)',
        }}>
          {icon}
        </div>
      )}
      <div>
        <p style={{
          fontSize: compact ? 13 : 15, fontWeight: 600,
          color: 'rgba(255,255,255,0.55)', marginBottom: 4,
        }}>
          {title}
        </p>
        {description && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, maxWidth: 260 }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4, padding: '8px 20px', borderRadius: 8,
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.25)',
            color: '#a78bfa', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

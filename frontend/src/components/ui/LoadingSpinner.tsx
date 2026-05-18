// ============================================================
// NEUROTEK AI — Loading Spinner variants
// ============================================================
import React from 'react';

interface SpinnerProps {
  size?: number;
  color?: string;
  label?: string;
}

export function Spinner({ size = 20, color = '#7c3aed', label }: SpinnerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
        <circle cx="12" cy="12" r="10" stroke={`${color}30`} strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </svg>
      {label && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{label}</span>}
    </div>
  );
}

export function PulseLoader({ color = '#7c3aed' }: { color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: color,
            animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

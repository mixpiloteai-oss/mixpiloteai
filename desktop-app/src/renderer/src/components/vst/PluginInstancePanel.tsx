import React, { useCallback } from 'react'
import { useVstStore } from '../../store/vstStore'
import type { LoadedInstance, PluginWindowInfo } from '../../audio/vst/vstTypes'

// ── Plugin Instance Panel ──────────────────────────────────────────────────────
// Shows all open plugin instances with controls per instance.
// CPU usage shows "N/A until native addon" until vst3-node is linked.

const STATUS_COLORS: Record<string, string> = {
  active: '#60c060',
  bypassed: '#c0c060',
  unknown: '#888',
}

export function PluginInstancePanel(): React.ReactElement {
  const {
    loadedInstances,
    openWindows,
    unloadInstance,
    setBypass,
    setSelectedInstance,
    selectedInstanceId,
    openWindow,
    closeWindow,
    pinWindow,
  } = useVstStore()

  const instances = Object.values(loadedInstances)
  const windowsByInstanceId = new Map<string, PluginWindowInfo>(
    openWindows.map(w => [w.instanceId, w])
  )

  const handleRemove = useCallback((instanceId: string) => {
    void unloadInstance(instanceId)
  }, [unloadInstance])

  const handleBypass = useCallback((instanceId: string, bypassed: boolean) => {
    void setBypass(instanceId, bypassed)
  }, [setBypass])

  const handleOpenWindow = useCallback((instance: LoadedInstance) => {
    void openWindow(instance.instanceId, instance.pluginName)
  }, [openWindow])

  const handleCloseWindow = useCallback((instanceId: string) => {
    void closeWindow(instanceId)
  }, [closeWindow])

  const handlePin = useCallback((instanceId: string, pinned: boolean) => {
    void pinWindow(instanceId, pinned)
  }, [pinWindow])

  if (instances.length === 0) {
    return (
      <div style={{ padding: 24, color: '#555', textAlign: 'center', fontSize: 13 }}>
        No plugin instances loaded.
        <br />
        <span style={{ fontSize: 11, color: '#444' }}>
          Double-click a plugin in the browser to load it.
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111122', color: '#ddd' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#c0c0ff' }}>
          Plugin Instances ({instances.length})
        </span>
        <span style={{ fontSize: 11, color: '#555' }}>
          CPU: N/A until native addon
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {instances.map(instance => {
          const isSelected = selectedInstanceId === instance.instanceId
          const winInfo = windowsByInstanceId.get(instance.instanceId)
          const status = instance.bypassed ? 'bypassed' : 'active'

          return (
            <div
              key={instance.instanceId}
              onClick={() => setSelectedInstance(instance.instanceId)}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #1e1e2e',
                background: isSelected ? '#1a1a3a' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Status badge */}
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: STATUS_COLORS[status] ?? STATUS_COLORS['unknown'],
                  flexShrink: 0,
                  boxShadow: `0 0 4px ${STATUS_COLORS[status] ?? STATUS_COLORS['unknown']}`,
                }} />

                {/* Plugin name */}
                <div style={{ flex: 1, fontWeight: 'bold', fontSize: 13, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {instance.pluginName}
                </div>

                {/* Status label */}
                <span style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 8,
                  background: instance.bypassed ? '#3a3a1a' : '#1a3a1a',
                  color: STATUS_COLORS[status],
                  border: `1px solid ${STATUS_COLORS[status]}55`,
                  flexShrink: 0,
                }}>
                  {status}
                </span>
              </div>

              {/* Instance ID */}
              <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {instance.instanceId}
              </div>

              {/* CPU placeholder */}
              <div style={{ fontSize: 11, color: '#555' }}>
                CPU: <span style={{ color: '#666' }}>N/A</span>
                {' · '}
                Params: <span style={{ color: '#666' }}>N/A until native addon</span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {/* Open/close window */}
                {winInfo ? (
                  <>
                    <ActionButton
                      label="Close UI"
                      color="#8060a0"
                      onClick={(e) => { e.stopPropagation(); handleCloseWindow(instance.instanceId) }}
                    />
                    <ActionButton
                      label={winInfo.pinned ? 'Unpin' : 'Pin'}
                      color="#6080a0"
                      onClick={(e) => { e.stopPropagation(); handlePin(instance.instanceId, !winInfo.pinned) }}
                    />
                  </>
                ) : (
                  <ActionButton
                    label="Open UI"
                    color="#6040a0"
                    onClick={(e) => { e.stopPropagation(); handleOpenWindow(instance) }}
                  />
                )}

                {/* Bypass toggle */}
                <ActionButton
                  label={instance.bypassed ? 'Enable' : 'Bypass'}
                  color={instance.bypassed ? '#606020' : '#404060'}
                  onClick={(e) => { e.stopPropagation(); handleBypass(instance.instanceId, !instance.bypassed) }}
                />

                {/* Remove */}
                <ActionButton
                  label="Remove"
                  color="#601818"
                  textColor="#ff8080"
                  onClick={(e) => { e.stopPropagation(); handleRemove(instance.instanceId) }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ActionButtonProps {
  label: string
  color: string
  textColor?: string
  onClick: (e: React.MouseEvent) => void
}

function ActionButton({ label, color, textColor, onClick }: ActionButtonProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px',
        background: color + '33',
        border: `1px solid ${color}88`,
        color: textColor ?? '#c0c0d0',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 11,
      }}
    >
      {label}
    </button>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { vstClient } from '../../audio/vst/VstPluginClient'
import { vstParameterManager } from '../../audio/vst/VstParameterManager'
import type { ParameterValue } from '../../audio/vst/vstTypes'

// ── Plugin Parameter Panel ─────────────────────────────────────────────────────
// Displays all parameters for a loaded plugin instance.

interface PluginParameterPanelProps {
  instanceId: string
}

export function PluginParameterPanel({ instanceId }: PluginParameterPanelProps): React.ReactElement {
  const [parameters, setParameters] = useState<ParameterValue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const automatedParams = vstParameterManager.getAutomatedParams(instanceId)
  const automatedSet = new Set(automatedParams)

  const fetchParameters = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = await vstClient.getAllParameters(instanceId)
      setParameters(params)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parameters')
    } finally {
      setLoading(false)
    }
  }, [instanceId])

  useEffect(() => {
    void fetchParameters()
  }, [fetchParameters])

  const handleReset = useCallback(async () => {
    // Reset all to default (0.5 normalized)
    for (const param of parameters) {
      try {
        await vstClient.setParameter(instanceId, param.index, 0.5)
      } catch {
        // Ignore individual failures
      }
    }
    void fetchParameters()
  }, [instanceId, parameters, fetchParameters])

  if (loading) {
    return (
      <div style={{ padding: 16, color: '#888', fontSize: 13, textAlign: 'center' }}>
        Loading parameters...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: '#c04040', fontSize: 13 }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderBottom: '1px solid #333',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#c0c0e0', flex: 1 }}>
          Parameters
        </span>
        <button
          onClick={() => { void handleReset() }}
          style={{
            padding: '3px 10px',
            background: '#2a2a4a',
            border: '1px solid #5a5a9a',
            color: '#9090cc',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Reset All
        </button>
      </div>

      {/* Parameter list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {parameters.length === 0 ? (
          <div style={{ padding: 16, color: '#666', fontSize: 12, textAlign: 'center' }}>
            No parameters available
          </div>
        ) : (
          parameters.map(param => (
            <div
              key={param.index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                borderBottom: '1px solid #1a1a1a',
              }}
            >
              {automatedSet.has(param.index) && (
                <span
                  title="Automated"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#8060ff',
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: '#c0c0c0',
                  marginLeft: automatedSet.has(param.index) ? 0 : 16,
                }}
              >
                {param.name}
              </span>
              <span style={{ fontSize: 11, color: '#aaa', minWidth: 80, textAlign: 'right' }}>
                {param.displayValue} {param.unit}
              </span>
              <span style={{ fontSize: 11, color: '#888', minWidth: 40, textAlign: 'right' }}>
                {Math.round(param.normalizedValue * 100)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

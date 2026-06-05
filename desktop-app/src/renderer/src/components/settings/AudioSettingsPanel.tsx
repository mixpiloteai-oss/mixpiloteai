// ── AudioSettingsPanel.tsx ─────────────────────────────────────────────────────
// UI for audio device, buffer size, and sample rate configuration.
// Calls the existing IPC handlers: audio-detect-drivers, audio-detect-devices,
// audio-set-driver, audio-set-buffer-size, audio-set-sample-rate.

import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../../ipc/ipcClient'
import { toast } from '../../store/toastStore'

interface DriverInfo {
  name: string
  latencyMs: number
  supported: boolean
}

interface DeviceInfo {
  id: string
  name: string
  maxInputChannels: number
  maxOutputChannels: number
  defaultSampleRate: number
}

interface AudioConfig {
  driver: string
  deviceName: string
  bufferSize: number
  sampleRate: number
}

const BUFFER_SIZES = [64, 128, 256, 512, 1024, 2048]
const SAMPLE_RATES = [44100, 48000, 88200, 96000, 192000]

function latencyMs(bufferSize: number, sampleRate: number): string {
  return ((bufferSize / sampleRate) * 1000).toFixed(1)
}

export default function AudioSettingsPanel() {
  const [drivers,  setDrivers]  = useState<DriverInfo[]>([])
  const [devices,  setDevices]  = useState<DeviceInfo[]>([])
  const [config,   setConfig]   = useState<AudioConfig>({
    driver: '',
    deviceName: '',
    bufferSize: 512,
    sampleRate: 44100,
  })
  const [loading,  setLoading]  = useState(false)
  const [applying, setApplying] = useState(false)

  const detect = useCallback(async () => {
    setLoading(true)
    try {
      const [driverResult, deviceResult] = await Promise.all([
        ipc.audioDetectDrivers(),
        ipc.audioDetectDevices(),
      ])

      // Normalise to arrays (IPC returns unknown)
      const driverArr: DriverInfo[] = Array.isArray(driverResult)
        ? (driverResult as DriverInfo[])
        : []
      const deviceArr: DeviceInfo[] = Array.isArray(deviceResult)
        ? (deviceResult as DeviceInfo[])
        : []

      setDrivers(driverArr)
      setDevices(deviceArr)

      if (driverArr.length > 0 && !config.driver) {
        const best = driverArr.find(d => d.supported) ?? driverArr[0]
        setConfig(c => ({ ...c, driver: best.name }))
      }
    } catch (err) {
      toast.error('Audio detect failed', err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [config.driver])

  useEffect(() => { void detect() }, [detect])

  async function apply() {
    setApplying(true)
    try {
      await ipc.audioSetDriver(config.driver, config.deviceName)
      await ipc.audioSetBufferSize(config.bufferSize)
      await ipc.audioSetSampleRate(config.sampleRate)
      toast.success('Audio settings applied', `${config.driver} · ${config.bufferSize} frames · ${config.sampleRate / 1000}kHz`)
    } catch (err) {
      toast.error('Failed to apply audio settings', err instanceof Error ? err.message : undefined)
    } finally {
      setApplying(false)
    }
  }

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #1c1c2e' }}>
      <label style={{ fontSize: 12, color: '#64748b', width: 120, flexShrink: 0 }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )

  const Select = ({ value, onChange, options }: {
    value: string | number
    onChange: (v: string) => void
    options: { value: string | number; label: string }[]
  }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 8,
        background: '#0f0f1a', border: '1px solid #1c1c2e', color: '#e2e8f0',
        outline: 'none', cursor: 'pointer',
      }}
    >
      {options.map(o => (
        <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
      ))}
    </select>
  )

  return (
    <div style={{ padding: '20px 24px', minWidth: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Audio Settings</h2>
          <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Driver, device, buffer, sample rate</p>
        </div>
        <button
          onClick={() => void detect()}
          disabled={loading}
          style={{
            fontSize: 11, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
            background: '#1c1c2e', border: '1px solid #2d2d3e', color: '#94a3b8',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Detecting…' : '↺ Refresh'}
        </button>
      </div>

      {/* Driver */}
      <Row label="Audio Driver">
        {drivers.length > 0 ? (
          <Select
            value={config.driver}
            onChange={v => setConfig(c => ({ ...c, driver: v }))}
            options={drivers.map(d => ({
              value: d.name,
              label: `${d.name}${d.supported ? ` (~${d.latencyMs}ms)` : ' (not available)'}`,
            }))}
          />
        ) : (
          <span style={{ fontSize: 11, color: '#475569' }}>
            {loading ? 'Detecting drivers…' : 'No drivers detected'}
          </span>
        )}
      </Row>

      {/* Output Device */}
      <Row label="Output Device">
        {devices.length > 0 ? (
          <Select
            value={config.deviceName}
            onChange={v => setConfig(c => ({ ...c, deviceName: v }))}
            options={[
              { value: '', label: 'Default device' },
              ...devices
                .filter(d => d.maxOutputChannels > 0)
                .map(d => ({ value: d.name, label: d.name })),
            ]}
          />
        ) : (
          <span style={{ fontSize: 11, color: '#475569' }}>
            {loading ? 'Scanning devices…' : 'No devices found'}
          </span>
        )}
      </Row>

      {/* Buffer Size */}
      <Row label="Buffer Size">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Select
            value={config.bufferSize}
            onChange={v => setConfig(c => ({ ...c, bufferSize: Number(v) }))}
            options={BUFFER_SIZES.map(b => ({ value: b, label: `${b} samples` }))}
          />
          <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap', width: 70 }}>
            ≈ {latencyMs(config.bufferSize, config.sampleRate)} ms
          </span>
        </div>
      </Row>

      {/* Sample Rate */}
      <Row label="Sample Rate">
        <Select
          value={config.sampleRate}
          onChange={v => setConfig(c => ({ ...c, sampleRate: Number(v) }))}
          options={SAMPLE_RATES.map(r => ({ value: r, label: `${r / 1000} kHz` }))}
        />
      </Row>

      {/* Latency summary */}
      <div style={{
        marginTop: 16, padding: '10px 14px', borderRadius: 8,
        background: '#0a0a0f', border: '1px solid #1c1c2e',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569' }}>Estimated round-trip latency</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
            {latencyMs(config.bufferSize * 2, config.sampleRate)} ms
          </span>
        </div>
        <p style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>
          Changes take effect immediately. Restart recommended after driver switch.
        </p>
      </div>

      {/* Apply button */}
      <button
        onClick={() => void apply()}
        disabled={applying}
        style={{
          marginTop: 20, width: '100%', padding: '10px 0', borderRadius: 9, fontSize: 13,
          fontWeight: 600, cursor: 'pointer', transition: 'opacity 150ms',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          border: 'none', color: '#fff', opacity: applying ? 0.6 : 1,
        }}
      >
        {applying ? 'Applying…' : 'Apply Audio Settings'}
      </button>
    </div>
  )
}

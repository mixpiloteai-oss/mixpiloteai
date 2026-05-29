// ─── ChannelStripUI.tsx ───────────────────────────────────────────────────────
// Re-exports the existing channel strip components for import-path compatibility.
// New consumers should import ChannelStripUI rather than ChannelStrip directly.

export {
  TrackChannelStrip,
  BusChannelStrip,
  faderPosToDb,
  dbToFaderPos,
} from './ChannelStrip'

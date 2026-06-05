// Audio decoding worker — receives ArrayBuffer, decodes via OfflineAudioContext,
// returns Float32Array channels back to main thread.
// Uses OfflineAudioContext which IS available in Workers in Electron/Chromium.

self.onmessage = async (e: MessageEvent<{ id: string; buffer: ArrayBuffer; sampleRate: number }>) => {
  const { id, buffer, sampleRate } = e.data
  try {
    // OfflineAudioContext is available in Workers in Chromium/Electron
    const ctx = new OfflineAudioContext(2, 1, sampleRate)
    const decoded = await ctx.decodeAudioData(buffer)
    // Transfer channel data as Transferable ArrayBuffers for zero-copy
    const channels: Float32Array[] = []
    const transferList: ArrayBuffer[] = []
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c).slice() // copy to own buffer
      channels.push(ch)
      transferList.push(ch.buffer)
    }
    ;(self as unknown as Worker).postMessage({
      id,
      ok: true,
      sampleRate: decoded.sampleRate,
      length: decoded.length,
      duration: decoded.duration,
      numberOfChannels: decoded.numberOfChannels,
      channels,
    }, transferList)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: (err as Error).message })
  }
}

import { IpcMain } from 'electron'

const module = {
  register(ipcMain: IpcMain): void {
    ipcMain.handle('get-midi-devices', async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const midi = require('@julusian/midi')
        const input = new midi.Input()
        const output = new midi.Output()
        const inputs: string[]  = Array.from({ length: input.getPortCount()  }, (_, i) => input.getPortName(i))
        const outputs: string[] = Array.from({ length: output.getPortCount() }, (_, i) => output.getPortName(i))
        input.closePort()
        output.closePort()
        return { inputs, outputs }
      } catch {
        return { inputs: [], outputs: [] }
      }
    })
  }
}

export default module

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { writeFile, rename, readFile } from 'node:fs/promises'

export class CorruptionGuard {
  async hashFile(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash   = createHash('sha256')
      const stream = createReadStream(filepath)
      stream.on('data', chunk => hash.update(chunk as Buffer))
      stream.on('end',  ()    => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  async writeProtected(filepath: string, data: string): Promise<void> {
    const tmp = filepath + '.tmp'
    await writeFile(tmp, data, 'utf8')
    await rename(tmp, filepath)
    const checksum = await this.hashFile(filepath)
    await writeFile(filepath + '.sha256', checksum, 'utf8')
  }

  async verifyFile(filepath: string): Promise<{ ok: boolean; expected?: string; actual?: string }> {
    try {
      const expected = (await readFile(filepath + '.sha256', 'utf8')).trim()
      const actual   = await this.hashFile(filepath)
      return { ok: expected === actual, expected, actual }
    } catch {
      return { ok: false }
    }
  }
}

export const corruptionGuard = new CorruptionGuard()

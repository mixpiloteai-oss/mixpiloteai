#!/usr/bin/env node
// Generates minimal valid placeholder icons for development builds.
// Replace with real brand icons before production release.
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const assetsDir = path.join(__dirname, '..', 'assets')
fs.mkdirSync(assetsDir, { recursive: true })

function makePng(width, height, r, g, b) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB
  // IDAT: raw scanlines (filter byte 0 + RGB per pixel)
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3)
    raw[offset] = 0
    for (let x = 0; x < width; x++) {
      raw[offset + 1 + x * 3] = r
      raw[offset + 2 + x * 3] = g
      raw[offset + 3 + x * 3] = b
    }
  }
  const compressed = zlib.deflateSync(raw)
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data ? data.length : 0)
    const c = crc32(Buffer.concat([Buffer.from(type), data || Buffer.alloc(0)]))
    const crcBuf = Buffer.alloc(4); crcBuf.writeInt32BE(c)
    return Buffer.concat([len, Buffer.from(type), data || Buffer.alloc(0), crcBuf])
  }
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// CRC32 table
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[n] = c
}
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) | 0
}

// 1024x1024 purple PNG -> icon.png (used for mac + linux)
const png1024 = makePng(1024, 1024, 0x8b, 0x5c, 0xf6) // brand purple
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png1024)
console.log('assets/icon.png (1024x1024)')

// Minimal ICO wrapping a 256x256 PNG for Windows
const png256 = makePng(256, 256, 0x8b, 0x5c, 0xf6)
const iconDir = Buffer.alloc(6)
iconDir.writeUInt16LE(0, 0); iconDir.writeUInt16LE(1, 2); iconDir.writeUInt16LE(1, 4)
const iconEntry = Buffer.alloc(16)
iconEntry[0] = 0; iconEntry[1] = 0; iconEntry[2] = 0; iconEntry[3] = 0
iconEntry.writeUInt16LE(1, 4); iconEntry.writeUInt16LE(32, 6)
iconEntry.writeUInt32LE(png256.length, 8); iconEntry.writeUInt32LE(22, 12)
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), Buffer.concat([iconDir, iconEntry, png256]))
console.log('assets/icon.ico (256x256 in ICO wrapper)')

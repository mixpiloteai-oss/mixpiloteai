#!/usr/bin/env node
// Orchestrates a full multi-platform release build.
// Usage: node scripts/build-release.js [--platform win|mac|linux|all]
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
const version = pkg.version

const args = process.argv.slice(2)
const platformIdx = args.indexOf('--platform')
const platform = platformIdx !== -1 ? args[platformIdx + 1] : 'all'

const valid = ['win', 'mac', 'linux', 'all']
if (!valid.includes(platform)) {
  console.error(`Unknown platform: ${platform}. Use: ${valid.join(', ')}`)
  process.exit(1)
}

function run(cmd, label) {
  console.log(`\n[build-release] ${label}`)
  console.log(`$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

console.log(`\n╔═══════════════════════════════════════╗`)
console.log(`║  Neurotek Studio — Release Build v${version} `)
console.log(`╚═══════════════════════════════════════╝`)

const start = Date.now()

// 1. TypeScript check
run('npm run typecheck', 'Type checking')

// 2. Compile sources with electron-vite
run('npm run build', 'Compiling sources (electron-vite)')

// 3. Package with electron-builder
const builderCmd = {
  win:   'electron-builder --win --x64',
  mac:   'electron-builder --mac',
  linux: 'electron-builder --linux --x64',
  all:   'electron-builder --win --mac --linux',
}[platform]

run(`npx ${builderCmd}`, `Packaging (${platform})`)

// 4. Report output artifacts
const releaseDir = path.join(__dirname, '..', 'release', version)
if (fs.existsSync(releaseDir)) {
  console.log(`\n[build-release] Artifacts in release/${version}:`)
  const files = fs.readdirSync(releaseDir).filter(f => {
    const ext = path.extname(f).toLowerCase()
    return ['.exe', '.dmg', '.appimage', '.deb', '.zip'].includes(ext)
  })
  for (const f of files) {
    const stat = fs.statSync(path.join(releaseDir, f))
    console.log(`  ${f.padEnd(60)} ${formatSize(stat.size)}`)
  }
} else {
  console.log(`\n[build-release] Release dir not found: ${releaseDir}`)
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`\n[build-release] Done in ${elapsed}s`)

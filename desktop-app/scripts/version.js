#!/usr/bin/env node
// Version management: `node scripts/version.js set 1.2.3` or `node scripts/version.js bump [major|minor|patch]`
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const [, , command, arg] = process.argv

function parseVersion(v) {
  const parts = v.split('.').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) throw new Error(`Invalid version: ${v}`)
  return parts
}

function bumpVersion(current, type = 'patch') {
  const [major, minor, patch] = parseVersion(current)
  switch (type) {
    case 'major': return `${major + 1}.0.0`
    case 'minor': return `${major}.${minor + 1}.0`
    case 'patch': return `${major}.${minor}.${patch + 1}`
    default: throw new Error(`Unknown bump type: ${type}. Use major, minor, or patch.`)
  }
}

const current = pkg.version

if (command === 'set') {
  if (!arg) { console.error('Usage: version.js set <version>'); process.exit(1) }
  parseVersion(arg) // validate
  pkg.version = arg
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`Version set: ${current} → ${arg}`)
} else if (command === 'bump') {
  const next = bumpVersion(current, arg || 'patch')
  pkg.version = next
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`Version bumped: ${current} → ${next}`)
} else {
  console.log(`Current version: ${current}`)
  console.log('Usage:')
  console.log('  node scripts/version.js set <x.y.z>')
  console.log('  node scripts/version.js bump [major|minor|patch]')
}

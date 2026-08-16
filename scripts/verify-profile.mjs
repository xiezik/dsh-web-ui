#!/usr/bin/env node
/**
 * Verify a dsh profile's plugin resolution BEFORE restarting the service —
 * the check that would have caught "aggregate patch references a child
 * package that is not linked into the profile" before launchd's restart
 * loop turned it into an outage.
 *
 * What it checks, for the profile at ~/.dsh/profiles/<name> (default web):
 *   1. Every bundle listed in the profile manifest (package.json
 *      `dsh.profile.bundles`) resolves to a real package under the profile's
 *      node_modules (walks up to the profile root node_modules).
 *   2. Every plugin row referenced by each aggregate bundle's
 *      cordis.patch.yml (`- insert: name: <pkg>`) resolves the same way —
 *      this is exactly the "aggregate references a child that is not
 *      linked" failure class (see 2026-08-17 outage: missing
 *      @linxin666/dsh-client-ui-community-plugins after the 0.1.19 sync).
 *   3. Each resolved package carries its declared entry files (package.json
 *      `main` / `exports['.']`, plus the `./client` browser half) — a link
 *      pointing at a source checkout without built `lib/` output is broken
 *      the same way.
 *
 * The check is read-only and safe to run before every `dsh web` restart.
 * Exit code: 0 when everything resolves, 1 when anything is missing/broken
 * (the report tells you which packages to link, e.g. re-run
 * `node scripts/link-profile.mjs` after a fork sync).
 *
 * Usage:
 *   node scripts/verify-profile.mjs                  # default: web profile
 *   node scripts/verify-profile.mjs --profile tui    # another profile
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')

function usage() {
  console.error('usage: node scripts/verify-profile.mjs [--profile <name>]')
  process.exit(2)
}

const profileArg = process.argv.indexOf('--profile')
const profileName = profileArg >= 0 ? process.argv[profileArg + 1] : 'web'
if (profileName === undefined) usage()

const profileDir = join(DSH_HOME, 'profiles', profileName)

/** Node resolution for one package name from the profile directory: try the
 * profile's own node_modules, then the shared profile node_modules layer. */
function resolvePackage(name) {
  const candidates = [
    join(profileDir, 'node_modules', ...name.split('/')),
    join(DSH_HOME, 'profiles', 'node_modules', ...name.split('/')),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'package.json'))) return dir
  }
  return undefined
}

/** Package names referenced by one aggregate bundle's patch file. Patch
 * rows may carry a subpath (`@scope/pkg/sub` or `pkg/sub`); only the
 * package name itself is resolved. */
function patchReferencedNames(bundleDir) {
  const patchPath = join(bundleDir, 'cordis.patch.yml')
  if (!existsSync(patchPath)) return []
  const text = readFileSync(patchPath, 'utf8')
  const names = []
  for (const line of text.split('\n')) {
    const match = /^\s*name:\s*['"]?(@?[^'"]+)['"]?\s*$/.exec(line)
    if (match === null) continue
    const raw = match[1].trim()
    const segments = raw.split('/')
    names.push(segments[0].startsWith('@') ? segments.slice(0, 2).join('/') : segments[0])
  }
  return names
}

/** Entry files a package must carry (main + client half). */
function entryFiles(pkgDir, pkg) {
  const files = []
  const main = pkg.main
  if (typeof main === 'string' && main !== '') files.push(main)
  const exportsObj = pkg.exports
  if (exportsObj !== null && typeof exportsObj === 'object' && !Array.isArray(exportsObj)) {
    const dot = exportsObj['.'] ?? exportsObj['./package.json']
    if (typeof dot === 'string') files.push(dot)
    const client = exportsObj['./client']
    if (typeof client === 'string') files.push(client)
  }
  return files
}

let problems = 0
const report = []

/** Check one package name; reports and counts problems. */
function checkPackage(name, context) {
  const dir = resolvePackage(name)
  if (dir === undefined) {
    problems += 1
    report.push(`✗ ${name}  (${context}): NOT resolvable under ${profileDir}/node_modules or ${DSH_HOME}/profiles/node_modules`)
    return
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const missing = entryFiles(dir, pkg).filter(file => !existsSync(join(dir, file)))
  if (missing.length > 0) {
    problems += 1
    report.push(`✗ ${name}  (${context}): resolved at ${dir} but missing built entries: ${missing.join(', ')} (run the package build / link-profile after a fork sync)`)
    return
  }
  report.push(`✓ ${name}  (${context})`)
}

// 1. Profile manifest exists?
const manifestPath = join(profileDir, 'package.json')
if (!existsSync(manifestPath)) {
  console.error(`✗ profile manifest not found: ${manifestPath}`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const bundles = manifest.dsh?.profile?.bundles ?? []
report.push(`profile: ${profileName} (${profileDir})`)
report.push(`bundles in manifest: ${bundles.length}`)

for (const bundle of bundles) {
  checkPackage(bundle, 'manifest bundle')
}

// 2. Aggregate bundles' patch children (the failure class from 2026-08-17).
for (const bundle of bundles) {
  const dir = resolvePackage(bundle)
  if (dir === undefined) continue
  for (const child of patchReferencedNames(dir)) {
    if (child === bundle) continue // self row; web-ui-all inserts itself too
    checkPackage(child, `patch child of ${bundle}`)
  }
}

console.log(report.join('\n'))
if (problems > 0) {
  console.error(`\n✗ ${problems} resolution problem(s). Fix with: node scripts/link-profile.mjs  (after a fork sync; then rebuild the fork with pnpm -r build)`)
  process.exit(1)
}
console.log(`\n✓ profile ${profileName}: all referenced packages resolve and carry their entry files — safe to restart dsh web.`)

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

/**
 * Strings that are not user-facing, so they never need translating: HTTP header
 * names, DOM event keys, error class names and the like. Kept as an explicit
 * list rather than a clever heuristic, so adding one is a decision somebody
 * makes on purpose.
 */
const ALLOWED = new Set([
  'ApiError',
  'Authorization',
  'Bearer',
  'Content-Type',
  'Escape',
  'NETWORK',
  'Promise',
])

/** Files that legitimately contain English prose: the catalogues themselves. */
function isExempt(path: string): boolean {
  const p = path.split(sep).join('/')
  return (
    p.includes('/i18n/') ||
    p.includes('/test/') ||
    p.includes('.test.') ||
    p.endsWith('types/domain.ts')
  )
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(full) && !isExempt(full) ? [full] : []
  })
}

const QUOTED = /'([A-Z][A-Za-z0-9 ,.?!:—–-]{3,80})'/g
const JSX_INLINE = />\s*([A-Z][A-Za-z0-9 ,.'?!:—–-]{3,80})\s*</g
const JSX_BARE = /^\s*([A-Z][A-Za-z0-9 ,.'?!:—–-]{3,80})\s*$/

interface Finding {
  file: string
  line: number
  text: string
}

function scan(): Finding[] {
  const findings: Finding[] = []

  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n')

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      const isComment =
        trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')
      if (isComment || trimmed.startsWith('import') || line.includes("from '")) return

      const hits = [
        ...[...line.matchAll(QUOTED)].map((m) => m[1]!),
        ...[...line.matchAll(JSX_INLINE)].map((m) => m[1]!),
      ]

      // Text sitting alone on a line between JSX tags.
      const bare = JSX_BARE.exec(line)
      if (bare) {
        const previous = lines[index - 1]?.trim() ?? ''
        const next = lines[index + 1]?.trim() ?? ''
        const insideJsx = previous.endsWith('>') || next.startsWith('</')
        const looksLikeCode = /[,;{}()]$/.test(trimmed)
        if (insideJsx && !looksLikeCode) hits.push(bare[1]!)
      }

      for (const text of hits) {
        const value = text.trim()
        if (ALLOWED.has(value) || value === value.toUpperCase()) continue
        findings.push({ file: relative(SRC, file).split(sep).join('/'), line: index + 1, text: value })
      }
    })
  }

  return findings
}

/**
 * The claim "nothing is hard-coded" was made once and was wrong: an entire
 * class of strings — label maps declared at module scope, where no hook can
 * reach — had been missed, and nothing was checking. A sentence in a component
 * cannot be translated, so this fails the build rather than waiting for someone
 * to notice a stray English word in an Arabic screen.
 */
describe('no user-facing string is hard-coded outside the catalogue', () => {
  it('finds none', () => {
    const findings = scan()
    const report = findings.map((f) => `${f.file}:${f.line}  ${f.text}`).join('\n')

    expect(report, `Move these into src/i18n/en.ts:\n${report}`).toBe('')
  })

  // Guards the guard: a detector that matches nothing would pass for ever.
  it('would notice one if it appeared', () => {
    const line = "        <p>Something went badly wrong</p>"
    expect(JSX_INLINE.test(line)).toBe(true)
  })
})

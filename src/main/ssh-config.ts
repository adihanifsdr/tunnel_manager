import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { basename, dirname, isAbsolute, join, resolve } from 'path'
import { homedir, userInfo } from 'os'
import type { SSHConfigHost } from '../shared/types'

/**
 * Hosts from `~/.ssh/config`, resolved the way `ssh` would resolve them.
 *
 * ── Why resolve at all ───────────────────────────────────────────────────────
 * The obvious shortcut is to put the alias in the host field and let `ssh` do
 * the lookup. That does not survive this app's argument building: it always
 * passes `-p <port>` and `<user>@<host>`, and a user or port given on the
 * command line beats anything in the file. Worse, once `HostName` is resolved
 * to an address, `ssh` matches its config against *that* address, so a
 * `Host contabo` block with an `IdentityFile` no longer applies. Everything the
 * block says therefore has to be copied into the form, which is what this does.
 *
 * ── What is honoured ─────────────────────────────────────────────────────────
 * `Host` blocks with plain and wildcard patterns, negated patterns, `Include`
 * (with `~`, paths relative to `~/.ssh`, and globs in the last segment), and the
 * four options the form has fields for. OpenSSH keeps the *first* value it sees
 * for an option, so a `Host *` block at the top of the file wins over a later
 * per-host block — the same rule is applied here, block by block in file order.
 *
 * `Match` blocks are skipped: they key on things like the local user or the
 * result of running a command, and the app cannot evaluate them without
 * becoming `ssh`.
 */

const SSH_DIR = join(homedir(), '.ssh')
const CONFIG_PATH = join(SSH_DIR, 'config')
const MAX_INCLUDE_DEPTH = 8

interface Block {
  patterns: string[]
  options: Map<string, string>
}

/** Split a config line into words, honouring double quotes. */
function splitWords(text: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.push(m[1] ?? m[2])
  return out
}

/** `Keyword value`, `Keyword=value` and `Keyword = value` are all valid. */
function splitKeyword(line: string): [string, string] | null {
  const m = /^([A-Za-z][A-Za-z0-9]*)\s*(?:=|\s)\s*(.*)$/.exec(line)
  if (!m) return null
  return [m[1].toLowerCase(), m[2].trim()]
}

function hasGlob(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?')
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/**
 * Files named by an `Include` line.
 *
 * Relative paths are relative to `~/.ssh` — not to the including file, which
 * is what OpenSSH does too. Globs are only expanded in the final segment, which
 * covers the `config.d/*` idiom this exists for.
 */
function includeTargets(value: string): string[] {
  const out: string[] = []
  for (const word of splitWords(value)) {
    const expanded = expandHome(word)
    const full = isAbsolute(expanded) ? expanded : join(SSH_DIR, expanded)
    if (!hasGlob(basename(full))) {
      out.push(full)
      continue
    }
    const dir = dirname(full)
    if (!existsSync(dir)) continue
    const re = globToRegex(basename(full))
    try {
      for (const name of readdirSync(dir).sort()) {
        if (re.test(name)) out.push(join(dir, name))
      }
    } catch {
      // unreadable directory — nothing to include from it
    }
  }
  return out
}

/**
 * Parse one file into blocks, in order, following includes.
 *
 * Options before the first `Host` line are global; they go into an implicit
 * `Host *` block so the first-value-wins rule treats them like OpenSSH does.
 */
function parseFile(path: string, depth: number, seen: Set<string>): Block[] {
  const canonical = resolve(path)
  if (seen.has(canonical) || depth > MAX_INCLUDE_DEPTH) return []
  seen.add(canonical)

  let text: string
  try {
    if (!statSync(canonical).isFile()) return []
    text = readFileSync(canonical, 'utf-8')
  } catch {
    return []
  }

  const blocks: Block[] = []
  let current: Block = { patterns: ['*'], options: new Map() }
  blocks.push(current)
  // inside a Match block nothing can be evaluated, so its options are dropped
  let inMatch = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const parsed = splitKeyword(line)
    if (!parsed) continue
    const [keyword, value] = parsed

    if (keyword === 'host') {
      inMatch = false
      current = { patterns: splitWords(value), options: new Map() }
      blocks.push(current)
      continue
    }
    if (keyword === 'match') {
      inMatch = true
      continue
    }
    if (keyword === 'include') {
      // An include inside a Host block is scoped to that block in OpenSSH. The
      // included file's own Host lines still start new blocks, so treating its
      // top-level options as belonging to the current block is a fair reading.
      for (const target of includeTargets(value)) {
        for (const block of parseFile(target, depth + 1, seen)) {
          const isGlobal = block.patterns.length === 1 && block.patterns[0] === '*'
          if (isGlobal && !inMatch) {
            for (const [k, v] of block.options) {
              if (!current.options.has(k)) current.options.set(k, v)
            }
          } else if (!isGlobal) {
            blocks.push(block)
          }
        }
      }
      continue
    }
    if (inMatch) continue
    // first value wins, within a block as well as across them
    if (!current.options.has(keyword)) current.options.set(keyword, value)
  }

  return blocks
}

function blockMatches(block: Block, alias: string): boolean {
  let matched = false
  for (const pattern of block.patterns) {
    if (pattern.startsWith('!')) {
      if (globToRegex(pattern.slice(1)).test(alias)) return false
    } else if (!matched && globToRegex(pattern).test(alias)) {
      matched = true
    }
  }
  return matched
}

/**
 * First value of an option across every block that matches the alias.
 *
 * Values may be double-quoted, which is how a path with a space is written;
 * the quotes are syntax, not part of the value.
 */
function resolveOption(blocks: Block[], alias: string, key: string): string | undefined {
  for (const block of blocks) {
    if (!blockMatches(block, alias)) continue
    const value = block.options.get(key)
    if (value !== undefined) return splitWords(value)[0] ?? ''
  }
  return undefined
}

interface TokenContext {
  alias: string
  host: string
  user: string
  port: string
  localUser: string
}

/**
 * The `%` tokens that can appear in `HostName` and `IdentityFile`.
 * Only the ones that can be known without connecting are expanded.
 */
function expandTokens(value: string, ctx: TokenContext): string {
  return value.replace(/%([%dhnprul])/g, (_m, t: string) => {
    switch (t) {
      case '%':
        return '%'
      case 'd':
        return homedir()
      case 'h':
        return ctx.host
      case 'n':
        return ctx.alias
      case 'p':
        return ctx.port
      case 'r':
        return ctx.user
      case 'u':
      case 'l':
        return ctx.localUser
      default:
        return `%${t}`
    }
  })
}

export function loadSSHConfigHosts(): SSHConfigHost[] {
  if (!existsSync(CONFIG_PATH)) return []

  const blocks = parseFile(CONFIG_PATH, 0, new Set())
  let localUser = ''
  try {
    localUser = userInfo().username
  } catch {
    // no local user name available; ssh would fail on this too
  }

  const hosts: SSHConfigHost[] = []
  const seen = new Set<string>()

  for (const block of blocks) {
    for (const pattern of block.patterns) {
      // wildcards and negations describe rules, not something you can connect to
      if (pattern.startsWith('!') || hasGlob(pattern)) continue
      if (seen.has(pattern)) continue
      seen.add(pattern)

      const alias = pattern
      const user = resolveOption(blocks, alias, 'user') ?? localUser
      const port = resolveOption(blocks, alias, 'port') ?? '22'
      // `HostName %h` is a common idiom for "the alias is the host"
      const host = expandTokens(resolveOption(blocks, alias, 'hostname') ?? alias, {
        alias,
        host: alias,
        user,
        port,
        localUser
      })
      const rawKey = resolveOption(blocks, alias, 'identityfile')
      const keyPath = rawKey
        ? expandHome(expandTokens(rawKey, { alias, host, user, port, localUser }))
        : ''

      hosts.push({ alias, host, user, port, keyPath })
    }
  }

  return hosts
}

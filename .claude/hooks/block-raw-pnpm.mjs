// PreToolUse hook (Bash matcher) — second, non-load-bearing layer on top of
// apps/frontend/.pnpmfile.mjs, which is the real enforcement (blocks any pnpm
// add/update/install/remove without a PROUST_SAFE_PNPM=1 marker at the pnpm level).
// This hook exists only to give Claude a fast, clear denial instead of letting it hit
// that block blind and have to figure out why. See docs/features/supply-chain-check.md.
//
// Deliberately not a security boundary: a command containing PROUST_SAFE_PNPM=1
// anywhere is let through unconditionally (e.g. a human debugging directly).

// Anchored to an actual command position (start of string, or right after a shell separator) —
// not just anywhere "pnpm add"/"pnpm install" appears. Without this, a command like
// `git commit -m "docs: mention pnpm install workflow"` got denied even though it never runs
// pnpm at all — the text only appears inside a quoted commit message.
const BLOCKED_SUBCOMMAND = /(^|[;&|`\n])\s*pnpm(\.cmd)?[ \t]+(add|install|i|update|up|remove|rm|uninstall|un)([ \t]|$)/

let data = ''
process.stdin.on('data', (chunk) => {
  data += chunk
})
process.stdin.on('end', () => {
  let command = ''
  try {
    command = JSON.parse(data)?.tool_input?.command ?? ''
  } catch {
    process.exit(0)
  }

  if (!BLOCKED_SUBCOMMAND.test(command) || command.includes('PROUST_SAFE_PNPM=1')) {
    process.exit(0)
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Direct pnpm add/update/install/remove is blocked for this repo ' +
          '(apps/frontend/.pnpmfile.mjs enforces the same rule at the pnpm level). ' +
          "Use 'pnpm safe:add', 'pnpm safe:update', 'pnpm safe:install', or 'pnpm safe:remove' " +
          'instead — see docs/features/supply-chain-check.md.',
      },
    }),
  )
})

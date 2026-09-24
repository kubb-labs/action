import { context, getOctokit } from '@actions/github'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { runCommand } from './process.js'
import type { SnapshotChanges, SnapshotDetails } from './cli.js'

const marker = '<!-- kubb-studio-snapshot -->'
type Pull = { head: { ref: string; repo?: { full_name?: string } | null } }

/**
 * The file table stays under GitHub's ~65,536-char comment limit even on a package with thousands
 * of generated files.
 */
const MAX_LISTED_FILES = 50

const STATUS_LABEL: Record<'added' | 'changed' | 'removed', string> = { added: 'Added', changed: 'Changed', removed: 'Removed' }

function commitLink(owner: string, repo: string, commit: string): string {
  return `[\`${commit.slice(0, 7)}\`](https://github.com/${owner}/${repo}/commit/${commit})`
}

/**
 * Renders the "Changes since ..." block: a one-line summary, and a collapsed table of paths when
 * there is anything to list. Empty when `changes` is absent, so an older CLI or Studio leaves the
 * comment exactly as it always looked.
 */
function renderChanges(changes: SnapshotChanges | undefined, owner: string, repo: string): Array<string> {
  if (!changes) return []

  const total = changes.added.length + changes.changed.length + changes.removed.length
  const since = changes.base ? (changes.base.commit ? commitLink(owner, repo, changes.base.commit) : changes.base.createdAt) : undefined

  const summary = !changes.base
    ? `**First snapshot for this pull request**: ${total} file${total === 1 ? '' : 's'} generated`
    : total === 0
      ? `**No changes since ${since}**`
      : `**Changes since ${since}**: ${changes.added.length} added · ${changes.changed.length} changed · ${changes.removed.length} removed`

  // Nothing to diff on a first snapshot: every file is "added" by definition, not a meaningful
  // change list. Nor when nothing changed against a real base.
  if (!changes.base || total === 0) {
    return ['', summary]
  }

  const rows = (['added', 'changed', 'removed'] as const).flatMap((status) => changes[status].map((path) => `| ${STATUS_LABEL[status]} | \`${path}\` |`))
  const shown = rows.slice(0, MAX_LISTED_FILES)
  const omitted = rows.length - shown.length

  return [
    '',
    summary,
    '',
    '<details>',
    `<summary>${total} generated file${total === 1 ? '' : 's'} changed</summary>`,
    '',
    '| Status | File |',
    '| --- | --- |',
    ...shown,
    ...(omitted > 0 ? [`| | …and ${omitted} more file${omitted === 1 ? '' : 's'}. Install the package to see everything. |`] : []),
    '',
    '</details>',
  ]
}

export async function updateComment(snapshot: SnapshotDetails, token: string): Promise<void> {
  if (!token || !context.issue.number) return
  const github = getOctokit(token)
  const { owner, repo } = context.repo
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${context.sha}`
  const body = [
    marker,
    `### Kubb snapshot — ${snapshot.name ?? 'unnamed'}@${snapshot.version ?? '0.0.0'}`,
    '',
    'Install this snapshot with npm:',
    '',
    '```bash',
    `npm i ${snapshot.url}`,
    '```',
    ...renderChanges(snapshot.changes, owner, repo),
    '',
    `[Package](${snapshot.url}) · [Studio agent](${snapshot.agentUrl})`,
    '',
    `<sub>Expires ${snapshot.expiresAt ?? 'soon'} · commit <a href="${commitUrl}"><code>${context.sha.slice(0, 7)}</code></a></sub>`,
  ].join('\n')
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: context.issue.number })
  const existing = comments.find((item: { body?: string }) => item.body?.includes(marker))
  if (existing) await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body })
  else await github.rest.issues.createComment({ owner, repo, issue_number: context.issue.number, body })
}

export async function initConfig(token: string, config = 'kubb.config.ts'): Promise<boolean> {
  const workingDirectory = process.cwd()
  const configPath = resolve(config)
  if (existsSync(configPath)) return false
  const { owner, repo } = context.repo
  const defaultBranch = context.payload.repository?.default_branch ?? 'main'
  const github = token ? getOctokit(token) : undefined
  if (github) {
    const pulls = await github.paginate(github.rest.pulls.list, { owner, repo, base: defaultBranch, state: 'open' })
    if (pulls.some((pull: Pull) => pull.head.repo?.full_name === `${owner}/${repo}` && pull.head.ref.startsWith('kubb/init-'))) return true
  }
  const branch = `kubb/init-${context.runId}`
  await runCommand('git', ['fetch', 'origin', defaultBranch])
  await runCommand('git', ['switch', '-c', branch, `origin/${defaultBranch}`])
  const configDirectory = dirname(configPath)
  mkdirSync(configDirectory, { recursive: true })
  process.chdir(configDirectory)
  try {
    await runCommand('npx', ['kubb', 'init', '--yes'])
    if (configPath !== resolve(configDirectory, 'kubb.config.ts')) renameSync(resolve(configDirectory, 'kubb.config.ts'), configPath)
  } finally {
    process.chdir(workingDirectory)
  }
  await runCommand('git', ['config', 'user.name', 'github-actions[bot]'])
  await runCommand('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])
  await runCommand('git', ['add', '-A'])
  await runCommand('git', ['commit', '-m', 'chore: initialize Kubb'])
  await runCommand('git', ['push', '--set-upstream', 'origin', branch])
  if (!github) return true
  await github.rest.pulls.create({
    owner,
    repo,
    head: branch,
    base: defaultBranch,
    title: 'chore: initialize Kubb',
    body: 'Generated by the Kubb snapshot action.',
  })
  return true
}

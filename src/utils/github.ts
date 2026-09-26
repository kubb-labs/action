import { context, getOctokit } from '@actions/github'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { runCommand } from './process.js'
import type { BranchSnapshotChanges, SnapshotChanges, SnapshotDetails } from './cli.js'

const marker = '<!-- kubb-studio-snapshot -->'
type Pull = { head: { ref: string; repo?: { full_name?: string } | null } }

/**
 * Each file table stays short enough that both together keep the comment under GitHub's
 * ~65,536-char limit, even on a package with thousands of generated files.
 */
const MAX_LISTED_FILES = 50

const STATUS_LABEL: Record<'added' | 'changed' | 'removed', string> = { added: 'Added', changed: 'Changed', removed: 'Removed' }

function commitLink(owner: string, repo: string, commit: string): string {
  return `[\`${commit.slice(0, 7)}\`](https://github.com/${owner}/${repo}/commit/${commit})`
}

/**
 * The commit this run builds: a pull request's head, not the merge commit `context.sha` points at.
 */
export function headSha(): string {
  return (context.payload.pull_request?.head as { sha?: string } | undefined)?.sha ?? context.sha
}

function totalOf(changes: SnapshotChanges): number {
  return changes.added.length + changes.changed.length + changes.removed.length
}

function counts(changes: SnapshotChanges): string {
  return `${changes.added.length} added · ${changes.changed.length} changed · ${changes.removed.length} removed`
}

/**
 * A summary line, and a collapsed table of the changed paths when there are any.
 */
function renderSection(summary: string, changes?: SnapshotChanges): Array<string> {
  const rows = (['added', 'changed', 'removed'] as const).flatMap(
    (status) => changes?.[status].map((path) => `| ${STATUS_LABEL[status]} | \`${path}\` |`) ?? [],
  )
  const omitted = rows.length - MAX_LISTED_FILES

  if (!rows.length) return ['', summary]

  return [
    '',
    summary,
    '',
    '<details>',
    `<summary>${rows.length} generated file${rows.length === 1 ? '' : 's'} changed</summary>`,
    '',
    '| Status | File |',
    '| --- | --- |',
    ...rows.slice(0, MAX_LISTED_FILES),
    ...(omitted > 0 ? [`| | …and ${omitted} more file${omitted === 1 ? '' : 's'}. Install the package to see everything. |`] : []),
    '',
    '</details>',
  ]
}

/**
 * What the pull request changes against its base branch's latest snapshot.
 */
function renderBranchChanges(changes: BranchSnapshotChanges | undefined, owner: string, repo: string): Array<string> {
  if (!changes) return []

  const branch = `\`${changes.branch}\``
  if (!changes.base) {
    return changes.baseFound
      ? renderSection(`**No snapshot of ${branch} for this package yet.**`)
      : renderSection(`**No snapshot of ${branch} to compare with yet.** Run this workflow on pushes to ${branch} to compare pull requests with it.`)
  }

  const at = changes.base.commit ? ` (${commitLink(owner, repo, changes.base.commit)})` : ''

  return renderSection(totalOf(changes) ? `**Changes against ${branch}**${at}: ${counts(changes)}` : `**No changes against ${branch}**${at}`, changes)
}

/**
 * What changed since the previous snapshot on this pull request.
 */
function renderChanges(changes: SnapshotChanges | undefined, owner: string, repo: string): Array<string> {
  if (!changes) return []

  const total = totalOf(changes)
  // A first snapshot lists no files: every one is "added" by definition.
  if (!changes.base) return renderSection(`**First snapshot for this pull request**: ${total} file${total === 1 ? '' : 's'} generated`)

  const since = changes.base.commit ? commitLink(owner, repo, changes.base.commit) : changes.base.createdAt

  return renderSection(total ? `**Changes since ${since}**: ${counts(changes)}` : `**No changes since ${since}**`, changes)
}

async function upsertComment(body: string, token: string): Promise<void> {
  if (!token || !context.issue.number) return
  const github = getOctokit(token)
  const { owner, repo } = context.repo
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: context.issue.number })
  const existing = comments.find((item: { body?: string }) => item.body?.includes(marker))
  if (existing) await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body })
  else await github.rest.issues.createComment({ owner, repo, issue_number: context.issue.number, body })
}

function commitFooter(owner: string, repo: string): string {
  const sha = headSha()

  return `commit <a href="https://github.com/${owner}/${repo}/commit/${sha}"><code>${sha.slice(0, 7)}</code></a>`
}

export async function updateComment(snapshot: SnapshotDetails, token: string): Promise<void> {
  const { owner, repo } = context.repo
  const body = [
    marker,
    `### Kubb snapshot — ${snapshot.name ?? 'unnamed'}@${snapshot.version ?? '0.0.0'}`,
    '',
    'Install this snapshot with npm:',
    '',
    '```bash',
    `npm i ${snapshot.url}`,
    '```',
    ...renderBranchChanges(snapshot.branchChanges, owner, repo),
    ...renderChanges(snapshot.changes, owner, repo),
    '',
    `[Package](${snapshot.url}) · [Studio agent](${snapshot.agentUrl})`,
    '',
    `<sub>Expires ${snapshot.expiresAt ?? 'soon'} · ${commitFooter(owner, repo)}</sub>`,
  ].join('\n')

  await upsertComment(body, token)
}

/**
 * Replaces the snapshot comment with why this run failed, so a failure shows on the pull request
 * even when the step may fail. The previous package no longer matches, so its install line goes.
 */
export async function updateFailureComment(message: string, token: string): Promise<void> {
  const { owner, repo } = context.repo
  const body = [
    marker,
    '### Kubb snapshot failed',
    '',
    `No snapshot was published for this commit. See the [workflow run](https://github.com/${owner}/${repo}/actions/runs/${context.runId}) for the full log.`,
    '',
    '```text',
    message.replaceAll('```', "'''"),
    '```',
    '',
    `<sub>${commitFooter(owner, repo)}</sub>`,
  ].join('\n')

  await upsertComment(body, token)
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

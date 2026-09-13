import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
//#endregion
//#region src/index.ts
const studioUrl = (process.env.KUBB_STUDIO_URL ?? "https://kubb.studio").replace(/\/$/, "");
const marker = "<!-- kubb-studio-snapshot -->";
async function request(path, token, init = {}) {
	const response = await fetch(`${studioUrl}${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${token}`,
			"x-api-key": token,
			"content-type": "application/json",
			...init.headers
		}
	});
	const text = await response.text();
	let body = {};
	try {
		body = JSON.parse(text);
	} catch {}
	if (!response.ok) {
		const upgradeUrl = body.data?.upgradeUrl;
		const detail = upgradeUrl ? ` Agent limit reached; upgrade at ${String(upgradeUrl)}.` : "";
		throw new Error(`Kubb Studio ${response.status}: ${String(body.message ?? text).slice(0, 500)}${detail}`);
	}
	return body;
}
function packageMetadata() {
	let directory = process.cwd();
	while (true) {
		const file = join(directory, "package.json");
		if (existsSync(file)) {
			const packageJson = JSON.parse(readFileSync(file, "utf8"));
			if (packageJson.name && packageJson.version) return {
				name: packageJson.name,
				version: packageJson.version
			};
		}
		const parent = dirname(directory);
		if (parent === directory) break;
		directory = parent;
	}
	throw new Error("No package.json with name and version found for the current working directory");
}
function machineToken(apiKey, repositoryId) {
	return createHmac("sha256", apiKey).update(`gh:${repositoryId}`).digest("hex");
}
function absoluteUrl(path) {
	return new URL(path, `${studioUrl}/`).toString();
}
function runCommand(command, args, env = process.env) {
	return new Promise((resolveCommand, reject) => {
		const child = spawn(command, args, {
			env,
			stdio: "inherit"
		});
		child.once("error", reject);
		child.once("exit", (code) => code === 0 ? resolveCommand() : reject(/* @__PURE__ */ new Error(`${command} exited with ${code}`)));
	});
}
function stop(child) {
	if (!child.killed) child.kill("SIGTERM");
}
function startStudio(agentToken) {
	const { INPUT_TOKEN: _inputToken, KUBB_TOKEN: _kubbToken, ...safeEnv } = process.env;
	return spawn("npx", [
		"kubb",
		"studio",
		"--url",
		studioUrl
	], {
		env: {
			...safeEnv,
			KUBB_AGENT_TOKEN: agentToken
		},
		stdio: "inherit"
	});
}
async function createSnapshot(agentId, token, metadata) {
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			return await request("/api/snapshots", token, {
				method: "POST",
				body: JSON.stringify({
					agentId,
					name: metadata.name,
					version: metadata.version,
					commitSha: context.sha
				})
			});
		} catch (error) {
			if (!(error instanceof Error && error.message.startsWith("Kubb Studio 503:"))) throw error;
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 1e3));
	}
	throw new Error("Timed out waiting for the Kubb Studio agent to connect");
}
function snapshotDetails(snapshot, agentId) {
	return {
		id: snapshot.id,
		integrity: snapshot.integrity,
		expiresAt: snapshot.expiresAt,
		name: String(snapshot.packageName ?? snapshot.name ?? `@kubb/snapshot-${agentId}`),
		version: String(snapshot.packageVersion ?? snapshot.version ?? "0.0.0"),
		url: absoluteUrl(String(snapshot.url))
	};
}
async function updateComment(snapshot, agentSlug, token) {
	if (!token || !context.issue.number) return;
	const github = getOctokit(token);
	const { owner, repo } = context.repo;
	const body = [
		marker,
		`### Kubb snapshot — ${snapshot.name}@${snapshot.version}`,
		"",
		`Expires ${snapshot.expiresAt ?? "soon"}`,
		"",
		`[Install the snapshot](${snapshot.url})`,
		"",
		`Agent: ${studioUrl}/agents/${agentSlug}`
	].join("\n");
	const existing = (await github.paginate(github.rest.issues.listComments, {
		owner,
		repo,
		issue_number: context.issue.number
	})).find((item) => item.body?.includes(marker));
	if (existing) await github.rest.issues.updateComment({
		owner,
		repo,
		comment_id: existing.id,
		body
	});
	else await github.rest.issues.createComment({
		owner,
		repo,
		issue_number: context.issue.number,
		body
	});
}
async function initConfig(token) {
	if (existsSync(join(process.cwd(), "kubb.config.ts"))) return false;
	await runCommand("npx", [
		"kubb",
		"init",
		"--yes"
	]);
	const branch = `kubb/init-${context.runId}`;
	await runCommand("git", [
		"switch",
		"-c",
		branch
	]);
	await runCommand("git", [
		"config",
		"user.name",
		"github-actions[bot]"
	]);
	await runCommand("git", [
		"config",
		"user.email",
		"41898282+github-actions[bot]@users.noreply.github.com"
	]);
	await runCommand("git", ["add", "-A"]);
	await runCommand("git", [
		"commit",
		"-m",
		"chore: initialize Kubb"
	]);
	await runCommand("git", [
		"push",
		"--set-upstream",
		"origin",
		branch
	]);
	if (!token || !context.issue.number) return true;
	const github = getOctokit(token);
	const { owner, repo } = context.repo;
	await github.rest.pulls.create({
		owner,
		repo,
		head: branch,
		base: context.payload.repository?.default_branch ?? "main",
		title: "chore: initialize Kubb",
		body: "Generated by the Kubb snapshot action."
	});
	return true;
}
async function run() {
	if (context.payload.pull_request?.head?.repo?.fork) {
		core.info("Skipping Kubb snapshot: GitHub does not expose repository secrets to fork pull requests.");
		return;
	}
	const apiKey = core.getInput("token", { required: true });
	const githubToken = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
	if (await initConfig(githubToken)) {
		core.info("Initialized Kubb and opened a pull request. Snapshot generation will run after it is merged.");
		return;
	}
	const metadata = packageMetadata();
	const repositoryId = String(context.payload.repository?.id ?? context.repo.repo);
	const agent = await request("/api/agents", apiKey, {
		method: "POST",
		body: JSON.stringify({
			name: `${context.repo.owner}/${context.repo.repo}`,
			machineToken: machineToken(apiKey, repositoryId)
		})
	});
	const agentInfo = agent.agent ?? agent;
	const agentId = String(agentInfo.id);
	const agentSlug = String(agentInfo.slug);
	core.setSecret(String(agent.token));
	const child = startStudio(String(agent.token));
	try {
		const snapshot = snapshotDetails(await createSnapshot(agentId, apiKey, metadata), agentId);
		core.setOutput("snapshot-id", snapshot.id);
		core.setOutput("package-name", snapshot.name);
		core.setOutput("package-version", snapshot.version);
		core.setOutput("tarball-url", snapshot.url);
		core.setOutput("integrity", snapshot.integrity);
		core.setOutput("agent-url", `${studioUrl}/agents/${agentSlug}`);
		await updateComment(snapshot, agentSlug, githubToken);
	} finally {
		stop(child);
	}
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) run().catch((error) => core.setFailed(error instanceof Error ? error.message : String(error)));
//#endregion
export { absoluteUrl, machineToken, run };

//# sourceMappingURL=index.js.map
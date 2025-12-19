const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { runCommand } = require('./commands');
const {
  ensureDir,
  writeJson,
  readJson,
  writeText,
  readText,
  listDirs,
  pathExists,
  removePath
} = require('./storage');

const DEFAULT_ORCH_HOME = path.join(os.homedir(), '.codex-orchestrator');

function parseThreadId(jsonl) {
  const lines = jsonl.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const payload = JSON.parse(line);
      if (payload.type === 'thread.started' && payload.thread_id) {
        return payload.thread_id;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

function nextRunLabel(runCount) {
  return `run-${String(runCount).padStart(3, '0')}`;
}

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
}

function parseLogEntries(content) {
  if (!content) return [];
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    const parsed = safeJsonParse(line);
    return {
      id: `log-${index + 1}`,
      type: parsed && parsed.type ? parsed.type : 'text',
      raw: line,
      parsed
    };
  });
}

class Orchestrator {
  constructor(options = {}) {
    this.orchHome = options.orchHome || process.env.ORCH_HOME || DEFAULT_ORCH_HOME;
    this.exec = options.exec || runCommand;
    this.spawn = options.spawn || spawn;
    this.now = options.now || (() => new Date().toISOString());
    this.fetch = options.fetch || global.fetch;
    this.running = new Map();
  }

  envsDir() {
    return path.join(this.orchHome, 'envs');
  }

  tasksDir() {
    return path.join(this.orchHome, 'tasks');
  }

  envDir(envId) {
    return path.join(this.envsDir(), envId);
  }

  mirrorDir(envId) {
    return path.join(this.envDir(envId), 'mirror');
  }

  taskDir(taskId) {
    return path.join(this.tasksDir(), taskId);
  }

  taskWorktree(taskId) {
    return path.join(this.taskDir(taskId), 'worktree');
  }

  taskMetaPath(taskId) {
    return path.join(this.taskDir(taskId), 'meta.json');
  }

  taskLogsDir(taskId) {
    return path.join(this.taskDir(taskId), 'logs');
  }

  envRepoUrlPath(envId) {
    return path.join(this.envDir(envId), 'repo.url');
  }

  envDefaultBranchPath(envId) {
    return path.join(this.envDir(envId), 'default_branch');
  }

  async init() {
    await ensureDir(this.envsDir());
    await ensureDir(this.tasksDir());
  }

  async execOrThrow(command, args, options) {
    const result = await this.exec(command, args, options);
    if (result.code !== 0) {
      const message = result.stderr || result.stdout || `${command} failed`;
      throw new Error(message.trim());
    }
    return result;
  }

  async readEnv(envId) {
    const repoUrl = await readText(this.envRepoUrlPath(envId));
    const defaultBranch = await readText(this.envDefaultBranchPath(envId));
    return {
      envId,
      repoUrl,
      defaultBranch,
      mirrorPath: this.mirrorDir(envId)
    };
  }

  async listEnvs() {
    await this.init();
    const envIds = await listDirs(this.envsDir());
    const envs = [];
    for (const envId of envIds) {
      try {
        const env = await this.readEnv(envId);
        envs.push(env);
      } catch (error) {
        continue;
      }
    }
    return envs;
  }

  async createEnv({ repoUrl, defaultBranch }) {
    await this.init();
    const envId = crypto.randomUUID();
    const envDir = this.envDir(envId);
    const mirrorDir = this.mirrorDir(envId);
    await ensureDir(envDir);
    await writeText(this.envRepoUrlPath(envId), repoUrl);
    await writeText(this.envDefaultBranchPath(envId), defaultBranch);

    try {
      await this.execOrThrow('git', ['clone', '--mirror', repoUrl, mirrorDir]);
      const verifyRef = `refs/heads/${defaultBranch}`;
      await this.execOrThrow('git', ['--git-dir', mirrorDir, 'show-ref', '--verify', verifyRef]);
      return { envId, repoUrl, defaultBranch };
    } catch (error) {
      await removePath(envDir);
      throw error;
    }
  }

  async deleteEnv(envId) {
    await this.init();
    const tasks = await this.listTasks();
    for (const task of tasks.filter((item) => item.envId === envId)) {
      await this.deleteTask(task.taskId);
    }
    await removePath(this.envDir(envId));
  }

  async listTasks() {
    await this.init();
    const taskIds = await listDirs(this.tasksDir());
    const tasks = [];
    for (const taskId of taskIds) {
      const metaPath = this.taskMetaPath(taskId);
      if (!(await pathExists(metaPath))) continue;
      const meta = await readJson(metaPath);
      tasks.push(meta);
    }
    tasks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return tasks;
  }

  async getTask(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const logTail = await this.readLogTail(taskId);
    const runLogs = await this.readRunLogs(taskId);
    return { ...meta, logTail, runLogs };
  }

  async readLogTail(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const latestRun = meta.runs[meta.runs.length - 1];
    if (!latestRun) return '';
    const logPath = path.join(this.taskLogsDir(taskId), latestRun.logFile);
    try {
      const content = await fsp.readFile(logPath, 'utf8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      return lines.slice(-120).join('\n');
    } catch (error) {
      return '';
    }
  }

  async readRunLogs(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const runs = [];
    for (const run of meta.runs || []) {
      const logPath = path.join(this.taskLogsDir(taskId), run.logFile);
      let content = '';
      try {
        content = await fsp.readFile(logPath, 'utf8');
      } catch (error) {
        content = '';
      }
      runs.push({
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt || null,
        prompt: run.prompt,
        logFile: run.logFile,
        entries: parseLogEntries(content)
      });
    }
    return runs;
  }

  async finalizeRun(taskId, runLabel, result, prompt) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const threadId = result.threadId || parseThreadId(combinedOutput);
    const resolvedThreadId = threadId || meta.threadId || null;
    const stopped = result.stopped === true;
    const success = !stopped && result.code === 0 && !!resolvedThreadId;
    const now = this.now();

    meta.threadId = resolvedThreadId;
    meta.error = success
      ? null
      : stopped
        ? 'Stopped by user.'
        : 'Unable to parse thread_id from codex output.';
    meta.status = success ? 'completed' : stopped ? 'stopped' : 'failed';
    meta.updatedAt = now;
    meta.lastPrompt = prompt || meta.lastPrompt || null;

    const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
    if (runIndex !== -1) {
      meta.runs[runIndex] = {
        ...meta.runs[runIndex],
        finishedAt: now,
        status: success ? 'completed' : stopped ? 'stopped' : 'failed',
        exitCode: result.code
      };
    }

    await writeJson(this.taskMetaPath(taskId), meta);
  }

  startCodexRun({ taskId, runLabel, prompt, cwd, args }) {
    const logFile = `${runLabel}.jsonl`;
    const logPath = path.join(this.taskLogsDir(taskId), logFile);
    const stderrPath = path.join(this.taskLogsDir(taskId), `${runLabel}.stderr`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });
    const child = this.spawn('codex-docker', args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const runState = { child, stopRequested: false, stopTimeout: null };
    this.running.set(taskId, runState);

    let stdoutBuffer = '';
    let stdoutFull = '';
    let stderrFull = '';
    let detectedThreadId = null;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      logStream.write(text);
      stdoutFull += text;
      stdoutBuffer += text;
      let index = stdoutBuffer.indexOf('\n');
      while (index !== -1) {
        const line = stdoutBuffer.slice(0, index).trim();
        stdoutBuffer = stdoutBuffer.slice(index + 1);
        if (line) {
          const payload = safeJsonParse(line);
          if (payload && payload.type === 'thread.started' && payload.thread_id) {
            detectedThreadId = payload.thread_id;
          }
        }
        index = stdoutBuffer.indexOf('\n');
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrStream.write(text);
      stderrFull += text;
    });

    const finalize = async (code, signal) => {
      logStream.end();
      stderrStream.end();
      if (runState.stopTimeout) {
        clearTimeout(runState.stopTimeout);
      }
      this.running.delete(taskId);
      const result = {
        stdout: stdoutFull,
        stderr: stderrFull,
        code: code ?? 1,
        stopped: runState.stopRequested || signal === 'SIGTERM' || signal === 'SIGKILL',
        threadId: detectedThreadId
      };
      await this.finalizeRun(taskId, runLabel, result, prompt);
    };

    child.on('error', (error) => {
      stderrFull += error?.message ? `\n${error.message}` : '\nUnknown error';
      finalize(1, null).catch(() => {});
    });

    child.on('close', (code, signal) => {
      finalize(code, signal).catch(() => {});
    });
  }

  async createTask({ envId, ref, prompt }) {
    await this.init();
    const env = await this.readEnv(envId);
    const taskId = crypto.randomUUID();
    const taskDir = this.taskDir(taskId);
    const logsDir = this.taskLogsDir(taskId);
    const worktreePath = this.taskWorktree(taskId);
    const branchName = `codex/${taskId}`;

    await ensureDir(taskDir);
    await ensureDir(logsDir);

    const targetRef = ref || env.defaultBranch;

    await this.execOrThrow('git', ['--git-dir', env.mirrorPath, 'fetch', '--all', '--prune']);
    await this.execOrThrow('git', ['--git-dir', env.mirrorPath, 'worktree', 'add', worktreePath, targetRef]);
    await this.execOrThrow('git', ['-C', worktreePath, 'checkout', '-b', branchName]);

    const runLabel = nextRunLabel(1);
    const logFile = `${runLabel}.jsonl`;
    const now = this.now();
    const meta = {
      taskId,
      envId,
      repoUrl: env.repoUrl,
      ref: targetRef,
      branchName,
      worktreePath,
      threadId: null,
      error: null,
      status: 'running',
      initialPrompt: prompt,
      lastPrompt: prompt,
      createdAt: now,
      updatedAt: now,
      runs: [
        {
          runId: runLabel,
          prompt,
          logFile,
          startedAt: now,
          finishedAt: null,
          status: 'running',
          exitCode: null
        }
      ]
    };

    await writeJson(this.taskMetaPath(taskId), meta);
    this.startCodexRun({
      taskId,
      runLabel,
      prompt,
      cwd: worktreePath,
      args: ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json', prompt]
    });
    return meta;
  }

  async resumeTask(taskId, prompt) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    if (!meta.threadId) {
      throw new Error('Cannot resume task without a thread_id. Rerun the task to generate one.');
    }
    const runsCount = meta.runs.length + 1;
    const runLabel = nextRunLabel(runsCount);
    const logFile = `${runLabel}.jsonl`;
    meta.updatedAt = this.now();
    meta.status = 'running';
    meta.lastPrompt = prompt;
    meta.runs.push({
      runId: runLabel,
      prompt,
      logFile,
      startedAt: this.now(),
      finishedAt: null,
      status: 'running',
      exitCode: null
    });

    await writeJson(this.taskMetaPath(taskId), meta);
    this.startCodexRun({
      taskId,
      runLabel,
      prompt,
      cwd: meta.worktreePath,
      args: ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json', 'resume', meta.threadId, prompt]
    });
    return meta;
  }

  async stopTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const run = this.running.get(taskId);
    if (!run) {
      throw new Error('No running task found.');
    }
    run.stopRequested = true;
    try {
      run.child.kill('SIGTERM');
      run.stopTimeout = setTimeout(() => {
        try {
          run.child.kill('SIGKILL');
        } catch (error) {
          // Ignore kill errors.
        }
      }, 5000);
    } catch (error) {
      // Ignore kill errors.
    }

    const updatedAt = this.now();
    meta.status = 'stopping';
    meta.updatedAt = updatedAt;
    if (meta.runs?.length) {
      meta.runs[meta.runs.length - 1] = {
        ...meta.runs[meta.runs.length - 1],
        status: 'stopping'
      };
    }
    await writeJson(this.taskMetaPath(taskId), meta);
    return meta;
  }

  async deleteTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const env = await this.readEnv(meta.envId);
    await this.execOrThrow('git', ['--git-dir', env.mirrorPath, 'worktree', 'remove', '--force', meta.worktreePath]);
    await removePath(this.taskDir(taskId));
  }

  async pushTask(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    await this.execOrThrow('git', [
      '-C',
      meta.worktreePath,
      '-c',
      'remote.origin.mirror=false',
      'push',
      'origin',
      meta.branchName
    ]);

    const githubToken = process.env.ORCH_GITHUB_TOKEN;
    const githubRepo = process.env.ORCH_GITHUB_REPO;
    if (!githubToken || !githubRepo) {
      return { pushed: true, prCreated: false };
    }

    const env = await this.readEnv(meta.envId);
    const response = await this.fetch(`https://api.github.com/repos/${githubRepo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        title: `Codex task ${meta.taskId}`,
        head: meta.branchName,
        base: env.defaultBranch,
        body: `Automated PR for task ${meta.taskId}.`
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to create PR');
    }

    const data = await response.json();
    return { pushed: true, prCreated: true, prUrl: data.html_url };
  }
}

module.exports = {
  Orchestrator,
  parseThreadId
};

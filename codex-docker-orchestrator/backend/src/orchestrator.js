const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
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

class Orchestrator {
  constructor(options = {}) {
    this.orchHome = options.orchHome || process.env.ORCH_HOME || DEFAULT_ORCH_HOME;
    this.exec = options.exec || runCommand;
    this.now = options.now || (() => new Date().toISOString());
    this.fetch = options.fetch || global.fetch;
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
    tasks.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return tasks;
  }

  async getTask(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const logTail = await this.readLogTail(taskId);
    return { ...meta, logTail };
  }

  async readLogTail(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    const latestRun = meta.runs[meta.runs.length - 1];
    if (!latestRun) return '';
    const logPath = path.join(this.taskLogsDir(taskId), latestRun.logFile);
    try {
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      return lines.slice(-120).join('\n');
    } catch (error) {
      return '';
    }
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
    const logPath = path.join(logsDir, logFile);

    const result = await this.exec('codex-docker', ['exec', '--json', prompt], { cwd: worktreePath });
    await fs.writeFile(logPath, result.stdout);
    if (result.stderr) {
      await fs.writeFile(path.join(logsDir, `${runLabel}.stderr`), result.stderr);
    }

    const threadId = parseThreadId(result.stdout);

    const success = result.code === 0 && !!threadId;
    const meta = {
      taskId,
      envId,
      repoUrl: env.repoUrl,
      ref: targetRef,
      branchName,
      worktreePath,
      threadId: threadId || null,
      error: threadId ? null : 'Unable to parse thread_id from codex output.',
      status: success ? 'completed' : 'failed',
      createdAt: this.now(),
      updatedAt: this.now(),
      runs: [
        {
          runId: runLabel,
          prompt,
          logFile,
          startedAt: this.now(),
          finishedAt: this.now(),
          status: success ? 'completed' : 'failed'
        }
      ]
    };

    await writeJson(this.taskMetaPath(taskId), meta);
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
    const logPath = path.join(this.taskLogsDir(taskId), logFile);

    const result = await this.exec(
      'codex-docker',
      ['exec', '--json', 'resume', meta.threadId, prompt],
      { cwd: meta.worktreePath }
    );

    await fs.writeFile(logPath, result.stdout);
    if (result.stderr) {
      await fs.writeFile(path.join(this.taskLogsDir(taskId), `${runLabel}.stderr`), result.stderr);
    }

    meta.updatedAt = this.now();
    meta.status = result.code === 0 ? 'completed' : 'failed';
    meta.runs.push({
      runId: runLabel,
      prompt,
      logFile,
      startedAt: this.now(),
      finishedAt: this.now(),
      status: result.code === 0 ? 'completed' : 'failed'
    });

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
    await this.execOrThrow('git', ['-C', meta.worktreePath, 'push', 'origin', meta.branchName]);

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

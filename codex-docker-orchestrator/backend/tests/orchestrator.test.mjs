import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator, parseThreadId } = require('../src/orchestrator');

async function waitForTaskStatus(orchestrator, taskId, status) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const task = await orchestrator.getTask(taskId);
    if (task.status === status) return task;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for status ${status}`);
}

describe('parseThreadId', () => {
  it('extracts thread_id from JSONL', () => {
    const jsonl = '{"type":"thread.started","thread_id":"abc"}\n{"type":"item.completed"}';
    expect(parseThreadId(jsonl)).toBe('abc');
  });

  it('ignores non-json lines and still finds thread_id', () => {
    const jsonl = 'banner line\n{"type":"thread.started","thread_id":"xyz"}\nnoise';
    expect(parseThreadId(jsonl)).toBe('xyz');
  });
});

describe('Orchestrator', () => {
  it('creates env and task, then resumes', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    expect(env.repoUrl).toBe('git@example.com:repo.git');

    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    expect(task.status).toBe('running');
    expect(task.branchName).toContain('codex/');

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.threadId).toBe(spawn.threadId);
    expect(completed.initialPrompt).toBe('Do work');

    const resumed = await orchestrator.resumeTask(task.taskId, 'Continue');
    expect(resumed.status).toBe('running');
    const resumedCompleted = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(resumed.runs).toHaveLength(2);
    expect(resumedCompleted.lastPrompt).toBe('Continue');

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.runs).toHaveLength(2);
  });
});

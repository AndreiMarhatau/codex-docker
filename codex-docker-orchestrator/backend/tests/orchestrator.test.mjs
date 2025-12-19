import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator, parseThreadId } = require('../src/orchestrator');

describe('parseThreadId', () => {
  it('extracts thread_id from JSONL', () => {
    const jsonl = '{"type":"thread.started","thread_id":"abc"}\n{"type":"item.completed"}';
    expect(parseThreadId(jsonl)).toBe('abc');
  });
});

describe('Orchestrator', () => {
  it('creates env and task, then resumes', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const orchestrator = new Orchestrator({ orchHome, exec, now: () => '2025-12-19T00:00:00.000Z' });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    expect(env.repoUrl).toBe('git@example.com:repo.git');

    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    expect(task.threadId).toBe(exec.threadId);
    expect(task.branchName).toContain('codex/');

    const resumed = await orchestrator.resumeTask(task.taskId, 'Continue');
    expect(resumed.runs).toHaveLength(2);

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.runs).toHaveLength(2);
  });
});

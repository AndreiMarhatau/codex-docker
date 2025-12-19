import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

async function waitForTaskCompletion(app, taskId) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const res = await request(app).get(`/api/tasks/${taskId}`).expect(200);
    if (res.body.status === 'completed') {
      return res.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for task completion');
}

async function createTestApp() {
  const orchHome = await createTempDir();
  const exec = createMockExec({ branches: ['main'] });
  const orchestrator = new Orchestrator({ orchHome, exec, now: () => '2025-12-19T00:00:00.000Z' });
  return { app: createApp({ orchestrator }), exec, orchHome };
}

describe('API', () => {
  it('creates env and task via API', async () => {
    const { app } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    const envId = envRes.body.envId;
    expect(envId).toBeTruthy();

    const taskRes = await request(app)
      .post('/api/tasks')
      .send({ envId, ref: 'main', prompt: 'Do work' })
      .expect(201);

    expect(taskRes.body.status).toBe('running');

    const listRes = await request(app).get('/api/tasks').expect(200);
    expect(listRes.body).toHaveLength(1);

    const completed = await waitForTaskCompletion(app, taskRes.body.taskId);
    expect(completed.threadId).toBeTruthy();
  });

  it('returns 404 for missing task', async () => {
    const { app } = await createTestApp();
    await request(app).get('/api/tasks/missing').expect(404);
  });
});

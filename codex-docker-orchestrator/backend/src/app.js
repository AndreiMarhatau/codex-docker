const express = require('express');
const cors = require('cors');
const { Orchestrator } = require('./orchestrator');

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createApp({ orchestrator = new Orchestrator() } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/envs', asyncHandler(async (req, res) => {
    const envs = await orchestrator.listEnvs();
    res.json(envs);
  }));

  app.post('/api/envs', asyncHandler(async (req, res) => {
    const { repoUrl, defaultBranch } = req.body;
    if (!repoUrl || !defaultBranch) {
      return res.status(400).send('repoUrl and defaultBranch are required');
    }
    const env = await orchestrator.createEnv({ repoUrl, defaultBranch });
    res.status(201).json(env);
  }));

  app.delete('/api/envs/:envId', asyncHandler(async (req, res) => {
    await orchestrator.deleteEnv(req.params.envId);
    res.status(204).send();
  }));

  app.get('/api/tasks', asyncHandler(async (req, res) => {
    const tasks = await orchestrator.listTasks();
    res.json(tasks);
  }));

  app.post('/api/tasks', asyncHandler(async (req, res) => {
    const { envId, ref, prompt } = req.body;
    if (!envId || !prompt) {
      return res.status(400).send('envId and prompt are required');
    }
    const task = await orchestrator.createTask({ envId, ref, prompt });
    res.status(201).json(task);
  }));

  app.get('/api/tasks/:taskId', asyncHandler(async (req, res) => {
    try {
      const task = await orchestrator.getTask(req.params.taskId);
      res.json(task);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).send('Task not found');
      }
      throw error;
    }
  }));

  app.post('/api/tasks/:taskId/resume', asyncHandler(async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).send('prompt is required');
    }
    const task = await orchestrator.resumeTask(req.params.taskId, prompt);
    res.json(task);
  }));

  app.post('/api/tasks/:taskId/push', asyncHandler(async (req, res) => {
    const result = await orchestrator.pushTask(req.params.taskId);
    res.json(result);
  }));

  app.delete('/api/tasks/:taskId', asyncHandler(async (req, res) => {
    await orchestrator.deleteTask(req.params.taskId);
    res.status(204).send();
  }));

  app.use((err, req, res, next) => {
    const message = err && err.message ? err.message : 'Internal error';
    res.status(500).send(message);
  });

  return app;
}

module.exports = {
  createApp
};

const express = require('express');
const cors = require('cors');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Orchestrator } = require('./orchestrator');

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createApp({ orchestrator = new Orchestrator() } = {}) {
  const app = express();
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type']
    })
  );
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

  app.get('/api/settings/image', asyncHandler(async (req, res) => {
    const info = await orchestrator.getImageInfo();
    res.json(info);
  }));

  app.post('/api/settings/image/pull', asyncHandler(async (req, res) => {
    const info = await orchestrator.pullImage();
    res.json(info);
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

  app.get('/api/tasks/:taskId/diff', asyncHandler(async (req, res) => {
    try {
      const diff = await orchestrator.getTaskDiff(req.params.taskId);
      res.json(diff);
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

  app.post('/api/tasks/:taskId/stop', asyncHandler(async (req, res) => {
    const task = await orchestrator.stopTask(req.params.taskId);
    res.json(task);
  }));

  app.get('/api/tasks/:taskId/logs/stream', async (req, res) => {
    const { taskId } = req.params;
    try {
      const task = await orchestrator.getTask(taskId);
      const runId = req.query.runId || (task.runs?.[task.runs.length - 1]?.runId ?? null);
      if (!runId) {
        return res.status(404).send('No runs for task.');
      }
      const run = task.runs.find((entry) => entry.runId === runId);
      if (!run) {
        return res.status(404).send('Run not found.');
      }
      const logPath = path.join(orchestrator.taskLogsDir(taskId), run.logFile);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });

      let filePosition = 0;
      let lineCount = 0;
      try {
        const content = await fs.readFile(logPath, 'utf8');
        const lines = content.split(/\r?\n/).filter(Boolean);
        lineCount = lines.length;
        const stat = await fs.stat(logPath);
        filePosition = stat.size;
      } catch (error) {
        filePosition = 0;
      }

      let buffer = '';
      const sendEntry = (entry) => {
        res.write(`data: ${JSON.stringify({ runId, entry })}\n\n`);
      };

      const interval = setInterval(async () => {
        try {
          const stat = await fs.stat(logPath);
          if (stat.size <= filePosition) {
            return;
          }
          const handle = await fs.open(logPath, 'r');
          const length = stat.size - filePosition;
          const readBuffer = Buffer.alloc(length);
          await handle.read(readBuffer, 0, length, filePosition);
          await handle.close();
          filePosition = stat.size;
          buffer += readBuffer.toString('utf8');
          let newlineIndex = buffer.indexOf('\n');
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line) {
              lineCount += 1;
              let parsed = null;
              try {
                parsed = JSON.parse(line);
              } catch (error) {
                parsed = null;
              }
              sendEntry({
                id: `log-${lineCount}`,
                type: parsed?.type || 'text',
                raw: line,
                parsed
              });
            }
            newlineIndex = buffer.indexOf('\n');
          }
        } catch (error) {
          // Ignore stream errors.
        }
      }, 1000);

      req.on('close', () => {
        clearInterval(interval);
      });
    } catch (error) {
      res.status(404).send('Task not found.');
    }
  });

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

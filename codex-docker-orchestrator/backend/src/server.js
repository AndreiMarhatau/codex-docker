const path = require('node:path');
const express = require('express');
const { createApp } = require('./app');

const PORT = process.env.ORCH_PORT ? Number(process.env.ORCH_PORT) : 8080;

const app = createApp();

const uiDist = path.resolve(__dirname, '../../ui/dist');
if (express.static && require('node:fs').existsSync(uiDist)) {
  app.use(express.static(uiDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(uiDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Orchestrator backend listening on :${PORT}`);
});

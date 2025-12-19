import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { apiRequest } from './api.js';

const emptyEnvForm = { repoUrl: '', defaultBranch: 'main' };
const emptyTaskForm = { envId: '', ref: '', prompt: '' };

function formatStatus(status) {
  if (!status) return 'unknown';
  return status.replace('_', ' ');
}

function formatTimestamp(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function App() {
  const [envs, setEnvs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [envForm, setEnvForm] = useState(emptyEnvForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [resumePrompt, setResumePrompt] = useState('');
  const [taskDetail, setTaskDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(1);

  const selectedEnv = useMemo(
    () => envs.find((env) => env.envId === selectedEnvId),
    [envs, selectedEnvId]
  );

  const visibleTasks = useMemo(() => {
    const filtered = selectedEnvId ? tasks.filter((task) => task.envId === selectedEnvId) : tasks;
    return filtered
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [tasks, selectedEnvId]);

  async function refreshAll() {
    const [envData, taskData] = await Promise.all([
      apiRequest('/api/envs'),
      apiRequest('/api/tasks')
    ]);
    setEnvs(envData);
    setTasks(taskData);
    if (!selectedEnvId && envData.length > 0) {
      setSelectedEnvId(envData[0].envId);
    }
  }

  async function refreshTaskDetail(taskId) {
    if (!taskId) return;
    try {
      const detail = await apiRequest(`/api/tasks/${taskId}`);
      setTaskDetail(detail);
    } catch (err) {
      if (err.status === 404) {
        setSelectedTaskId('');
        setTaskDetail(null);
        return;
      }
      throw err;
    }
  }

  useEffect(() => {
    refreshAll().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll().catch(() => {});
      if (selectedTaskId) {
        refreshTaskDetail(selectedTaskId).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedTaskId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskDetail(null);
      return;
    }
    refreshTaskDetail(selectedTaskId).catch((err) => setError(err.message));
  }, [selectedTaskId]);

  async function handleCreateEnv() {
    setError('');
    setLoading(true);
    try {
      await apiRequest('/api/envs', {
        method: 'POST',
        body: JSON.stringify(envForm)
      });
      setEnvForm(emptyEnvForm);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask() {
    setError('');
    setLoading(true);
    try {
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskForm)
      });
      setTaskForm(emptyTaskForm);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResumeTask() {
    if (!selectedTaskId || !resumePrompt.trim()) return;
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${selectedTaskId}/resume`, {
        method: 'POST',
        body: JSON.stringify({ prompt: resumePrompt })
      });
      setResumePrompt('');
      await refreshAll();
      await refreshTaskDetail(selectedTaskId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTask(taskId) {
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (taskId === selectedTaskId) {
        setSelectedTaskId('');
        setTaskDetail(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEnv(envId) {
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/envs/${envId}`, { method: 'DELETE' });
      if (envId === selectedEnvId) {
        setSelectedEnvId('');
      }
      const selectedTask = tasks.find((task) => task.taskId === selectedTaskId);
      if (selectedTask && selectedTask.envId === envId) {
        setSelectedTaskId('');
        setTaskDetail(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePushTask() {
    if (!selectedTaskId) return;
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${selectedTaskId}/push`, { method: 'POST' });
      await refreshTaskDetail(selectedTaskId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="app-shell">
      <Card className="header-card" sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h4">Codex Docker Orchestrator</Typography>
            <Typography color="text.secondary">
              Manage isolated repo environments, run Codex tasks, resume work, and push on demand.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onChange={(event, value) => setActiveTab(value)}
        textColor="primary"
        indicatorColor="primary"
        sx={{ mb: 3 }}
      >
        <Tab label="Repo Environments" />
        <Tab label="Tasks" />
      </Tabs>

      {activeTab === 0 && (
        <Box className="surface-grid">
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Repo Environments</Typography>
                  <TextField
                    label="Repository URL"
                    fullWidth
                    value={envForm.repoUrl}
                    onChange={(event) =>
                      setEnvForm((prev) => ({ ...prev, repoUrl: event.target.value }))
                    }
                  />
                  <TextField
                    label="Default branch"
                    fullWidth
                    value={envForm.defaultBranch}
                    onChange={(event) =>
                      setEnvForm((prev) => ({ ...prev, defaultBranch: event.target.value }))
                    }
                  />
                  <Button
                    variant="contained"
                    onClick={handleCreateEnv}
                    disabled={loading || !envForm.repoUrl.trim()}
                  >
                    Create environment
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Existing Environments</Typography>
                  <Stack spacing={1}>
                    {envs.map((env) => (
                      <Card
                        key={env.envId}
                        variant="outlined"
                        sx={{
                          borderColor: env.envId === selectedEnvId ? 'primary.main' : 'divider',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedEnvId(env.envId)}
                      >
                        <CardContent>
                          <Stack spacing={0.5}>
                            <Typography fontWeight={600}>{env.repoUrl}</Typography>
                            <Typography color="text.secondary" className="mono">
                              {env.envId}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={`default: ${env.defaultBranch}`} />
                              <Button
                                size="small"
                                color="secondary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteEnv(env.envId);
                                }}
                              >
                                Remove
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                    {envs.length === 0 && (
                      <Typography color="text.secondary">
                        No environments yet. Create one to get started.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )}

      {activeTab === 1 && (
        <Box className="surface-grid">
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Create Task</Typography>
                  <TextField
                    select
                    label="Environment"
                    value={taskForm.envId}
                    onChange={(event) =>
                      setTaskForm((prev) => ({ ...prev, envId: event.target.value }))
                    }
                    fullWidth
                  >
                    {envs.map((env) => (
                      <MenuItem key={env.envId} value={env.envId}>
                        {env.repoUrl}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Branch / tag / ref"
                    fullWidth
                    value={taskForm.ref}
                    onChange={(event) =>
                      setTaskForm((prev) => ({ ...prev, ref: event.target.value }))
                    }
                    placeholder={selectedEnv?.defaultBranch || 'main'}
                  />
                  <TextField
                    label="Task prompt"
                    fullWidth
                    multiline
                    minRows={3}
                    value={taskForm.prompt}
                    onChange={(event) =>
                      setTaskForm((prev) => ({ ...prev, prompt: event.target.value }))
                    }
                  />
                  <Button
                    variant="contained"
                    onClick={handleCreateTask}
                    disabled={loading || !taskForm.envId || !taskForm.prompt.trim()}
                  >
                    Run task
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Tasks</Typography>
                    <Button size="small" variant="outlined" onClick={refreshAll}>
                      Refresh
                    </Button>
                  </Stack>
                  <Stack spacing={1}>
                    {visibleTasks.map((task) => (
                      <Card
                        key={task.taskId}
                        variant="outlined"
                        sx={{
                          borderColor: task.taskId === selectedTaskId ? 'primary.main' : 'divider',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedTaskId(task.taskId)}
                      >
                        <CardContent>
                          <Stack spacing={0.5}>
                            <Typography fontWeight={600}>{task.branchName}</Typography>
                            <Typography color="text.secondary">{task.repoUrl}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={formatStatus(task.status)} />
                              <Chip size="small" label={task.ref} />
                              <Chip size="small" label={`created ${formatTimestamp(task.createdAt)}`} />
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                    {visibleTasks.length === 0 && (
                      <Typography color="text.secondary">
                        No tasks yet. Create one on the left.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Task Details</Typography>
                  {!taskDetail && (
                    <Typography color="text.secondary">
                      Select a task to view details, logs, and continue work.
                    </Typography>
                  )}
                  {taskDetail && (
                    <Stack spacing={2}>
                      <Stack spacing={0.5}>
                        <Typography fontWeight={600}>{taskDetail.branchName}</Typography>
                        <Typography color="text.secondary">{taskDetail.repoUrl}</Typography>
                        <Typography className="mono">{taskDetail.taskId}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={formatStatus(taskDetail.status)} size="small" />
                        <Chip label={`ref: ${taskDetail.ref}`} size="small" />
                        <Chip label={`thread: ${taskDetail.threadId}`} size="small" />
                      </Stack>
                      <Divider />
                      <Typography variant="subtitle2">Latest logs</Typography>
                      <Box className="log-box">
                        {taskDetail.logTail || 'No logs yet.'}
                      </Box>
                      <TextField
                        label="Resume prompt"
                        fullWidth
                        multiline
                        minRows={3}
                        value={resumePrompt}
                        onChange={(event) => setResumePrompt(event.target.value)}
                      />
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Button
                          variant="contained"
                          onClick={handleResumeTask}
                          disabled={loading || !resumePrompt.trim()}
                        >
                          Continue task
                        </Button>
                        <Button variant="outlined" onClick={handlePushTask} disabled={loading}>
                          Push + PR
                        </Button>
                        <Button
                          color="secondary"
                          onClick={() => handleDeleteTask(taskDetail.taskId)}
                          disabled={loading}
                        >
                          Remove task
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

          </Stack>
        </Box>
      )}

      {error && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default App;

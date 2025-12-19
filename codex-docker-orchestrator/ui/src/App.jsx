import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { apiRequest, apiUrl } from './api.js';

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

function formatLogEntry(entry) {
  if (!entry) return '';
  if (entry.parsed) {
    try {
      return JSON.stringify(entry.parsed, null, 2);
    } catch (error) {
      return entry.raw || '';
    }
  }
  return entry.raw || '';
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
  const logStreamRef = useRef(null);

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

  useEffect(() => {
    if (!selectedTaskId || !taskDetail) return;
    if (taskDetail.status !== 'running' && taskDetail.status !== 'stopping') {
      if (logStreamRef.current) {
        logStreamRef.current.close();
        logStreamRef.current = null;
      }
      return;
    }
    const latestRun = taskDetail.runs?.[taskDetail.runs.length - 1];
    if (!latestRun) return;
    if (logStreamRef.current) {
      logStreamRef.current.close();
    }
    const eventSource = new EventSource(
      apiUrl(`/api/tasks/${selectedTaskId}/logs/stream?runId=${latestRun.runId}`)
    );
    logStreamRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { runId, entry } = payload;
        if (!runId || !entry) return;
        setTaskDetail((prev) => {
          if (!prev) return prev;
          const runLogs = prev.runLogs ? [...prev.runLogs] : [];
          const runIndex = runLogs.findIndex((run) => run.runId === runId);
          if (runIndex === -1) return prev;
          const run = runLogs[runIndex];
          const existing = run.entries || [];
          if (existing.some((item) => item.id === entry.id)) {
            return prev;
          }
          const updatedRun = {
            ...run,
            entries: [...existing, entry]
          };
          runLogs[runIndex] = updatedRun;
          return { ...prev, runLogs };
        });
      } catch (err) {
        // Ignore malformed stream payloads.
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => {
      eventSource.close();
      if (logStreamRef.current === eventSource) {
        logStreamRef.current = null;
      }
    };
  }, [selectedTaskId, taskDetail]);

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

  async function handleStopTask(taskId = selectedTaskId) {
    if (!taskId) return;
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${taskId}/stop`, { method: 'POST' });
      if (taskId === selectedTaskId) {
        await refreshTaskDetail(taskId);
      }
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
                    {!selectedTaskId && (
                      <>
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
                                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Chip size="small" label={formatStatus(task.status)} />
                                      <Chip size="small" label={task.ref} />
                                      <Chip size="small" label={`created ${formatTimestamp(task.createdAt)}`} />
                                    </Stack>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                      <Tooltip title="Stop task">
                                        <span>
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleStopTask(task.taskId);
                                            }}
                                            disabled={loading || task.status !== 'running'}
                                            aria-label={`Stop task ${task.taskId}`}
                                          >
                                            <StopCircleOutlinedIcon fontSize="small" />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                      <Tooltip title="Remove task">
                                        <span>
                                          <IconButton
                                            size="small"
                                            color="secondary"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleDeleteTask(task.taskId);
                                            }}
                                            disabled={loading}
                                            aria-label={`Remove task ${task.taskId}`}
                                          >
                                            <DeleteOutlineIcon fontSize="small" />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    </Stack>
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
                      </>
                    )}
                    {selectedTaskId && (
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                          <Typography variant="h6">Task Details</Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedTaskId('');
                              setTaskDetail(null);
                            }}
                          >
                            Back to tasks
                          </Button>
                        </Stack>
                        {!taskDetail && (
                          <Typography color="text.secondary">
                            Loading task details...
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
                              <Chip label={`thread: ${taskDetail.threadId || 'pending'}`} size="small" />
                            </Stack>
                            <Divider />
                            <Stack spacing={1}>
                              <Typography variant="subtitle2">Prompts</Typography>
                              <Typography color="text.secondary">
                                Initial: {taskDetail.initialPrompt || taskDetail.runs?.[0]?.prompt || 'unknown'}
                              </Typography>
                              <Typography color="text.secondary">
                                Latest: {taskDetail.lastPrompt || taskDetail.runs?.[taskDetail.runs?.length - 1]?.prompt || 'unknown'}
                              </Typography>
                            </Stack>
                            <Divider />
                            <Typography variant="subtitle2">Logs</Typography>
                            <Stack spacing={1}>
                              {(taskDetail.runLogs || []).map((run) => (
                                <Box key={run.runId} component="details" className="log-run">
                                  <summary className="log-summary">
                                    <span>{run.runId}</span>
                                    <span className="log-meta">
                                      {formatStatus(run.status)} • {formatTimestamp(run.startedAt)}
                                    </span>
                                  </summary>
                                  <Stack spacing={1} sx={{ mt: 1 }}>
                                    {run.entries.length === 0 && (
                                      <Typography color="text.secondary">No logs yet.</Typography>
                                    )}
                                    {run.entries.map((entry) => (
                                      <Box key={`${run.runId}-${entry.id}`} component="details" className="log-entry">
                                        <summary className="log-summary">
                                          <span className="mono">{entry.type}</span>
                                        </summary>
                                        <Box className="log-box">
                                          <pre>{formatLogEntry(entry)}</pre>
                                        </Box>
                                      </Box>
                                    ))}
                                  </Stack>
                                </Box>
                              ))}
                              {(taskDetail.runLogs || []).length === 0 && (
                                <Typography color="text.secondary">No logs yet.</Typography>
                              )}
                            </Stack>
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
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Tooltip title="Stop task">
                                  <span>
                                    <IconButton
                                      color="error"
                                      onClick={() => handleStopTask(taskDetail.taskId)}
                                      disabled={loading || taskDetail.status !== 'running'}
                                      aria-label="Stop task"
                                    >
                                      <StopCircleOutlinedIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title="Remove task">
                                  <span>
                                    <IconButton
                                      color="secondary"
                                      onClick={() => handleDeleteTask(taskDetail.taskId)}
                                      disabled={loading}
                                      aria-label="Remove task"
                                    >
                                      <DeleteOutlineIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Stack>
                            </Stack>
                          </Stack>
                        )}
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

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export function createMockExec({ branches = ['main'] } = {}) {
  const calls = [];
  const threadId = '019b341f-04d9-73b3-8263-2c05ca63d690';

  const exec = async (command, args, options = {}) => {
    calls.push({ command, args, options });

    if (command === 'git') {
      if (args[0] === 'clone' && args[1] === '--mirror') {
        const target = args[3];
        await fs.mkdir(target, { recursive: true });
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args[0] === '--git-dir' && args[2] === 'show-ref') {
        const ref = args[4];
        const branch = ref.replace('refs/heads/', '');
        if (branches.includes(branch)) {
          return { stdout: ref, stderr: '', code: 0 };
        }
        return { stdout: '', stderr: 'not found', code: 1 };
      }
      if (args[0] === '--git-dir' && args[2] === 'fetch') {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args[0] === '--git-dir' && args[2] === 'worktree' && args[3] === 'add') {
        const worktreePath = args[4];
        await fs.mkdir(worktreePath, { recursive: true });
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args[0] === '-C' && args[2] === 'checkout') {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args[0] === '--git-dir' && args[2] === 'worktree' && args[3] === 'remove') {
        const worktreePath = args[5];
        await fs.rm(worktreePath, { recursive: true, force: true });
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args[0] === '-C' && args[2] === 'push') {
        return { stdout: '', stderr: '', code: 0 };
      }
    }

    if (command === 'codex-docker') {
      const isResume = args[2] === 'resume';
      const stdout = 'banner line\n' + JSON.stringify({ type: 'thread.started', thread_id: threadId }) + '\n' +
        JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'agent_message', text: isResume ? 'RESUME' : 'OK' } });
      return { stdout, stderr: '', code: 0 };
    }

    return { stdout: '', stderr: 'unknown command', code: 1 };
  };

  exec.calls = calls;
  exec.threadId = threadId;

  return exec;
}

export async function createTempDir() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-orch-'));
  return base;
}

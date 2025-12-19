import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';

it('renders the orchestrator header and forms', async () => {
  render(<App />);
  expect(await screen.findByText('Codex Docker Orchestrator')).toBeInTheDocument();
  expect(screen.getByText('Repo Environments')).toBeInTheDocument();
  expect(screen.getByText('Create Task')).toBeInTheDocument();
});

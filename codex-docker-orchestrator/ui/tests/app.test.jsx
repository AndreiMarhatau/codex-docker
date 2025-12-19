import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';

it('renders the orchestrator header and forms', async () => {
  render(<App />);
  expect(await screen.findByText('Codex Docker Orchestrator')).toBeInTheDocument();
  expect(screen.getAllByText('Repo Environments').length).toBeGreaterThan(0);
  expect(screen.getByText('Create Task')).toBeInTheDocument();
  expect(screen.getByText('Settings')).toBeInTheDocument();
});

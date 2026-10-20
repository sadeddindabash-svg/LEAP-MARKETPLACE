import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoriesTabs from './CategoriesTabs';

beforeEach(() => { localStorage.setItem('leap_admin_token', 't'); globalThis.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => (String(url).endsWith('/health') ? { categories: { total: 0, inCatalog: 0, withoutRealPhoto: 0 }, parts: { total: 0, inCatalog: 0, withoutRealPhoto: 0, onEstimatedSize: 0 }, productsPricedOnEstimates: 0 } : []) })); });

describe('CategoriesTabs', () => {
  it('opens on the existing Categories page and switches to the import and edit screens', async () => {
    render(<CategoriesTabs main={<div>THE EXISTING PAGE</div>} onSessionExpired={vi.fn()} />);
    expect(screen.getByText('THE EXISTING PAGE')).toBeInTheDocument(); expect(screen.getByRole('tab', { name: 'Categories' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Import from Excel' })); expect(await screen.findByText(/import the parts catalog from an excel sheet/i)).toBeInTheDocument(); expect(screen.queryByText('THE EXISTING PAGE')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Edit details' })); expect(await screen.findByText(/^Categories \(0\)$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Categories' })); expect(screen.getByText('THE EXISTING PAGE')).toBeInTheDocument();
  });

  it('an answer of an unexpected shape does not crash the import screen', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ unexpected: true }) }));
    render(<CategoriesTabs main={<div>MAIN</div>} onSessionExpired={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Import from Excel' }));
    expect(await screen.findByText(/import the parts catalog from an excel sheet/i)).toBeInTheDocument(); expect(screen.queryByText('Catalog health')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// The Categories page has a "Photos" tab beside the others; it opens the photos screen, and the other tabs are unchanged.
vi.mock('./CatalogPhotosPanel', () => ({ default: () => <div>THE PHOTOS SCREEN</div> }));
vi.mock('./CatalogImportPanel', () => ({ default: () => <div>THE IMPORT SCREEN</div> }));
vi.mock('./CatalogEditorPanel', () => ({ default: () => <div>THE EDIT SCREEN</div> }));
import CategoriesTabs from './CategoriesTabs';

describe('the Photos tab', () => {
  it('is the fourth tab, opens the photos screen, and the others still work', () => {
    render(<CategoriesTabs main={<div>THE EXISTING PAGE</div>} onSessionExpired={vi.fn()} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Categories', 'Import from Excel', 'Edit details', 'Photos']); expect(screen.queryByText('THE PHOTOS SCREEN')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Photos' })); expect(screen.getByText('THE PHOTOS SCREEN')).toBeInTheDocument(); expect(screen.getByRole('tab', { name: 'Photos' })).toHaveAttribute('aria-selected', 'true'); expect(screen.queryByText('THE EXISTING PAGE')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Import from Excel' })); expect(screen.getByText('THE IMPORT SCREEN')).toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: 'Edit details' })); expect(screen.getByText('THE EDIT SCREEN')).toBeInTheDocument(); fireEvent.click(screen.getByRole('tab', { name: 'Categories' })); expect(screen.getByText('THE EXISTING PAGE')).toBeInTheDocument();
  });
});

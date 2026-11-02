import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FolderTabs, FilterButtons } from './components/PageChrome';

// The common page design: the main tabs under the header (at most 7 shown, the rest under "More") and the buttons inside a page (all 40 px, the number in a box).
const tabs = Array.from({ length: 10 }, (_, i) => ({ id: `t${i + 1}`, label: `Tab ${i + 1}` }));

describe('main tabs', () => {
  it('shows 7 tabs and puts the rest under "More (3)"; choosing one there selects it', () => {
    const onSelect = vi.fn(); render(<FolderTabs label="Sections" tabs={tabs} activeId="t1" onSelect={onSelect} />);
    expect(within(screen.getByRole('tablist', { name: 'Sections' })).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4', 'Tab 5', 'Tab 6', 'Tab 7']);
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^More \(3\)/ })); fireEvent.click(screen.getByRole('menuitem', { name: 'Tab 9' }));
    expect(onSelect).toHaveBeenCalledWith('t9'); expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('a chosen tab from "More" takes the last visible place, so the chosen tab is always shown', () => {
    render(<FolderTabs label="Sections" tabs={tabs} activeId="t9" onSelect={vi.fn()} />);
    const names = screen.getAllByRole('tab').map((t) => t.textContent); expect(names).toHaveLength(7); expect(names[6]).toBe('Tab 9'); expect(screen.getByRole('tab', { name: 'Tab 9' })).toHaveAttribute('aria-selected', 'true');
  });
  it('with 7 tabs or fewer there is no "More"', () => {
    render(<FolderTabs label="Sections" tabs={tabs.slice(0, 4)} activeId="t2" onSelect={vi.fn()} />); expect(screen.queryByRole('button', { name: /^More/ })).not.toBeInTheDocument();
  });
});

describe('buttons inside a page', () => {
  const items = [{ id: 'all', label: 'All', count: 6, countTestId: 'c-all' }, { id: 'open', label: 'Open', count: 3, tone: 'red' }, { id: 'none', label: 'Plain' }];
  it('are toggle buttons named by their label, 40 px high, with the number in a box; the chosen one is pressed', () => {
    const onSelect = vi.fn(); render(<FilterButtons label="Filter" items={items} activeId="all" onSelect={onSelect} />);
    const group = screen.getByRole('group', { name: 'Filter' }); const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']); buttons.forEach((b) => expect(b).toHaveStyle({ height: '40px' }));
    expect(screen.getByTestId('c-all')).toHaveTextContent('6'); expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('title', 'Open: 3');
    expect(within(screen.getByRole('button', { name: 'Plain' })).queryByText(/\d/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' })); expect(onSelect).toHaveBeenCalledWith('open');
  });
});

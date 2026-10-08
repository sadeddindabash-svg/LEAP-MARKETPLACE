import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShoppingBag } from 'lucide-react';
import { KpiCard } from './components/ui.jsx';

describe('KpiCard: the trend row only appears when there is a REAL change to show', () => {
  it('CRITICAL: with no change given there is no arrow and no "vs last week" (it used to show a red down-arrow on every card, as if everything had dropped)', () => {
    const { container } = render(<KpiCard label="Total orders" value="240" icon={ShoppingBag} />);
    expect(screen.getByText('240')).toBeInTheDocument();
    expect(screen.queryByText(/vs last week/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(1);               // only the card's own icon, no trend arrow
    for (const empty of [undefined, null, '']) {
      const { container: c, unmount } = render(<KpiCard label="x" value="1" delta={empty} positive={false} icon={ShoppingBag} />);
      expect(c.querySelectorAll('svg')).toHaveLength(1);
      unmount();
    }
  });

  it('with a real change it shows the number, the direction and "vs last week"', () => {
    const { container } = render(<KpiCard label="Total orders" value="240" delta="+4.2%" positive icon={ShoppingBag} />);
    expect(screen.getByText('+4.2%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(2);               // icon + up arrow
    render(<KpiCard label="Open tickets" value="14" delta="-3%" positive={false} icon={ShoppingBag} />);
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });
});

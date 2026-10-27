import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import FitmentSummary from './FitmentSummary';

// The summary at the top of the admin's Vehicle fitment card.
const row = (brandName, modelName, year, generationId = 'g1') => ({ brandName, modelName, year, generationId, label: `${brandName} ${modelName} (G) · ${year}` });
describe('the summary', () => {
  it('with fitment: the totals and one line per model with its years', () => {
    render(<FitmentSummary fitment={[row('BYD', 'Seal', 2022), row('BYD', 'Seal', 2023), row('BYD', 'Dolphin', 2023, 'g2')]} />);
    const box = screen.getByTestId('fitment-summary'); expect(box).toHaveTextContent('Summary: 3 vehicles · 2 models'); const lines = screen.getAllByTestId('fitment-summary-line'); expect(lines.map((l) => l.textContent)).toEqual(['BYD Seal2022–2023', 'BYD Dolphin2023']); expect(within(lines[0]).getByText('2022–2023')).toBeInTheDocument();
  });
  it('one vehicle of one model is said in the singular', () => { render(<FitmentSummary fitment={[row('BYD', 'Seal', 2022)]} />); expect(screen.getByTestId('fitment-summary')).toHaveTextContent('Summary: 1 vehicle · 1 model'); });
  it('with no fitment at all it says buyers see the part as universal', () => { for (const none of [[], undefined, null]) { const v = render(<FitmentSummary fitment={none} />); expect(screen.getByTestId('fitment-summary')).toHaveTextContent('buyers see this part as universal (fits all vehicles)'); v.unmount(); } });
  it('rows with an unreadable model still give the vehicle count and no broken line', () => { render(<FitmentSummary fitment={[{ label: '???', year: 2020, generationId: 'x' }]} />); expect(screen.getByTestId('fitment-summary')).toHaveTextContent('Summary: 1 vehicle'); expect(screen.queryAllByTestId('fitment-summary-line')).toHaveLength(0); });
});

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import OrderVehicle, { OrderVehicleCell, carHeader, carTitle, carDetail, versionInfo, generationYears } from './OrderVehicle';
import { LangContext } from './langContext';

// The part photo, the arrow and the car IN FULL (brand, model, generation, year, engine, transmission and the versions the part is for), under an item (OrderVehicle) and in the orders list (OrderVehicleCell), in English and Chinese.
const name = (en, zh) => ({ en, ar: null, zh });
const GEN = { name: 'Gen One', yearStart: 2022, yearEnd: null, versionCount: 3 };
const V = (id, en, zh, engine = '2 motors', seats = 5) => ({ id, name: name(en, zh), engine, seats });
const car = (over = {}) => ({ year: 2023, brand: name('BYD', '比亚迪'), model: name('Seal', '海豹'), engine: '2.0T', transmission: 'Automatic', photoUrl: '/uploads/car.png', generation: GEN, versions: null, ...over });
const vehicle = (cars, over = {}) => ({ partPhotoUrl: '/uploads/part.png', fitsAnyCar: cars.length === 0, carCount: cars.length, cars, ...over });
const inLang = (lang, ui) => render(<LangContext.Provider value={{ lang, t: null, toggle: () => {} }}>{ui}</LangContext.Provider>);
const narrowed = (over = {}) => car({ versions: [V('v2', 'Performance AWD', '性能四驱'), V('v3', 'Excellence AWD', '旗舰四驱')], ...over });

describe('OrderVehicle (under an item)', () => {
  it('shows nothing when there is no vehicle information', () => { const { container } = inLang('en', <OrderVehicle vehicle={null} />); expect(container).toBeEmptyDOMElement(); });
  it('CRITICAL: the car in full: the title, brand, model, generation, year, engine and transmission, with the part photo and the car photo', () => {
    const { container } = inLang('en', <OrderVehicle vehicle={vehicle([car()])} />);
    expect(container.querySelector('.lucide-arrow-right')).toBeInTheDocument(); expect(screen.getByText('The part')).toBeInTheDocument(); expect(screen.getByText('Fits this car')).toBeInTheDocument();
    const box = screen.getByTestId('vehicle-details'); expect(within(box).getByText('BYD Seal · 2023')).toBeInTheDocument();
    for (const [label, value] of [['Brand', 'BYD'], ['Model', 'Seal'], ['Generation', '2022 – present'], ['Year', '2023'], ['Engine', '2.0T'], ['Transmission', 'Automatic']]) { const l = within(box).getByText(label); expect(l.nextSibling).toHaveTextContent(value); }
    const [part, carPhoto] = screen.getAllByRole('img'); expect(part).toHaveAttribute('src', 'http://localhost:4000/uploads/part.png'); expect(carPhoto).toHaveAttribute('src', 'http://localhost:4000/uploads/car.png'); expect(screen.queryByText(/Also listed/)).not.toBeInTheDocument();
  });
  it('CRITICAL: a part narrowed to some versions: "2 of 3 versions", each version with its engine and seats, and the warning to check the version', () => {
    inLang('en', <OrderVehicle vehicle={vehicle([narrowed()])} />);
    expect(screen.getByTestId('version-tag-some')).toHaveTextContent('2 of 3 versions'); expect(screen.getByTestId('version-chip-v2')).toHaveTextContent('Performance AWD'); expect(screen.getByTestId('version-chip-v2')).toHaveTextContent('2 motors · 5 seats'); expect(screen.getByTestId('version-chip-v3')).toHaveTextContent('Excellence AWD');
    expect(screen.queryByTestId('version-chip-v1')).not.toBeInTheDocument(); expect(screen.getByTestId('version-warning')).toHaveTextContent('This part is for these versions only: check the version before you send it to the hub.');
  });
  it('a part for every version of a generation that has versions says "All versions", with no warning', () => { inLang('en', <OrderVehicle vehicle={vehicle([car()])} />); expect(screen.getByTestId('version-tag-all')).toHaveTextContent('All versions'); expect(screen.queryByTestId('version-warning')).not.toBeInTheDocument(); expect(screen.queryByTestId('version-tag-some')).not.toBeInTheDocument(); });
  it('a generation with NO versions in the catalogue has no Version row at all (nothing to say)', () => { inLang('en', <OrderVehicle vehicle={vehicle([car({ generation: { ...GEN, versionCount: 0 } })])} />); expect(screen.queryByText('Version')).not.toBeInTheDocument(); expect(screen.queryByTestId('version-tag-all')).not.toBeInTheDocument(); expect(screen.queryByTestId('version-tag-none')).not.toBeInTheDocument(); });
  it('an older server (no generation, no versions in the car) still works: the car without the generation and version rows', () => {
    inLang('en', <OrderVehicle vehicle={vehicle([car({ generation: undefined, versions: undefined })])} />); const box = screen.getByTestId('vehicle-details'); expect(within(box).getByText('BYD Seal · 2023')).toBeInTheDocument(); expect(within(box).queryByText('Generation')).not.toBeInTheDocument(); expect(within(box).queryByText('Version')).not.toBeInTheDocument(); expect(within(box).getByText('Engine')).toBeInTheDocument();
  });
  it('rows with nothing to say are left out: no engine, no transmission; a generation that is the one year already shown', () => {
    inLang('en', <OrderVehicle vehicle={vehicle([car({ engine: null, transmission: null, generation: { ...GEN, yearStart: 2023, yearEnd: 2023 } })])} />); const box = screen.getByTestId('vehicle-details'); for (const label of ['Engine', 'Transmission', 'Generation']) expect(within(box).queryByText(label)).not.toBeInTheDocument(); expect(within(box).getByText('Year')).toBeInTheDocument();
  });
  it('a closed generation shows its two years', () => { inLang('en', <OrderVehicle vehicle={vehicle([car({ generation: { ...GEN, yearStart: 2019, yearEnd: 2023 } })])} />); expect(screen.getByText('Generation').nextSibling).toHaveTextContent('2019 – 2023'); });
  it('Chinese: the wording and the Chinese names (brand, model, versions) follow the language; a missing Chinese name falls back to English', () => {
    inLang('zh', <OrderVehicle vehicle={vehicle([narrowed({ brand: { en: 'Toyota', ar: null, zh: null } })])} />);
    const box = screen.getByTestId('vehicle-details'); expect(within(box).getByText('Toyota 海豹 · 2023')).toBeInTheDocument(); for (const label of ['品牌', '车型', '年款范围', '年份', '发动机', '变速箱', '版本']) expect(within(box).getByText(label)).toBeInTheDocument();
    expect(screen.getByTestId('version-tag-some')).toHaveTextContent('3个版本中的2个'); expect(screen.getByTestId('version-chip-v2')).toHaveTextContent('性能四驱'); expect(screen.getByTestId('version-chip-v2')).toHaveTextContent('2 motors · 5座'); expect(screen.getByTestId('version-warning')).toHaveTextContent('发往集运仓前请核对版本'); expect(within(box).getByText('2022 – 至今')).toBeInTheDocument();
    expect(screen.getByText('零件')).toBeInTheDocument(); expect(screen.getByText('适配此车型')).toBeInTheDocument();
  });
  it('several cars: the first is shown in full, the others are named (with their versions when narrowed), and the ones not sent are counted', () => {
    inLang('en', <OrderVehicle vehicle={vehicle([car(), narrowed({ year: 2022, brand: name('Toyota', '丰田'), model: name('Corolla', '卡罗拉') }), car({ year: 2019, brand: name('Honda', '本田'), model: name('Civic', '思域') })], { carCount: 7 })} />);
    expect(within(screen.getByTestId('vehicle-details')).getByText('BYD Seal · 2023')).toBeInTheDocument(); expect(screen.getByText('Also listed for: Toyota Corolla · 2022 (Performance AWD, Excellence AWD), Honda Civic · 2019 +4 more')).toBeInTheDocument();
  });
  it('a car or a part without a photo shows an icon, not a broken image; a full web address is used as it is', () => {
    const { rerender } = inLang('en', <OrderVehicle vehicle={vehicle([car({ photoUrl: null })], { partPhotoUrl: null })} />); expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<LangContext.Provider value={{ lang: 'en', t: null, toggle: () => {} }}><OrderVehicle vehicle={vehicle([car()], { partPhotoUrl: 'https://cdn.example.com/p.png' })} /></LangContext.Provider>); expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', 'https://cdn.example.com/p.png');
  });
  it('a part that fits any car shows its photo and says so', () => {
    const { container } = inLang('en', <OrderVehicle vehicle={vehicle([])} />); expect(container.querySelector('.lucide-arrow-right')).not.toBeInTheDocument(); expect(screen.getByText('Fits any car: no car to match')).toBeInTheDocument(); expect(screen.getAllByRole('img')).toHaveLength(1); expect(screen.queryByText('Fits this car')).not.toBeInTheDocument();
  });
  it('PRIVACY: nothing of the buyer is shown: only what the part is listed for', () => { const { container } = inLang('en', <OrderVehicle vehicle={vehicle([narrowed()])} />); expect(container.textContent.toLowerCase()).not.toMatch(/buyer|ordered for|your car|garage/); });
});

describe('the helpers', () => {
  it('write the title and the details the same way everywhere', () => {
    expect(carTitle(car(), 'en')).toBe('BYD Seal · 2023'); expect(carTitle(car(), 'zh')).toBe('比亚迪 海豹 · 2023'); expect(carDetail(car({ transmission: null }))).toBe('2.0T'); expect(carDetail(car({ engine: null, transmission: null }))).toBe(''); expect(carHeader('en')).toBe('Part → Car'); expect(carHeader('zh')).toBe('零件 → 车辆');
  });
  it('versionInfo: some / all / none', () => {
    expect(versionInfo(narrowed(), 'en')).toMatchObject({ kind: 'some', names: ['Performance AWD', 'Excellence AWD'], label: '2 of 3 versions' }); expect(versionInfo(car(), 'en')).toMatchObject({ kind: 'all', label: 'All versions' }); expect(versionInfo(car({ generation: { ...GEN, versionCount: 0 } }), 'en')).toEqual({ kind: 'none' }); expect(versionInfo(car({ generation: undefined }), 'en')).toEqual({ kind: 'none' });
    expect(versionInfo(narrowed({ generation: { ...GEN, versionCount: 2 } }), 'en').label).toBe('Only some versions'); expect(versionInfo(narrowed({ generation: undefined }), 'en').label).toBe('Only some versions'); expect(versionInfo(car({ versions: [] }), 'en').kind).toBe('all');
  });
  it('generationYears: a range, "present", or nothing', () => { expect(generationYears(car(), 'en')).toBe('2022 – present'); expect(generationYears(car({ generation: { ...GEN, yearEnd: 2024 } }), 'en')).toBe('2022 – 2024'); expect(generationYears(car({ generation: { ...GEN, yearEnd: 2022 } }), 'en')).toBeNull(); expect(generationYears(car({ generation: undefined }), 'en')).toBeNull(); });
});

describe('the photos are SQUARE', () => {
  const squares = (container) => [...container.querySelectorAll('img')].map((img) => { const box = img.parentElement.style; return [box.width, box.height]; });
  it('in the order detail the part photo and the car photo are the same width and height', () => { const { container } = inLang('en', <OrderVehicle vehicle={vehicle([car()])} />); const boxes = squares(container); expect(boxes).toHaveLength(2); for (const [w, h] of boxes) expect(w).toBe(h); });
  it('and so are the small ones in the orders list', () => { const { container } = inLang('en', <OrderVehicleCell items={[{ vehicle: vehicle([car()]) }]} />); const boxes = squares(container); expect(boxes).toHaveLength(2); for (const [w, h] of boxes) expect(w).toBe(h); });
});

describe('OrderVehicleCell (in the orders list)', () => {
  const cell = (items, lang = 'en') => inLang(lang, <OrderVehicleCell items={items} />);
  it('CRITICAL: each item\'s car in full: the title, "2 of 3 versions" with the version names, engine and transmission', () => {
    cell([{ name: 'Front Brake Disc', vehicle: vehicle([narrowed()]) }]); const row = screen.getByTestId('ordercell-item'); expect(row).toHaveTextContent('BYD Seal · 2023'); expect(within(row).getByTestId('version-tag-some')).toHaveTextContent('2 of 3 versions'); expect(row).toHaveTextContent('Performance AWD, Excellence AWD'); expect(row).toHaveTextContent('2.0T · Automatic'); expect(row.querySelector('.lucide-arrow-right')).toBeInTheDocument(); expect(within(row).getAllByRole('img')).toHaveLength(2);
  });
  it('a part for every version: the green "All versions" tag; a generation with no versions: no tag', () => {
    const { unmount } = cell([{ vehicle: vehicle([car()]) }]); expect(screen.getByTestId('version-tag-all')).toBeInTheDocument(); unmount(); cell([{ vehicle: vehicle([car({ generation: { ...GEN, versionCount: 0 } })]) }]); expect(screen.queryByTestId('version-tag-all')).not.toBeInTheDocument(); expect(screen.queryByTestId('version-tag-some')).not.toBeInTheDocument(); expect(screen.queryByTestId('version-tag-none')).not.toBeInTheDocument();
  });
  it('CRITICAL: up to TWO items are shown, in order, and the rest are counted: "+N more items"', () => {
    cell([{ name: 'A', vehicle: vehicle([car()]) }, { name: 'B', vehicle: vehicle([car({ year: 2022 })]) }, { name: 'C', vehicle: vehicle([car({ year: 2021 })]) }, { name: 'D', vehicle: vehicle([car({ year: 2020 })]) }]);
    const rows = screen.getAllByTestId('ordercell-item'); expect(rows).toHaveLength(2); expect(rows[0]).toHaveTextContent('BYD Seal · 2023'); expect(rows[1]).toHaveTextContent('BYD Seal · 2022'); expect(screen.getByText('+2 more items')).toBeInTheDocument();
  });
  it('exactly two items: no "more" line; one item: one row', () => { const { unmount } = cell([{ vehicle: vehicle([car()]) }, { vehicle: vehicle([car({ year: 2022 })]) }]); expect(screen.getAllByTestId('ordercell-item')).toHaveLength(2); expect(screen.queryByText(/more items/)).not.toBeInTheDocument(); unmount(); cell([{ vehicle: vehicle([car()]) }]); expect(screen.getAllByTestId('ordercell-item')).toHaveLength(1); });
  it('a car the part is also listed for is counted on its row: "(+2 more cars)", including the ones not sent', () => { cell([{ vehicle: vehicle([car(), car({ year: 2022 })], { carCount: 3 }) }]); expect(screen.getByText('(+2 more cars)')).toBeInTheDocument(); });
  it('a part that fits any car: its photo and "<name>: fits any car" (or "Fits any car" with no name); no arrow', () => {
    const { container, unmount } = cell([{ name: 'Universal Wiper Blade', vehicle: vehicle([]) }]); expect(screen.getByText('Universal Wiper Blade: fits any car')).toBeInTheDocument(); expect(screen.getAllByRole('img')).toHaveLength(1); expect(container.querySelector('.lucide-arrow-right')).not.toBeInTheDocument(); unmount(); cell([{ vehicle: vehicle([]) }]); expect(screen.getByText('Fits any car')).toBeInTheDocument();
  });
  it('an item with a car and an item that fits any car are both shown', () => { cell([{ name: 'Disc', vehicle: vehicle([car()]) }, { name: 'Wiper', vehicle: vehicle([]) }]); expect(screen.getAllByTestId('ordercell-item')).toHaveLength(2); expect(screen.getByText('Wiper: fits any car')).toBeInTheDocument(); });
  it('items with no vehicle information are skipped; nothing at all: a dash', () => { cell([{ vehicle: null }, { name: 'X', vehicle: vehicle([car()]) }]); expect(screen.getAllByTestId('ordercell-item')).toHaveLength(1); expect(screen.queryByText('—')).not.toBeInTheDocument(); });
  it('nothing at all: a dash', () => { cell([{ vehicle: null }]); expect(screen.getByText('—')).toBeInTheDocument(); });
  it('Chinese wording: the names, the version tag and "+N more items"', () => {
    cell([{ vehicle: vehicle([narrowed()]) }, { vehicle: vehicle([car()]) }, { vehicle: vehicle([car()]) }], 'zh'); const rows = screen.getAllByTestId('ordercell-item'); expect(rows[0]).toHaveTextContent('比亚迪 海豹 · 2023'); expect(rows[0]).toHaveTextContent('3个版本中的2个'); expect(rows[0]).toHaveTextContent('性能四驱, 旗舰四驱'); expect(rows[1]).toHaveTextContent('所有版本'); expect(screen.getByText('另有1件商品')).toBeInTheDocument();
  });
});

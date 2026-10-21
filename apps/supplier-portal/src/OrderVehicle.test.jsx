import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderVehicle, { OrderVehicleCell, carHeader, carTitle, carDetail } from './OrderVehicle';
import { LangContext } from './langContext';

// The part photo, the arrow and the car, under an item (OrderVehicle) and in the orders list (OrderVehicleCell), in English and in Chinese.
const name = (en, zh) => ({ en, ar: null, zh });
const car = (over = {}) => ({ year: 2022, brand: name('BAIC', '北汽'), model: name('BJ60', 'BJ60'), engine: '2.0T', transmission: 'Automatic', photoUrl: '/uploads/car.png', ...over });
const vehicle = (cars, over = {}) => ({ partPhotoUrl: '/uploads/part.png', fitsAnyCar: cars.length === 0, carCount: cars.length, cars, ...over });
const inLang = (lang, ui) => render(<LangContext.Provider value={{ lang, t: null, toggle: () => {} }}>{ui}</LangContext.Provider>);

describe('OrderVehicle (under an item)', () => {
  it('shows nothing when there is no vehicle information', () => {
    const { container } = inLang('en', <OrderVehicle vehicle={null} />); expect(container).toBeEmptyDOMElement();
  });
  it('English: the part photo, then the car photo and its name, engine and transmission', () => {
    const { container } = inLang('en', <OrderVehicle vehicle={vehicle([car()])} />);
    expect(container.querySelector('.lucide-arrow-right')).toBeInTheDocument();     // the arrow from the part to the car
    expect(screen.getByText('The part')).toBeInTheDocument(); expect(screen.getByText('Fits this car')).toBeInTheDocument();
    expect(screen.getByText('BAIC BJ60 · 2022')).toBeInTheDocument(); expect(screen.getByText('2.0T · Automatic')).toBeInTheDocument();
    const [part, carPhoto] = screen.getAllByRole('img'); expect(part).toHaveAttribute('src', 'http://localhost:4000/uploads/part.png'); expect(carPhoto).toHaveAttribute('src', 'http://localhost:4000/uploads/car.png');
    expect(screen.queryByText(/Also listed/)).not.toBeInTheDocument();
  });
  it('Chinese: the wording and the Chinese names follow the language; a missing Chinese name falls back to English', () => {
    inLang('zh', <OrderVehicle vehicle={vehicle([car({ brand: { en: 'Toyota', ar: null, zh: null } })])} />);
    expect(screen.getByText('零件')).toBeInTheDocument(); expect(screen.getByText('适配此车型')).toBeInTheDocument(); expect(screen.getByText('Toyota BJ60 · 2022')).toBeInTheDocument();
  });
  it('several cars: the first is shown, the others are named, and the ones not sent are counted', () => {
    inLang('en', <OrderVehicle vehicle={vehicle([car(), car({ year: 2018, brand: name('Toyota', '丰田'), model: name('Corolla', '卡罗拉') }), car({ year: 2019, brand: name('Honda', '本田'), model: name('Civic', '思域') })], { carCount: 7 })} />);
    expect(screen.getByText('BAIC BJ60 · 2022')).toBeInTheDocument(); expect(screen.getByText('Also listed for: Toyota Corolla · 2018, Honda Civic · 2019 +4 more')).toBeInTheDocument();
  });
  it('a car or a part without a photo shows an icon, not a broken image; no engine means no engine line; a full web address is used as it is', () => {
    const { rerender } = inLang('en', <OrderVehicle vehicle={vehicle([car({ photoUrl: null, engine: null, transmission: null })], { partPhotoUrl: null })} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument(); expect(screen.queryByText(/Automatic|2\.0T/)).not.toBeInTheDocument();
    rerender(<LangContext.Provider value={{ lang: 'en', t: null, toggle: () => {} }}><OrderVehicle vehicle={vehicle([car()], { partPhotoUrl: 'https://cdn.example.com/p.png' })} /></LangContext.Provider>);
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', 'https://cdn.example.com/p.png');
  });
  it('a part that fits any car shows its photo and says so', () => {
    const { container } = inLang('en', <OrderVehicle vehicle={vehicle([])} />);
    expect(container.querySelector('.lucide-arrow-right')).not.toBeInTheDocument();      // no car, so no arrow
    expect(screen.getByText('Fits any car: no car to match')).toBeInTheDocument(); expect(screen.getAllByRole('img')).toHaveLength(1); expect(screen.queryByText('Fits this car')).not.toBeInTheDocument();
  });
  it('the helpers write the title and the details the same way everywhere', () => {
    expect(carTitle(car(), 'en')).toBe('BAIC BJ60 · 2022'); expect(carTitle(car(), 'zh')).toBe('北汽 BJ60 · 2022'); expect(carDetail(car({ transmission: null }))).toBe('2.0T'); expect(carDetail(car({ engine: null, transmission: null }))).toBe('');
    expect(carHeader('en')).toBe('Part → Car'); expect(carHeader('zh')).toBe('零件 → 车辆');
  });
});

describe('OrderVehicleCell (in the orders list)', () => {
  const cell = (items, lang = 'en') => inLang(lang, <OrderVehicleCell items={items} />);
  it('the first item with a car: part photo, arrow, car photo and the car', () => {
    const { container } = cell([{ vehicle: vehicle([]) }, { vehicle: vehicle([car()]) }]);
    expect(screen.getByText('BAIC BJ60 · 2022')).toBeInTheDocument(); expect(screen.getAllByRole('img')).toHaveLength(2); expect(container.querySelector('.lucide-arrow-right')).toBeInTheDocument();
  });
  it('the same car on several items is not repeated; different cars are counted as "+N more", including the ones not sent', () => {
    cell([{ vehicle: vehicle([car()]) }, { vehicle: vehicle([car()]) }]); expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    cell([{ vehicle: vehicle([car(), car({ year: 2018 })], { carCount: 5 }) }, { vehicle: vehicle([car({ year: 2019 })]) }]);
    expect(screen.getByText(/\+5 more/)).toBeInTheDocument();
  });
  it('parts that fit any car: the part photo and "Fits any car"; nothing at all: a dash', () => {
    const { container } = cell([{ vehicle: vehicle([]) }]); expect(screen.getByText('Fits any car')).toBeInTheDocument(); expect(screen.getAllByRole('img')).toHaveLength(1); expect(container.querySelector('.lucide-arrow-right')).not.toBeInTheDocument();
    cell([{ vehicle: null }]); expect(screen.getByText('—')).toBeInTheDocument();
  });
  it('Chinese wording', () => {
    cell([{ vehicle: vehicle([car(), car({ year: 2018 })]) }], 'zh'); expect(screen.getByText(/北汽 BJ60 · 2022/)).toBeInTheDocument(); expect(screen.getByText(/另有1款/)).toBeInTheDocument();
  });
});

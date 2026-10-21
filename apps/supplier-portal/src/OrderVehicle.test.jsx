import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderVehicle, { OrderVehicleCell, carHeader, carTitle, carDetail } from './OrderVehicle';
import { LangContext } from './langContext';

// The car under an item (OrderVehicle) and in the orders list (OrderVehicleCell), in English and in Chinese, for every status the server can send.
const name = (en, zh) => ({ en, ar: null, zh });
const car = (over = {}) => ({ year: 2022, seats: 5, photoUrl: '/uploads/ver.png', brand: name('BAIC', '北汽'), model: name('BJ60', 'BJ60'), version: name('May Day', '五一'), engine: name('2.0T (190 kW)', '2.0T (190 kW)'), ...over });
const inLang = (lang, ui) => render(<LangContext.Provider value={{ lang, t: null, toggle: () => {} }}>{ui}</LangContext.Provider>);

describe('OrderVehicle (under an item)', () => {
  it('shows nothing for an order placed before this existed', () => {
    const { container } = inLang('en', <OrderVehicle vehicle={null} />); expect(container).toBeEmptyDOMElement();
    const again = inLang('zh', <OrderVehicle vehicle={undefined} />); expect(again.container).toBeEmptyDOMElement();
  });
  it('English: the car, its details, the photo and "listed"', () => {
    inLang('en', <OrderVehicle vehicle={{ status: 'listed', isDefaultCar: true, car: car() }} />);
    expect(screen.getByText("Buyer's car:", { exact: false })).toBeInTheDocument(); expect(screen.getByText('BAIC BJ60 · 2022')).toBeInTheDocument();
    expect(screen.getByText('May Day · 2.0T (190 kW) · 5 seats')).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('Listed as fitting this car');
    expect(screen.getByRole('img', { name: 'BAIC BJ60 · 2022' })).toHaveAttribute('src', 'http://localhost:4000/uploads/ver.png');
    expect(screen.queryByText(/another car/)).not.toBeInTheDocument();
  });
  it('Chinese: names, details and wording follow the language', () => {
    inLang('zh', <OrderVehicle vehicle={{ status: 'listed', isDefaultCar: true, car: car() }} />);
    expect(screen.getByText('北汽 BJ60 · 2022')).toBeInTheDocument(); expect(screen.getByText('五一 · 2.0T (190 kW) · 5座')).toBeInTheDocument(); expect(screen.getByRole('status')).toHaveTextContent('该商品适配此车型');
  });
  it('a car that is not the buyer\'s default says so; a missing Chinese name falls back to English', () => {
    inLang('zh', <OrderVehicle vehicle={{ status: 'listed', isDefaultCar: false, car: car({ brand: { en: 'Toyota', ar: null, zh: null } }) }} />);
    expect(screen.getByText(/买家车库中的另一辆车/)).toBeInTheDocument(); expect(screen.getByText('Toyota BJ60 · 2022')).toBeInTheDocument();
  });
  it('"not listed" is a clear warning in both languages', () => {
    inLang('en', <OrderVehicle vehicle={{ status: 'not_listed', isDefaultCar: true, car: car() }} />);
    expect(screen.getByRole('status')).toHaveTextContent("Not in this product's fitment list: please check before sending");
    inLang('zh', <OrderVehicle vehicle={{ status: 'not_listed', isDefaultCar: true, car: car() }} />);
    expect(screen.getAllByRole('status')[1]).toHaveTextContent('该商品的适配列表中没有此车型，发货前请核对');
  });
  it('a car without a photo shows an icon, not a broken image; a full web address is used as it is', () => {
    const { rerender } = inLang('en', <OrderVehicle vehicle={{ status: 'listed', isDefaultCar: true, car: car({ photoUrl: null }) }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<LangContext.Provider value={{ lang: 'en', t: null, toggle: () => {} }}><OrderVehicle vehicle={{ status: 'listed', isDefaultCar: true, car: car({ photoUrl: 'https://cdn.example.com/a.png' }) }} /></LangContext.Provider>);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/a.png');
  });
  it('a part that fits any car, and a buyer with no car, are told plainly', () => {
    inLang('en', <><OrderVehicle vehicle={{ status: 'universal', car: null }} /><OrderVehicle vehicle={{ status: 'no_car', car: null }} /></>);
    expect(screen.getByText('Fits any car: no car recorded')).toBeInTheDocument(); expect(screen.getByText('No car on file: the buyer has no car in My Garage')).toBeInTheDocument();
  });
  it('the small helpers write the title and details the same way everywhere', () => {
    expect(carTitle(car(), 'en')).toBe('BAIC BJ60 · 2022'); expect(carDetail(car({ version: null, seats: null }), 'en')).toBe('2.0T (190 kW)'); expect(carHeader('zh')).toBe('车辆'); expect(carHeader('en')).toBe('Car');
  });
});

describe('OrderVehicleCell (in the orders list)', () => {
  const cell = (items, lang = 'en') => inLang(lang, <OrderVehicleCell items={items} />);
  it('one car: title and photo; the same car on several items is not repeated', () => {
    const v = { status: 'listed', isDefaultCar: true, car: car() }; cell([{ vehicle: v }, { vehicle: v }]);
    expect(screen.getByText('BAIC BJ60 · 2022')).toBeInTheDocument(); expect(screen.queryByText(/more/)).not.toBeInTheDocument(); expect(screen.getAllByRole('img')).toHaveLength(1);
  });
  it('several different cars: the first and "+N more"', () => {
    cell([{ vehicle: { status: 'listed', car: car() } }, { vehicle: { status: 'listed', car: car({ year: 2018 }) } }, { vehicle: { status: 'listed', car: car({ year: 2019 }) } }]);
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
  });
  it('a warning mark appears when any car is not on its product\'s fitment list', () => {
    cell([{ vehicle: { status: 'listed', car: car() } }, { vehicle: { status: 'not_listed', car: car({ year: 2018 }) } }]);
    expect(screen.getByText(/⚠ check/)).toBeInTheDocument();
  });
  it('no cars: "Fits any car", "No car on file", or a dash for old orders', () => {
    cell([{ vehicle: { status: 'universal', car: null } }]); expect(screen.getByText('Fits any car')).toBeInTheDocument();
    cell([{ vehicle: { status: 'no_car', car: null } }]); expect(screen.getByText('No car on file')).toBeInTheDocument();
    cell([{ vehicle: null }]); expect(screen.getByText('—')).toBeInTheDocument();
  });
});

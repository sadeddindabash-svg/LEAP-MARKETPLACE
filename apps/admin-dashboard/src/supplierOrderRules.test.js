// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { describeControls, refuseChange } = require('../../../services/api/src/modules/supplier/orderRules.js');

describe('what a supplier may do to an order (pure rules)', () => {
  it('CRITICAL: pending can go to preparing or shipped; preparing only to shipped; shipped to nothing: forward only', () => {
    expect(describeControls({ status: 'pending', hubShipmentStatus: null })).toMatchObject({ locked: false, allowedStatuses: ['preparing', 'shipped'], canEditTracking: true });
    expect(describeControls({ status: 'preparing', hubShipmentStatus: null })).toMatchObject({ locked: false, allowedStatuses: ['shipped'] });
    expect(describeControls({ status: 'shipped', hubShipmentStatus: 'awaiting_receipt' })).toMatchObject({ locked: false, allowedStatuses: [], canEditTracking: true }); // still fixable
  });

  it('CRITICAL: going backwards is refused with its own code, going forward or staying put is allowed', () => {
    const at = (status) => ({ status, hubShipmentStatus: status === 'shipped' ? 'awaiting_receipt' : null });
    expect(refuseChange(at('preparing'), { status: 'pending' })).toMatchObject({ code: 'status_cannot_go_back' });
    expect(refuseChange(at('shipped'), { status: 'preparing' })).toMatchObject({ code: 'status_cannot_go_back' });
    expect(refuseChange(at('shipped'), { status: 'pending' })).toMatchObject({ code: 'status_cannot_go_back' });
    expect(refuseChange(at('pending'), { status: 'preparing' })).toBeNull();
    expect(refuseChange(at('pending'), { status: 'shipped' })).toBeNull();                 // skipping "preparing" is still forward
    expect(refuseChange(at('preparing'), { status: 'preparing' })).toBeNull();             // the same status again changes nothing
    expect(refuseChange(at('shipped'), { status: 'shipped', trackingNumber: 'FIXED-1' })).toBeNull(); // correcting the tracking number
    expect(refuseChange(at('shipped'), { trackingNumber: 'FIXED-2' })).toBeNull();
  });

  it('CRITICAL: once the hub has received the parcel NOTHING can be changed: not the status, not the tracking number', () => {
    for (const hub of ['received', 'opened', 'inspected', 'packed', 'shipped_to_buyer', 'delivered', 'flagged', 'returned_to_supplier', 'discarded_at_hub']) {
      const state = { status: 'shipped', hubShipmentStatus: hub };
      expect(describeControls(state), hub).toMatchObject({ locked: true, lockReason: 'at_hub', allowedStatuses: [], canEditTracking: false });
      expect(refuseChange(state, { status: 'preparing' }), hub).toMatchObject({ code: 'order_locked_at_hub' });
      expect(refuseChange(state, { trackingNumber: 'X' }), hub).toMatchObject({ code: 'order_locked_at_hub' });
      expect(refuseChange(state, { status: 'shipped' }), hub).toMatchObject({ code: 'order_locked_at_hub' });
    }
  });

  it('a part the buyer cancelled is locked for good, and an old "dispute" row may still move forward from the start', () => {
    expect(describeControls({ status: 'cancelled', hubShipmentStatus: null })).toMatchObject({ locked: true, lockReason: 'cancelled', allowedStatuses: [] });
    expect(refuseChange({ status: 'cancelled', hubShipmentStatus: null }, { status: 'preparing' })).toMatchObject({ code: 'order_cancelled' });
    expect(describeControls({ status: 'dispute', hubShipmentStatus: null }).allowedStatuses).toEqual(['pending', 'preparing', 'shipped']);
  });
});

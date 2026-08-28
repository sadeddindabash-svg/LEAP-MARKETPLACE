// Real, shared product validation constants -- confirmed necessary to
// avoid two separate copies drifting apart: both the real supplier
// submission endpoint (supplier/routes.js) and the real admin product-
// edit endpoint (catalog/routes.js) need the exact same real rules.

const ALLOWED_POSITIONS = ['Front', 'Rear', 'Left', 'Right', 'Front-Left', 'Front-Right', 'Rear-Left', 'Rear-Right', 'Universal'];
const MIN_PRODUCT_PHOTOS = 3;

// Real, confirmed with the person: enforced everywhere a real product
// name can be entered -- the real supplier's own initial submission,
// the real admin's own approval step, and the real admin's own later
// edit. A single, shared function so all three real call sites can't
// drift apart on what "valid" actually means.
const MIN_NAME_LENGTH = 25;
const MAX_NAME_LENGTH = 100;
function validateNameLength(name, fieldLabel) {
  const trimmed = (name || '').trim();
  if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH) {
    return `${fieldLabel} must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters (got ${trimmed.length})`;
  }
  return null;
}

module.exports = { ALLOWED_POSITIONS, MIN_PRODUCT_PHOTOS, MIN_NAME_LENGTH, MAX_NAME_LENGTH, validateNameLength };

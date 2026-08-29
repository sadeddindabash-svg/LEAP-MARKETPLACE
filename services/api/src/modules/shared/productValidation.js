// Real, shared product validation constants -- confirmed necessary to
// avoid two separate copies drifting apart: both the real supplier
// submission endpoint (supplier/routes.js) and the real admin product-
// edit endpoint (catalog/routes.js) need the exact same real rules.

const ALLOWED_POSITIONS = ['Front', 'Rear', 'Left', 'Right', 'Front-Left', 'Front-Right', 'Rear-Left', 'Rear-Right', 'Universal'];
const MIN_PRODUCT_PHOTOS = 3;

// Real, generic core -- both name and description length checks share
// this exact real logic, rather than two separate, real copies that
// could drift apart.
function validateTextLength(text, fieldLabel, min, max) {
  const trimmed = (text || '').trim();
  if (trimmed.length < min || trimmed.length > max) {
    return `${fieldLabel} must be between ${min} and ${max} characters (got ${trimmed.length})`;
  }
  return null;
}

// Real, confirmed with the person: the real supplier's own initial
// submission now only needs a real minimum of 10 characters (down
// from 25) -- the real admin's own approval step and later edit stay
// completely unchanged at the real original 25-100 range. Two
// separate real rules now, not one shared one, since suppliers and
// admins genuinely need different real minimums.
const MIN_SUPPLIER_NAME_LENGTH = 10;
const MAX_SUPPLIER_NAME_LENGTH = 100;
function validateSupplierNameLength(name, fieldLabel) {
  return validateTextLength(name, fieldLabel, MIN_SUPPLIER_NAME_LENGTH, MAX_SUPPLIER_NAME_LENGTH);
}

const MIN_NAME_LENGTH = 25;
const MAX_NAME_LENGTH = 100;
function validateNameLength(name, fieldLabel) {
  return validateTextLength(name, fieldLabel, MIN_NAME_LENGTH, MAX_NAME_LENGTH);
}

// Real, confirmed with the person: description is now mandatory
// (previously optional) everywhere a real product name can be
// entered too, at the same real 3 real call sites -- the real
// supplier's own initial single-item submission, the real admin's own
// approval step, and the real admin's own later edit. Deliberately
// NOT enforced in bulk-import specifically -- confirmed by reading it
// directly that this real flow never collects a real description at
// all (not even optionally), so bulk-imported products still need a
// real admin to write one in at the real moderation step, same as
// they always have.
const MIN_DESCRIPTION_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 150;
function validateDescriptionLength(description, fieldLabel) {
  return validateTextLength(description, fieldLabel, MIN_DESCRIPTION_LENGTH, MAX_DESCRIPTION_LENGTH);
}

module.exports = {
  ALLOWED_POSITIONS, MIN_PRODUCT_PHOTOS,
  MIN_SUPPLIER_NAME_LENGTH, MAX_SUPPLIER_NAME_LENGTH, validateSupplierNameLength,
  MIN_NAME_LENGTH, MAX_NAME_LENGTH, validateNameLength,
  MIN_DESCRIPTION_LENGTH, MAX_DESCRIPTION_LENGTH, validateDescriptionLength,
};

// Real, shared product validation constants -- confirmed necessary to
// avoid two separate copies drifting apart: both the real supplier
// submission endpoint (supplier/routes.js) and the real admin product-
// edit endpoint (catalog/routes.js) need the exact same real rules.

const ALLOWED_POSITIONS = ['Front', 'Rear', 'Left', 'Right', 'Front-Left', 'Front-Right', 'Rear-Left', 'Rear-Right', 'Universal'];
const MIN_PRODUCT_PHOTOS = 3;

module.exports = { ALLOWED_POSITIONS, MIN_PRODUCT_PHOTOS };

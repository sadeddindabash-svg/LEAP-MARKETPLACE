// Email addresses are compared WITHOUT regard to capital letters (migration 100): they are stored lowercase, and anything a person types is
// lowercased (and trimmed) before it is looked up or saved.
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

function sameEmail(a, b) {
  return typeof a === 'string' && typeof b === 'string' && normalizeEmail(a) === normalizeEmail(b);
}

module.exports = { normalizeEmail, sameEmail };

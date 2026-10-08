/**
 * How the cleanup tool (remove-test-data.js) recognises leftovers of the automated tests. Kept in its own file so it can be tested on its own.
 *
 * The tests name everything they create with the current time in milliseconds (a 13-digit number such as 1791368182850), or with the words "Test" /
 * "E2E" / 测试, or (for names padded by the test helper) "compatible replacement part". Nothing a person types by hand has any of those.
 */
const LONG_NUMBER = /\d{10,}/;
const TEST_WORD = /\b(test|e2e)\b|test\d|测试/i;
const FIXTURE_PADDING = /compatible replacement part/i;

function looksLikeTest(...texts) {
  return texts.some((t) => typeof t === 'string' && (LONG_NUMBER.test(t) || TEST_WORD.test(t) || FIXTURE_PADDING.test(t)));
}

// The three seed products (p1, p2, p3) are never touched.
const isSeedProductId = (id) => /^p\d+$/.test(String(id));

const isTestCategory = ({ id, name_en: nameEn }) => /^test_cat_/i.test(String(id)) || /^Test Category/i.test(String(nameEn || ''));
const isTestPart = (nameEn) => looksLikeTest(nameEn);
const isTestVehicleBrand = (name) => looksLikeTest(name);
const isTestHub = ({ id, name }) => !/^hub_(guangzhou|ningbo|shenzhen|yiwu|shanghai)$/.test(String(id)) && looksLikeTest(name);
// The tests sign up with @example.com addresses (a reserved "example" domain nobody really owns).
const isTestAddress = (address) => typeof address === 'string' && /@example\.(com|org|net)$/i.test(address.trim());
// A test ADMIN account: the tests create them with an @example.com address, or "perm-test-<number>@leap.dev", or a timestamp in the address. The owner is
// never one, and neither is any admin whose address does not clearly look like a test account (so a real colleague with "test" in their name is safe).
const isTestAdmin = ({ email, is_owner: isOwner }) => !isOwner && (isTestAddress(email) || /^perm-test-/i.test(String(email || '')) || /\d{10,}/.test(String(email || '')));
const isTestProduct = ({ id, name, name_zh: nameZh, name_ar: nameAr }) => !isSeedProductId(id) && looksLikeTest(name, nameZh, nameAr);

module.exports = { looksLikeTest, isSeedProductId, isTestCategory, isTestPart, isTestVehicleBrand, isTestHub, isTestProduct, isTestAddress, isTestAdmin };

/**
 * Which database the automated tests may use, and the rule that protects the real one.
 *
 * The test suites create and change a lot of data, so they must NEVER run against the database the app uses. The test database is derived from the
 * development one (leap_marketplace_dev -> leap_marketplace_test) and is the ONLY database the test runner is allowed to wipe: anything whose name does
 * not end in "_test" is refused.
 */
function deriveTestDatabase(developmentUrl) {
  if (!developmentUrl) throw new Error('DATABASE_URL is not set (services/api/.env).');
  const url = new URL(developmentUrl);
  const developmentName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!developmentName) throw new Error('DATABASE_URL has no database name in it.');
  let testName;
  if (/_test$/i.test(developmentName)) testName = developmentName;                 // already a test database
  else if (/_dev$/i.test(developmentName)) testName = developmentName.replace(/_dev$/i, '_test');
  else testName = `${developmentName}_test`;
  url.pathname = `/${encodeURIComponent(testName)}`;
  return { url: url.toString(), name: testName, developmentName };
}

// The last line of defence before anything is dropped.
function assertSafeToWipe(name) {
  if (!/_test$/i.test(String(name))) throw new Error(`Refusing to wipe "${name}": only a database whose name ends in "_test" may be wiped.`);
}

module.exports = { deriveTestDatabase, assertSafeToWipe };

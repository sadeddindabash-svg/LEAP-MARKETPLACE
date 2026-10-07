-- Migration 100: email addresses are matched WITHOUT regard to capital letters.
--
-- Until now "Name@gmail.com" and "name@gmail.com" were two different accounts for login and password reset, so a phone keyboard that capitalises the first
-- letter could lock someone out without any message. From now on every address is stored in lowercase and looked up case-insensitively.
--
-- If two existing accounts differ ONLY by capital letters this stops with a clear message instead of guessing which one to keep: merge or rename one of
-- them, then run it again.
DO $$
DECLARE clash TEXT;
BEGIN
  SELECT string_agg(address, ', ') INTO clash
  FROM (SELECT lower(email) AS address FROM users GROUP BY lower(email) HAVING count(*) > 1) c;
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'Two accounts have the same email apart from capital letters (%). Merge or rename one of them, then run the migration again.', clash;
  END IF;
END $$;

UPDATE users SET email = lower(email) WHERE email <> lower(email);
UPDATE orders SET guest_email = lower(guest_email) WHERE guest_email IS NOT NULL AND guest_email <> lower(guest_email);

-- Makes "same address, different capitals" impossible for good, and makes lower(email) lookups fast.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

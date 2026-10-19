-- The moving announcement line at the top of the website's home page is now edited by an admin (Settings > Home page announcements) instead of being fixed text in the website.
-- It lives in the existing generic settings store as ONE value: a JSON list of up to 5 { "en": "...", "ar": "..." }.
-- The website's two current lines are put in here so the bar does not disappear the day this goes live. ON CONFLICT DO NOTHING: an admin's own list is never overwritten.
INSERT INTO platform_settings (key, value) VALUES (
  'storefront_announcements',
  '[{"en":"Opening Middle East warehouse in Saudi Arabia","ar":"افتتاح مستودع الشرق الأوسط في السعودية"},{"en":"International shipping in 3-7 days","ar":"شحن دولي خلال 3-7 أيام"}]'
) ON CONFLICT (key) DO NOTHING;

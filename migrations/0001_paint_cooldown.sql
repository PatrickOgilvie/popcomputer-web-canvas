-- A member paints one pixel every 10 seconds (COOLDOWN_SECONDS in
-- src/canvas.ts). The database refuses a paint too soon after their last one,
-- however many requests arrive at once. It compares the rows' own times with
-- the new row's, rather than the database's clock, so a test's clock moves it.
-- The raised text is the constraintName the paint action shows.
CREATE TRIGGER `paints_cooldown` BEFORE INSERT ON `paints`
WHEN EXISTS (
  SELECT 1 FROM `paints`
  WHERE `user_id` = NEW.`user_id` AND `created_at` > NEW.`created_at` - 10000
)
BEGIN
  SELECT RAISE(ABORT, 'paints_cooldown');
END;

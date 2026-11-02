-- Migration 121: a review can be edited ONCE.
--
-- A buyer writes one review per part (migration 025); writing again edits it. From now on that edit
-- can happen only once: edit_count counts the edits, POST /reviews refuses a second one
-- (409, code review_edit_used), and the storefront hides the Edit button once it is 1.
-- Reviews that existed before start at 0 (it was never recorded whether they had been edited).
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;

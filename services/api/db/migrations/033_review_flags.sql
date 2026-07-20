-- Migration 033: real reporting/flagging of inappropriate reviews.
--
-- CONFIRMED SCOPE: a real buyer can flag a review with a required
-- short reason. One real flag per buyer per review (a UNIQUE
-- constraint) -- prevents the same real account from repeatedly
-- flagging the same review to force it up an admin queue. Flagging
-- never auto-hides anything -- same real pattern as every other
-- moderation flow in this project (return cases, support tickets,
-- product listings): a real admin always makes the actual call. An
-- admin can either dismiss the real flag(s) (the review stays exactly
-- as it was) or hide the review outright, reusing the EXISTING real
-- PATCH /reviews/:id/moderate 'reject' action -- no new review status
-- needed, since a rejected review is already correctly hidden from
-- public view.
CREATE TABLE IF NOT EXISTS review_flags (
  id          SERIAL PRIMARY KEY,
  review_id   INTEGER NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  buyer_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_review_flags_review ON review_flags(review_id);

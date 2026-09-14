-- One pick per category per profile: within a given category (e.g.
-- "Best Coffee"), a person can only have one pick. Plain uniqueness
-- constraint, independent of RLS — no policy changes needed.

alter table picks
  add constraint picks_profile_category_unique unique (profile_id, category_id);

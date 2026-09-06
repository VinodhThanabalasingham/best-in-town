-- The Place Details route now checks the businesses cache before calling
-- Google, so it only ever INSERTs (never UPDATEs) — this policy from
-- migration 0004 is no longer needed and unnecessarily let any
-- authenticated user update any cached business row.
drop policy "Authenticated update businesses" on businesses;

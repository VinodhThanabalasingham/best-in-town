-- Auto-create a profiles row when a new auth.users row is inserted.
-- Reads `username` (and optionally `display_name`) out of the user's
-- metadata, which the app sets via the `data` option on signUp /
-- signInWithOtp. Runs regardless of which auth method was used, so
-- there's a single place profile creation happens.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

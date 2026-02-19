
-- Create the 'mirror_store' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('mirror_store', 'mirror_store', false)
on conflict (id) do nothing;

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Remove existing policies to avoid conflicts
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow pro/tester downloads" on storage.objects;
drop policy if exists "Allow users to view their own objects" on storage.objects;

-- Policy: Allow uploads only for 'pro' or 'tester' users
create policy "Allow uploads for pro/tester"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'mirror_store' and
  (auth.jwt() ->> 'user_plan')::text in ('pro', 'tester')
);

-- Policy: Allow downloads only for 'pro' or 'tester' users
create policy "Allow downloads for pro/tester"
on storage.objects for select
to authenticated
using (
  bucket_id = 'mirror_store' and
  (auth.jwt() ->> 'user_plan')::text in ('pro', 'tester')
);

-- Policy: Allow users to delete their own objects
create policy "Allow delete own objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'mirror_store' and
  auth.uid() = owner
);

-- Policy: Allow users to update their own objects
create policy "Allow update own objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'mirror_store' and
  auth.uid() = owner
);


-- Create the 'mirror_store' bucket
insert into storage.buckets (id, name, public)
values ('mirror_store', 'mirror_store', false)
on conflict (id) do nothing;

-- RLS should be enabled by default for new buckets, or globally for storage.objects
-- Note: 'storage.objects' is a system table. We generally define policies on it.

-- Drop existing policies to be safe
drop policy if exists "Allow uploads for pro/tester" on storage.objects;
drop policy if exists "Allow downloads for pro/tester" on storage.objects;
drop policy if exists "Allow delete own objects" on storage.objects;

-- Create Policy: Uploads
create policy "Allow uploads for pro/tester"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'mirror_store' and
  (auth.jwt() ->> 'user_plan')::text in ('pro', 'tester')
);

-- Create Policy: Downloads
create policy "Allow downloads for pro/tester"
on storage.objects for select
to authenticated
using (
  bucket_id = 'mirror_store' and
  (auth.jwt() ->> 'user_plan')::text in ('pro', 'tester')
);

-- Create Policy: Delete Own
create policy "Allow delete own objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'mirror_store' and
  auth.uid() = owner
);

-- Note: We are relying on the fact that RLS is ALREADY enabled on storage.objects in Supabase.
-- If it is not, we might fail to secure it, but standard Supabase setup has it enabled.
-- The previous error was due to `alter table` which requires ownership.

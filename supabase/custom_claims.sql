
-- Enable the pg_net extension to allow making HTTP requests if needed (we are using hooks though)
-- create extension if not exists "pg_net" with schema "extensions";

-- Create a function to be used as a hook for custom access tokens
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    claims jsonb;
    user_plan text;
  begin
    -- Check if the user plan is present in the app_metadata
    -- If using app_metadata, it is already part of the JWT at the root level 'app_metadata'
    -- However, specific claim injection might be desired
    
    claims := event->'claims';
    user_plan := claims->'app_metadata'->>'plan';

    -- Check if 'user_plan' claim is already present in the JWT claims
    if jsonb_typeof(claims->'user_plan') is null then
      -- If user_plan exists in app_metadata, propagate it as a top-level claim 'user_plan'
      if user_plan is not null then
        claims := jsonb_set(claims, '{user_plan}', to_jsonb(user_plan));
      else
        -- If not set, default to 'free'
        claims := jsonb_set(claims, '{user_plan}', '"free"');
      end if;
    end if;

    -- Update the 'claims' object in the original event
    event := jsonb_set(event, '{claims}', claims);

    -- Return the modified or original event
    return event;
  end;
$$;

-- Grant usage on the hook function to the supabase_auth_admin role
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- Revoke execute permission from public to secure the function
revoke execute on function public.custom_access_token_hook from public;
revoke execute on function public.custom_access_token_hook from anon;
revoke execute on function public.custom_access_token_hook from authenticated;
revoke execute on function public.custom_access_token_hook from service_role;

-- To enable this hook, you typically need to update the auth configuration.
-- However, enabling hooks is often done via the Supabase Dashboard -> Authentication -> Hooks.
-- Or via SQL if permitted (depends on Supabase version, usually not directly via SQL for config).
-- But creating the function is the first step.

-- Also, let's create a secure policy helper function?
-- No, RLS policies can check auth.jwt() -> 'user_plan' directly now.

-- Example RLS Policy for MirrorStore (assuming table name is 'mirror_store' or checks are on storage.objects)
-- If checking storage:
-- create policy "Allow download for pro users"
-- on storage.objects for select
-- to authenticated
-- using ( bucket_id = 'mirror_store' and (auth.jwt() ->> 'user_plan')::text = 'pro' );

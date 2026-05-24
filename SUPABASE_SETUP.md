# Free Laptop and iPhone Sync

This app can sync the same inventory data between your laptop and iPhone using a free Supabase project.

## 1. Create the free project

1. Create a Supabase project at https://supabase.com.
2. In Authentication, create your own email/password user.
3. To keep it private, disable public sign-ups after your account is created.

## 2. Create the sync table

Open the Supabase SQL editor and run:

```sql
create table if not exists public.egg_app_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_key text not null default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, app_key)
);

alter table public.egg_app_state enable row level security;

create policy "Users can read own egg app state"
on public.egg_app_state
for select
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert own egg app state"
on public.egg_app_state
for insert
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own egg app state"
on public.egg_app_state
for update
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
```

## 3. Add your project keys

In `sync-config.js`, paste your Supabase project URL and anon key:

```js
window.YOLK_SYNC_CONFIG = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  tableName: 'egg_app_state'
};
```

## 4. Use it

Open the app, go to Cloud Sync, sign in with your Supabase email/password, then press Push on the device with the latest data. On the other device, sign in and press Pull.

For iPhone installation, the app needs to be opened from an HTTPS address, such as GitHub Pages, Cloudflare Pages, or Vercel free hosting. Then use Safari Share > Add to Home Screen.

# Supabase Setup

## 1. Create Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project (name: `coach-ai`)
3. Copy **Project URL** and **anon public key**

## 2. Configure App

```bash
cp .env.example .env.local
```

Add your credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 3. Run Migrations

Install Supabase CLI: https://supabase.com/docs/guides/cli

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

Or paste `migrations/20260723100000_initial_schema.sql` into the Supabase SQL Editor.

## 4. Enable Auth Providers

In Supabase Dashboard → Authentication → Providers:

- **Email** — enabled by default
- **Apple** — configure for iOS (Milestone 1)
- **Google** — configure for Android (Milestone 1)

## 5. Storage

The migration creates a private `clips` bucket (200 MB limit).

## 6. Edge Function Secrets (Milestone 3)

```bash
supabase secrets set GEMINI_API_KEY=your-key
```

## Monetisation

- Free tier: **3 analyses/month** (enforced in edge function)
- Beta bonus credits: update `profiles.analyses_bonus_credits` manually in SQL:

```sql
UPDATE profiles SET analyses_bonus_credits = 5 WHERE id = 'user-uuid';
```

Check remaining:

```sql
SELECT get_remaining_analyses('user-uuid');
```

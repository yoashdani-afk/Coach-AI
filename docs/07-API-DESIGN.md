# Coach AI — API Design (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23

---

## 1. Architecture Note

The MVP has **no custom REST API server**. The mobile app talks directly to Supabase (auth, database, storage) with Row Level Security. Two Supabase Edge Functions handle AI workloads.

```
Mobile App
    ├── Supabase Auth          (sign up, login)
    ├── Supabase Client        (CRUD via PostgREST + RLS)
    ├── Supabase Storage       (clip upload/download)
    ├── Edge Function: generate-report
    └── Edge Function: chat
```

This document describes the **logical API surface** — implemented via Supabase client calls and edge functions.

---

## 2. Conventions

| Convention | Value |
|------------|-------|
| Auth | Supabase JWT (`Authorization: Bearer <token>`) |
| IDs | UUID v4 |
| Timestamps | ISO 8601 UTC |
| Errors | Supabase error codes + edge function JSON errors |

---

## 3. Authentication

Handled entirely by **Supabase Auth SDK** on mobile. No custom auth endpoints.

```typescript
// Sign up
await supabase.auth.signUp({ email, password });

// Apple Sign In
await supabase.auth.signInWithOAuth({ provider: 'apple' });

// Google Sign In
await supabase.auth.signInWithOAuth({ provider: 'google' });

// Session
const { data: { session } } = await supabase.auth.getSession();
```

---

## 4. Profile

### Read profile
```typescript
const { data } = await supabase
  .from('profiles')
  .select('*')
  .single();
```

### Create / update profile
```typescript
await supabase.from('profiles').upsert({
  id: user.id,
  display_name: 'Alex',
  position: 'CM',
  age: 17,
  skill_level: 'ADVANCED',
  preferred_foot: 'RIGHT',
  playing_style: ['PLAYMAKER'],
  improvement_goals: 'Improve scanning and first touch under pressure',
});
```

### Upload avatar
```typescript
await supabase.storage.from('avatars').upload(`${userId}.jpg`, file);
// Update profile.avatar_url with public URL
```

---

## 5. Clips

### Upload clip

**Step 1:** Insert clip record
```typescript
const { data: clip } = await supabase.from('clips').insert({
  user_id: userId,
  title: 'Training session passing',
  storage_path: `${userId}/${clipId}.mp4`,
  duration_seconds: 45,
  file_size_bytes: 15000000,
  focus_areas: ['PASSING', 'DECISION_MAKING'],
  status: 'UPLOADING',
  profile_snapshot: { position, age, skill_level, ... },
}).select().single();
```

**Step 2:** Upload video to storage
```typescript
await supabase.storage
  .from('clips')
  .upload(`${userId}/${clipId}.mp4`, videoFile, {
    contentType: 'video/mp4',
    upsert: false,
  });
```

**Step 3:** Mark uploaded + trigger analysis
```typescript
await supabase.from('clips')
  .update({ status: 'UPLOADED' })
  .eq('id', clipId);

// Trigger edge function
await supabase.functions.invoke('generate-report', {
  body: { clip_id: clipId },
});
```

### List clips (with reports)
```typescript
const { data } = await supabase
  .from('clips')
  .select(`
    id, title, focus_areas, status, duration_seconds, created_at,
    reports (id, overall_rating, strengths, areas_to_improve)
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(20);
```

### Get single clip
```typescript
const { data } = await supabase
  .from('clips')
  .select('*, reports(*)')
  .eq('id', clipId)
  .single();
```

### Delete clip
```typescript
await supabase.storage.from('clips').remove([storagePath]);
await supabase.from('clips').delete().eq('id', clipId);
// Report cascades via FK
```

---

## 6. Reports

### Get report
```typescript
const { data } = await supabase
  .from('reports')
  .select('*')
  .eq('clip_id', clipId)
  .single();
```

**Response shape:**
```json
{
  "id": "uuid",
  "clip_id": "uuid",
  "overall_rating": 7.8,
  "strengths": ["Good body position...", "..."],
  "areas_to_improve": ["Scan before receiving...", "..."],
  "coach_explanation": "In this clip, you receive...",
  "drills": [
    {
      "title": "Scan and Play",
      "description": "...",
      "reps": "3 sets of 8",
      "duration_minutes": 15,
      "focus": "FIRST_TOUCH"
    }
  ],
  "focus_areas": ["PASSING", "DECISION_MAKING"],
  "helpful": null,
  "created_at": "2026-07-23T12:00:00Z"
}
```

### Rate report (thumbs up/down)
```typescript
await supabase.from('reports')
  .update({ helpful: true })
  .eq('id', reportId);
```

---

## 7. Progress / Dashboard

### Rating trend
```typescript
const { data } = await supabase
  .from('reports')
  .select('overall_rating, created_at, focus_areas, clips(title)')
  .eq('user_id', userId)
  .order('created_at', { ascending: true });
```

### Summary stats (computed client-side or via RPC)
```typescript
// Supabase RPC function: get_dashboard_summary(user_id)
const { data } = await supabase.rpc('get_dashboard_summary', {
  p_user_id: userId,
});
```

**RPC returns:**
```json
{
  "total_clips": 5,
  "average_rating": 7.4,
  "best_rating": 8.1,
  "latest_rating": 7.8,
  "improvement_delta": 0.3
}
```

---

## 8. Edge Function: `generate-report`

**Endpoint:** `POST /functions/v1/generate-report`  
**Auth:** JWT required  
**Trigger:** Called by mobile after upload, or database webhook

### Request
```json
{
  "clip_id": "uuid"
}
```

### Processing
1. Verify JWT + clip ownership
2. Set clip status → `ANALYSING`
3. Generate signed video URL
4. Call Gemini 2.0 Flash with video + prompt
5. Validate JSON response (Zod)
6. Insert report
7. Set clip status → `COMPLETE`
8. Send push notification

### Response (success)
```json
{
  "report_id": "uuid",
  "overall_rating": 7.8,
  "generation_time_ms": 45000
}
```

### Response (error)
```json
{
  "error": "VIDEO_QUALITY_TOO_LOW",
  "message": "We couldn't analyse this clip clearly. Try brighter footage."
}
```

### Error codes

| Code | HTTP | Description |
|------|------|-------------|
| `CLIP_NOT_FOUND` | 404 | Invalid clip_id |
| `UNAUTHORIZED` | 403 | User doesn't own clip |
| `ALREADY_ANALYSED` | 409 | Report already exists |
| `VIDEO_QUALITY_TOO_LOW` | 422 | AI can't analyse clip |
| `ANALYSIS_FAILED` | 500 | LLM error after retries |
| `RATE_LIMITED` | 429 | Max 10 analyses/day |

---

## 9. Edge Function: `chat` (Milestone 5)

**Endpoint:** `POST /functions/v1/chat`  
**Auth:** JWT required

### Request
```json
{
  "thread_id": "uuid",
  "message": "How can I improve my scanning?",
  "report_id": "uuid"
}
```

### Response
```json
{
  "message_id": "uuid",
  "content": "Based on your last two reports, scanning before receiving...",
  "role": "assistant"
}
```

### Create thread
```typescript
const { data } = await supabase.from('chat_threads').insert({
  user_id: userId,
  report_id: reportId,
  title: 'Questions about passing clip',
}).select().single();
```

### Get messages
```typescript
const { data } = await supabase
  .from('chat_messages')
  .select('*')
  .eq('thread_id', threadId)
  .order('created_at', { ascending: true });
```

---

## 10. Push Notifications

### Register device
```typescript
// Mobile: get Expo push token
const token = await Notifications.getExpoPushTokenAsync();

// Store on profile or separate table
await supabase.from('profiles')
  .update({ push_token: token.data })
  .eq('id', userId);
```

### Send (from edge function, after report complete)
```typescript
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: pushToken,
    title: 'Report Ready',
    body: 'Your coaching report is ready — tap to view.',
    data: { clip_id: clipId, report_id: reportId },
  }),
});
```

---

## 11. Supabase RPC Functions

### `get_dashboard_summary(p_user_id UUID)`

```sql
CREATE OR REPLACE FUNCTION get_dashboard_summary(p_user_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_clips', COUNT(*),
    'average_rating', ROUND(AVG(r.overall_rating), 1),
    'best_rating', MAX(r.overall_rating),
    'latest_rating', (
      SELECT overall_rating FROM reports
      WHERE user_id = p_user_id
      ORDER BY created_at DESC LIMIT 1
    ),
    'improvement_delta', (
      SELECT r1.overall_rating - r2.overall_rating
      FROM reports r1
      JOIN reports r2 ON r2.user_id = r1.user_id
      WHERE r1.user_id = p_user_id
      ORDER BY r1.created_at DESC
      LIMIT 1
    )
  )
  FROM reports r
  WHERE r.user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

---

## 12. Rate Limits

| Action | Limit | Enforcement |
|--------|-------|-------------|
| Analyses per day | 10 (beta) | Edge function checks count |
| Clip uploads per day | 20 | RLS + client-side |
| Chat messages per day | 50 | Edge function |
| Storage per user | 2 GB | Supabase bucket policy |

---

## 13. Removed Endpoints (vs v1 Plan)

These are deferred to v2+:

| Endpoint | When |
|----------|------|
| `/matches/*` (full match CRUD) | v2.0 |
| `/reports/:id/timeline` | v2.0 |
| `/reports/:id/touches` | v2.0 |
| `/reports/:id/tactical` | v2.0 |
| `/reports/:id/ratings` (15 categories) | v2.0 |
| `/reports/:id/share` | v1.1 |
| WebSocket `/ws` (analysis progress) | v2.0 |
| `/internal/*` (worker callbacks) | v2.0 |
| tus upload server | v2.0 |

---

## 14. API Surface Summary

| Action | Method | Implementation |
|--------|--------|----------------|
| Sign up / login | SDK | Supabase Auth |
| Get/update profile | SDK | `profiles` table |
| Upload clip | SDK | Storage + `clips` insert |
| Trigger analysis | Edge fn | `generate-report` |
| Get report | SDK | `reports` table |
| Rate report | SDK | `reports` update |
| List clips + reports | SDK | `clips` join `reports` |
| Dashboard summary | RPC | `get_dashboard_summary` |
| Progress trend | SDK | `reports` ordered query |
| Create chat thread | SDK | `chat_threads` insert |
| Send chat message | Edge fn | `chat` |
| Get chat history | SDK | `chat_messages` query |
| Register push token | SDK | `profiles` update |
| Delete account | SDK | Cascade delete via FK |

**Total custom endpoints: 2 edge functions.** Everything else is Supabase SDK.

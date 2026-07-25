# Coach AI — AI Pipeline (MVP)

**Version:** 2.0  
**Last Updated:** 2026-07-23

---

## 1. Overview

The MVP AI pipeline is a **single edge function** that sends a video clip + player context to a multimodal LLM and receives a structured coaching report.

```
Clip (video) + Profile + Focus Areas
              ↓
      Gemini 2.0 Flash
              ↓
      Structured JSON Report
              ↓
         PostgreSQL
```

**No CV preprocessing. No event detection. No frame pipeline.** The LLM watches the clip and coaches.

**Target latency:** 30 seconds – 2 minutes  
**Target cost:** ≤ $0.10 per analysis

---

## 2. Pipeline Steps

### Step 1 — Receive Request

Edge function `generate-report` receives:
```json
{
  "clip_id": "uuid"
}
```

Loads from database:
- Clip storage path + duration + focus areas
- Profile snapshot (position, age, level, foot, style, goals)

### Step 2 — Prepare Video

```typescript
// Generate 60-second signed URL for clip
const videoUrl = await supabase.storage
  .from('clips')
  .createSignedUrl(clip.storage_path, 60);
```

### Step 3 — Build Prompt

System prompt establishes coaching persona. User prompt includes all context.

### Step 4 — Call Multimodal LLM

Send video URL + prompt to Gemini 2.0 Flash with structured output schema.

### Step 5 — Validate Response

Parse JSON with Zod schema. Retry once if validation fails.

### Step 6 — Save Report

Insert into `reports` table. Update clip status to `COMPLETE`.

### Step 7 — Notify User

Send Expo push notification: "Your coaching report is ready."

---

## 3. Prompt Design

### System Prompt

```
You are an experienced UEFA Pro Licence football coach providing 
personalised video analysis to a player.

Rules:
1. Watch the entire clip carefully before responding.
2. Base ALL feedback on what you actually see in the video.
3. If video quality is too poor to analyse, say so honestly.
4. Use second person ("You...") — speak directly to the player.
5. Be specific: reference moments, body position, decisions you observe.
6. Be constructive: every criticism must include what to do instead.
7. Tailor advice to the player's position, age, and skill level.
8. Do NOT invent actions that aren't visible in the clip.
9. Drills must be specific with reps, sets, and duration.
10. Rating must reflect what you see — don't inflate or deflate.
```

### User Prompt Template

```
Analyse this football clip for the following player:

PROFILE:
- Position: {position}
- Age: {age}
- Level: {skill_level}
- Preferred foot: {preferred_foot}
- Playing style: {playing_style}
- Goals: {improvement_goals}

FOCUS AREAS (prioritise feedback on these):
{focus_areas_list}

CLIP DETAILS:
- Duration: {duration_seconds} seconds

Provide your analysis as JSON matching the required schema.
Prioritise the selected focus areas but mention other observations 
if clearly visible.
```

---

## 4. Output Schema

```typescript
const ReportSchema = z.object({
  overall_rating: z.number().min(0).max(10),
  strengths: z.array(z.string()).min(2).max(4),
  areas_to_improve: z.array(z.string()).min(2).max(4),
  coach_explanation: z.string().min(200).max(2000),
  drills: z.array(z.object({
    title: z.string(),
    description: z.string(),
    reps: z.string(),
    duration_minutes: z.number(),
    focus: z.string(),
  })).min(2).max(3),
});
```

**Example output:**
```json
{
  "overall_rating": 7.8,
  "strengths": [
    "Good body position before receiving — open stance facing forward",
    "Positive decision to play forward rather than recycle backward",
    "Awareness of space — checked shoulder before receiving"
  ],
  "areas_to_improve": [
    "Scan before receiving — opponent approached from blind side unnoticed",
    "First touch was heavy — allowed defender to close space",
    "Could have played wide earlier when passing lane was available"
  ],
  "coach_explanation": "In this clip, you receive the ball in midfield with your body already facing forward — that's excellent and shows good pre-scanning habit. Your decision to play forward is the right instinct for a central midfielder at your level.\n\nHowever, the first touch lets you down. You take the ball across your body rather than into space, which gives the pressing midfielder time to close you down. At this moment, a cleaner first touch into the right foot would have opened the passing lane wide earlier.\n\nAn elite player like Kevin De Bruyne would scan twice before the pass arrives, take one touch into space, and release the through ball 0.5 seconds earlier. The difference is that extra scan and a sharper first touch under pressure.",
  "drills": [
    {
      "title": "Scan and Play",
      "description": "Partner stands behind you and passes to your feet. Before every touch, scan over both shoulders. Play first time into a cone gate.",
      "reps": "3 sets of 8",
      "duration_minutes": 15,
      "focus": "FIRST_TOUCH"
    },
    {
      "title": "One-Touch Wall Pass",
      "description": "Pass into a wall/rebounder, receive one-touch into space, pass to target cone. Focus on touch weight and direction.",
      "reps": "4 sets of 10",
      "duration_minutes": 12,
      "focus": "PASSING"
    }
  ]
}
```

---

## 5. Model Selection

| Model | Video Input | Latency | Cost/Clip | Quality | MVP Role |
|-------|-------------|---------|-----------|---------|----------|
| **Gemini 2.0 Flash** | Native | 30–60s | ~$0.05–0.10 | Good | **Primary** |
| GPT-4o | Frames only | 45–90s | ~$0.15–0.25 | Very good | Fallback |
| Claude Sonnet 4 | Frames only | 45–90s | ~$0.20–0.30 | Very good | Premium (v1.2) |

**Why Gemini Flash for MVP:**
- Native video input (no frame extraction code)
- Cheapest option with video support
- Fast enough for 2-minute SLA
- Good enough quality for beta validation

---

## 6. Error Handling

| Error | Action |
|-------|--------|
| LLM returns invalid JSON | Retry once with "respond only with valid JSON" |
| LLM says video too poor | Save report with rating null; message: "Try brighter/clearer footage" |
| LLM timeout (> 120s) | Retry once; if fail, set clip status FAILED |
| Rate limit hit | Queue with 30s delay; retry up to 3 times |
| Video URL expired | Regenerate signed URL; retry |

---

## 7. Quality Controls

### Pre-Upload (Client-Side)
- Validate duration (10s–5min)
- Validate file size (≤ 200 MB)
- Optional: warn if resolution < 480p

### Post-Generation
- Zod schema validation (required fields, lengths)
- Rating sanity check (0–10 range)
- Minimum explanation length (200 chars)
- Log all reports for manual review during beta

### User Feedback Loop
- Thumbs up/down on every report
- Track helpfulness rate per focus area
- Flag reports with thumbs down for prompt review

---

## 8. AI Coach Chat Pipeline (Milestone 5)

Separate edge function: `chat`

```
User message + thread history + (optional) report context
                    ↓
            Gemini 2.0 Flash (text only)
                    ↓
            Streaming response → save to chat_messages
```

### Chat System Prompt

```
You are Coach AI — a UEFA Pro Licence football coach.
You are helping {display_name}, a {skill_level} {position}, age {age}.
Their improvement goals: {improvement_goals}

{if report_context}
They are asking about this report:
Rating: {rating}
Strengths: {strengths}
Areas to improve: {areas}
Coach explanation: {explanation}
{/if}

Rules:
1. Be concise unless asked for detail.
2. Give specific, actionable advice.
3. Reference their profile and past feedback when relevant.
4. Never give medical advice.
5. Suggest drills with reps and duration when appropriate.
```

---

## 9. Prompt Versioning

```
supabase/functions/generate-report/
├── index.ts
├── prompts/
│   ├── v1-system.txt
│   ├── v1-user.txt
│   └── schema.ts
└── README.md
```

- Version prompts in filenames  
- Log `model_used` + prompt version on every report  
- A/B test prompt variants during beta by splitting traffic  

---

## 10. Future AI Enhancements

| Version | Enhancement |
|---------|-------------|
| **v1.1** | GPT-4o fallback for higher quality; multi-focus deep dives |
| **v1.2** | Cross-clip comparison ("Your passing improved 0.6 since last clip") |
| **v2.0** | CV pipeline provides structured events → LLM generates richer reports |
| **v2.5** | Fine-tuned coaching model on anonymised report corpus |
| **v3.0** | Real-time coaching on live recording |

See `06-CV-PIPELINE.md` for when structured CV data augments (not replaces) the LLM.

---

## 11. Cost Projection

| Scale | Analyses/mo | Gemini Cost | Supabase | Total |
|-------|-------------|-------------|----------|-------|
| Beta (100 users, ~3 clips each) | 300 | $30 | $25 | $55 |
| Launch | 1,000 | $100 | $25 | $125 |

**Free tier:** 3 analyses/month per user. Beta testers can receive manual bonus credits via `profiles.analyses_bonus_credits`.

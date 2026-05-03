# FitDomains — MVP Business Requirements

> Group-based fitness platform · Coach-led · AI domain mapping · Personal workout logging · iOS

---

## At a Glance

| Property | Value |
|---|---|
| Platform | iOS (React Native / Expo) |
| Model | Group-led with solo user support |
| User roles | Coach, Member |
| Fitness domains | 10 |
| AI-powered | Yes — Claude API for domain mapping |
| Scoring model | Recency-weighted running average |
| Monetization | Freemium |

---

## Problem & Value Proposition

**Problem:** Coaches and fitness instructors run group programs with no structured way to track members' all-around physical development. Progress is siloed, challenges are informal, and there is no shared visual language for fitness across domains.

**Solution:** A group fitness platform where coaches create structured workout challenges, members log results, and AI automatically maps those results to the 10 GPP fitness domains — updating each member's radar chart profile automatically. Coaches get a full view of group progress; members track their fitness evolving across all 10 dimensions.

**Key differentiator:** No mainstream fitness app uses AI to automatically decompose arbitrary workouts into the 10 GPP domains and maintain a live, recency-weighted fitness radar chart per user.

---

## Target Users

### Coach / Instructor (primary acquirer)
CrossFit coaches, personal trainers, sports team coaches, group fitness instructors. Creates the group, designs challenges, monitors member progress. The key acquisition target — one coach brings an entire group of users.

Personas: CrossFit box coaches, PT studio owners, sports team coaches, boot camp instructors.

### Member (primary user)
Athletes and fitness enthusiasts who join a coach's group or use the app independently. Participates in challenges, logs personal workouts, tracks domain scores across the radar chart.

Personas: Group athletes, solo fitness enthusiasts, competitive members.

> Members can exist without a group — solo use is fully supported.

---

## The 10 Fitness Domains

| # | Domain | Definition |
|---|---|---|
| 1 | Cardiovascular endurance | Ability of the body's systems to gather, process, and deliver oxygen |
| 2 | Stamina | Ability of body systems to process, deliver, store, and utilize energy |
| 3 | Strength | Ability of a muscular unit, or combination of muscular units, to apply force |
| 4 | Flexibility | Ability to maximize the range of motion at a given joint |
| 5 | Power | Ability of a muscular unit to apply maximum force in minimum time |
| 6 | Speed | Ability to minimize the cycle time of a repeated movement |
| 7 | Coordination | Ability to combine several distinct movement patterns into a singular movement |
| 8 | Agility | Ability to minimize transition time from one movement pattern to another |
| 9 | Balance | Ability to control the placement of the body's center of gravity |
| 10 | Accuracy | Ability to control movement in a given direction or at a given intensity |

---

## User Roles & Permissions

| Feature | Coach | Member |
|---|:---:|:---:|
| Create & manage groups | ✓ | — |
| Invite members via code | ✓ | — |
| Create challenges | ✓ | — |
| View all member scores | ✓ | — |
| Log workout results (challenges) | ✓ | ✓ |
| Log personal workouts (AI-mapped) | ✓ | ✓ |
| View own radar chart | ✓ | ✓ |
| View group leaderboard | ✓ | ✓ (opt-in) |
| Exist without a group | ✓ | ✓ |

---

## Core Feature: AI-Powered Domain Mapping

AI domain mapping powers two distinct flows.

### Flow 1 — Coach challenge
1. Coach builds a structured workout (exercises, sets, reps, weight, distance, time)
2. App sends workout to Claude API → returns weighted domain map
3. AI-mapped domains are shown to coach before publishing the challenge
4. Members log their results per exercise
5. Scores are computed and applied to mapped domains
6. Each member's radar chart updates automatically

### Flow 2 — Personal workout log
1. User logs a workout (exercises, sets, reps, weight, distance, time)
2. App sends workout to Claude API → returns weighted domain map
3. User sees a preview of which domains will be updated and by how much
4. User confirms → scores computed → radar chart updated

### AI Output Format
The Claude API must return a consistent JSON object. Weights must always sum to 1.0. Domains not trained by the workout are omitted or set to 0.

```json
{
  "cardiovascular_endurance": 0.40,
  "strength": 0.30,
  "power": 0.20,
  "stamina": 0.10
}
```

**System prompt guidance for Claude API:** The prompt must include full definitions of all 10 GPP domains and instruct the model to analyze the workout structure and return only a JSON object with domain weights, no preamble or explanation.

---

## Radar Chart Scoring Model

**Model: Recency-weighted running average (Option A)**

Each domain score (0–10) displayed on the radar chart is a weighted average of all workout contributions to that domain, with more recent workouts carrying more weight. This means:

- Training consistently → scores stay high
- Stopping training a domain → scores gradually decay
- Returning to training → scores recover
- The radar chart is a live reflection of current fitness, not a trophy case

### Per-workout contribution
When a workout is logged:
1. AI returns domain weights (e.g. `{ strength: 0.5, power: 0.3, stamina: 0.2 }`)
2. User's performance is converted to a raw score (0–10) based on effort metrics (weight, time, reps, distance)
3. That raw score is multiplied by each domain's weight → producing a per-domain contribution score for that session

### Recency decay formula
Use exponential decay weighting:

```
weight = e^(-λ × days_ago)
```

- Recommended starting λ = `0.02`
- A workout from ~35 days ago carries roughly half the weight of today's
- λ should be defined as a named constant in the codebase so it can be tuned without code changes

**Displayed domain score** = weighted average of all contributions to that domain using decay weights. Recompute on every new workout submission.

### Data model for contributions
Store one record per domain per workout. Never overwrite — always append. Scores are always recomputed from raw history.

```
workout_contributions table:
  id              uuid primary key
  workout_id      uuid references workouts
  user_id         uuid references users
  domain          text (one of the 10 domain keys)
  contribution_score  float (0–10)
  domain_weight   float (AI-assigned weight)
  logged_at       timestamp with time zone
```

> Score computation must be server-side (Supabase function), not client-side, to ensure consistency across all users.

---

## Challenge Structure

### Coach inputs
- Challenge name and description
- Start date and end date
- Workout definition: list of exercises each with sets, reps, weight, distance, or time
- Optional: target score goal per domain

### Member inputs
- Per-exercise results: time taken, weight lifted, reps completed, distance covered
- Free-text notes (optional)
- Submitted once per challenge

### Leaderboard
- Per-challenge ranking based on composite result score
- Members can opt out of appearing publicly (defaults to visible)
- Coach always sees the full ranking regardless of member opt-out

---

## Core Screens (MVP)

### Coach screens

| Screen | Description |
|---|---|
| Group dashboard | Overview of all members, average domain scores per member, active challenges, group-level radar chart |
| Create / manage challenge | Build workout with exercises. AI domain mapping preview shown before publishing. Set start/end dates. |
| Member profile view | Individual member's radar chart, score history, challenge participation record |
| Challenge results view | Per-challenge leaderboard, submission status (who has/hasn't submitted), individual result breakdown |

### Member screens

| Screen | Description |
|---|---|
| Home — my fitness profile | Personal radar chart, overall score (avg of 10 domains), individual domain scores, recent activity |
| Active challenges | List of open challenges from coach. Tap to view workout details and submit results. |
| Submit challenge results | Log results per exercise. Domain impact preview shown before confirming. |
| Group leaderboard | Per-challenge ranking. Toggle own visibility. |
| Log personal workout | User inputs workout (exercises, sets, reps, weight, distance, time). AI maps to domains. Preview shown before saving. |
| Domain detail | Score history and trend line for a single domain. Lists all contributing workouts and challenges. |
| Workout history | Chronological log of all personal workouts and challenge submissions with domain contributions |

### Shared screens

| Screen | Description |
|---|---|
| Onboarding & sign-up | Choose role (coach or member). Email or Apple Sign-In. Members: enter group invite code or continue solo. |
| Profile & settings | Edit personal info, leaderboard visibility toggle, notification preferences, log out |

---

## Freemium Model

| Tier | Limits | Status |
|---|---|---|
| **Free** | 1 group, up to 10 members, 3 active challenges at a time, unlimited personal workout logging, radar charts, group leaderboard | MVP launch |
| **Pro** | Unlimited members, unlimited challenges, advanced analytics, group radar overlay, full workout history export, CSV export | Post-MVP paid tier |
| **Team** | Multiple coaches, multiple groups, org-level dashboard, API access, priority support | Future |

> In-app payments (RevenueCat) are out of scope for MVP. Pro tier can be manually unlocked during early access.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React Native (Expo) | iOS-first, Android-ready, fastest path to App Store |
| Backend / DB | Supabase | Auth, Postgres, row-level security for role permissions |
| AI domain mapping | Claude API (`claude-sonnet-4-20250514`) | Workout → domain weight JSON |
| Charts | Victory Native | Radar chart, trend lines, leaderboard visuals |
| Auth | Supabase Auth + `expo-apple-authentication` | Apple Sign-In required for App Store |
| Payments | RevenueCat | Post-MVP; iOS subscriptions with minimal setup |

### Critical implementation notes for Claude Code

1. **Set up Supabase row-level security (RLS) before building any UI.** Coaches must not be able to read other coaches' group data. Members must only read their own scores and their group's leaderboard.

2. **Build the scoring engine first.** Implement the `workout_contributions` table and the server-side score recomputation function before wiring up any UI. All radar chart data flows from this.

3. **The Claude API system prompt for domain mapping is critical.** It must include all 10 GPP domain definitions and strict JSON-only output instructions. Test it with diverse workout types before building the UI around it.

4. **Always show a domain mapping preview before saving.** Both personal workout logging and challenge result submission should display which domains will be affected and by how much, before the user confirms. This builds trust in the AI layer.

5. **Recommended build order:**
   - Supabase schema + RLS policies
   - Auth + onboarding (role selection, Apple Sign-In)
   - Claude API domain mapping service + scoring engine
   - Coach: challenge creation flow
   - Member: personal workout logging + radar chart
   - Member: challenge submission
   - Group leaderboard
   - Domain detail + workout history

---

## Out of Scope for MVP

- Achievement badges
- Wearable / device integration (Apple Watch, Garmin, etc.)
- Android support
- In-app payments / subscription billing
- Multiple groups per coach
- Member-created challenges
- Social sharing
- In-app chat or messaging
- HealthKit integration
- Exercise video demonstrations
- Predefined workout library
- AI workout suggestions or recommendations

# Training Analyzer — Product Requirements Document

**Version**: 0.1 (current state: MVP in production)
**Date**: 2026-04-23
**Author**: Alessandro Curti
**Status**: Living document — update with each meaningful release
**Audience**: founder (internal use), external developer, investor pitch (sections §2, §3, §6, §7)

---

## 1. Executive Summary

Training Analyzer is a workout-analysis web app for amateur endurance and multi-sport athletes. It aggregates data from Apple Health, GPX files and manual input into a single dashboard, computes a **sport-specific score**, and surfaces trends for training load, recovery, weight and body composition.

The app is live in production (Render + Neon PostgreSQL 18, Frankfurt region), multi-user, with Google and email auth, **21 supported sports**, body-measurement tracking and an admin dashboard. It is a solid MVP, used daily by the author. The path to product-market fit requires simplified onboarding, an automated coach and an acquisition funnel.

---

## 2. Vision & Mission

**Vision**: become the first *privacy-first digital coach* for amateur endurance athletes who don't hire a personal trainer but want to train with structure.

**Mission**: aggregate the data you already generate (Apple Health, Garmin, Strava, manual gym logs) and turn it into actionable feedback — not just charts — while handing control of the data back to the user.

---

## 3. Problem Statement

Amateur endurance and multi-sport athletes face three underserved problems today:

1. **Data fragmentation** — Garmin data lives in Garmin Connect, gym sessions in a separate app, body metrics in Apple Health, casual workouts nowhere. No unified view.
2. **Inaccessible personalized coaching** — TrainingPeaks requires a paid coach (~€150/month), Strava is social-first with no prescription, Garmin Coach is generic. Questions like *"am I overreaching this week?"* get no automated answer.
3. **Your data as someone else's business model** — Strava has faced data-privacy controversies; Garmin ties everything to its hardware. Biometric data (HRV, sleep, weight) becomes a third party's asset.

---

## 4. Solution

A mobile-friendly web app that:

- **Imports** Apple Health (full XML export), GPX (any sport watch), CSV (gym), manual input, basic FIT.
- **Unifies** everything into a common data model (Workout) with sport-specific scoring computed automatically.
- **Visualizes** load, recovery, score, weight and body-composition trends with Chart.js.
- **Recommends** (v2 roadmap) what to do today: rest, easy session, intensity, tapering.
- **Owns** the data: single database, full JSON export, optional self-hosting on the roadmap.

---

## 5. Target Users (Personas)

### Primary — *The Structured Amateur*
- Age 22-45, multi-sport (running + gym + something else)
- Uses Apple Watch / Garmin / Polar
- 4-6 sessions/week, clear goals (weight, performance) but no coach
- Wants to know if they're training too much, too little, or improving
- Comfortable with some setup friction but won't tolerate enterprise UX

### Secondary — *The Data Enthusiast*
- Multiple devices, wants a unified "all my life in one dashboard" view
- Values data ownership and full export

### Tertiary — *The Athlete in Transition*
- Ex-structured athlete who lost contact with a coach
- Wants continuity and automated accountability

---

## 6. Market & Competition

**TAM**: ~125M monthly Strava users; ~50M+ Garmin Connect; ~500K TrainingPeaks paying athletes. Endurance sports tracking ~$2B SAM.

| Competitor | Model | Strength | Weakness |
|---|---|---|---|
| **Strava** | Freemium ~€80/yr | Community, segments | No coaching, social-first |
| **TrainingPeaks** | ~€20/mo + coach | Serious planning | Complex, requires human coach |
| **Garmin Connect** | Free + hardware | Device integration | Vendor lock-in |
| **Whoop** | ~€25/mo hardware+app | Recovery focus | Recovery only, no strength |
| **Coros / Form** | Hardware + app | Modern UX | Lock-in |

**Market gap**: European amateurs who want automated coaching + data ownership + multi-sport, without vendor lock-in. **No dominant player in Italy or southern Europe.**

---

## 7. Differentiation — Three Wedges

### Wedge 1 — AI Coach for Amateurs
Automated coaching (rules + ML) that watches load, HRV, weight and score to recommend *what to do today*. Doesn't replace a human coach but covers 90% of the non-elite amateur's needs. **Addressable**: ~10M EU users who currently don't pay for a coach.

### Wedge 2 — Privacy & Data Ownership
Self-hostable (open core on the roadmap), free full export, zero third-party analytics, zero data monetization. **Strong narrative differentiation** post Strava/Garmin data controversies and in a mature GDPR climate.

### Wedge 3 — Multi-source Aggregator
A single dashboard for Apple Health + Garmin + Strava + manual + gym + body measurements + (future) nutrition and sleep. **Cross-source analysis** — e.g. sleep-to-performance correlations across providers — that no single vendor can offer.

---

## 8. Product Features — Current State (v1.0)

### Auth & Account
- Google OAuth2 + email/password login
- JWT (15min access + 7-day refresh, with rotation)
- Profile: firstName, lastName, displayName, photoURL, role (user/admin)
- Admin dashboard with global stats and user list

### Import
- **GPX**: running, cycling, hiking (distance, elevation, track, optional HR)
- **Apple Health**: full XML export (tested on 823 workouts, 9 years of data)
- **CSV**: gym sessions
- **JSON**: internal backup/restore
- **FIT**: basic support

### Supported Sports (21)
gym, running, walking, cycling, swimming, hiking, karting, boxing, tennis, padel, football, basketball, crossfit, yoga, climbing, skiing, martial_arts, volleyball, skateboard, surf, dance.

### Metrics & Scoring
Computed client-side (`scoring.js`):
- **Sport-specific score**: gym (volume + intensity + progression + variety + duration); running (distance + pace + HR efficiency + effort); karting (consistency + improvement + effort); etc.
- Recovery score, streak, RPE from HR or METs, fitness assessment
- Calorie tracking (ActiveEnergyBurned + BasalEnergyBurned from Apple Health)

### Visualizations
- Calendar heatmap (canvas)
- Score / weight / volume trends (Chart.js)
- Filterable workout tables
- GPX track map
- Body-composition charts

### Body Measurements & Settings
- Weight history
- 8 circumferences (chest, waist, hips, shoulders, biceps, neck, thigh, calf)
- 8 composition metrics (body fat %, skeletal muscle, water, muscle/bone mass, protein, visceral/subcutaneous fat)
- Cardiac profile (maxHR, restHR), VO2max, weight target, active sports, muscle groups

### Social (basic)
- User search
- Follow / unfollow
- Public stats view of followed users

### Admin (v1.0)
- Global stats (users, 7/30-day signups, total/recent workouts)
- Paginated user list
- Sport breakdown (doughnut chart) + signups line chart
- Admin bootstrap via `ADMIN_EMAIL` env var

---

## 9. Technical Architecture

### Stack
- **Frontend**: Vanilla JS (ES modules, no build step), Chart.js 4.4.1
- **Backend**: Node.js 20, Express 4, Sequelize 6 ORM
- **Database**: PostgreSQL 18 (Neon production, Frankfurt) + 16 supported
- **Auth**: Passport.js (Google OAuth2 + Local), JWT
- **Container**: Docker + docker-compose
- **Hosting**: Render (web service) + Neon (PostgreSQL pooler)

### Data Model (7 entities)
| Entity | Notes |
|---|---|
| **User** | uid UUID, role (user/admin), provider (google/local) |
| **Workout** | JSONB `data` for sport-specific details, indexes on (userId,date) and (userId,type) |
| **Exercise** | strength-tracking fields (weightMode total/per-side, barbellWeight, isUnilateral) |
| **Settings** | cardiac profile, anthropometry, active sports, muscle groups, weightTarget |
| **Weight** | weight history, unique index on (userId,date) |
| **BodyMeasurement** | 16 metrics (8 circumferences + 8 composition), unique index on (userId,date) |
| **Follow** | composite PK followerId + followingId |

### Security
- `helmet` + CORS allowlist + `express-rate-limit` (2000 req / 15 min)
- `bcryptjs` password hashing
- JWT with refresh rotation
- SSL required for production database (`sslmode=require`)

### API
RESTful, 8 route groups (auth, workouts, exercises, settings, weights, body, users, admin), no versioning (`/api/...`).

### Deploy
- Render auto-deploy on push to `main`
- Sequelize CLI migrations (`npm run migrate`) run manually with `NODE_ENV=production` for Neon SSL
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`, `CLIENT_ORIGIN`, `ADMIN_EMAIL`

---

## 10. Roadmap

### v1.x — Stabilization (Q2 2026)
- **Onboarding wizard** — today a new user lands with no starting path
- **Mobile UX polish** — touch targets, swipe gestures, iOS performance
- **Fix imprecise RPE** — compute from Apple Health METs instead of estimated HR
- **Full-fidelity import** — recover METs, elevation, GPS track, basal calories, VO2max trend currently dropped by the Apple Health parser
- **User-facing docs in Italian** — only a technical `README.md` exists today

### v2.0 — AI Coach (Q3-Q4 2026)
- *"Suggested workout today"* based on 7-day load + HRV + weight + recent scores
- Overreaching / under-recovery detection with notifications
- Automated pre-race tapering (configurable)
- Email/push notifications (weekly digest, milestones)

### v3.0 — Aggregator (2027)
- **Garmin Connect** integration (OAuth API)
- **Strava** integration (OAuth API, segment import)
- **MyFitnessPal** / nutrition integration
- Sleep tracking (Apple Health + Oura / Whoop)

### v4.0 — Community + Monetization (2027+)
- Shareable training plans between followers
- Challenges and segments
- **Premium tier** (€7-10/mo): advanced AI coach, integrations, coach-grade PDF export
- **Self-hosted edition** (open core)

---

## 11. Success Metrics

### Product KPIs
- **WAU / MAU**
- Workout imports per user per week (≥3 = healthy)
- Sport diversity per user (1 = casual, 3+ = power user)
- **4-week retention** (target: 40% for power users)
- Time-to-first-import (target: <10 min from signup)

### Business KPIs (post-monetization)
- **Free → premium conversion** (target: 3-5%)
- ARR, MRR
- **CAC** (target: <€20 organic, <€60 paid)
- LTV / CAC ratio (target: >3)

### Technical KPIs
- Uptime (target: 99.5%)
- p95 API latency (target: <500ms)
- Error rate (<0.5%)

---

## 12. Business Model (Future)

**Consumer freemium**
- *Free*: unlimited import, base scoring, dashboard, body measurements, basic social
- *Premium €7/mo or €60/yr*: AI coach, Garmin/Strava/MyFitnessPal integrations, coach-grade PDF export, priority support

**Self-hosted (open core)**
- Free for personal use (Docker self-host)
- Commercial license for professional coaches hosting their own athletes

**Principles**
- No data sales
- No ad targeting
- Transparent pricing, no dark patterns

---

## 13. Risks & Open Questions

### Risks
- **Amateur adoption** — sensitive to "yet another app" fatigue. Onboarding ≤5 min is critical.
- **Apple Health friction** — users must manually export XML from iPhone; an iOS Shortcut is required for a decent UX.
- **Garmin/Strava APIs** — rate limits and potential future enterprise costs.
- **GDPR / biometric data** — special category (Art. 9 GDPR), requires DPA, privacy policy, DPIA at scale.
- **Proprietary scoring** — current formulas validated against the author only; sport-scientist benchmarking needed before coaching claims.

### Open Questions
- **Final naming** — "Training Analyzer" is a working title
- **Open-source or closed-source?** — strategic decision, directly affects the "Privacy & ownership" wedge
- **Mobile**: PWA or native app? — dev cost vs reach
- **Launch language**: Italian only, or IT + EN from day 1?
- **Scientific scoring**: engage a sport-science consultant to validate formulas before shipping automated coaching?

---

## 14. Appendix — Related Documents

- [Technical README](README.md)
- [DB migration Render → Neon](MIGRATION_RENDER_TO_NEON.md)
- [Apple Health data profile](APPLE_HEALTH_DATA_PROFILE.md)
- [PRD Italian version](PRD_IT.md)

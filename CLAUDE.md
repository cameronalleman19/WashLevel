# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Frontend (root)**
```bash
npm run dev        # Start Vite dev server
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

**Functions**
```bash
cd functions && npm run serve    # Start Functions emulator only
cd functions && npm run deploy   # Deploy functions to Firebase
```

**Deploy everything**
```bash
npm run build && firebase deploy
```

There is no test suite.

## Architecture

### Single-file frontend
The entire React frontend lives in `src/App.jsx` (~5,300 lines). There is no component file splitting, no React Router, and no state management library. All views are conditionally rendered in one `Dashboard` component that owns all app state.

**Navigation** is a `view` string state (`"overview"`, `"tasks"`, `"all-tasks"`, `"timeclock"`, `"inventory"`, `"equipment"`, `"alerts"`, `"calendar"`, `"carcounts"`, `"sensors"`, `"settings"`) combined with a `locId` string for the currently selected location. Switching between views means calling `setView(...)` — nothing is mounted/unmounted via routing.

**Data flow**: `Dashboard` fetches all locations, tasks, sensors, and equipment via Firestore `onSnapshot` listeners on mount, then passes slices of that state as props down to each view component. There are no shared contexts for app data — only `AuthCtx`.

### Firebase backend
- **Auth**: Firebase Email/Password auth. User profile data is stored in `users/{uid}` (not Firebase Auth custom claims).
- **Firestore**: All persistent data. Realtime listeners are used throughout — prefer `onSnapshot` for display data, `getDoc`/`updateDoc` for mutations.
- **Storage**: Used for file/image uploads via `uploadFile()` helper at the top of `App.jsx`. Images are compressed client-side to max 1200px / JPEG 80% before upload.
- **Functions**: Node.js Cloud Functions v2 in `functions/index.js`. The secret `RESEND_API_KEY` must be provisioned via Firebase before deploying email functions.

### Firestore data model
```
users/{uid}                              — profile: role, name, email, ownerId, allowedLocations, bizName
users/{uid}/integrations/sensorpush      — SensorPush OAuth token + sensor list + location assignments
users/{uid}/integrations/shelly          — Shelly Cloud authKey + server URL
users/{uid}/prefs/alerts                 — daily summary settings, alert toggles
users/{uid}/prefs/sensorAlerts           — per-SensorPush-sensor min/max thresholds
users/{uid}/prefs/shellyConfig           — Shelly device location assignments + hidden list
users/{uid}/notifications/{id}           — in-app notifications (read/unread)

locations/{locId}                        — name, address, zipCode, ownerId, order
locations/{locId}/tasks/{taskId}         — title, category, priority, status, assignedRole, due, shift, note, completedAt
locations/{locId}/equipment/{eqId}       — name, status (ok/warning/error), lastService, nextService
locations/{locId}/inventory/{itemId}     — inventory items with quantities
locations/{locId}/shellyReadings/{devId} — latest relay/input state from Shelly Cloud
locations/{locId}/shellyDevices/{id}     — Shelly BLU distance sensors with alert thresholds
locations/{locId}/sensorReadings/{id}    — latest ChemLevel sensor reading; subcollection /history for time series
locations/{locId}/daySummaries/{date}    — carsWashed count keyed by YYYY-MM-DD

sensors/{locId}                          — current sensor snapshot (manual + SensorPush spTempF/spHumidity)
invites/{id}                             — pending team member invitations
```

### Multi-tenancy model
Managers sign up and become "owners". Team members are invited and stored with `isTeamMember: true` and `ownerId` pointing to the manager's uid. Location queries always filter `where("ownerId", "==", ownerId)`. Team members are further restricted by `allowedLocations[]` on their profile.

### Cloud Functions
| Function | Trigger | Purpose |
|---|---|---|
| `sendInviteEmail` | `onCall` | Send team invite email via Resend |
| `sendWelcomeEmail` | `onDocumentCreated("users/{uid}")` | Welcome email on new user registration |
| `sendPasswordResetEmail` | `onCall` | Custom password reset via Resend + Firebase Admin |
| `sendDailySummary` | `onCall` | Manual trigger for daily summary email |
| `scheduledDailySummary` | cron `0 * * * *` (ET) | Hourly check — sends to users whose preferred send time matches current ET hour |
| `ingestSensorReading` | `onRequest` (HTTP POST) | ChemLevel IoT sensor ingestion; auth via shared secret `chemlevel2025` |
| `checkSensorPushAlerts` | cron `*/10 * * * *` | Polls SensorPush API for all users, writes notifications if thresholds breached |
| `shellyCloudProxy` | `onCall` | Proxies requests to Shelly Cloud API (device list, status, relay control) |

### Hardware integrations
- **SensorPush**: Temperature/humidity sensors. Browser polls `api.sensorpush.com` every 5 minutes from `Dashboard`, updating `sensors/{locId}`. Cloud function also checks thresholds every 10 minutes and writes notifications.
- **Shelly Cloud**: Smart relays and inputs. All communication goes through the `shellyCloudProxy` Cloud Function to keep auth keys server-side. Device state is cached in `locations/{locId}/shellyReadings/{deviceId}`.
- **ChemLevel**: Custom IoT sensors posting readings via the HTTP `ingestSensorReading` endpoint.

## Styling conventions
All styling is inline (`style={{ ... }}`). There are no CSS utility classes or component-level CSS files (other than `index.css` for global resets). Brand colors: navy `#1a3352`, accent blue `#0ea5e9`. Font: DM Sans loaded from Google Fonts at runtime.

Shared style lookup tables at the top of `App.jsx` (`CAT`, `PRI`, `STS`, `EQS`) map task categories, priorities, statuses, and equipment states to `{ bg, color }` objects used for `<Pill>` and inline badges.

# The Water App - Smart Garden

A self-hosted smart garden watering control system built with Next.js and deployed on Vercel. Features AI-powered automated watering using Gemini, soil moisture monitoring, weather integration, and a modern bento-box dashboard design.

**Live App**: [watering-app.vercel.app](https://watering-app.vercel.app)

---

## Features

### Dashboard
- **Modern Bento Box Layout** - Clean, card-based UI inspired by modern dashboard designs
- **Left Sidebar Navigation** - Collapsible sidebar with logo and menu items
- **Quick Actions** - Water All / Stop All buttons with gradient styling
- **Real-time Status** - Device connection status, active zones count
- **Property Map** - Interactive satellite view with clickable watering zones
- **Weather Widget** - Current temperature and conditions at a glance
- **Soil Moisture Display** - Real-time moisture readings from Zigbee sensor
- **Statistics Cards** - Weekly events, total watering time

### AI-Powered Automated Watering
- **Gemini AI Decision Making** - AI analyzes soil moisture, weather, and plant needs
- **Smart Scheduling** - Runs every 4 hours via cron job
- **Contextual Analysis** - Considers plant type, age, recent rainfall, forecast
- **Time Restrictions** - Only waters between 6 AM - 10 PM
- **Safety Limits** - 30-60 minutes per session (deep watering only)
- **Frequency Control** - Maximum 2-3 waterings per week to encourage root growth

### Soil Sensor Integration
- **Real-time Monitoring** - Live soil moisture percentage
- **Temperature Tracking** - Soil temperature readings
- **Battery Status** - Sensor battery level monitoring
- **Zone Linking** - Moisture data linked to watering zones

### Security
- **PIN Lock** - 6-digit PIN required to access app
- **Remember Browser** - Optional persistent authentication
- **Cron Authentication** - Bearer token protection for API endpoints

### Pages
- **Dashboard** - Main control center with bento grid layout
- **Garden AI** - Chat with Gemini-powered garden assistant
- **Weather** - 7-day forecast with detailed conditions
- **Rainfall** - Precipitation tracking and watering recommendations
- **History** - Complete watering event log with statistics
- **Soil** - Real-time soil sensor data display

### Mobile Responsive
- **Slide-out Menu** - Hidden sidebar that slides in on mobile
- **Fixed Header** - Always-visible app bar with hamburger menu
- **Touch-optimized** - Larger touch targets, responsive padding
- **PWA Support** - Installable as a home screen app

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Database** | Supabase (PostgreSQL) |
| **AI** | Google Gemini 2.0 Flash |
| **Weather** | Open-Meteo API |
| **IoT** | Tuya Cloud API |
| **Hosting** | Vercel |
| **Cron Jobs** | cron-job.org |
| **Hardware** | Zigbee smart water tap + soil sensor (SmartLife/Tuya) |

---

## Project Structure

```
watering-app/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main dashboard (bento grid)
│   │   ├── layout.tsx                  # Root layout with PWA meta
│   │   ├── globals.css                 # Global styles + custom scrollbar
│   │   └── api/
│   │       ├── chat/
│   │       │   └── route.ts            # Gemini AI chat endpoint
│   │       ├── cron/
│   │       │   ├── auto-water/
│   │       │   │   └── route.ts        # AI-powered auto watering
│   │       │   └── water-check/
│   │       │       └── route.ts        # Stop watering when scheduled
│   │       ├── device/
│   │       │   └── [deviceId]/
│   │       │       └── route.ts        # Tuya device control
│   │       ├── history/
│   │       │   └── route.ts            # Watering history from Supabase
│   │       ├── soil-sensor/
│   │       │   └── route.ts            # Soil sensor data
│   │       └── weather/
│   │           └── route.ts            # Open-Meteo weather API
│   ├── components/
│   │   └── PinLock.tsx                 # PIN authentication component
│   └── lib/
│       ├── tuya.ts                     # Tuya API client with HMAC auth
│       └── supabase.ts                 # Supabase client
├── public/
│   ├── logo.png                        # App logo
│   ├── property-map.png                # Property satellite image
│   └── manifest.json                   # PWA manifest
├── vercel.json                         # Vercel configuration
└── .env.local                          # Environment variables (not committed)
```

---

## Environment Variables

### Required Variables

```env
# Tuya API (Device Control)
TUYA_ACCESS_ID=your_tuya_access_id
TUYA_ACCESS_SECRET=your_tuya_access_secret
TUYA_API_ENDPOINT=https://openapi.tuyaeu.com

# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Google Gemini (AI Chat & Auto Watering)
GEMINI_API_KEY=your_gemini_api_key

# Cron Job Authentication
CRON_SECRET=your_random_secret_string
```

### Setup Instructions

1. **Local Development**: Create `.env.local` file with above variables
2. **Vercel**: Add variables in Dashboard > Settings > Environment Variables

---

## Database Schema (Supabase)

### Tables

```sql
-- Watering zones
CREATE TABLE zones (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  plant_type TEXT,
  plant_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watering events
CREATE TABLE watering_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id TEXT REFERENCES zones(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  trigger TEXT DEFAULT 'manual',  -- 'manual', 'scheduled', 'automated'
  scheduled_end_at TIMESTAMPTZ,   -- For automated watering stop time
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soil readings (optional - for historical tracking)
CREATE TABLE soil_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id TEXT REFERENCES zones(id),
  moisture_percent INTEGER NOT NULL,
  temperature DECIMAL,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Initial Setup SQL

```sql
-- Add zone
INSERT INTO zones (id, device_id, name, plant_type, plant_date)
VALUES ('zone-1', 'bf9d467329b87e8748kbam', 'Front Right Garden Hedges', 'Leighton Greens', '2025-12-13');

-- Add scheduled_end_at column (if upgrading)
ALTER TABLE watering_events
ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;
```

---

## Automated Watering System

### How It Works

1. **Cron job runs every 4 hours** (via cron-job.org)
2. **Time check** - Only proceeds between 6 AM - 10 PM Melbourne time
3. **Soil sensor reading** - Gets current moisture percentage
4. **Gemini AI analysis** - Sends data to AI with context:
   - Current moisture level
   - Plant type and age
   - Weather conditions and forecast
   - Recent rainfall
   - Watering history
5. **AI decision** - Returns whether to water and for how long
6. **Execution** - Turns on tap for recommended duration
7. **Auto-stop** - Water-check cron turns off tap when scheduled time reached

### Gemini AI Decision Factors

The AI receives strict rules it must follow:

```
=== STRICT RULES (MUST FOLLOW) ===

RULE 1 - WATERING FREQUENCY: Water ONLY 2-3 times per week, NOT daily.
- Tracks waterings in the past 7 days
- If already watered 3+ times this week, DO NOT WATER unless soil is critically dry (<20%)
- If watered yesterday or today, DO NOT WATER again unless emergency

RULE 2 - DURATION: If watering, MUST be between 30-60 minutes.
- NEVER suggest less than 30 minutes
- Short waterings (under 30 min) create shallow roots - this is BAD
- Deep watering encourages root growth - this is the goal

RULE 3 - SKIP WATERING if any of these are true:
- Already watered 3+ times this week
- Watered within the last 2 days AND soil moisture > 25%
- Rain expected in next 24 hours
- Soil moisture > 40%

=== SOIL MOISTURE GUIDELINES ===
- Below 20%: CRITICAL - water immediately (30-60 min)
- 20-30%: Dry - water if not watered in last 2 days (30-60 min)
- 30-40%: Adequate - only water if last watering was 3+ days ago
- Above 40%: Good - DO NOT water
```

### Example AI Response

```json
{
  "shouldWater": true,
  "durationMinutes": 30,
  "reason": "Soil moisture at 27% is below optimal range. No rain forecast for 3 days.",
  "confidence": "high"
}
```

### Cron Job Setup (cron-job.org)

**Job 1: Auto Water Check** (every 4 hours)
- URL: `https://watering-app.vercel.app/api/cron/auto-water`
- Schedule: `0 */4 * * *`
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

**Job 2: Water Stop Check** (every minute)
- URL: `https://watering-app.vercel.app/api/cron/water-check`
- Schedule: `* * * * *`
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

### Why External Cron?

Vercel Hobby accounts only allow daily cron jobs. Using cron-job.org (free) allows:
- More frequent execution (every 4 hours, every minute)
- Custom scheduling
- Execution history and logs

---

## Hardware Setup

### Devices

| Device | Device ID | Purpose |
|--------|-----------|---------|
| Front Tap | `bf9d467329b87e8748kbam` | ZigBee smart water valve |
| Soil Sensor | `bf455b6fdac1b8d5b9kagj` | Soil moisture/temperature sensor |
| Gateway | `bf727c0aae995a8336yjmf` | GW002 ZigBee hub |

### SmartLife App Configuration

**Important: Auto-Off Timer Setting**

The smart tap has a built-in auto-off timer that overrides API commands. Configure it to be longer than max watering duration:

1. Open SmartLife app
2. Tap on the water tap device
3. Find "Irrigation Duration" setting
4. Set to **1 hour 10 minutes** (70 min)

This acts as a safety backup - the API will stop watering at 30-45 min, but if it fails, the tap auto-stops at 70 min.

### Tuya Developer Platform Setup

1. Create project at [iot.tuya.com](https://iot.tuya.com)
2. Link SmartLife account under "Devices" > "Link App Account"
3. Subscribe to required APIs under "Service API":
   - Device Control
   - Device Status
4. Note your Access ID and Secret
5. Match API endpoint to your data center (Australia uses EU endpoint)

---

## API Integrations

### 1. Tuya Cloud API (Device Control)

Controls Zigbee devices via Tuya's REST API.

**Authentication**: HMAC-SHA256 signature-based

**Endpoints Used**:
- `GET /v1.0/devices/{device_id}` - Get device status
- `POST /v1.0/devices/{device_id}/commands` - Send commands

**Soil Sensor Status Codes**:
```typescript
// Common codes (vary by manufacturer)
const moistureCodes = ["humidity", "soil_humidity", "humidity_value", "moisture"];
const temperatureCodes = ["temp_current", "temperature", "temp_value"];
const batteryCodes = ["battery_percentage", "battery_state", "va_battery"];
```

**Tip**: Use "Debug Device" in Tuya platform to see actual status codes for your specific device.

### 2. Open-Meteo API (Weather)

Free weather API - no API key required.

**Endpoint**: `https://api.open-meteo.com/v1/forecast`

**Features**:
- Current conditions (temp, humidity, wind, precipitation)
- 7-day forecast with precipitation probability
- Last 7 days rainfall totals
- Smart watering recommendations

### 3. Google Gemini API (AI)

Powers both chat assistant and automated watering decisions.

**Model**: `gemini-2.0-flash-exp`

**Chat Context Includes**:
- Garden location and zone info
- Plant types and planting dates
- Current weather conditions
- Recent watering history
- Soil moisture readings

### 4. Supabase (Database)

PostgreSQL database for watering history and soil readings.

---

## Learnings & Technical Notes

### Tuya API Authentication

Tuya uses complex HMAC-SHA256 signature authentication:

1. **Token Request** (no access token yet):
   ```
   sign = HMAC-SHA256(client_id + timestamp + stringToSign, secret)
   ```

2. **API Request** (with access token):
   ```
   sign = HMAC-SHA256(client_id + access_token + timestamp + stringToSign, secret)
   ```

3. **String to Sign**:
   ```
   HTTP_METHOD\n
   SHA256(body)\n
   \n
   URL_PATH
   ```

### Tuya Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 1004 | sign invalid | Check signature generation |
| 1106 | permission deny | Subscribe to APIs in Service API tab |
| 28841107 | data center suspended | API endpoint doesn't match project region |
| 2017 | token invalid | Token expired, get new token |

### Data Center Mapping

| SmartLife Region | API Endpoint |
|-----------------|--------------|
| Australia | `https://openapi.tuyaeu.com` (Central Europe) |
| USA West | `https://openapi.tuyaus.com` |
| Europe | `https://openapi.tuyaeu.com` |
| India | `https://openapi.tuyain.com` |
| China | `https://openapi.tuyacn.com` |

### Soil Sensor Discovery

When adding a new soil sensor:
1. Add device to SmartLife app
2. Wait for it to appear in Tuya Developer Platform (may take a few minutes)
3. If not appearing, re-link your SmartLife account under "Link App Account"
4. Use "Debug Device" to discover the actual status codes

### SmartLife Auto-Off Timer Issue

**Problem**: Water stops before scheduled duration
**Cause**: SmartLife tap has built-in auto-off timer (default often 10 min)
**Solution**: Set auto-off timer to longer than max watering duration (e.g., 70 min)

### Vercel Hobby Cron Limitations

Vercel Hobby accounts only allow daily cron jobs (`0 0 * * *`). For more frequent execution:
- Use external cron service (cron-job.org is free)
- Or upgrade to Vercel Pro

### Time Zone Handling for Cron

```typescript
// Convert to Melbourne time for watering hour check
const melbourneTime = new Date(now.toLocaleString("en-US", {
  timeZone: "Australia/Melbourne"
}));
const currentHour = melbourneTime.getHours();
const allowed = currentHour >= 6 && currentHour < 22; // 6 AM - 10 PM
```

### Closing Stale Watering Events

If watering events get stuck "In progress":
```sql
UPDATE watering_events
SET ended_at = NOW(), duration_seconds = 900
WHERE ended_at IS NULL AND trigger = 'automated';
```

### Deep Watering Philosophy

**Problem**: Short, frequent watering (10-20 min) creates shallow root systems that make plants dependent on constant irrigation.

**Solution**: Always water deeply (30-60 min), less frequently (2-3x per week max).

**Benefits**:
- Deep roots make plants more drought-resistant
- Reduces overall water usage (fewer watering events)
- Plants can survive longer between waterings
- Healthier, more established plants

**Implementation**:
- `MIN_WATERING_DURATION = 30` - Enforces minimum 30 minutes
- `MAX_WATERING_DURATION = 60` - Maximum cap at 60 minutes
- `TARGET_WATERINGS_PER_WEEK = 3` - Track and limit weekly frequency
- AI prompt uses strict numbered rules (not soft guidelines)
- Code enforces duration constraints even if AI ignores them
- Fallback logic also defaults to 30 minutes

### AI Prompt Engineering for Automated Tasks

**Problem**: When using AI (Gemini) for automated decisions, soft guidelines like "prefer deep watering" and "try to water 2x per week" are often ignored. The AI would water daily for 20-25 minutes instead of following the intended philosophy.

**Solution**: Use explicit, numbered rules with strict language:

1. **Numbered rules**: "RULE 1", "RULE 2", etc. make rules harder to ignore
2. **Explicit constraints**: "MUST be between 30-60 minutes" not "aim for 30-45 minutes"
3. **Negative examples**: "Short waterings create shallow roots - this is BAD"
4. **Provide concrete data**: Pass in "waterings this week: 3" so AI has facts to work with
5. **Multiple skip conditions**: List all reasons to NOT water, not just when TO water
6. **Code enforcement**: Always enforce constraints in code even if AI returns wrong values:
   ```typescript
   if (decision.shouldWater && decision.durationMinutes < MIN_WATERING_DURATION) {
     decision.durationMinutes = MIN_WATERING_DURATION;
   }
   ```

**Before** (soft guidelines - AI ignored):
```
- ALWAYS water deeply (30-45 minutes) rather than short frequent waterings
- Goal: Water thoroughly only 2 times per week maximum
```

**After** (strict rules - AI follows):
```
RULE 1 - WATERING FREQUENCY: Water ONLY 2-3 times per week, NOT daily.
- If already watered 3+ times this week, DO NOT WATER unless soil is critically dry (<20%)

RULE 2 - DURATION: If watering, MUST be between 30-60 minutes.
- NEVER suggest less than 30 minutes
```

---

## Security

### PIN Lock

The app is protected with a 6-digit PIN:
- PIN stored in component (for personal use)
- "Remember browser" saves auth to localStorage
- Checking auth shows loading spinner to prevent flash

### Cron Endpoint Protection

Cron endpoints verify Bearer token:
```typescript
const authHeader = request.headers.get("authorization");
const isValid = authHeader === `Bearer ${process.env.CRON_SECRET}`;
```

---

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy (auto-deploys on push to main)

### Manual Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

---

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## Roadmap

### Completed
- [x] Next.js 16 + Tailwind CSS setup
- [x] Modern bento box dashboard design
- [x] Left sidebar with collapsible navigation
- [x] Mobile responsive with slide-out menu
- [x] Tuya API integration for device control
- [x] Real-time device status monitoring
- [x] Property map with interactive zones
- [x] Zone detail popup with controls
- [x] Open-Meteo weather integration
- [x] 7-day forecast display
- [x] Rainfall tracking and recommendations
- [x] Supabase watering history database
- [x] Statistics and activity feed
- [x] Gemini AI garden assistant
- [x] PWA manifest for home screen install
- [x] Deploy to Vercel
- [x] Zigbee soil moisture sensor integration
- [x] Automated AI-powered watering
- [x] Cron job setup with cron-job.org
- [x] PIN lock with remember browser
- [x] Time-restricted watering (6 AM - 10 PM)
- [x] Deep watering philosophy (30-60 min sessions, 2-3x/week max)
- [x] AI prompt engineering with strict rules for reliable automation

### Planned
- [ ] Push notifications for watering events
- [ ] Multiple zone support (front, back, sides)
- [ ] Water usage tracking/estimation
- [ ] Historical charts and graphs
- [ ] Dark mode support
- [ ] Offline PWA support with sync

---

## Contributing

This is a personal project for home automation. Feel free to fork and adapt for your own garden!

## License

MIT

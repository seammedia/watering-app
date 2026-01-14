# The Water App - Smart Garden

A self-hosted smart garden watering control system built with Next.js and deployed on Vercel. Features a modern bento-box dashboard design, AI-powered garden assistant, weather integration, and watering history tracking.

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
- **Statistics Cards** - Weekly events, total watering time
- **Recent Activity Feed** - Latest watering events

### Pages
- **Dashboard** - Main control center with bento grid layout
- **Garden AI** - Chat with Gemini-powered garden assistant
- **Weather** - 7-day forecast with detailed conditions
- **Rainfall** - Precipitation tracking and watering recommendations
- **History** - Complete watering event log with statistics
- **Soil** - Soil sensor integration (coming soon)

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
| **Hardware** | Zigbee smart water tap (SmartLife/Tuya) |

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
│   │       ├── device/
│   │       │   └── [deviceId]/
│   │       │       └── route.ts        # Tuya device control
│   │       ├── history/
│   │       │   └── route.ts            # Watering history from Supabase
│   │       └── weather/
│   │           └── route.ts            # Open-Meteo weather API
│   └── lib/
│       ├── tuya.ts                     # Tuya API client with HMAC auth
│       └── supabase.ts                 # Supabase client
├── public/
│   ├── logo.png                        # App logo (water drop + gear)
│   ├── property-map.png                # Property satellite image
│   └── manifest.json                   # PWA manifest
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

# Google Gemini (AI Chat)
GEMINI_API_KEY=your_gemini_api_key
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
  trigger TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Insert Initial Zone

```sql
INSERT INTO zones (id, device_id, name, plant_type, plant_date)
VALUES ('zone-1', 'bf9d467329b87e8748kbam', 'Front Right Garden Hedges', 'Leighton Greens', '2025-12-13');
```

---

## API Integrations

### 1. Tuya Cloud API (Device Control)

Controls Zigbee smart water taps via Tuya's REST API.

**Authentication**: HMAC-SHA256 signature-based
- Get access token: `GET /v1.0/token?grant_type=1`
- Sign requests with: `client_id + access_token + timestamp + stringToSign`

**Endpoints Used**:
- `GET /v1.0/devices/{device_id}` - Get device status
- `POST /v1.0/devices/{device_id}/commands` - Send commands

**Command Format**:
```json
{
  "commands": [{ "code": "switch", "value": true }]
}
```

### 2. Open-Meteo API (Weather)

Free weather API - no API key required.

**Endpoint**: `https://api.open-meteo.com/v1/forecast`

**Parameters**:
```
latitude=-38.1833
longitude=145.1000
current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m
hourly=precipitation
daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max
past_days=7
forecast_days=7
timezone=Australia/Melbourne
```

**Features**:
- Current conditions (temp, humidity, wind, precipitation)
- 7-day forecast with precipitation probability
- Last 7 days rainfall totals
- Weather code to description mapping
- Smart watering recommendations based on recent rainfall

### 3. Google Gemini API (AI Chat)

Garden assistant powered by Gemini 2.0 Flash.

**Endpoint**: Google Generative AI SDK

**System Prompt Context**:
- Garden location (Mount Eliza, Victoria, Australia)
- Zone information (plant types, dates)
- Current weather conditions
- Recent watering history
- Watering statistics

**Example Queries**:
- "When did I last water?"
- "Should I water today?"
- "Care tips for Leighton Greens"
- "How much rain have we had?"

### 4. Supabase (Database)

PostgreSQL database for watering history.

**Features**:
- Tracks watering events (start, end, duration)
- Stores zone configuration
- Calculates statistics (total events, avg duration, weekly count)
- Real-time last watered timestamps

---

## UI/UX Design

### Design Principles
- **Bento Grid Layout** - Asymmetric card grid like modern dashboards
- **Warm Color Palette** - Cream background (#f5f0e8), earth tones
- **Soft Shadows** - Subtle depth with colored shadow glows
- **Extra Rounded Corners** - `rounded-3xl` and `rounded-2xl` throughout
- **Gradient Buttons** - Blue/red gradients with shadow effects

### Color Scheme
```css
--background: #f5f0e8;        /* Warm cream */
--sidebar: #1a1a2e → #16213e; /* Dark gradient */
--status-online: #10b981;     /* Emerald */
--weather: #0ea5e9;           /* Sky blue */
--stats-beige: #e8d5c4;       /* Warm beige */
--stats-green: #d4e5d7;       /* Soft green */
```

### Responsive Breakpoints
- **Mobile**: < 768px - Single column, slide-out menu
- **Tablet**: 768px-1024px - 2 column grid
- **Desktop**: > 1024px - 4 column grid, fixed sidebar

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
| USA East | `https://openapi-ueaz.tuyaus.com` |
| Europe | `https://openapi.tuyaeu.com` |
| India | `https://openapi.tuyain.com` |
| China | `https://openapi.tuyacn.com` |

### Weather Code Mapping

```typescript
const weatherDescriptions: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
};
```

### Watering Recommendation Logic

```typescript
// Recommend watering if:
// - No rain in last 24h AND no rain forecast AND last 7 days < 10mm
// - OR last 7 days < 5mm (very dry)

// Skip watering if:
// - Rain in last 24h > 5mm
// - OR rain forecast > 50% with > 5mm expected
// - OR last 7 days > 25mm
```

### Mobile Sidebar Pattern

```tsx
// State for mobile menu
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// Sidebar classes for slide-in effect
<aside className={`
  fixed lg:relative h-full z-50
  transition-all duration-300
  ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
  lg:translate-x-0
`}>
```

### Supabase Event Tracking

```typescript
// Start watering - create event
const { data } = await supabase
  .from('watering_events')
  .insert({ zone_id, started_at: new Date().toISOString(), trigger: 'manual' })
  .select()
  .single();

// Stop watering - update event with end time
await supabase
  .from('watering_events')
  .update({
    ended_at: new Date().toISOString(),
    duration_seconds: Math.floor((endTime - startTime) / 1000)
  })
  .eq('id', eventId);
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

### Planned
- [ ] Zigbee soil moisture sensor integration
- [ ] Automated watering schedules/timers
- [ ] Push notifications for watering reminders
- [ ] Multiple zone support (front, back, sides)
- [ ] Water usage tracking/estimation
- [ ] Historical charts and graphs
- [ ] Dark mode support
- [ ] Offline PWA support with sync

---

## Hardware

### Current Setup
- **Device**: ZigBee Smart Water Tap (Tuya-compatible)
- **Connection**: SmartLife app → Tuya Cloud
- **Zone**: Front Right Garden Hedges
- **Plants**: Leighton Green hedges (planted Dec 2025)

### Device Info
- **Device ID**: `bf9d467329b87e8748kbam`
- **Control Code**: `switch` (boolean on/off)
- **Status Refresh**: Every 30 seconds

### Planned Additions
- ZigBee Soil Moisture Sensors
- Additional water taps for multiple zones
- Flow meter for water usage tracking

---

## Contributing

This is a personal project for home automation. Feel free to fork and adapt for your own garden!

## License

MIT

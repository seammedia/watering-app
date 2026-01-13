# Smart Watering App

A self-hosted smart garden watering control system built with Next.js and deployed on Vercel.

**Live App**: [watering-app.vercel.app](https://watering-app.vercel.app)

## Project Overview

This app controls Zigbee-based smart water taps (currently managed via SmartLife) through the Tuya Developer API. It provides a mobile-friendly dashboard for:

- Manual watering control (on/off toggle)
- Real-time device status monitoring
- Property map with zone visualization
- Soil moisture monitoring (future: Zigbee soil sensors)
- Automated watering based on soil conditions (planned)

## Tech Stack

- **Frontend**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (auto-deploy from GitHub)
- **API Integration**: Tuya Cloud API
- **Hardware**: Zigbee smart water tap (SmartLife/Tuya compatible)

## Current Features

- **Dashboard**: Mobile-first responsive design
- **Quick Actions**: Water All / Stop All buttons
- **Zone Control**: Toggle individual watering zones on/off
- **Property Map**: Visual overview of garden zones
- **Real-time Status**: Auto-refresh every 30 seconds
- **Connection Indicator**: Shows online/offline status
- **Navigation Menu**: Home, Soil, Rain, History pages (hamburger menu)

---

## Tuya Developer API Setup

### Step 1: Create Tuya Developer Account

1. Go to [Tuya IoT Platform](https://iot.tuya.com/)
2. Sign up for a developer account
3. Verify your email

### Step 2: Create a Cloud Project

1. Navigate to **Cloud** > **Development** > **Create Cloud Project**
2. Fill in:
   - **Project Name**: e.g., "Smart Watering App"
   - **Industry**: Smart Home
   - **Development Method**: Smart Home
   - **Data Center**: **CRITICAL** - Must match your SmartLife app region!

### Step 3: Find Your SmartLife Data Center

Your SmartLife account is registered to a specific data center. To find it:

1. Open **SmartLife app** on your phone
2. Go to **Me** > **Settings** > **Account and Security**
3. Look for region/data center info

**Common mappings:**
- Australia → Often "Central Europe" or "Western America"
- USA → "Western America" or "Eastern America"
- Europe → "Western Europe" or "Central Europe"
- Asia → "China" or "India"

> **Important**: If data centers don't match, you'll get error `28841107: "No permission. The data center is suspended"` when trying to link accounts.

### Step 4: Link Your SmartLife Account

1. In your cloud project, go to **Devices** tab
2. Click **Add App Account** > **Tuya App Account Authorization**
3. A QR code appears
4. In SmartLife app: **Me** > tap scan icon (top right) > scan QR
5. Choose **Automatic Link** to link all devices
6. Your devices should now appear in the Device List

### Step 5: Subscribe to APIs

Go to **Service API** tab and subscribe to:
- **IoT Core**
- **Authorization Token Management**
- **Smart Home Basic Service**

### Step 6: Get Your Credentials

From the **Overview** tab, note down:
- **Access ID/Client ID**
- **Access Secret/Client Secret**
- **Data Center** (to determine API endpoint)

---

## Environment Variables

### Local Development

Create `.env.local` (never commit this):

```env
TUYA_ACCESS_ID=your_access_id
TUYA_ACCESS_SECRET=your_access_secret
TUYA_API_ENDPOINT=https://openapi.tuyaeu.com
```

### Vercel Deployment

Add these in Vercel Dashboard > Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `TUYA_ACCESS_ID` | Your Client ID from Tuya |
| `TUYA_ACCESS_SECRET` | Your Client Secret from Tuya |
| `TUYA_API_ENDPOINT` | API endpoint matching your data center |

### API Endpoints by Data Center

| Data Center | API Endpoint |
|-------------|--------------|
| China | `https://openapi.tuyacn.com` |
| Western America | `https://openapi.tuyaus.com` |
| Eastern America | `https://openapi-ueaz.tuyaus.com` |
| Central Europe | `https://openapi.tuyaeu.com` |
| Western Europe | `https://openapi.tuyaeu.com` |
| India | `https://openapi.tuyain.com` |

---

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy (auto-deploys on push to main)

---

## Project Structure

```
watering-app/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard home
│   │   ├── layout.tsx            # Root layout with PWA meta
│   │   ├── globals.css           # Global styles
│   │   └── api/
│   │       └── device/
│   │           └── [deviceId]/
│   │               └── route.ts  # Device control API
│   └── lib/
│       └── tuya.ts               # Tuya API client
├── public/
│   ├── property-map.png          # Property satellite image
│   └── manifest.json             # PWA manifest
└── .env.local                    # Local environment (not committed)
```

---

## Learnings & Notes

### Zigbee & Tuya Ecosystem

- SmartLife app uses Tuya's cloud platform under the hood
- Zigbee devices connect to a Tuya-compatible gateway/hub
- All device control goes through Tuya Cloud API (no direct Zigbee control from app)
- Device states and controls are accessed via Tuya's REST API
- Device ID format: `bf9d467329b87e8748kbam` (24 characters)

### Tuya API Authentication

Tuya uses HMAC-SHA256 signature-based authentication:

1. **Get Access Token**: `GET /v1.0/token?grant_type=1`
   - Sign with: `client_id + timestamp + stringToSign`

2. **API Requests**: Include access token
   - Sign with: `client_id + access_token + timestamp + stringToSign`

3. **String to Sign Format**:
   ```
   HTTP_METHOD\n
   Content-SHA256\n
   \n
   URL_PATH
   ```

4. **Required Headers**:
   - `client_id`: Your Access ID
   - `access_token`: Token from step 1 (for API calls)
   - `sign`: HMAC-SHA256 signature (uppercase hex)
   - `t`: Unix timestamp in milliseconds
   - `sign_method`: "HMAC-SHA256"

### Device Control

- Devices identified by unique `device_id`
- Each device has "data points" (DPs/status codes)
- Water tap uses: `switch` (boolean) for on/off
- Send commands via: `POST /v1.0/devices/{device_id}/commands`
- Command format: `{ "commands": [{ "code": "switch", "value": true }] }`

### Common Errors & Solutions

| Error Code | Message | Solution |
|------------|---------|----------|
| 1004 | sign invalid | Check signature generation, verify secret |
| 1106 | permission deny | Subscribe to required APIs in Service API tab |
| 28841107 | data center is suspended | API endpoint doesn't match project data center |
| 2017 | token invalid | Token expired, refresh token |

### Data Center Mismatch Issue

**Symptom**: SmartLife account won't link, or API returns "data center suspended"

**Cause**: Your Tuya Cloud Project data center doesn't match your SmartLife account's region

**Solution**:
1. Check SmartLife account region in app settings
2. Create new Cloud Project in matching data center
3. Or verify API endpoint matches project data center

### Future: Soil Sensors

- Zigbee soil moisture sensors report via same Tuya API
- Typical data points: `humidity_value` (moisture %), `temp_current` (temperature)
- Can query status same way as water tap
- Plan to add automation rules based on moisture readings

---

## Roadmap

- [x] Project setup with Next.js + Tailwind
- [x] Basic dashboard UI (mobile-first)
- [x] Property map with zone legend
- [x] Navigation menu (Home, Soil, Rain, History)
- [x] Tuya API integration
- [x] Manual water control (on/off)
- [x] Real-time device status
- [x] Deploy to Vercel
- [ ] Soil sensor integration
- [ ] Watering schedules/timers
- [ ] Weather API integration (Rain page)
- [ ] Watering history logging
- [ ] Automated watering rules
- [ ] Multiple zone support
- [ ] PWA offline support

---

## Hardware

**Current Setup:**
- ZigBee Smart Water Tap (Tuya-compatible)
- Connected via SmartLife app
- Device: "Front Tap" - `bf9d467329b87e8748kbam`

**Planned Additions:**
- ZigBee Soil Moisture Sensors
- Additional water taps for multiple zones

---

## Contributing

This is a personal project for home automation. Feel free to fork and adapt for your own use.

## License

MIT

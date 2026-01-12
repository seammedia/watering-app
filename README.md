# Smart Watering App

A self-hosted smart garden watering control system built with Next.js and deployed on Vercel.

## Project Overview

This app controls Zigbee-based smart water taps (currently managed via SmartLife) through the Tuya Developer API. It provides a mobile-friendly dashboard for:

- Manual watering control
- Scheduled watering
- Soil moisture monitoring (future: Zigbee soil sensors)
- Automated watering based on soil conditions

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Hosting**: Vercel
- **API Integration**: Tuya Cloud API
- **Hardware**: Zigbee smart water tap (SmartLife/Tuya compatible)

## Tuya Developer API Setup

### Prerequisites

1. **Create Tuya Developer Account**
   - Go to [Tuya IoT Platform](https://iot.tuya.com/)
   - Sign up for a developer account
   - Verify your email

2. **Create a Cloud Project**
   - Navigate to "Cloud" > "Development" > "Create Cloud Project"
   - Select "Smart Home" as the industry
   - Choose your data center region (match your SmartLife app region)
   - Note down your `Access ID` and `Access Secret`

3. **Link Your Tuya/SmartLife Account**
   - In your cloud project, go to "Devices" > "Link Tuya App Account"
   - Use the SmartLife app to scan the QR code
   - This links your physical devices to the API

4. **Subscribe to Required APIs**
   - Go to "Cloud" > "API Explorer"
   - Subscribe to:
     - Smart Home Device Management
     - Smart Home Family Management
     - Device Control

### Environment Variables

Create a `.env.local` file (never commit this):

```env
TUYA_ACCESS_ID=your_access_id
TUYA_ACCESS_SECRET=your_access_secret
TUYA_API_ENDPOINT=https://openapi.tuyaeu.com  # EU region, adjust for your region
```

**API Endpoints by Region:**
- China: `https://openapi.tuyacn.com`
- Western America: `https://openapi.tuyaus.com`
- Eastern America: `https://openapi-ueaz.tuyaus.com`
- Europe: `https://openapi.tuyaeu.com`
- India: `https://openapi.tuyain.com`

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Deployment

This app is deployed via Vercel:

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Project Structure

```
watering-app/
├── app/
│   ├── page.tsx          # Dashboard home
│   ├── layout.tsx        # Root layout
│   └── api/
│       └── tuya/         # Tuya API routes
├── components/
│   └── ...               # UI components
├── lib/
│   └── tuya.ts           # Tuya API client
└── public/
    └── ...               # Static assets
```

## Learnings & Notes

### Zigbee & Tuya Ecosystem

- SmartLife app uses Tuya's cloud platform under the hood
- Zigbee devices connect to a Tuya-compatible hub/gateway
- All device control goes through Tuya Cloud API (no direct Zigbee control)
- Device states and controls are accessed via Tuya's REST API

### API Authentication

- Tuya uses HMAC-SHA256 signature-based authentication
- Each request requires a timestamp, nonce, and signature
- Access tokens expire and need refresh logic

### Device Control

- Devices are identified by `device_id`
- Each device has "data points" (DPs) that control functions
- Water tap typically has: on/off (DP 1), timer settings, etc.

### Future: Soil Sensors

- Zigbee soil moisture sensors will report via same Tuya API
- Typical data points: moisture %, temperature
- Can set automation rules based on readings

---

## Roadmap

- [x] Project setup
- [ ] Basic dashboard UI
- [ ] Tuya API integration
- [ ] Manual water control
- [ ] Watering schedules
- [ ] Soil sensor integration
- [ ] Automated watering rules
- [ ] PWA support for mobile

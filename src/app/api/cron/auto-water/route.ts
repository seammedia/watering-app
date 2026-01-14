import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDeviceStatus, turnOnDevice } from "@/lib/tuya";
import {
  startScheduledWatering,
  hasActiveAutomatedWatering,
  logSoilReading,
  getWateringHistory,
  getLastWateredForZones,
} from "@/lib/supabase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SOIL_SENSOR_DEVICE_ID = "bf455b6fdac1b8d5b9kagj";
const FRONT_TAP_DEVICE_ID = "bf9d467329b87e8748kbam";
const ZONE_ID = "zone-1";
const ZONE_NAME = "Front Right Garden Hedges";

// Watering constraints
const MAX_WATERING_DURATION = 45; // Never water longer than this
const MIN_WATERING_DURATION = 10; // Minimum watering time if needed

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("CRON_SECRET not set - allowing request without auth");
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

interface WateringDecision {
  shouldWater: boolean;
  durationMinutes: number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

async function getAIWateringDecision(
  moisture: number,
  temperature: number | null,
  weatherData: unknown,
  lastWateredDaysAgo: number | null,
  recentHistory: unknown[]
): Promise<WateringDecision> {
  if (!process.env.GEMINI_API_KEY) {
    // Fallback to simple logic if no API key
    const shouldWater = moisture < 35;
    return {
      shouldWater,
      durationMinutes: shouldWater ? 30 : 0,
      reason: "Gemini API not configured - using fallback threshold of 35%",
      confidence: "low",
    };
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
  });

  const prompt = `You are an expert gardener analyzing soil moisture data for automated watering.

PLANT INFORMATION:
- Plant: Leighton Green hedges (Cupressocyparis leylandii)
- Location: Mount Eliza, Victoria, Australia
- Planted: 13/12/2025 (about 1 month old - still establishing)
- Zone: Front Right Garden Hedges

CURRENT CONDITIONS:
- Soil Moisture: ${moisture}%
- Soil Temperature: ${temperature !== null ? `${temperature}°C` : "Unknown"}
- Last Watered: ${lastWateredDaysAgo !== null ? `${lastWateredDaysAgo} days ago` : "Unknown"}

WEATHER DATA:
${JSON.stringify(weatherData, null, 2)}

RECENT WATERING HISTORY (last 5 events):
${JSON.stringify(recentHistory.slice(0, 5), null, 2)}

WATERING GUIDELINES FOR YOUNG LEIGHTON GREENS:
- Optimal soil moisture for newly planted hedges: 30-40%
- Below 25%: Soil is too dry, needs immediate watering
- 25-35%: Getting dry, consider watering
- 35-45%: Good moisture level
- Above 45%: Well hydrated, no watering needed
- Young plants (under 6 months) need consistent moisture to establish roots
- Water deeply but not too frequently to encourage deep root growth

CONSTRAINTS:
- Maximum watering duration: ${MAX_WATERING_DURATION} minutes
- Minimum watering duration: ${MIN_WATERING_DURATION} minutes
- Consider recent rainfall - don't water if significant rain recently
- Consider forecast - don't water if heavy rain expected soon

Based on all this information, should the automated system water now?

Respond in JSON format only:
{
  "shouldWater": true/false,
  "durationMinutes": number (0 if not watering, ${MIN_WATERING_DURATION}-${MAX_WATERING_DURATION} if watering),
  "reason": "Brief explanation of your decision",
  "confidence": "high/medium/low"
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const decision = JSON.parse(jsonMatch[0]) as WateringDecision;

    // Enforce constraints
    if (decision.durationMinutes > MAX_WATERING_DURATION) {
      decision.durationMinutes = MAX_WATERING_DURATION;
    }
    if (decision.shouldWater && decision.durationMinutes < MIN_WATERING_DURATION) {
      decision.durationMinutes = MIN_WATERING_DURATION;
    }

    return decision;
  } catch (error) {
    console.error("Gemini API error:", error);
    // Fallback logic
    const shouldWater = moisture < 30;
    return {
      shouldWater,
      durationMinutes: shouldWater ? 30 : 0,
      reason: `AI analysis failed, using fallback: moisture ${moisture}% ${shouldWater ? "below" : "above"} 30% threshold`,
      confidence: "low",
    };
  }
}

async function fetchWeatherData(): Promise<unknown> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/weather`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Failed to fetch weather:", error);
  }
  return null;
}

// Check if current time is within allowed watering hours (6 AM - 10 PM Melbourne time)
function isWithinWateringHours(): { allowed: boolean; currentHour: number } {
  const now = new Date();
  // Convert to Melbourne time
  const melbourneTime = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const currentHour = melbourneTime.getHours();

  // Allow watering between 6 AM (6) and 10 PM (22)
  const allowed = currentHour >= 6 && currentHour < 22;
  return { allowed, currentHour };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (message: string) => {
    console.log(`[auto-water] ${message}`);
    logs.push(`${new Date().toISOString()} - ${message}`);
  };

  try {
    // Check if within allowed watering hours
    const { allowed, currentHour } = isWithinWateringHours();
    if (!allowed) {
      log(`Outside watering hours (current hour: ${currentHour}, allowed: 6 AM - 10 PM Melbourne time)`);
      return NextResponse.json({
        success: true,
        action: "skipped",
        reason: `Outside watering hours (${currentHour}:00). Watering only allowed 6 AM - 10 PM.`,
        currentHour,
        logs,
      });
    }

    log(`Within watering hours (${currentHour}:00 Melbourne time)`);
    log("Starting AI-powered moisture check");

    // Check if watering is already in progress
    const isWatering = await hasActiveAutomatedWatering(ZONE_ID);
    if (isWatering) {
      log("Watering already in progress, skipping");
      return NextResponse.json({
        success: true,
        action: "skipped",
        reason: "Watering already in progress",
        logs,
      });
    }

    // Get soil moisture level
    const { device: sensorDevice, error: sensorError } = await getDeviceStatus(SOIL_SENSOR_DEVICE_ID);

    if (sensorError || !sensorDevice) {
      log(`Failed to get soil sensor status: ${sensorError}`);
      return NextResponse.json({
        success: false,
        error: "Failed to read soil sensor",
        details: sensorError,
        logs,
      }, { status: 500 });
    }

    // Parse moisture value from sensor
    const getStatusValue = (codes: string[]): number | null => {
      for (const code of codes) {
        const status = sensorDevice.status.find((s) => s.code === code);
        if (status !== undefined && status.value !== undefined) {
          return typeof status.value === "number" ? status.value : Number(status.value);
        }
      }
      return null;
    };

    const moisture = getStatusValue(["humidity", "soil_humidity", "humidity_value", "moisture"]);
    const temperatureRaw = getStatusValue(["temp_current", "temperature", "temp_value"]);
    const temperature = temperatureRaw !== null ? temperatureRaw / 10 : null;

    log(`Current moisture: ${moisture}%, temperature: ${temperature !== null ? temperature + "°C" : "N/A"}`);

    if (moisture === null) {
      log("Could not read moisture level");
      return NextResponse.json({
        success: false,
        error: "Could not read moisture level",
        logs,
      }, { status: 500 });
    }

    // Log the soil reading to database
    await logSoilReading(ZONE_ID, moisture, temperature ?? undefined);

    // Gather context for AI decision
    const [weatherData, history, lastWateredMap] = await Promise.all([
      fetchWeatherData(),
      getWateringHistory(10, ZONE_ID),
      getLastWateredForZones(),
    ]);

    // Calculate days since last watered
    let lastWateredDaysAgo: number | null = null;
    const lastWatered = lastWateredMap[ZONE_ID];
    if (lastWatered) {
      const lastDate = new Date(lastWatered);
      lastWateredDaysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    log(`Last watered: ${lastWateredDaysAgo !== null ? lastWateredDaysAgo + " days ago" : "unknown"}`);

    // Get AI decision
    log("Consulting Gemini AI for watering decision...");
    const decision = await getAIWateringDecision(
      moisture,
      temperature,
      weatherData,
      lastWateredDaysAgo,
      history
    );

    log(`AI Decision: shouldWater=${decision.shouldWater}, duration=${decision.durationMinutes}min, confidence=${decision.confidence}`);
    log(`AI Reason: ${decision.reason}`);

    if (!decision.shouldWater) {
      return NextResponse.json({
        success: true,
        action: "none",
        moisture,
        temperature,
        aiDecision: decision,
        logs,
      });
    }

    // Check if the tap is online
    const { device: tapDevice, error: tapError } = await getDeviceStatus(FRONT_TAP_DEVICE_ID);
    if (tapError || !tapDevice || !tapDevice.online) {
      log(`Front tap is offline or unavailable: ${tapError}`);
      return NextResponse.json({
        success: false,
        error: "Front tap is offline",
        details: tapError,
        aiDecision: decision,
        logs,
      }, { status: 500 });
    }

    // Turn on the water
    log(`Turning on water for ${decision.durationMinutes} minutes`);
    const turnOnResult = await turnOnDevice(FRONT_TAP_DEVICE_ID);

    if (!turnOnResult.success) {
      log(`Failed to turn on water: ${turnOnResult.error}`);
      return NextResponse.json({
        success: false,
        error: "Failed to turn on water",
        details: turnOnResult.error,
        aiDecision: decision,
        logs,
      }, { status: 500 });
    }

    // Log the scheduled watering to database
    const eventId = await startScheduledWatering(ZONE_ID, ZONE_NAME, FRONT_TAP_DEVICE_ID, decision.durationMinutes);
    log(`Watering started, event ID: ${eventId}, scheduled to stop in ${decision.durationMinutes} minutes`);

    return NextResponse.json({
      success: true,
      action: "started",
      moisture,
      temperature,
      aiDecision: decision,
      eventId,
      scheduledEndTime: new Date(Date.now() + decision.durationMinutes * 60 * 1000).toISOString(),
      logs,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`Error: ${errorMessage}`);
    return NextResponse.json({
      success: false,
      error: errorMessage,
      logs,
    }, { status: 500 });
  }
}

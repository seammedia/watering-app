import { NextResponse } from "next/server";
import { getDeviceStatus, turnOnDevice } from "@/lib/tuya";
import {
  startScheduledWatering,
  hasActiveAutomatedWatering,
  logSoilReading,
} from "@/lib/supabase";

const SOIL_SENSOR_DEVICE_ID = "bf455b6fdac1b8d5b9kagj";
const FRONT_TAP_DEVICE_ID = "bf9d467329b87e8748kbam";
const ZONE_ID = "zone-1";
const ZONE_NAME = "Front Right Garden Hedges";

// Moisture thresholds
const OPTIMAL_MOISTURE = 50; // Above this = no watering needed
const VERY_DRY_MOISTURE = 25; // Below this = longer watering needed

// Watering durations (in minutes)
const DEFAULT_WATERING_DURATION = 30;
const MAX_WATERING_DURATION = 45;

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If no CRON_SECRET is set, allow the request (for testing)
  if (!cronSecret) {
    console.warn("CRON_SECRET not set - allowing request without auth");
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (message: string) => {
    console.log(`[auto-water] ${message}`);
    logs.push(`${new Date().toISOString()} - ${message}`);
  };

  try {
    log("Starting automated moisture check");

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
    const temperature = getStatusValue(["temp_current", "temperature", "temp_value"]);

    log(`Current moisture: ${moisture}%, temperature: ${temperature !== null ? temperature / 10 : 'N/A'}°C`);

    // Log the soil reading to database
    if (moisture !== null) {
      await logSoilReading(ZONE_ID, moisture, temperature !== null ? temperature / 10 : undefined);
    }

    // Check if watering is needed
    if (moisture === null) {
      log("Could not read moisture level");
      return NextResponse.json({
        success: false,
        error: "Could not read moisture level",
        logs,
      }, { status: 500 });
    }

    if (moisture >= OPTIMAL_MOISTURE) {
      log(`Moisture ${moisture}% is at or above optimal (${OPTIMAL_MOISTURE}%), no watering needed`);
      return NextResponse.json({
        success: true,
        action: "none",
        reason: `Moisture ${moisture}% is optimal`,
        moisture,
        logs,
      });
    }

    // Determine watering duration based on how dry the soil is
    let duration = DEFAULT_WATERING_DURATION;
    if (moisture < VERY_DRY_MOISTURE) {
      // Very dry - use maximum duration
      duration = MAX_WATERING_DURATION;
      log(`Soil is very dry (${moisture}%), using maximum duration of ${duration} minutes`);
    } else {
      // Moderately dry - use default duration
      log(`Soil is moderately dry (${moisture}%), using default duration of ${duration} minutes`);
    }

    // Check if the tap is online
    const { device: tapDevice, error: tapError } = await getDeviceStatus(FRONT_TAP_DEVICE_ID);
    if (tapError || !tapDevice || !tapDevice.online) {
      log(`Front tap is offline or unavailable: ${tapError}`);
      return NextResponse.json({
        success: false,
        error: "Front tap is offline",
        details: tapError,
        logs,
      }, { status: 500 });
    }

    // Turn on the water
    log(`Turning on water for ${duration} minutes`);
    const turnOnResult = await turnOnDevice(FRONT_TAP_DEVICE_ID);

    if (!turnOnResult.success) {
      log(`Failed to turn on water: ${turnOnResult.error}`);
      return NextResponse.json({
        success: false,
        error: "Failed to turn on water",
        details: turnOnResult.error,
        logs,
      }, { status: 500 });
    }

    // Log the scheduled watering to database
    const eventId = await startScheduledWatering(ZONE_ID, ZONE_NAME, FRONT_TAP_DEVICE_ID, duration);
    log(`Watering started, event ID: ${eventId}, scheduled to stop in ${duration} minutes`);

    return NextResponse.json({
      success: true,
      action: "started",
      moisture,
      duration,
      eventId,
      scheduledEndTime: new Date(Date.now() + duration * 60 * 1000).toISOString(),
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

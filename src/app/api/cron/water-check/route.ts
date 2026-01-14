import { NextResponse } from "next/server";
import { turnOffDevice } from "@/lib/tuya";
import { getWateringToStop, logWateringEnd } from "@/lib/supabase";

const FRONT_TAP_DEVICE_ID = "bf9d467329b87e8748kbam";

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
    console.log(`[water-check] ${message}`);
    logs.push(`${new Date().toISOString()} - ${message}`);
  };

  try {
    log("Checking for watering events to stop");

    // Get any active watering events that have passed their scheduled end time
    const eventsToStop = await getWateringToStop();

    if (eventsToStop.length === 0) {
      log("No watering events need to be stopped");
      return NextResponse.json({
        success: true,
        action: "none",
        reason: "No active watering to stop",
        logs,
      });
    }

    log(`Found ${eventsToStop.length} watering event(s) to stop`);

    let stoppedCount = 0;
    const errors: string[] = [];

    for (const event of eventsToStop) {
      log(`Stopping watering event ${event.id} (started: ${event.started_at}, scheduled end: ${event.scheduled_end_at})`);

      // Turn off the water tap
      const turnOffResult = await turnOffDevice(FRONT_TAP_DEVICE_ID);

      if (!turnOffResult.success) {
        const errorMsg = `Failed to turn off water for event ${event.id}: ${turnOffResult.error}`;
        log(errorMsg);
        errors.push(errorMsg);
        continue;
      }

      // Log the end of watering in database
      const logged = await logWateringEnd(event.id);
      if (logged) {
        log(`Successfully stopped and logged watering event ${event.id}`);
        stoppedCount++;
      } else {
        log(`Stopped watering but failed to log event ${event.id}`);
        stoppedCount++;
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      action: "stopped",
      stoppedCount,
      totalEvents: eventsToStop.length,
      errors: errors.length > 0 ? errors : undefined,
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

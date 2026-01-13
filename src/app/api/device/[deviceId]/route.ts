import { NextRequest, NextResponse } from "next/server";
import { getDeviceStatus, turnOnDevice, turnOffDevice } from "@/lib/tuya";
import { logWateringStart, logWateringEnd } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;

  try {
    const { device, error } = await getDeviceStatus(deviceId);

    if (error || !device) {
      return NextResponse.json(
        { error: error || "Failed to get device status" },
        { status: 500 }
      );
    }

    const isOn = device.status.find((s) => s.code === "switch")?.value ?? false;

    return NextResponse.json({
      id: device.id,
      name: device.name,
      online: device.online,
      isOn: isOn,
      status: device.status,
    });
  } catch (error) {
    console.error("Error fetching device:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;

  try {
    const body = await request.json();
    const { action, zoneId, zoneName, eventId } = body;

    let result: { success: boolean; error?: string };

    if (action === "on") {
      result = await turnOnDevice(deviceId);

      // Log watering start to database (fire and forget)
      if (result.success && zoneId && zoneName) {
        logWateringStart(zoneId, zoneName, deviceId, "manual").catch((err) =>
          console.error("Failed to log watering start:", err)
        );
      }
    } else if (action === "off") {
      result = await turnOffDevice(deviceId);

      // Log watering end to database (fire and forget)
      if (result.success && eventId) {
        logWateringEnd(eventId).catch((err) =>
          console.error("Failed to log watering end:", err)
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'on' or 'off'" },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to control device" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Error controlling device:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

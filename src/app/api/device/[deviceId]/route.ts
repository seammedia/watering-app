import { NextRequest, NextResponse } from "next/server";
import { getDeviceStatus, turnOnDevice, turnOffDevice } from "@/lib/tuya";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;

  try {
    const status = await getDeviceStatus(deviceId);

    if (!status) {
      return NextResponse.json(
        { error: "Failed to get device status" },
        { status: 500 }
      );
    }

    const isOn = status.status.find((s) => s.code === "switch")?.value ?? false;

    return NextResponse.json({
      id: status.id,
      name: status.name,
      online: status.online,
      isOn: isOn,
      status: status.status,
    });
  } catch (error) {
    console.error("Error fetching device:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
    const { action } = body;

    let success = false;

    if (action === "on") {
      success = await turnOnDevice(deviceId);
    } else if (action === "off") {
      success = await turnOffDevice(deviceId);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'on' or 'off'" },
        { status: 400 }
      );
    }

    if (!success) {
      return NextResponse.json(
        { error: "Failed to control device" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Error controlling device:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

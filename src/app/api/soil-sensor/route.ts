import { NextResponse } from "next/server";
import { getDeviceStatus } from "@/lib/tuya";

const SOIL_SENSOR_DEVICE_ID = "bf455b6fdac1b8d5b9kagj";

export interface SoilSensorData {
  id: string;
  name: string;
  online: boolean;
  moisture: number | null;
  temperature: number | null;
  battery: number | null;
  lastUpdated: string;
}

export async function GET() {
  try {
    const { device, error } = await getDeviceStatus(SOIL_SENSOR_DEVICE_ID);

    if (error || !device) {
      return NextResponse.json(
        { error: error || "Failed to get soil sensor status" },
        { status: 500 }
      );
    }

    // Parse the status values from the device
    // Common Tuya soil sensor codes: humidity/soil_humidity, temp_current/temperature, battery_percentage/battery_state
    const getStatusValue = (codes: string[]): number | null => {
      for (const code of codes) {
        const status = device.status.find((s) => s.code === code);
        if (status !== undefined && status.value !== undefined) {
          return typeof status.value === "number" ? status.value : Number(status.value);
        }
      }
      return null;
    };

    const moisture = getStatusValue(["humidity", "soil_humidity", "humidity_value", "moisture"]);
    const temperature = getStatusValue(["temp_current", "temperature", "temp_value"]);
    const battery = getStatusValue(["battery_percentage", "battery_state", "battery", "va_battery"]);

    const sensorData: SoilSensorData = {
      id: device.id,
      name: device.name,
      online: device.online,
      moisture,
      temperature: temperature !== null ? temperature / 10 : null, // Tuya often sends temp * 10
      battery,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(sensorData);
  } catch (error) {
    console.error("Error fetching soil sensor:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

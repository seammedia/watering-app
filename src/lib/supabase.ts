import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create client only if credentials are available
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = () => !!supabase;

// Types for our database tables
export interface Zone {
  id: string;
  device_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface WateringEvent {
  id: string;
  zone_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  trigger: "manual" | "scheduled" | "automated";
  weather_snapshot_id?: string;
  created_at: string;
}

export interface WeatherSnapshot {
  id: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  weather_code: number;
  weather_description: string;
  wind_speed: number;
  rainfall_last_24h: number;
  rainfall_last_7days: number;
  captured_at: string;
}

export interface SoilReading {
  id: string;
  zone_id: string;
  moisture_percent: number;
  temperature?: number;
  captured_at: string;
}

// Helper functions for database operations
export async function logWateringStart(
  zoneId: string,
  zoneName: string,
  deviceId: string,
  trigger: "manual" | "scheduled" | "automated" = "manual"
): Promise<string | null> {
  if (!supabase) {
    console.log("Supabase not configured, skipping watering log");
    return null;
  }

  // First ensure the zone exists
  const { error: zoneError } = await supabase
    .from("zones")
    .upsert({ id: zoneId, device_id: deviceId, name: zoneName }, { onConflict: "id" });

  if (zoneError) {
    console.error("Error upserting zone:", zoneError);
  }

  // Create watering event
  const { data, error } = await supabase
    .from("watering_events")
    .insert({
      zone_id: zoneId,
      started_at: new Date().toISOString(),
      trigger,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging watering start:", error);
    return null;
  }

  return data?.id || null;
}

export async function logWateringEnd(eventId: string): Promise<boolean> {
  if (!supabase) {
    console.log("Supabase not configured, skipping watering end log");
    return false;
  }

  const endedAt = new Date().toISOString();

  // Get the start time to calculate duration
  const { data: event } = await supabase
    .from("watering_events")
    .select("started_at")
    .eq("id", eventId)
    .single();

  if (!event) return false;

  const startTime = new Date(event.started_at).getTime();
  const endTime = new Date(endedAt).getTime();
  const durationSeconds = Math.round((endTime - startTime) / 1000);

  const { error } = await supabase
    .from("watering_events")
    .update({
      ended_at: endedAt,
      duration_seconds: durationSeconds,
    })
    .eq("id", eventId);

  if (error) {
    console.error("Error logging watering end:", error);
    return false;
  }

  return true;
}

export async function captureWeatherSnapshot(weatherData: {
  temperature: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeed: number;
  recentRainfall: { last24h: number; last7days: number };
}): Promise<string | null> {
  if (!supabase) {
    console.log("Supabase not configured, skipping weather snapshot");
    return null;
  }

  const { data, error } = await supabase
    .from("weather_snapshots")
    .insert({
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      precipitation: weatherData.precipitation,
      weather_code: weatherData.weatherCode,
      weather_description: weatherData.weatherDescription,
      wind_speed: weatherData.windSpeed,
      rainfall_last_24h: weatherData.recentRainfall.last24h,
      rainfall_last_7days: weatherData.recentRainfall.last7days,
      captured_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error capturing weather snapshot:", error);
    return null;
  }

  return data?.id || null;
}

export async function logSoilReading(
  zoneId: string,
  moisturePercent: number,
  temperature?: number
): Promise<boolean> {
  if (!supabase) {
    console.log("Supabase not configured, skipping soil reading");
    return false;
  }

  const { error } = await supabase.from("soil_readings").insert({
    zone_id: zoneId,
    moisture_percent: moisturePercent,
    temperature,
    captured_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error logging soil reading:", error);
    return false;
  }

  return true;
}

export async function getWateringHistory(
  limit: number = 50,
  zoneId?: string
): Promise<WateringEvent[]> {
  if (!supabase) {
    console.log("Supabase not configured");
    return [];
  }

  let query = supabase
    .from("watering_events")
    .select("*, zones(name)")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (zoneId) {
    query = query.eq("zone_id", zoneId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching watering history:", error);
    return [];
  }

  return data || [];
}

export async function getRecentWeatherSnapshots(
  limit: number = 10
): Promise<WeatherSnapshot[]> {
  if (!supabase) {
    console.log("Supabase not configured");
    return [];
  }

  const { data, error } = await supabase
    .from("weather_snapshots")
    .select("*")
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching weather snapshots:", error);
    return [];
  }

  return data || [];
}

export async function getSoilReadings(
  zoneId: string,
  limit: number = 100
): Promise<SoilReading[]> {
  if (!supabase) {
    console.log("Supabase not configured");
    return [];
  }

  const { data, error } = await supabase
    .from("soil_readings")
    .select("*")
    .eq("zone_id", zoneId)
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching soil readings:", error);
    return [];
  }

  return data || [];
}

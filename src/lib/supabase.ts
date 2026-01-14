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
  scheduled_end_at?: string;
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

export async function getLastWateredForZones(): Promise<Record<string, string>> {
  if (!supabase) {
    return {};
  }

  // Get the most recent completed watering event for each zone
  const { data, error } = await supabase
    .from("watering_events")
    .select("zone_id, ended_at")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false });

  if (error) {
    console.error("Error fetching last watered times:", error);
    return {};
  }

  // Build a map of zone_id -> last_watered timestamp (most recent first)
  const lastWatered: Record<string, string> = {};
  for (const event of data || []) {
    if (!lastWatered[event.zone_id] && event.ended_at) {
      lastWatered[event.zone_id] = event.ended_at;
    }
  }

  return lastWatered;
}

// Close stale watering events (started more than 4 hours ago without ending)
export async function closeStaleWateringEvents(): Promise<number> {
  if (!supabase) {
    return 0;
  }

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  // Find stale events
  const { data: staleEvents, error: findError } = await supabase
    .from("watering_events")
    .select("id, started_at")
    .is("ended_at", null)
    .lt("started_at", fourHoursAgo);

  if (findError || !staleEvents || staleEvents.length === 0) {
    return 0;
  }

  // Close each stale event with a reasonable duration estimate (assume 30 min)
  let closedCount = 0;
  for (const event of staleEvents) {
    const startTime = new Date(event.started_at).getTime();
    const estimatedEndTime = new Date(startTime + 30 * 60 * 1000); // 30 minutes after start
    const durationSeconds = 30 * 60; // 30 minutes

    const { error: updateError } = await supabase
      .from("watering_events")
      .update({
        ended_at: estimatedEndTime.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", event.id);

    if (!updateError) {
      closedCount++;
      console.log(`Auto-closed stale watering event ${event.id}`);
    }
  }

  return closedCount;
}

// Start automated watering with scheduled end time
export async function startScheduledWatering(
  zoneId: string,
  zoneName: string,
  deviceId: string,
  durationMinutes: number
): Promise<string | null> {
  if (!supabase) {
    console.log("Supabase not configured, skipping scheduled watering log");
    return null;
  }

  // First ensure the zone exists
  const { error: zoneError } = await supabase
    .from("zones")
    .upsert({ id: zoneId, device_id: deviceId, name: zoneName }, { onConflict: "id" });

  if (zoneError) {
    console.error("Error upserting zone:", zoneError);
  }

  const startedAt = new Date();
  const scheduledEndAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

  // Create watering event with scheduled end time
  const { data, error } = await supabase
    .from("watering_events")
    .insert({
      zone_id: zoneId,
      started_at: startedAt.toISOString(),
      scheduled_end_at: scheduledEndAt.toISOString(),
      trigger: "automated",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging scheduled watering start:", error);
    return null;
  }

  return data?.id || null;
}

// Get active watering events that should be stopped
export async function getWateringToStop(): Promise<Array<{
  id: string;
  zone_id: string;
  started_at: string;
  scheduled_end_at: string;
}>> {
  if (!supabase) {
    return [];
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("watering_events")
    .select("id, zone_id, started_at, scheduled_end_at")
    .is("ended_at", null)
    .not("scheduled_end_at", "is", null)
    .lt("scheduled_end_at", now);

  if (error) {
    console.error("Error fetching watering to stop:", error);
    return [];
  }

  return data || [];
}

// Check if there's any active automated watering
export async function hasActiveAutomatedWatering(zoneId: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("watering_events")
    .select("id")
    .eq("zone_id", zoneId)
    .is("ended_at", null)
    .limit(1);

  if (error) {
    console.error("Error checking active watering:", error);
    return false;
  }

  return (data?.length || 0) > 0;
}

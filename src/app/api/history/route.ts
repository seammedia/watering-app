import { NextResponse } from "next/server";
import { getWateringHistory, getRecentWeatherSnapshots, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const zoneId = searchParams.get("zoneId") || undefined;

    const [wateringEvents, weatherSnapshots] = await Promise.all([
      getWateringHistory(limit, zoneId),
      getRecentWeatherSnapshots(10),
    ]);

    // Calculate statistics
    const totalEvents = wateringEvents.length;
    const totalDuration = wateringEvents.reduce(
      (sum, event) => sum + (event.duration_seconds || 0),
      0
    );
    const avgDuration = totalEvents > 0 ? Math.round(totalDuration / totalEvents) : 0;

    // Get events from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentEvents = wateringEvents.filter(
      (e) => new Date(e.started_at) >= sevenDaysAgo
    );

    return NextResponse.json({
      events: wateringEvents,
      weatherSnapshots,
      stats: {
        totalEvents,
        totalDurationSeconds: totalDuration,
        averageDurationSeconds: avgDuration,
        eventsLast7Days: recentEvents.length,
      },
    });
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

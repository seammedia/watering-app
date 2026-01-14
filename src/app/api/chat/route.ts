import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getWateringHistory, getLastWateredForZones, isSupabaseConfigured } from "@/lib/supabase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function getSystemContext(): Promise<string> {
  let context = `You are a helpful garden assistant for a smart watering system in Mount Eliza, Victoria, Australia.
The system controls a Zigbee smart water tap for the "Front Right Garden Hedges" zone, which has Leighton Green hedges planted on 13/12/2025.

Your role is to:
- Answer questions about watering history and schedules
- Provide gardening advice for Leighton Green hedges
- Help the user understand their garden's water needs
- Give recommendations based on weather and soil conditions

Be concise and friendly. Use Australian date formats (DD/MM/YYYY).

`;

  // Add real-time data if Supabase is configured
  if (isSupabaseConfigured()) {
    try {
      const [history, lastWatered] = await Promise.all([
        getWateringHistory(10),
        getLastWateredForZones(),
      ]);

      if (history.length > 0) {
        context += "\n--- RECENT WATERING HISTORY ---\n";
        history.slice(0, 5).forEach((event) => {
          const start = new Date(event.started_at);
          const duration = event.duration_seconds
            ? `${Math.floor(event.duration_seconds / 60)}m ${event.duration_seconds % 60}s`
            : "in progress";
          context += `- ${start.toLocaleDateString("en-AU")} at ${start.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}: Duration ${duration}\n`;
        });
      }

      const zone1LastWatered = lastWatered["zone-1"];
      if (zone1LastWatered) {
        const lastDate = new Date(zone1LastWatered);
        const now = new Date();
        const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        context += `\nLast watered: ${lastDate.toLocaleDateString("en-AU")} at ${lastDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })} (${daysSince} days ago)\n`;
      } else {
        context += "\nNo watering history recorded yet.\n";
      }

      // Calculate stats
      const totalEvents = history.length;
      const totalDuration = history.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
      context += `\nTotal watering events: ${totalEvents}`;
      context += `\nTotal watering time: ${Math.round(totalDuration / 60)} minutes\n`;

    } catch (error) {
      console.error("Error fetching context data:", error);
    }
  }

  // Add weather context by fetching from our weather API
  try {
    const weatherResponse = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/weather`);
    if (weatherResponse.ok) {
      const weather = await weatherResponse.json();
      context += "\n--- CURRENT WEATHER ---\n";
      context += `Temperature: ${weather.current.temperature}°C\n`;
      context += `Conditions: ${weather.current.weatherDescription}\n`;
      context += `Humidity: ${weather.current.humidity}%\n`;
      context += `Rain last 24h: ${weather.recentRainfall.last24h}mm\n`;
      context += `Rain last 7 days: ${weather.recentRainfall.last7days}mm\n`;
      context += `Watering recommendation: ${weather.wateringRecommendation.reason}\n`;
    }
  } catch (error) {
    // Weather fetch failed, continue without it
  }

  context += "\n--- PLANT INFO ---\n";
  context += "Zone: Front Right Garden Hedges\n";
  context += "Plant: Leighton Green (Cupressocyparis leylandii)\n";
  context += "Planted: 13/12/2025\n";
  context += "Care notes: Leighton Greens are fast-growing evergreen hedging plants. They need regular watering especially when young. Water deeply 2-3 times per week in summer, less in winter. They prefer well-drained soil and can tolerate some drought once established.\n";

  return context;
}

export async function POST(request: Request) {
  try {
    const { messages }: { messages: ChatMessage[] } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found in environment");
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 503 }
      );
    }

    // Get system context with real-time data
    const systemContext = await getSystemContext();

    // Create model with system instruction
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction: systemContext,
    });

    // Build conversation history for Gemini
    const chat = model.startChat({
      history: messages.slice(0, -1).map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
    });

    // Get the latest user message
    const userMessage = messages[messages.length - 1].content;

    // Generate response
    const result = await chat.sendMessage(userMessage);
    const response = result.response.text();

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: `Failed to generate response: ${errorMessage}` },
      { status: 500 }
    );
  }
}

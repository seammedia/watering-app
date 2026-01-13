import { NextResponse } from "next/server";

// Default coordinates for Mount Eliza, Victoria, Australia
// Can be overridden with env vars
const LATITUDE = process.env.LOCATION_LATITUDE || "-38.4534";
const LONGITUDE = process.env.LOCATION_LONGITUDE || "145.0933";

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    precipitation: number[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
  };
}

interface WeatherData {
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    weatherCode: number;
    weatherDescription: string;
    windSpeed: number;
  };
  recentRainfall: {
    last24h: number;
    last7days: number;
  };
  forecast: Array<{
    date: string;
    dayName: string;
    weatherCode: number;
    weatherDescription: string;
    tempMax: number;
    tempMin: number;
    precipitationSum: number;
    precipitationProbability: number;
  }>;
  wateringRecommendation: {
    shouldWater: boolean;
    reason: string;
    urgency: "none" | "low" | "medium" | "high";
  };
}

function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] || "Unknown";
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return date.toLocaleDateString("en-AU", { weekday: "short" });
}

function calculateWateringRecommendation(
  recentRainfall: number,
  forecastRain: number[],
  precipProbability: number[]
): WeatherData["wateringRecommendation"] {
  const next3DaysRain = forecastRain.slice(0, 3).reduce((a, b) => a + b, 0);
  const next3DaysProbability = Math.max(...precipProbability.slice(0, 3));

  // If significant recent rain, no need to water
  if (recentRainfall > 10) {
    return {
      shouldWater: false,
      reason: `${recentRainfall.toFixed(1)}mm of rain in the last 7 days - soil should be moist`,
      urgency: "none",
    };
  }

  // If rain expected soon with high probability
  if (next3DaysProbability > 70 && next3DaysRain > 5) {
    return {
      shouldWater: false,
      reason: `Rain forecast: ${next3DaysRain.toFixed(1)}mm expected in next 3 days (${next3DaysProbability}% chance)`,
      urgency: "none",
    };
  }

  // If some rain expected
  if (next3DaysProbability > 50 && next3DaysRain > 2) {
    return {
      shouldWater: false,
      reason: `Possible rain: ${next3DaysRain.toFixed(1)}mm expected (${next3DaysProbability}% chance) - consider waiting`,
      urgency: "low",
    };
  }

  // If no recent rain and none expected
  if (recentRainfall < 2 && next3DaysRain < 2) {
    return {
      shouldWater: true,
      reason: "No recent rain and dry forecast - watering recommended",
      urgency: "high",
    };
  }

  // Moderate recommendation
  if (recentRainfall < 5) {
    return {
      shouldWater: true,
      reason: `Only ${recentRainfall.toFixed(1)}mm in last 7 days - light watering suggested`,
      urgency: "medium",
    };
  }

  return {
    shouldWater: false,
    reason: "Conditions look adequate - monitor soil moisture",
    urgency: "low",
  };
}

export async function GET() {
  try {
    // Fetch current weather + 7 day forecast + past 7 days
    const params = new URLSearchParams({
      latitude: LATITUDE,
      longitude: LONGITUDE,
      current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
      hourly: "precipitation,precipitation_probability",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
      past_days: "7",
      forecast_days: "7",
      timezone: "auto",
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { next: { revalidate: 1800 } } // Cache for 30 minutes
    );

    if (!response.ok) {
      throw new Error("Failed to fetch weather data");
    }

    const data: OpenMeteoResponse = await response.json();

    // Calculate recent rainfall (last 7 days from hourly data)
    const now = new Date();
    const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7daysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let last24h = 0;
    let last7days = 0;

    data.hourly.time.forEach((time, i) => {
      const timeDate = new Date(time);
      if (timeDate >= last7daysStart && timeDate <= now) {
        last7days += data.hourly.precipitation[i] || 0;
        if (timeDate >= last24hStart) {
          last24h += data.hourly.precipitation[i] || 0;
        }
      }
    });

    // Get future forecast (from today onwards)
    const todayStr = now.toISOString().split("T")[0];
    const todayIndex = data.daily.time.findIndex((t) => t >= todayStr);
    const futureDays = data.daily.time.slice(todayIndex, todayIndex + 7);

    const forecast = futureDays.map((date, i) => {
      const idx = todayIndex + i;
      return {
        date,
        dayName: getDayName(date),
        weatherCode: data.daily.weather_code[idx],
        weatherDescription: getWeatherDescription(data.daily.weather_code[idx]),
        tempMax: data.daily.temperature_2m_max[idx],
        tempMin: data.daily.temperature_2m_min[idx],
        precipitationSum: data.daily.precipitation_sum[idx],
        precipitationProbability: data.daily.precipitation_probability_max[idx],
      };
    });

    const weatherData: WeatherData = {
      current: {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        precipitation: data.current.precipitation,
        weatherCode: data.current.weather_code,
        weatherDescription: getWeatherDescription(data.current.weather_code),
        windSpeed: data.current.wind_speed_10m,
      },
      recentRainfall: {
        last24h: Math.round(last24h * 10) / 10,
        last7days: Math.round(last7days * 10) / 10,
      },
      forecast,
      wateringRecommendation: calculateWateringRecommendation(
        last7days,
        forecast.map((f) => f.precipitationSum),
        forecast.map((f) => f.precipitationProbability)
      ),
    };

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const FRONT_TAP_DEVICE_ID = "bf9d467329b87e8748kbam";

interface WaterZone {
  id: string;
  deviceId: string;
  name: string;
  isWatering: boolean;
  lastWatered: string | null;
  moistureLevel: number | null;
  online: boolean;
  plantType?: string;
  plantDate?: string;
}

interface DeviceStatus {
  id: string;
  name: string;
  online: boolean;
  isOn: boolean;
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

interface WateringEventWithZone {
  id: string;
  zone_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  trigger: string;
  zones?: { name: string };
}

interface HistoryData {
  events: WateringEventWithZone[];
  stats: {
    totalEvents: number;
    totalDurationSeconds: number;
    averageDurationSeconds: number;
    eventsLast7Days: number;
  };
}

export default function Dashboard() {
  const [zones, setZones] = useState<WaterZone[]>([
    {
      id: "zone-1",
      deviceId: FRONT_TAP_DEVICE_ID,
      name: "Front Right Garden Hedges",
      isWatering: false,
      lastWatered: null,
      moistureLevel: null,
      online: false,
      plantType: "Leighton Greens",
      plantDate: "13/12/2025",
    },
  ]);

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isControlling, setIsControlling] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<"home" | "soil" | "rain" | "weather" | "history">("home");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/history");
      if (response.ok) {
        const data: HistoryData = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const response = await fetch("/api/weather");
      if (response.ok) {
        const data: WeatherData = await response.json();
        setWeather(data);
      }
    } catch (error) {
      console.error("Failed to fetch weather:", error);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const fetchDeviceStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/device/${FRONT_TAP_DEVICE_ID}`);
      if (response.ok) {
        const data: DeviceStatus = await response.json();
        setZones((prev) =>
          prev.map((zone) =>
            zone.deviceId === data.id
              ? { ...zone, isWatering: data.isOn, online: data.online }
              : zone
          )
        );
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Failed to fetch device status:", error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeviceStatus();
    const interval = setInterval(fetchDeviceStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchDeviceStatus]);

  useEffect(() => {
    if ((currentPage === "rain" || currentPage === "weather") && !weather && !weatherLoading) {
      fetchWeather();
    }
  }, [currentPage, weather, weatherLoading, fetchWeather]);

  useEffect(() => {
    if (currentPage === "history" && !history && !historyLoading) {
      fetchHistory();
    }
  }, [currentPage, history, historyLoading, fetchHistory]);

  const toggleWatering = async (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;

    setIsControlling(zoneId);
    const newState = !zone.isWatering;

    try {
      const response = await fetch(`/api/device/${zone.deviceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: newState ? "on" : "off",
          zoneId: zone.id,
          zoneName: zone.name,
        }),
      });

      if (response.ok) {
        setZones((prev) =>
          prev.map((z) =>
            z.id === zoneId
              ? {
                  ...z,
                  isWatering: newState,
                  lastWatered: newState ? null : new Date().toLocaleString(),
                }
              : z
          )
        );
        // Refresh history after watering ends
        if (!newState) {
          setTimeout(() => fetchHistory(), 1000);
        }
      } else {
        console.error("Failed to control device");
      }
    } catch (error) {
      console.error("Error controlling device:", error);
    } finally {
      setIsControlling(null);
    }
  };

  const waterAll = async () => {
    for (const zone of zones) {
      if (!zone.isWatering) {
        await toggleWatering(zone.id);
      }
    }
  };

  const stopAll = async () => {
    for (const zone of zones) {
      if (zone.isWatering) {
        await toggleWatering(zone.id);
      }
    }
  };

  const getMoistureColor = (level: number | null) => {
    if (level === null) return "bg-gray-200";
    if (level < 25) return "bg-red-500";
    if (level < 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getMoistureStatus = (level: number | null) => {
    if (level === null) return "No sensor";
    if (level < 25) return "Dry";
    if (level < 50) return "Moderate";
    return "Moist";
  };

  const getWeatherIcon = (code: number) => {
    if (code === 0) return "sun"; // Clear
    if (code <= 3) return "cloud-sun"; // Partly cloudy
    if (code <= 48) return "cloud"; // Cloudy/fog
    if (code <= 67) return "cloud-drizzle"; // Drizzle/rain
    if (code <= 77) return "snowflake"; // Snow
    if (code <= 86) return "cloud-rain"; // Rain showers
    return "cloud-lightning"; // Thunderstorm
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high": return "bg-red-100 border-red-300 text-red-800";
      case "medium": return "bg-yellow-100 border-yellow-300 text-yellow-800";
      case "low": return "bg-blue-100 border-blue-300 text-blue-800";
      default: return "bg-green-100 border-green-300 text-green-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-green-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Smart Watering</h1>
            <p className="text-green-100 text-sm">Garden Control</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-300" : "bg-red-400"} ${isLoading ? "animate-pulse" : ""}`}
              />
              <span className="text-sm">
                {isLoading ? "Connecting..." : isConnected ? "Connected" : "Offline"}
              </span>
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 hover:bg-green-700 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-gray-800 shadow-xl">
            <div className="p-4 bg-green-600 text-white flex justify-between items-center">
              <h2 className="font-semibold">Menu</h2>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1 hover:bg-green-700 rounded"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="p-2">
              {[
                { id: "home", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
                { id: "soil", label: "Soil", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
                { id: "weather", label: "Weather", icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
                { id: "rain", label: "Rain", icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" },
                { id: "history", label: "History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id as typeof currentPage);
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    currentPage === item.id
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {item.label}
                  {currentPage === item.id && (
                    <span className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 max-w-lg mx-auto">
        {currentPage === "home" && (
          <>
        {/* Quick Actions */}
        <section className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={waterAll}
                disabled={!isConnected || isControlling !== null}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
                Water All
              </button>
              <button
                className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={stopAll}
                disabled={!isConnected || isControlling !== null}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Stop All
              </button>
            </div>
          </div>
        </section>

        {/* Property Map */}
        <section className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            <div className="p-4 pb-2">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                Property Map
              </h2>
            </div>
            <div className="relative">
              <Image
                src="/property-map.png"
                alt="Property map showing watering zones"
                width={600}
                height={300}
                className="w-full h-auto"
                priority
              />
              {/* Zone Overlay - Front Right Garden Hedges */}
              <button
                onClick={() => setSelectedZone("zone-1")}
                className="absolute bg-blue-500/40 border-2 border-blue-500 hover:bg-blue-500/60 transition-colors cursor-pointer"
                style={{
                  bottom: "5%",
                  right: "0%",
                  width: "52%",
                  height: "8%",
                }}
                title="Front Right Garden Hedges"
              />
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-600 dark:text-gray-400">Needs Attention</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-gray-600 dark:text-gray-400">Dry</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-gray-600 dark:text-gray-400">Healthy</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Zone Detail Popup */}
        {selectedZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedZone(null)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              {(() => {
                const zone = zones.find((z) => z.id === selectedZone);
                if (!zone) return null;
                return (
                  <>
                    <div className="bg-blue-500 text-white p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg">{zone.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`w-2 h-2 rounded-full ${zone.online ? "bg-green-300" : "bg-gray-300"}`} />
                            <span className="text-sm text-blue-100">
                              {zone.online ? "Online" : "Offline"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedZone(null)}
                          className="p-1 hover:bg-blue-600 rounded"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Status */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-gray-600 dark:text-gray-300">Status</span>
                        <span className={`font-semibold ${zone.isWatering ? "text-blue-500" : "text-gray-500"}`}>
                          {zone.isWatering ? "Watering" : "Idle"}
                        </span>
                      </div>

                      {/* Plant Type */}
                      {zone.plantType && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <span className="text-gray-600 dark:text-gray-300">Plant</span>
                          </div>
                          <span className="font-semibold text-gray-800 dark:text-white">
                            {zone.plantType}
                          </span>
                        </div>
                      )}

                      {/* Plant Date */}
                      {zone.plantDate && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-600 dark:text-gray-300">Plant Date</span>
                          </div>
                          <span className="font-semibold text-gray-800 dark:text-white">
                            {zone.plantDate}
                          </span>
                        </div>
                      )}

                      {/* Last Watered */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-600 dark:text-gray-300">Last Watered</span>
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-white">
                          {zone.lastWatered || "Never"}
                        </span>
                      </div>

                      {/* Soil Moisture */}
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                            </svg>
                            <span className="text-gray-600 dark:text-gray-300">Soil Moisture</span>
                          </div>
                          <span className="font-semibold text-gray-800 dark:text-white">
                            {zone.moistureLevel !== null ? `${zone.moistureLevel}%` : "No sensor"}
                          </span>
                        </div>
                        {zone.moistureLevel !== null && (
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getMoistureColor(zone.moistureLevel)}`}
                              style={{ width: `${zone.moistureLevel}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Recent Rain */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                          </svg>
                          <span className="text-gray-600 dark:text-gray-300">Recent Rain</span>
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-white">
                          No data
                        </span>
                      </div>

                      {/* Zone Health */}
                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-gray-600 dark:text-gray-300">Zone Health</span>
                        </div>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Healthy
                        </span>
                      </div>

                      {/* Control Button */}
                      <button
                        onClick={() => {
                          toggleWatering(zone.id);
                        }}
                        disabled={!isConnected || isControlling === zone.id}
                        className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                          zone.isWatering
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                        } disabled:opacity-50`}
                      >
                        {isControlling === zone.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Processing...
                          </span>
                        ) : zone.isWatering ? (
                          "Stop Watering"
                        ) : (
                          "Start Watering"
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Watering Zones */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
            Watering Zones
          </h2>
          <div className="space-y-3">
            {zones.map((zone) => (
              <div
                key={zone.id}
                onClick={() => setSelectedZone(zone.id)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        {zone.name}
                      </h3>
                      <span
                        className={`w-2 h-2 rounded-full ${zone.online ? "bg-green-500" : "bg-gray-400"}`}
                        title={zone.online ? "Online" : "Offline"}
                      />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Last: {zone.lastWatered || "Never"}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatering(zone.id);
                    }}
                    disabled={!isConnected || isControlling === zone.id}
                    className={`w-16 h-8 rounded-full transition-colors relative ${
                      zone.isWatering ? "bg-blue-500" : "bg-gray-300"
                    } ${isControlling === zone.id ? "opacity-50" : ""} ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        zone.isWatering ? "translate-x-9" : "translate-x-1"
                      }`}
                    />
                    {isControlling === zone.id && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </span>
                    )}
                  </button>
                </div>

                {/* Moisture Level */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        Soil Moisture
                      </span>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {zone.moistureLevel !== null
                          ? `${zone.moistureLevel}%`
                          : "--"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getMoistureColor(zone.moistureLevel)}`}
                        style={{ width: `${zone.moistureLevel || 0}%` }}
                      />
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      zone.moistureLevel !== null && zone.moistureLevel < 25
                        ? "bg-red-100 text-red-700"
                        : zone.moistureLevel !== null && zone.moistureLevel < 50
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {getMoistureStatus(zone.moistureLevel)}
                  </span>
                </div>

                {/* Watering Animation */}
                {zone.isWatering && (
                  <div className="mt-3 flex items-center gap-2 text-blue-500">
                    <svg
                      className="w-5 h-5 animate-bounce"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z" />
                    </svg>
                    <span className="text-sm font-medium">Watering...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Connection Status Card - only show when not connected */}
        {!isConnected && !isLoading && (
          <section className="mb-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-amber-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Connection Failed
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Unable to connect to your smart water tap. Please check your
                    Tuya API credentials in the environment variables.
                  </p>
                  <button
                    onClick={fetchDeviceStatus}
                    className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200 underline"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
          </>
        )}

        {/* Rain/Weather Page */}
        {currentPage === "rain" && (
          <>
            {weatherLoading && !weather && (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {weather && (
              <>
                {/* Watering Recommendation */}
                <section className="mb-6">
                  <div className={`rounded-xl shadow-md p-4 border-2 ${getUrgencyColor(weather.wateringRecommendation.urgency)}`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${weather.wateringRecommendation.shouldWater ? "bg-red-200" : "bg-green-200"}`}>
                        {weather.wateringRecommendation.shouldWater ? (
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h2 className="font-bold text-lg">
                          {weather.wateringRecommendation.shouldWater ? "Watering Recommended" : "No Watering Needed"}
                        </h2>
                        <p className="text-sm mt-1">{weather.wateringRecommendation.reason}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Current Conditions */}
                <section className="mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      Current Conditions
                    </h2>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-4xl font-bold text-gray-800 dark:text-white">
                        {Math.round(weather.current.temperature)}°C
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">{weather.current.weatherDescription}</p>
                        <p className="text-sm text-gray-500">Wind: {weather.current.windSpeed} km/h</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Humidity</div>
                        <div className="font-semibold text-gray-800 dark:text-white">{weather.current.humidity}%</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Precipitation</div>
                        <div className="font-semibold text-gray-800 dark:text-white">{weather.current.precipitation} mm</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Recent Rainfall */}
                <section className="mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      Recent Rainfall
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {weather.recentRainfall.last24h} mm
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 24 hours</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {weather.recentRainfall.last7days} mm
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 7 days</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 7-Day Forecast */}
                <section className="mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      7-Day Forecast
                    </h2>
                    <div className="space-y-2">
                      {weather.forecast.map((day, i) => (
                        <div
                          key={day.date}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            i === 0 ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-700"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 font-medium text-gray-800 dark:text-white">
                              {day.dayName}
                            </div>
                            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
                              {day.weatherDescription}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {day.precipitationSum > 0 && (
                              <div className="flex items-center gap-1 text-blue-500">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
                                </svg>
                                <span className="text-xs">{day.precipitationSum}mm</span>
                              </div>
                            )}
                            {day.precipitationProbability > 0 && (
                              <div className="text-xs text-gray-500">
                                {day.precipitationProbability}%
                              </div>
                            )}
                            <div className="text-sm font-medium text-gray-800 dark:text-white">
                              {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Refresh Button */}
                <div className="text-center mb-6">
                  <button
                    onClick={fetchWeather}
                    disabled={weatherLoading}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium disabled:opacity-50"
                  >
                    {weatherLoading ? "Refreshing..." : "Refresh Weather Data"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Weather Page - 7 Day Forecast */}
        {currentPage === "weather" && (
          <>
            {weatherLoading && !weather && (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {weather && (
              <>
                {/* Location Header */}
                <section className="mb-6">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium">Mount Eliza, Victoria</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-5xl font-bold">
                        {Math.round(weather.current.temperature)}°
                      </div>
                      <div>
                        <p className="text-xl">{weather.current.weatherDescription}</p>
                        <p className="text-blue-100 text-sm">
                          Feels like {Math.round(weather.current.temperature)}°C
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Current Details */}
                <section className="mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      Current Details
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                        <svg className="w-6 h-6 mx-auto text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Humidity</div>
                        <div className="font-semibold text-gray-800 dark:text-white">{weather.current.humidity}%</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                        <svg className="w-6 h-6 mx-auto text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Wind</div>
                        <div className="font-semibold text-gray-800 dark:text-white">{weather.current.windSpeed} km/h</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                        <svg className="w-6 h-6 mx-auto text-blue-400 mb-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
                        </svg>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Precip</div>
                        <div className="font-semibold text-gray-800 dark:text-white">{weather.current.precipitation} mm</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 7-Day Forecast */}
                <section className="mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      7-Day Forecast
                    </h2>
                    <div className="space-y-3">
                      {weather.forecast.map((day, i) => (
                        <div
                          key={day.date}
                          className={`flex items-center p-3 rounded-lg ${
                            i === 0 ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800" : "bg-gray-50 dark:bg-gray-700"
                          }`}
                        >
                          <div className="w-16 font-medium text-gray-800 dark:text-white">
                            {day.dayName}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {day.weatherDescription}
                            </div>
                            {day.precipitationProbability > 0 && (
                              <div className="flex items-center gap-1 text-blue-500 text-xs mt-0.5">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
                                </svg>
                                {day.precipitationProbability}%
                                {day.precipitationSum > 0 && ` · ${day.precipitationSum}mm`}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-gray-800 dark:text-white">
                              {Math.round(day.tempMax)}°
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 ml-1">
                              {Math.round(day.tempMin)}°
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Refresh Button */}
                <div className="text-center mb-6">
                  <button
                    onClick={fetchWeather}
                    disabled={weatherLoading}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium disabled:opacity-50"
                  >
                    {weatherLoading ? "Refreshing..." : "Refresh Weather"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Soil Page Placeholder */}
        {currentPage === "soil" && (
          <section className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Soil Sensors Coming Soon
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Zigbee soil moisture sensors will be integrated here to monitor soil conditions across your garden zones.
              </p>
            </div>
          </section>
        )}

        {/* History Page */}
        {currentPage === "history" && (
          <>
            {historyLoading && !history && (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {history && (
              <>
                {/* Statistics */}
                <section className="mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      Statistics
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {history.stats.totalEvents}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Events</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {history.stats.eventsLast7Days}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Last 7 Days</div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {Math.round(history.stats.totalDurationSeconds / 60)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Minutes</div>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {Math.round(history.stats.averageDurationSeconds / 60)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Avg Minutes</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Recent Events */}
                <section className="mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      Recent Watering Events
                    </h2>
                    {history.events.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No watering events yet.</p>
                        <p className="text-sm mt-1">Events will appear here when you water your garden.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {history.events.slice(0, 20).map((event) => {
                          const startDate = new Date(event.started_at);
                          const isToday = startDate.toDateString() === new Date().toDateString();
                          const duration = event.duration_seconds
                            ? `${Math.floor(event.duration_seconds / 60)}m ${event.duration_seconds % 60}s`
                            : "In progress";

                          return (
                            <div
                              key={event.id}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${event.ended_at ? "bg-green-500" : "bg-blue-500 animate-pulse"}`} />
                                <div>
                                  <div className="font-medium text-gray-800 dark:text-white text-sm">
                                    {event.zones?.name || "Unknown Zone"}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {isToday ? "Today" : startDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                                    {" at "}
                                    {startDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm font-medium ${event.ended_at ? "text-gray-800 dark:text-white" : "text-blue-500"}`}>
                                  {duration}
                                </div>
                                <div className="text-xs text-gray-500 capitalize">
                                  {event.trigger}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                {/* Refresh Button */}
                <div className="text-center mb-6">
                  <button
                    onClick={() => {
                      setHistory(null);
                      fetchHistory();
                    }}
                    disabled={historyLoading}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium disabled:opacity-50"
                  >
                    {historyLoading ? "Refreshing..." : "Refresh History"}
                  </button>
                </div>
              </>
            )}

            {!history && !historyLoading && (
              <section className="mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-amber-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                    Database Not Connected
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    Configure Supabase credentials to enable watering history tracking.
                  </p>
                  <button
                    onClick={fetchHistory}
                    className="mt-4 text-blue-500 hover:text-blue-600 text-sm font-medium"
                  >
                    Retry Connection
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          <p>Smart Watering v0.1.0</p>
          <p className="text-xs mt-1">Powered by Tuya Cloud API</p>
        </footer>
      </main>
    </div>
  );
}

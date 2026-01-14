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
  currentEventId?: string | null;
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
  lastWateredByZone: Record<string, string>;
  stats: {
    totalEvents: number;
    totalDurationSeconds: number;
    averageDurationSeconds: number;
    eventsLast7Days: number;
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SoilSensorData {
  id: string;
  name: string;
  online: boolean;
  moisture: number | null;
  temperature: number | null;
  battery: number | null;
  lastUpdated: string;
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
  const [currentPage, setCurrentPage] = useState<"home" | "soil" | "rain" | "weather" | "history" | "chat">("home");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [soilSensor, setSoilSensor] = useState<SoilSensorData | null>(null);
  const [soilSensorLoading, setSoilSensorLoading] = useState(false);

  useEffect(() => {
    const savedEventIds = localStorage.getItem("wateringEventIds");
    if (savedEventIds) {
      try {
        const eventIds: Record<string, string> = JSON.parse(savedEventIds);
        setZones((prev) =>
          prev.map((zone) => ({
            ...zone,
            currentEventId: eventIds[zone.id] || null,
          }))
        );
      } catch (e) {
        console.error("Failed to parse saved event IDs:", e);
      }
    }
  }, []);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();
      if (response.ok) {
        setChatMessages([...newMessages, { role: "assistant", content: data.response }]);
      } else {
        setChatMessages([
          ...newMessages,
          { role: "assistant", content: data.error || "Sorry, I couldn't process that request. Please try again." },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages([
        ...newMessages,
        { role: "assistant", content: "Connection error. Please check your internet and try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/history");
      if (response.ok) {
        const data: HistoryData = await response.json();
        setHistory(data);

        if (data.lastWateredByZone) {
          setZones((prev) =>
            prev.map((zone) => {
              const lastWatered = data.lastWateredByZone[zone.id];
              if (lastWatered) {
                return {
                  ...zone,
                  lastWatered: new Date(lastWatered).toLocaleString("en-AU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                };
              }
              return zone;
            })
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchSoilSensor = useCallback(async () => {
    setSoilSensorLoading(true);
    try {
      const response = await fetch("/api/soil-sensor");
      if (response.ok) {
        const data: SoilSensorData = await response.json();
        setSoilSensor(data);

        // Update zone moisture level with sensor data
        if (data.moisture !== null) {
          setZones((prev) =>
            prev.map((zone) => ({
              ...zone,
              moistureLevel: data.moisture,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch soil sensor:", error);
    } finally {
      setSoilSensorLoading(false);
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
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchSoilSensor();
    const interval = setInterval(fetchSoilSensor, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchSoilSensor]);

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
          eventId: newState ? undefined : zone.currentEventId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newEventId = newState ? data.eventId : null;

        setZones((prev) =>
          prev.map((z) =>
            z.id === zoneId
              ? {
                  ...z,
                  isWatering: newState,
                  lastWatered: newState ? z.lastWatered : new Date().toLocaleString(),
                  currentEventId: newEventId,
                }
              : z
          )
        );

        try {
          const savedEventIds = localStorage.getItem("wateringEventIds");
          const eventIds: Record<string, string> = savedEventIds ? JSON.parse(savedEventIds) : {};
          if (newEventId) {
            eventIds[zoneId] = newEventId;
          } else {
            delete eventIds[zoneId];
          }
          localStorage.setItem("wateringEventIds", JSON.stringify(eventIds));
        } catch (e) {
          console.error("Failed to save event ID to localStorage:", e);
        }

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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high": return "bg-red-100 border-red-300 text-red-800";
      case "medium": return "bg-yellow-100 border-yellow-300 text-yellow-800";
      case "low": return "bg-blue-100 border-blue-300 text-blue-800";
      default: return "bg-green-100 border-green-300 text-green-800";
    }
  };

  const navItems = [
    { id: "home", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { id: "chat", label: "Garden AI", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    { id: "weather", label: "Weather", icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
    { id: "rain", label: "Rainfall", icon: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" },
    { id: "history", label: "History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "soil", label: "Soil", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div className="min-h-screen bg-[#f5f0e8] lg:flex">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#1a1a2e] text-white p-4 flex items-center justify-between shadow-lg">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative rounded-full overflow-hidden bg-white">
            <Image src="/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <span className="font-semibold">The Water App</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Left Sidebar */}
      <aside className={`
        fixed lg:relative h-full z-50 lg:z-auto
        bg-gradient-to-b from-[#1a1a2e] to-[#16213e]
        flex flex-col transition-all duration-300
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-72
      `}>
        {/* Close button for mobile */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo */}
        <div className="p-4 flex items-center justify-center">
          <div className={`${sidebarCollapsed ? 'lg:w-12 lg:h-12' : 'lg:w-32 lg:h-32'} w-24 h-24 relative rounded-full overflow-hidden bg-white shadow-lg transition-all duration-300`}>
            <Image
              src="/logo.png"
              alt="The Water App"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* App Name */}
        <div className={`text-center pb-4 border-b border-white/10 mx-4 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
          <h1 className="text-white font-bold text-lg">The Water App</h1>
          <p className="text-gray-400 text-xs">Smart Garden</p>
        </div>

        {/* Connection Status */}
        <div className={`${sidebarCollapsed ? 'lg:px-2' : 'lg:px-4'} px-4 py-3 border-b border-white/10`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : ''} gap-2`}>
            <span
              className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"} ${isLoading ? "animate-pulse" : ""}`}
            />
            <span className={`text-gray-300 text-sm ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              {isLoading ? "Connecting..." : isConnected ? "Connected" : "Offline"}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id as typeof currentPage);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center' : ''} gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 ${
                currentPage === item.id
                  ? "bg-white/20 text-white shadow-lg"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className={`font-medium ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Collapse Toggle - Desktop only */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex p-4 border-t border-white/10 text-gray-400 hover:text-white items-center justify-center gap-2 transition-colors"
        >
          <svg className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto pt-20 lg:pt-0 p-4 lg:p-6">
        {currentPage === "home" && (
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
              <p className="text-gray-500">Welcome back to your smart garden</p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Quick Actions - Spans 2 columns */}
              <div className="md:col-span-2 lg:col-span-2 bg-white rounded-3xl shadow-sm p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-300 disabled:to-blue-400 text-white py-3 sm:py-4 px-3 sm:px-6 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-blue-500/25 text-sm sm:text-base"
                    onClick={waterAll}
                    disabled={!isConnected || isControlling !== null}
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Water All
                  </button>
                  <button
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-red-300 disabled:to-red-400 text-white py-3 sm:py-4 px-3 sm:px-6 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-red-500/25 text-sm sm:text-base"
                    onClick={stopAll}
                    disabled={!isConnected || isControlling !== null}
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Stop All
                  </button>
                </div>
              </div>

              {/* Status Card */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl shadow-sm p-4 sm:p-6 text-white">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <span className="text-emerald-100 text-xs sm:text-sm font-medium">System Status</span>
                  <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${isConnected ? 'bg-white' : 'bg-red-300'} ${isLoading ? 'animate-pulse' : ''}`} />
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1">{isConnected ? 'Online' : 'Offline'}</div>
                <p className="text-emerald-100 text-xs sm:text-sm">{zones.filter(z => z.isWatering).length} zone{zones.filter(z => z.isWatering).length !== 1 ? 's' : ''} active</p>
              </div>

              {/* Weather Quick View */}
              <div className="bg-gradient-to-br from-sky-400 to-blue-500 rounded-3xl shadow-sm p-4 sm:p-6 text-white">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <span className="text-sky-100 text-xs sm:text-sm font-medium">Weather</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-sky-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1">{weather ? `${Math.round(weather.current.temperature)}°C` : '--°C'}</div>
                <p className="text-sky-100 text-xs sm:text-sm">{weather?.current.weatherDescription || 'Loading...'}</p>
              </div>

              {/* Property Map - Spans 2 columns and 2 rows */}
              <div className="md:col-span-2 lg:col-span-2 lg:row-span-2 bg-white rounded-3xl shadow-sm overflow-hidden">
                <div className="p-6 pb-3">
                  <h2 className="text-lg font-semibold text-gray-800">Property Map</h2>
                  <p className="text-gray-500 text-sm">Click zones to view details</p>
                </div>
                <div className="relative px-6">
                  <Image
                    src="/property-map.png"
                    alt="Property map showing watering zones"
                    width={600}
                    height={300}
                    className="w-full h-auto rounded-2xl"
                    priority
                  />
                  <button
                    onClick={() => setSelectedZone("zone-1")}
                    className="absolute bg-blue-500/40 border-2 border-blue-500 hover:bg-blue-500/60 transition-colors cursor-pointer rounded-lg"
                    style={{
                      bottom: "8%",
                      right: "4%",
                      width: "48%",
                      height: "10%",
                    }}
                    title="Front Right Garden Hedges"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-gray-600">Needs Attention</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-gray-600">Dry</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-gray-600">Healthy</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watering Zone Card */}
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.id)}
                  className="md:col-span-2 lg:col-span-2 bg-white rounded-3xl shadow-sm p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800">{zone.name}</h3>
                        <span
                          className={`w-2 h-2 rounded-full ${zone.online ? "bg-green-500" : "bg-gray-400"}`}
                        />
                      </div>
                      <p className="text-sm text-gray-500">Last: {zone.lastWatered || "Never"}</p>
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
                          zone.isWatering ? "translate-x-8" : "translate-x-1"
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

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Soil Moisture</span>
                        <span className="font-medium text-gray-800">
                          {zone.moistureLevel !== null ? `${zone.moistureLevel}%` : "--"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getMoistureColor(zone.moistureLevel)}`}
                          style={{ width: `${zone.moistureLevel || 0}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-3 py-1.5 rounded-full ${
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

                  {zone.isWatering && (
                    <div className="mt-4 flex items-center gap-2 text-blue-500 bg-blue-50 px-4 py-2 rounded-xl">
                      <svg className="w-5 h-5 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z" />
                      </svg>
                      <span className="text-sm font-medium">Watering in progress...</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Statistics Bento */}
              <div className="bg-[#e8d5c4] rounded-3xl shadow-sm p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-[#8b7355] mb-2 sm:mb-3">This Week</h3>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">{history?.stats.eventsLast7Days || 0}</div>
                <p className="text-xs sm:text-sm text-[#8b7355]">watering events</p>
              </div>

              <div className="bg-[#d4e5d7] rounded-3xl shadow-sm p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-[#5a7d5f] mb-2 sm:mb-3">Total Time</h3>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">{history ? Math.round(history.stats.totalDurationSeconds / 60) : 0}</div>
                <p className="text-xs sm:text-sm text-[#5a7d5f]">minutes total</p>
              </div>

              {/* Recent Activity */}
              <div className="md:col-span-2 lg:col-span-2 bg-white rounded-3xl shadow-sm p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
                {history?.events && history.events.length > 0 ? (
                  <div className="space-y-3">
                    {history.events.slice(0, 3).map((event) => {
                      const startDate = new Date(event.started_at);
                      const duration = event.duration_seconds
                        ? `${Math.floor(event.duration_seconds / 60)}m ${event.duration_seconds % 60}s`
                        : "In progress";

                      return (
                        <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${event.ended_at ? "bg-green-500" : "bg-blue-500 animate-pulse"}`} />
                            <div>
                              <div className="font-medium text-gray-800 text-sm">{event.zones?.name || "Unknown Zone"}</div>
                              <div className="text-xs text-gray-500">
                                {startDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                          <span className={`text-sm font-medium ${event.ended_at ? "text-gray-600" : "text-blue-500"}`}>
                            {duration}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">No recent activity</p>
                )}
              </div>

              {/* Connection Warning */}
              {!isConnected && !isLoading && (
                <div className="md:col-span-2 lg:col-span-4 bg-amber-50 border-2 border-amber-200 rounded-3xl p-4 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-amber-100 rounded-xl">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-800">Connection Failed</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Unable to connect to your smart water tap. Check your Tuya API credentials.
                      </p>
                      <button
                        onClick={fetchDeviceStatus}
                        className="mt-3 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Zone Detail Popup */}
        {selectedZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedZone(null)} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              {(() => {
                const zone = zones.find((z) => z.id === selectedZone);
                if (!zone) return null;
                return (
                  <>
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-xl">{zone.name}</h3>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`w-2 h-2 rounded-full ${zone.online ? "bg-green-300" : "bg-gray-300"}`} />
                            <span className="text-sm text-blue-100">
                              {zone.online ? "Online" : "Offline"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedZone(null)}
                          className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                        <span className="text-gray-600">Status</span>
                        <span className={`font-semibold ${zone.isWatering ? "text-blue-500" : "text-gray-500"}`}>
                          {zone.isWatering ? "Watering" : "Idle"}
                        </span>
                      </div>

                      {zone.plantType && (
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <span className="text-gray-600">Plant</span>
                          </div>
                          <span className="font-semibold text-gray-800">{zone.plantType}</span>
                        </div>
                      )}

                      {zone.plantDate && (
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-600">Plant Date</span>
                          </div>
                          <span className="font-semibold text-gray-800">{zone.plantDate}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-600">Last Watered</span>
                        </div>
                        <span className="font-semibold text-gray-800">{zone.lastWatered || "Never"}</span>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                            </svg>
                            <span className="text-gray-600">Soil Moisture</span>
                          </div>
                          <span className="font-semibold text-gray-800">
                            {zone.moistureLevel !== null ? `${zone.moistureLevel}%` : "No sensor"}
                          </span>
                        </div>
                        {zone.moistureLevel !== null && (
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full ${getMoistureColor(zone.moistureLevel)}`}
                              style={{ width: `${zone.moistureLevel}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => toggleWatering(zone.id)}
                        disabled={!isConnected || isControlling === zone.id}
                        className={`w-full py-4 rounded-2xl font-semibold transition-all ${
                          zone.isWatering
                            ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25"
                            : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25"
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

        {/* Rain/Weather Page */}
        {currentPage === "rain" && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Rainfall Data</h1>
              <p className="text-gray-500">Monitor rainfall and watering recommendations</p>
            </div>

            {weatherLoading && !weather && (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {weather && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Watering Recommendation */}
                <div className={`md:col-span-2 rounded-3xl p-6 border-2 ${getUrgencyColor(weather.wateringRecommendation.urgency)}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${weather.wateringRecommendation.shouldWater ? "bg-red-200" : "bg-green-200"}`}>
                      {weather.wateringRecommendation.shouldWater ? (
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h2 className="font-bold text-xl">
                        {weather.wateringRecommendation.shouldWater ? "Watering Recommended" : "No Watering Needed"}
                      </h2>
                      <p className="mt-2">{weather.wateringRecommendation.reason}</p>
                    </div>
                  </div>
                </div>

                {/* Recent Rainfall Cards */}
                <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl p-6 text-white">
                  <h3 className="text-blue-100 text-sm font-medium mb-2">Last 24 Hours</h3>
                  <div className="text-4xl font-bold">{weather.recentRainfall.last24h} mm</div>
                </div>

                <div className="bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-3xl p-6 text-white">
                  <h3 className="text-indigo-100 text-sm font-medium mb-2">Last 7 Days</h3>
                  <div className="text-4xl font-bold">{weather.recentRainfall.last7days} mm</div>
                </div>

                {/* Current Conditions */}
                <div className="md:col-span-2 bg-white rounded-3xl p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Current Conditions</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-gray-800">{Math.round(weather.current.temperature)}°</div>
                      <div className="text-sm text-gray-500">Temperature</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-gray-800">{weather.current.humidity}%</div>
                      <div className="text-sm text-gray-500">Humidity</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-gray-800">{weather.current.windSpeed}</div>
                      <div className="text-sm text-gray-500">Wind km/h</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-bold text-gray-800">{weather.current.precipitation}</div>
                      <div className="text-sm text-gray-500">Precip mm</div>
                    </div>
                  </div>
                </div>

                {/* 7-Day Forecast */}
                <div className="md:col-span-2 bg-white rounded-3xl p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">7-Day Forecast</h2>
                  <div className="space-y-3">
                    {weather.forecast.map((day, i) => (
                      <div
                        key={day.date}
                        className={`flex items-center justify-between p-4 rounded-2xl ${
                          i === 0 ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-14 font-medium text-gray-800">{day.dayName}</div>
                          <div className="flex-1 text-sm text-gray-600">{day.weatherDescription}</div>
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
                          <div className="text-sm font-medium text-gray-800">
                            {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 text-center">
                  <button
                    onClick={fetchWeather}
                    disabled={weatherLoading}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium disabled:opacity-50"
                  >
                    {weatherLoading ? "Refreshing..." : "Refresh Weather Data"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weather Page */}
        {currentPage === "weather" && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Weather Forecast</h1>
              <p className="text-gray-500">7-day weather outlook for your garden</p>
            </div>

            {weatherLoading && !weather && (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {weather && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Location Header */}
                <div className="md:col-span-3 bg-gradient-to-r from-sky-500 to-blue-600 rounded-3xl p-8 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">Mount Eliza, Victoria</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-6xl font-bold">{Math.round(weather.current.temperature)}°</div>
                    <div>
                      <p className="text-2xl font-medium">{weather.current.weatherDescription}</p>
                      <p className="text-sky-100">Feels like {Math.round(weather.current.temperature)}°C</p>
                    </div>
                  </div>
                </div>

                {/* Current Details */}
                <div className="bg-white rounded-3xl p-6 text-center">
                  <svg className="w-8 h-8 mx-auto text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <div className="text-2xl font-bold text-gray-800">{weather.current.humidity}%</div>
                  <div className="text-sm text-gray-500">Humidity</div>
                </div>

                <div className="bg-white rounded-3xl p-6 text-center">
                  <svg className="w-8 h-8 mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <div className="text-2xl font-bold text-gray-800">{weather.current.windSpeed}</div>
                  <div className="text-sm text-gray-500">Wind km/h</div>
                </div>

                <div className="bg-white rounded-3xl p-6 text-center">
                  <svg className="w-8 h-8 mx-auto text-blue-400 mb-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
                  </svg>
                  <div className="text-2xl font-bold text-gray-800">{weather.current.precipitation}</div>
                  <div className="text-sm text-gray-500">Precipitation mm</div>
                </div>

                {/* 7-Day Forecast */}
                <div className="md:col-span-3 bg-white rounded-3xl p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">7-Day Forecast</h2>
                  <div className="space-y-3">
                    {weather.forecast.map((day, i) => (
                      <div
                        key={day.date}
                        className={`flex items-center p-4 rounded-2xl ${
                          i === 0 ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
                        }`}
                      >
                        <div className="w-20 font-medium text-gray-800">{day.dayName}</div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-600">{day.weatherDescription}</div>
                          {day.precipitationProbability > 0 && (
                            <div className="flex items-center gap-1 text-blue-500 text-xs mt-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
                              </svg>
                              {day.precipitationProbability}%
                              {day.precipitationSum > 0 && ` · ${day.precipitationSum}mm`}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-800">{Math.round(day.tempMax)}°</span>
                          <span className="text-gray-400 ml-2">{Math.round(day.tempMin)}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-3 text-center">
                  <button
                    onClick={fetchWeather}
                    disabled={weatherLoading}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium disabled:opacity-50"
                  >
                    {weatherLoading ? "Refreshing..." : "Refresh Weather"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat Page */}
        {currentPage === "chat" && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Garden AI Assistant</h1>
              <p className="text-gray-500">Ask questions about your garden and get expert advice</p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
              <div className="flex flex-col h-full">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-semibold text-gray-800 mb-2">How can I help?</h2>
                      <p className="text-gray-500 mb-6">Ask me about your garden, watering schedules, or plant care.</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[
                          "When did I last water?",
                          "How are my hedges doing?",
                          "Should I water today?",
                          "Care tips for Leighton Greens",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setChatInput(suggestion)}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-sm hover:bg-gray-200 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-100">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                      placeholder="Ask about your garden..."
                      className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-5 py-3 rounded-2xl transition-all shadow-lg shadow-green-500/25"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Soil Page */}
        {currentPage === "soil" && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Soil Sensors</h1>
              <p className="text-gray-500">Monitor soil conditions across your garden</p>
            </div>

            {soilSensorLoading && !soilSensor && (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-green-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {soilSensor && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sensor Header */}
                <div className="md:col-span-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{soilSensor.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${soilSensor.online ? "bg-green-300" : "bg-red-300"}`} />
                        <span className="text-sm text-green-100">
                          {soilSensor.online ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-100 text-sm">Last updated</div>
                      <div className="text-sm">
                        {new Date(soilSensor.lastUpdated).toLocaleTimeString("en-AU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Moisture Card */}
                <div className="bg-white rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-100 rounded-2xl">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Soil Moisture</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {soilSensor.moisture !== null ? `${soilSensor.moisture}%` : "--"}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        soilSensor.moisture !== null && soilSensor.moisture < 25
                          ? "bg-red-500"
                          : soilSensor.moisture !== null && soilSensor.moisture < 50
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${soilSensor.moisture || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Dry</span>
                    <span>Optimal</span>
                    <span>Wet</span>
                  </div>
                </div>

                {/* Temperature Card */}
                <div className="bg-white rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-orange-100 rounded-2xl">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Soil Temperature</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {soilSensor.temperature !== null ? `${soilSensor.temperature.toFixed(1)}°C` : "--"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {soilSensor.temperature !== null && soilSensor.temperature < 10
                      ? "Cold - root growth slowed"
                      : soilSensor.temperature !== null && soilSensor.temperature > 30
                        ? "Hot - water more frequently"
                        : "Ideal for plant growth"}
                  </div>
                </div>

                {/* Battery Card */}
                <div className="bg-white rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-2xl ${
                      soilSensor.battery !== null && soilSensor.battery < 20
                        ? "bg-red-100"
                        : "bg-green-100"
                    }`}>
                      <svg className={`w-6 h-6 ${
                        soilSensor.battery !== null && soilSensor.battery < 20
                          ? "text-red-600"
                          : "text-green-600"
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h14a2 2 0 012 2v6a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm18 4v2" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Battery Level</div>
                      <div className="text-2xl font-bold text-gray-800">
                        {soilSensor.battery !== null ? `${soilSensor.battery}%` : "--"}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        soilSensor.battery !== null && soilSensor.battery < 20
                          ? "bg-red-500"
                          : soilSensor.battery !== null && soilSensor.battery < 50
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${soilSensor.battery || 0}%` }}
                    />
                  </div>
                </div>

                {/* Linked Zone */}
                <div className="md:col-span-3 bg-white rounded-3xl p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Linked Zone</h2>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-2xl">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">Front Right Garden Hedges</div>
                        <div className="text-sm text-gray-500">Leighton Greens</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Current Moisture</div>
                      <div className={`font-semibold ${
                        soilSensor.moisture !== null && soilSensor.moisture < 25
                          ? "text-red-600"
                          : soilSensor.moisture !== null && soilSensor.moisture < 50
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}>
                        {soilSensor.moisture !== null ? `${soilSensor.moisture}%` : "--"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Refresh Button */}
                <div className="md:col-span-3 text-center">
                  <button
                    onClick={fetchSoilSensor}
                    disabled={soilSensorLoading}
                    className="text-green-500 hover:text-green-600 text-sm font-medium disabled:opacity-50"
                  >
                    {soilSensorLoading ? "Refreshing..." : "Refresh Sensor Data"}
                  </button>
                </div>
              </div>
            )}

            {!soilSensor && !soilSensorLoading && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 text-center">
                <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Sensor Not Connected</h2>
                <p className="text-gray-600 mb-4">Unable to connect to the soil sensor. Check that it&apos;s online in the Tuya app.</p>
                <button
                  onClick={fetchSoilSensor}
                  className="text-amber-600 hover:text-amber-700 font-medium"
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        )}

        {/* History Page */}
        {currentPage === "history" && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Watering History</h1>
              <p className="text-gray-500">Track your watering patterns and statistics</p>
            </div>

            {historyLoading && !history && (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}

            {history && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Stats */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 text-white">
                  <div className="text-blue-100 text-sm mb-2">Total Events</div>
                  <div className="text-3xl font-bold">{history.stats.totalEvents}</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-6 text-white">
                  <div className="text-green-100 text-sm mb-2">Last 7 Days</div>
                  <div className="text-3xl font-bold">{history.stats.eventsLast7Days}</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-6 text-white">
                  <div className="text-purple-100 text-sm mb-2">Total Minutes</div>
                  <div className="text-3xl font-bold">{Math.round(history.stats.totalDurationSeconds / 60)}</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white">
                  <div className="text-orange-100 text-sm mb-2">Avg Duration</div>
                  <div className="text-3xl font-bold">{Math.round(history.stats.averageDurationSeconds / 60)}m</div>
                </div>

                {/* Recent Events */}
                <div className="col-span-2 md:col-span-4 bg-white rounded-3xl p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Watering Events</h2>
                  {history.events.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
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
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-3 h-3 rounded-full ${event.ended_at ? "bg-green-500" : "bg-blue-500 animate-pulse"}`} />
                              <div>
                                <div className="font-medium text-gray-800">{event.zones?.name || "Unknown Zone"}</div>
                                <div className="text-sm text-gray-500">
                                  {isToday ? "Today" : startDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                                  {" at "}
                                  {startDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${event.ended_at ? "text-gray-800" : "text-blue-500"}`}>
                                {duration}
                              </div>
                              <div className="text-sm text-gray-500 capitalize">{event.trigger}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="col-span-2 md:col-span-4 text-center">
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
              </div>
            )}

            {!history && !historyLoading && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 text-center">
                <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Database Not Connected</h2>
                <p className="text-gray-600 mb-4">Configure Supabase credentials to enable watering history tracking.</p>
                <button
                  onClick={fetchHistory}
                  className="text-amber-600 hover:text-amber-700 font-medium"
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

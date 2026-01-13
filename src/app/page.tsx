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
}

interface DeviceStatus {
  id: string;
  name: string;
  online: boolean;
  isOn: boolean;
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
    },
  ]);

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isControlling, setIsControlling] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<"home" | "soil" | "rain" | "history">("home");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

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

  const toggleWatering = async (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;

    setIsControlling(zoneId);
    const newState = !zone.isWatering;

    try {
      const response = await fetch(`/api/device/${zone.deviceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: newState ? "on" : "off" }),
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

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          <p>Smart Watering v0.1.0</p>
          <p className="text-xs mt-1">Powered by Tuya Cloud API</p>
        </footer>
      </main>
    </div>
  );
}

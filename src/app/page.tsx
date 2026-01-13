"use client";

import { useState } from "react";

interface WaterZone {
  id: string;
  name: string;
  isWatering: boolean;
  lastWatered: string | null;
  moistureLevel: number | null;
}

export default function Dashboard() {
  const [zones, setZones] = useState<WaterZone[]>([
    {
      id: "zone-1",
      name: "Front Right Garden Hedges",
      isWatering: false,
      lastWatered: null,
      moistureLevel: null,
    },
  ]);

  const [isConnected, setIsConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<"home" | "soil" | "rain" | "history">("home");

  const toggleWatering = (zoneId: string) => {
    setZones((prev) =>
      prev.map((zone) =>
        zone.id === zoneId ? { ...zone, isWatering: !zone.isWatering } : zone
      )
    );
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
                className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-300" : "bg-red-400"}`}
              />
              <span className="text-sm">
                {isConnected ? "Connected" : "Offline"}
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
                className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={() => alert("Water All - Coming soon with Tuya API")}
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
                className="bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={() =>
                  setZones((prev) =>
                    prev.map((z) => ({ ...z, isWatering: false }))
                  )
                }
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

        {/* Watering Zones */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
            Watering Zones
          </h2>
          <div className="space-y-3">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">
                      {zone.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Last: {zone.lastWatered || "Never"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleWatering(zone.id)}
                    className={`w-16 h-8 rounded-full transition-colors relative ${
                      zone.isWatering ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        zone.isWatering ? "translate-x-9" : "translate-x-1"
                      }`}
                    />
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

        {/* Connection Status Card */}
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
                  Setup Required
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Connect your Tuya account to control your smart water tap.
                  Configure API credentials in settings.
                </p>
                <button
                  onClick={() => setIsConnected(true)}
                  className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200 underline"
                >
                  Configure Connection
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          <p>Smart Watering v0.1.0</p>
          <p className="text-xs mt-1">Powered by Tuya Cloud API</p>
        </footer>
      </main>
    </div>
  );
}

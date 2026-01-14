"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const PIN_CODE = "110171";
const STORAGE_KEY = "watering_app_auth";

interface PinLockProps {
  children: React.ReactNode;
}

export default function PinLock({ children }: PinLockProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [rememberBrowser, setRememberBrowser] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check if browser is remembered
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "authenticated") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newPin = pin.split("");
    newPin[index] = value;
    const updatedPin = newPin.join("").slice(0, 6);
    setPin(updatedPin);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 6 digits entered
    if (updatedPin.length === 6) {
      verifyPin(updatedPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === PIN_CODE) {
      if (rememberBrowser) {
        localStorage.setItem(STORAGE_KEY, "authenticated");
      }
      setIsAuthenticated(true);
    } else {
      setError("Incorrect PIN");
      setPin("");
      inputRefs.current[0]?.focus();
    }
  };

  // Show nothing while checking auth status
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show PIN entry if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 relative rounded-full overflow-hidden bg-white shadow-lg">
              <Image
                src="/logo.png"
                alt="The Water App"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            The Water App
          </h1>
          <p className="text-gray-500 text-center mb-8">Enter PIN to continue</p>

          {/* PIN Input */}
          <div className="flex justify-center gap-2 mb-6">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={pin[index] || ""}
                onChange={(e) => handlePinChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2
                  ${error ? "border-red-400 bg-red-50" : "border-gray-200"}
                  focus:border-green-500 focus:outline-none transition-colors`}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-red-500 text-center text-sm mb-4">{error}</p>
          )}

          {/* Remember Browser */}
          <label className="flex items-center justify-center gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberBrowser}
              onChange={(e) => setRememberBrowser(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
            />
            <span className="text-gray-600">Remember this browser</span>
          </label>

          {/* Hint */}
          <p className="text-gray-400 text-center text-xs">
            Enter your 6-digit PIN to access the app
          </p>
        </div>
      </div>
    );
  }

  // Show app if authenticated
  return <>{children}</>;
}

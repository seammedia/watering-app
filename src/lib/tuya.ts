import crypto from "crypto";

const TUYA_ACCESS_ID = process.env.TUYA_ACCESS_ID || "";
const TUYA_ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET || "";
const TUYA_API_ENDPOINT = process.env.TUYA_API_ENDPOINT || "https://openapi.tuyaus.com";

interface TuyaResponse {
  success: boolean;
  code?: number;
  msg?: string;
  t: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
}

interface TuyaTokenResult {
  access_token: string;
  expire_time: number;
  refresh_token: string;
  uid: string;
}

interface TuyaDeviceResult {
  id: string;
  name: string;
  online: boolean;
  status: Array<{ code: string; value: boolean | number | string }>;
}

let cachedToken: { token: string; expiry: number } | null = null;

function generateSign(
  method: string,
  path: string,
  timestamp: string,
  accessToken?: string,
  body?: string
): string {
  const contentHash = crypto
    .createHash("sha256")
    .update(body || "")
    .digest("hex");

  const stringToSign = [method, contentHash, "", path].join("\n");

  const signStr = accessToken
    ? TUYA_ACCESS_ID + accessToken + timestamp + stringToSign
    : TUYA_ACCESS_ID + timestamp + stringToSign;

  return crypto
    .createHmac("sha256", TUYA_ACCESS_SECRET)
    .update(signStr)
    .digest("hex")
    .toUpperCase();
}

export async function getAccessToken(): Promise<string> {
  if (!TUYA_ACCESS_ID || !TUYA_ACCESS_SECRET) {
    throw new Error("Tuya credentials not configured");
  }

  if (cachedToken && Date.now() < cachedToken.expiry) {
    return cachedToken.token;
  }

  const timestamp = Date.now().toString();
  const path = "/v1.0/token?grant_type=1";
  const sign = generateSign("GET", path, timestamp);

  console.log("Tuya Token Request:", {
    endpoint: TUYA_API_ENDPOINT,
    path,
    clientId: TUYA_ACCESS_ID,
    timestamp,
  });

  const response = await fetch(`${TUYA_API_ENDPOINT}${path}`, {
    method: "GET",
    headers: {
      client_id: TUYA_ACCESS_ID,
      sign: sign,
      t: timestamp,
      sign_method: "HMAC-SHA256",
    },
  });

  const data: TuyaResponse = await response.json();
  console.log("Tuya Token Response:", JSON.stringify(data, null, 2));

  if (!data.success) {
    throw new Error(`Tuya auth failed: ${data.code} - ${data.msg}`);
  }

  const result = data.result as TuyaTokenResult;
  cachedToken = {
    token: result.access_token,
    expiry: Date.now() + result.expire_time * 1000 - 60000,
  };

  return cachedToken.token;
}

export async function getDeviceStatus(
  deviceId: string
): Promise<{ device: TuyaDeviceResult | null; error?: string }> {
  try {
    const token = await getAccessToken();
    const timestamp = Date.now().toString();
    const path = `/v1.0/devices/${deviceId}`;
    const sign = generateSign("GET", path, timestamp, token);

    const response = await fetch(`${TUYA_API_ENDPOINT}${path}`, {
      method: "GET",
      headers: {
        client_id: TUYA_ACCESS_ID,
        access_token: token,
        sign: sign,
        t: timestamp,
        sign_method: "HMAC-SHA256",
      },
    });

    const data: TuyaResponse = await response.json();
    console.log("Tuya Device Response:", JSON.stringify(data, null, 2));

    if (!data.success) {
      return { device: null, error: `${data.code}: ${data.msg}` };
    }

    return { device: data.result as TuyaDeviceResult };
  } catch (error) {
    console.error("Error getting device status:", error);
    return {
      device: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendDeviceCommand(
  deviceId: string,
  commands: Array<{ code: string; value: boolean | number | string }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    const timestamp = Date.now().toString();
    const path = `/v1.0/devices/${deviceId}/commands`;
    const body = JSON.stringify({ commands });
    const sign = generateSign("POST", path, timestamp, token, body);

    const response = await fetch(`${TUYA_API_ENDPOINT}${path}`, {
      method: "POST",
      headers: {
        client_id: TUYA_ACCESS_ID,
        access_token: token,
        sign: sign,
        t: timestamp,
        sign_method: "HMAC-SHA256",
        "Content-Type": "application/json",
      },
      body: body,
    });

    const data: TuyaResponse = await response.json();
    console.log("Tuya Command Response:", JSON.stringify(data, null, 2));

    if (!data.success) {
      return { success: false, error: `${data.code}: ${data.msg}` };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending device command:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function turnOnDevice(
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  return sendDeviceCommand(deviceId, [{ code: "switch", value: true }]);
}

export async function turnOffDevice(
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  return sendDeviceCommand(deviceId, [{ code: "switch", value: false }]);
}

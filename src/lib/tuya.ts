import crypto from "crypto";

const TUYA_ACCESS_ID = process.env.TUYA_ACCESS_ID!;
const TUYA_ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET!;
const TUYA_API_ENDPOINT =
  process.env.TUYA_API_ENDPOINT || "https://openapi.tuyaus.com";

interface TuyaTokenResponse {
  result: {
    access_token: string;
    expire_time: number;
    refresh_token: string;
    uid: string;
  };
  success: boolean;
  t: number;
}

interface TuyaDeviceResponse {
  result: {
    id: string;
    name: string;
    online: boolean;
    status: Array<{ code: string; value: boolean | number | string }>;
  };
  success: boolean;
}

interface TuyaCommandResponse {
  result: boolean;
  success: boolean;
  t: number;
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

  const stringToSign = [
    method,
    contentHash,
    "",
    path,
  ].join("\n");

  const signStr = accessToken
    ? TUYA_ACCESS_ID + accessToken + timestamp + stringToSign
    : TUYA_ACCESS_ID + timestamp + stringToSign;

  return crypto
    .createHmac("sha256", TUYA_ACCESS_SECRET)
    .update(signStr)
    .digest("hex")
    .toUpperCase();
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiry) {
    return cachedToken.token;
  }

  const timestamp = Date.now().toString();
  const path = "/v1.0/token?grant_type=1";
  const sign = generateSign("GET", path, timestamp);

  const response = await fetch(`${TUYA_API_ENDPOINT}${path}`, {
    method: "GET",
    headers: {
      client_id: TUYA_ACCESS_ID,
      sign: sign,
      t: timestamp,
      sign_method: "HMAC-SHA256",
    },
  });

  const data: TuyaTokenResponse = await response.json();

  if (!data.success) {
    throw new Error("Failed to get Tuya access token");
  }

  cachedToken = {
    token: data.result.access_token,
    expiry: Date.now() + data.result.expire_time * 1000 - 60000,
  };

  return cachedToken.token;
}

export async function getDeviceStatus(
  deviceId: string
): Promise<TuyaDeviceResponse["result"] | null> {
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

    const data: TuyaDeviceResponse = await response.json();

    if (!data.success) {
      console.error("Failed to get device status:", data);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error("Error getting device status:", error);
    return null;
  }
}

export async function sendDeviceCommand(
  deviceId: string,
  commands: Array<{ code: string; value: boolean | number | string }>
): Promise<boolean> {
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

    const data: TuyaCommandResponse = await response.json();

    if (!data.success) {
      console.error("Failed to send device command:", data);
      return false;
    }

    return data.result;
  } catch (error) {
    console.error("Error sending device command:", error);
    return false;
  }
}

export async function turnOnDevice(deviceId: string): Promise<boolean> {
  return sendDeviceCommand(deviceId, [{ code: "switch", value: true }]);
}

export async function turnOffDevice(deviceId: string): Promise<boolean> {
  return sendDeviceCommand(deviceId, [{ code: "switch", value: false }]);
}

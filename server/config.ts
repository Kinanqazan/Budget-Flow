import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load local .env file natively if it exists (Node 20.12+)
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
} catch {
  // Ignore env loading errors
}

export const config = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  DATA_DIR: process.env.DATA_DIR || "./data",
  JWT_SECRET: process.env.JWT_SECRET || (() => {
    const secret = crypto.randomBytes(32).toString("hex");
    console.warn("JWT_SECRET not set. Generated random secret.");
    console.warn("Set JWT_SECRET env var for production use.");
    return secret;
  })(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  AUTH_ENABLED: process.env.AUTH_ENABLED === "true",
  ASSISTANT_API_TOKEN: process.env.ASSISTANT_API_TOKEN || "",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

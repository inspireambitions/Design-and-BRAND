import Anthropic from "@anthropic-ai/sdk";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const required = [
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "OWNER_NOTIFICATION_EMAIL",
  "EMAIL_FROM",
];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Integration verification stopped. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
if (!emailPattern.test(process.env.OWNER_NOTIFICATION_EMAIL)) {
  console.error("Integration verification stopped. OWNER_NOTIFICATION_EMAIL is invalid.");
  process.exit(1);
}

async function verifyClaude() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
    max_tokens: 24,
    messages: [{ role: "user", content: "Reply with exactly: INTEGRATION_OK" }],
  });
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text.includes("INTEGRATION_OK")) throw new Error("Claude returned an unexpected verification response.");
  console.log("Claude API: verified");
}

async function verifyResend() {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [process.env.OWNER_NOTIFICATION_EMAIL],
      subject: "Inspire Ambitions integration verification",
      text: "Resend is connected to the Career Change Roadmap. This is a one-time verification email.",
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend rejected the verification email with HTTP ${response.status}.`);
  }
  console.log("Resend API: accepted one verification email");
}

try {
  await verifyClaude();
  await verifyResend();
  console.log("Integration verification: passed");
} catch (error) {
  console.error(`Integration verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}

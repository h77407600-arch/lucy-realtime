const requirements = [
  {
    key: "DECART_API_KEY",
    validate: (value) => typeof value === "string" && value.length >= 12,
    message: "must be set to your server-side Decart API key",
  },
  {
    key: "APP_ACCESS_PASSWORD",
    validate: (value) => typeof value === "string" && value.length >= 12,
    message: "must be at least 12 characters",
  },
  {
    key: "SESSION_SECRET",
    validate: (value) => typeof value === "string" && value.length >= 32,
    message: "must be at least 32 characters",
  },
  {
    key: "UPSTASH_REDIS_REST_URL",
    validate: (value) => typeof value === "string" && value.startsWith("https://"),
    message: "must be a valid Upstash REST URL",
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    validate: (value) => typeof value === "string" && value.length >= 16,
    message: "must be set to your Upstash REST token",
  },
];

const optionalChecks = [
  {
    key: "DECART_API_URL",
    validate: (value) => !value || /^https:\/\//.test(value),
    message: "should be an https URL when provided",
  },
  {
    key: "SESSION_TTL_HOURS",
    validate: (value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 168),
    message: "should be an integer between 1 and 168",
  },
  {
    key: "DECART_REALTIME_MODEL",
    validate: (value) => !value || /^[a-z0-9.-]+$/i.test(value),
    message: "should be a Decart realtime model id such as lucy-2.1",
  },
  {
    key: "DECART_TOKEN_EXPIRES_SECONDS",
    validate: (value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 3600),
    message: "should be an integer between 1 and 3600",
  },
  {
    key: "DECART_MAX_SESSION_SECONDS",
    validate: (value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 30 && Number(value) <= 3600),
    message: "should be an integer between 30 and 3600",
  },
  {
    key: "DECART_ALLOWED_ORIGINS",
    validate: (value) => !value || value.split(",").every((origin) => /^https?:\/\/[^/]+$/i.test(origin.trim())),
    message: "should be a comma-separated list of full origins such as https://example.com",
  },
];

const missingOrInvalid = [];
const warnings = [];

for (const requirement of requirements) {
  const value = process.env[requirement.key];
  if (!requirement.validate(value)) {
    missingOrInvalid.push(`${requirement.key}: ${requirement.message}`);
  }
}

for (const check of optionalChecks) {
  const value = process.env[check.key];
  if (!check.validate(value)) {
    warnings.push(`${check.key}: ${check.message}`);
  }
}

if (missingOrInvalid.length > 0) {
  console.error("Production configuration check failed.");
  for (const item of missingOrInvalid) {
    console.error(`- ${item}`);
  }

  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  process.exit(1);
}

console.log("Production configuration check passed.");

if (warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

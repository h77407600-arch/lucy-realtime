const deploymentUrl = process.argv[2];

if (!deploymentUrl) {
  console.error("Usage: node scripts/check-health.mjs https://your-deployment-url");
  process.exit(1);
}

const healthUrl = new URL("/api/health", deploymentUrl).toString();

const response = await fetch(healthUrl, {
  headers: {
    Accept: "application/json",
  },
});

let payload = null;
try {
  payload = await response.json();
} catch {
  payload = null;
}

if (!response.ok || !payload?.ok) {
  console.error(`Health check failed for ${healthUrl}`);
  console.error(`Status: ${response.status}`);
  if (payload) {
    console.error(JSON.stringify(payload, null, 2));
  }
  process.exit(1);
}

console.log(`Health check passed for ${healthUrl}`);
console.log(JSON.stringify(payload, null, 2));

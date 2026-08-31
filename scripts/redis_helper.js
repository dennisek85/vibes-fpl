/**
 * Shared Upstash Redis REST API Helper for Background Sync Scripts
 */

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function saveToRedis(key, data) {
  const config = getRedisConfig();
  if (!config) return false;

  try {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const res = await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`✅ Successfully saved key "${key}" to Upstash Redis.`);
      return true;
    } else {
      console.warn(`⚠️ Redis returned status ${res.status} for key "${key}".`);
      return false;
    }
  } catch (err) {
    console.warn(`⚠️ Redis write error for key "${key}":`, err.message);
    return false;
  }
}

async function loadFromRedis(key) {
  const config = getRedisConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${config.token}` }
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.result === null || json.result === undefined) return null;
    return typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
  } catch (err) {
    console.warn(`⚠️ Redis read error for key "${key}":`, err.message);
    return null;
  }
}

module.exports = {
  saveToRedis,
  loadFromRedis
};

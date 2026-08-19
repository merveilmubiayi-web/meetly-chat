const DEFAULT_PROJECT_ID = 'meetly-0';
const BASE = process.env.FUNCTIONS_BASE_URL || process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL || `https://us-central1-${DEFAULT_PROJECT_ID}.cloudfunctions.net/api`;

async function _post(path, body) {
  const url = `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(json?.message || 'request_failed');
    err.code = resp.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function requestRegistrationCode({ name, username, email, phoneNumber, password }) {
  return _post('/requestRegistrationCode', { name, username, email, phoneNumber, password });
}

async function requestLiveKitToken(room, identity) {
  return _post('/getLiveKitToken', { room, identity });
}

async function confirmRegistrationCode({ email, code }) {
  return _post('/confirmRegistrationCode', { email, code });
}

export { BASE, confirmRegistrationCode, requestRegistrationCode, requestLiveKitToken };


// Example Express endpoint to generate a LiveKit access token.
// Requires environment variables: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL

const express = require('express');
const bodyParser = require('body-parser');
const { AccessToken, RoomServiceClient, VideoGrant } = require('livekit-server-sdk');

const app = express();
app.use(bodyParser.json());

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn('LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set. The endpoint will fail until configured.');
}

app.post('/', async (req, res) => {
  try {
    const { room, identity } = req.body || {};
    if (!identity) return res.status(400).json({ error: 'identity is required' });

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
    // Grant access to a specific room
    const grant = new VideoGrant({ room });
    at.addGrant(grant);

    const token = at.toJwt();
    res.json({ token });
  } catch (err) {
    console.error('Error generating LiveKit token', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`getLiveKitToken example listening on ${port}`));

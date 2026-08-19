const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Utils: generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function encrypt(text) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(data) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  const parts = data.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Email sender via SMTP (configure env vars)
async function sendCodeByEmail(toEmail, code) {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) throw new Error('SMTP_HOST not set');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@meetly.app',
    to: toEmail,
    subject: 'Votre code de confirmation Meetly',
    text: `Votre code Meetly : ${code} (valable 10 minutes)`,
    html: `<p>Votre code Meetly : <strong>${code}</strong> (valable 10 minutes)</p>`,
  });
  return info;
}

// POST /requestRegistrationCode
app.post('/requestRegistrationCode', async (req, res) => {
  try {
    const { name, username, email, phoneNumber, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing parameters' });
    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user exists
    try {
      await admin.auth().getUserByEmail(normalizedEmail);
      return res.status(409).json({ message: 'Email already in use' });
    } catch (e) {
      // not found -> proceed
    }

    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));

    // encrypt password before storing
    const encryptedPassword = encrypt(password);

    await db.collection('registrationRequests').doc(normalizedEmail).set({
      name: name || null,
      username: username || null,
      email: normalizedEmail,
      phoneNumber: phoneNumber || null,
      codeHash,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      encryptedPassword,
    });

    // send email
    await sendCodeByEmail(normalizedEmail, code);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'internal_error' });
  }
});

// POST /confirmRegistrationCode
app.post('/confirmRegistrationCode', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Missing parameters' });
    const normalizedEmail = String(email).trim().toLowerCase();

    const docRef = db.collection('registrationRequests').doc(normalizedEmail);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ message: 'request_not_found' });
    const data = docSnap.data();

    // check expiry
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      await docRef.delete().catch(() => {});
      return res.status(410).json({ message: 'code_expired' });
    }

    const codeHash = hashCode(String(code));
    if (codeHash !== data.codeHash) return res.status(400).json({ message: 'invalid_code' });

    // decrypt password and create user
    const password = decrypt(data.encryptedPassword);

    const userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      emailVerified: true,
      password,
      displayName: data.name || null,
    });

    // create Firestore user document
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      displayName: data.name || '',
      username: data.username || '',
      email: normalizedEmail,
      phoneNumber: data.phoneNumber || null,
      photoURL: null,
      bio: '',
      region: null,
      isVerified: false,
      isEmailVerified: true,
      isPhoneVerified: false,
      phoneVerificationPending: Boolean(data.phoneNumber),
      blockedUsers: [],
      followers: [],
      following: [],
      friends: [],
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // cleanup
    await docRef.delete().catch(() => {});

    return res.json({ uid: userRecord.uid, displayName: userRecord.displayName || null, photoURL: userRecord.photoURL || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'internal_error' });
  }
});

exports.api = functions.https.onRequest(app);

// POST /getLiveKitToken - generate a LiveKit access token (server-side)
app.post('/getLiveKitToken', async (req, res) => {
  try {
    const { room, identity } = req.body || {};
    if (!identity) return res.status(400).json({ message: 'identity_required' });

    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.warn('LiveKit env vars not set');
      return res.status(500).json({ message: 'livekit_not_configured' });
    }

    const { AccessToken, VideoGrant } = require('livekit-server-sdk');
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
    const grant = new VideoGrant({ room });
    at.addGrant(grant);
    const token = at.toJwt();
    return res.json({ token });
  } catch (err) {
    console.error('getLiveKitToken error', err);
    return res.status(500).json({ message: 'internal_error' });
  }
});

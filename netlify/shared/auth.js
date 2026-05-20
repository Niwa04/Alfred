const crypto = require('crypto');

const { getDatabaseClient, normalizeDatabaseRows } = require('./database');

const COOKIE_NAME = 'alfred_session';
const DEFAULT_MEMBER_PASSWORD = 'Alfred2026';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours
const ARTIST_ROLES = ['chanteur', 'comedien', 'danseur'];

function normalizeArtistRoles(value) {
  let roles = value;

  if (typeof roles === 'string') {
    try {
      roles = JSON.parse(roles);
    } catch (error) {
      roles = roles.split(',');
    }
  }

  if (!Array.isArray(roles)) {
    roles = [];
  }

  return [...new Set(
    roles
      .map((role) => String(role || '').trim().toLowerCase())
      .filter((role) => ARTIST_ROLES.includes(role))
  )];
}

function normalizeMember(member) {
  const username = member.username;
  const displayName = member.displayName || member.display_name || username;
  const role = member.role === 'admin' ? 'admin' : 'member';
  const imagePath = member.imagePath || member.image_path || '';
  const artistRoles = normalizeArtistRoles(member.artistRoles || member.artist_roles);
  const age = Number.parseInt(member.age, 10);
  const displayRole = member.displayRole || member.display_role || '';
  const description = member.description || '';
  const gallery = normalizeGallery(member.gallery);
  const displayOrder = Number.parseInt(member.displayOrder || member.display_order, 10);

  return {
    username,
    displayName,
    role,
    imagePath,
    artistRoles,
    age: Number.isFinite(age) ? age : null,
    displayRole,
    description,
    gallery,
    displayOrder: Number.isFinite(displayOrder) ? displayOrder : null
  };
}

function normalizeGallery(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function isAdmin(member) {
  return member?.role === 'admin';
}

function serializeMember(member) {
  const normalizedMember = normalizeMember(member);

  return {
    username: normalizedMember.username,
    displayName: normalizedMember.displayName,
    role: normalizedMember.role,
    imagePath: normalizedMember.imagePath,
    artistRoles: normalizedMember.artistRoles,
    age: normalizedMember.age,
    displayRole: normalizedMember.displayRole,
    description: normalizedMember.description,
    gallery: normalizedMember.gallery,
    displayOrder: normalizedMember.displayOrder,
    canManagePlanning: isAdmin(normalizedMember)
  };
}

async function ensureMemberSessionColumns(db) {
  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS image_path TEXT
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS artist_roles JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS age INTEGER
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS display_role TEXT
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS description TEXT
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS display_order INTEGER
  `;
}

async function findDatabaseMember(db, username) {
  await ensureMemberSessionColumns(db);

  const result = await db.sql`
    SELECT username, display_name, role, image_path, artist_roles, age, display_role, description, gallery, display_order
    FROM members
    WHERE lower(username) = lower(${username})
    LIMIT 1
  `;
  const rows = normalizeDatabaseRows(result);

  return rows[0] || null;
}

async function findMember(username = '') {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) return null;

  const db = await getDatabaseClient();
  const member = await findDatabaseMember(db, normalizedUsername);

  return member ? normalizeMember(member) : null;
}

function getMemberPassword() {
  return (process.env.MEMBER_PASSWORD || DEFAULT_MEMBER_PASSWORD).trim();
}

function getSessionSecret() {
  return (process.env.SESSION_SECRET || process.env.MEMBER_PASSWORD || DEFAULT_MEMBER_PASSWORD).trim();
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyPassword(password = '') {
  const expectedPassword = getMemberPassword();
  return Boolean(expectedPassword) && timingSafeEqual(String(password).trim(), expectedPassword);
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
}

function createSessionCookie(member) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = base64UrlEncode(JSON.stringify({ username: member.username, expiresAt }));
  const signature = signPayload(payload);
  const cookieValue = `${payload}.${signature}`;

  return `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

function createExpiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) return cookies;

      const name = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);
      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
}

async function getSessionMember(event) {
  const secret = getSessionSecret();
  if (!secret) return null;

  const headers = event.headers || {};
  const cookies = parseCookies(headers.cookie || headers.Cookie || '');
  const session = cookies[COOKIE_NAME];
  if (!session) return null;

  const [payload, signature] = session.split('.');
  if (!payload || !signature || !timingSafeEqual(signature, signPayload(payload))) {
    return null;
  }

  let sessionData;
  try {
    sessionData = JSON.parse(base64UrlDecode(payload));
  } catch (error) {
    return null;
  }

  if (!sessionData.expiresAt || sessionData.expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return findMember(sessionData.username);
}

function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    },
    body: JSON.stringify(body)
  };
}

module.exports = {
  createExpiredSessionCookie,
  createSessionCookie,
  findMember,
  getSessionMember,
  isAdmin,
  jsonResponse,
  serializeMember,
  verifyPassword
};

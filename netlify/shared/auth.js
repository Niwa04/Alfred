const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { getDatabaseClient } = require('./database');

const COOKIE_NAME = 'alfred_session';
const DEFAULT_MEMBER_PASSWORD = 'Alfred2026';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

function normalizeMember(member) {
  const username = member.username;
  const displayName = member.displayName || member.display_name || username;
  const role = member.role === 'admin' ? 'admin' : 'member';

  return { username, displayName, role };
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
    canManagePlanning: isAdmin(normalizedMember)
  };
}

function getExtraMembers() {
  return (process.env.MEMBER_USERS || '')
    .split(',')
    .map((username) => username.trim())
    .filter(Boolean)
    .map((username) => normalizeMember({ username, displayName: username, role: 'member' }));
}

function getFileMembers() {
  try {
    const membersPath = path.join(__dirname, '..', 'data', 'members.json');
    const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
    return Array.isArray(members) ? members.map(normalizeMember) : [];
  } catch (error) {
    return [];
  }
}

function findLocalMember(username) {
  const normalizedUsername = username.trim().toLowerCase();
  return [...getFileMembers(), ...getExtraMembers()].find(
    (member) => member.username.toLowerCase() === normalizedUsername
  );
}

async function findMember(username = '') {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) return null;

  let member;

  try {
    const db = await getDatabaseClient();
    const rows = await db.sql`
      SELECT username, display_name, role
      FROM members
      WHERE lower(username) = lower(${normalizedUsername})
      LIMIT 1
    `;
    member = rows[0];
  } catch (error) {
    member = findLocalMember(normalizedUsername);
  }

  member = member || findLocalMember(normalizedUsername);

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

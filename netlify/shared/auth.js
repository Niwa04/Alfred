const crypto = require('crypto');

const COOKIE_NAME = 'alfred_session';
const DEFAULT_MEMBER_PASSWORD = 'Alfred2026';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours
const MEMBERS = require('../data/members.json');

function getAllowedMembers() {
  const extraMembers = (process.env.MEMBER_USERS || '')
    .split(',')
    .map((username) => username.trim())
    .filter(Boolean)
    .map((username) => ({ username, displayName: username, role: 'member' }));

  return [...MEMBERS, ...extraMembers];
}

function normalizeMember(member) {
  const role = member.role === 'admin' ? 'admin' : 'member';

  return {
    username: member.username,
    displayName: member.displayName || member.username,
    role
  };
}

function findMember(username = '') {
  const normalizedUsername = username.trim().toLowerCase();
  const member = getAllowedMembers().find((allowedMember) => allowedMember.username.toLowerCase() === normalizedUsername);

  return member ? normalizeMember(member) : null;
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

function getMemberPassword() {
  return process.env.MEMBER_PASSWORD || DEFAULT_MEMBER_PASSWORD;
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.MEMBER_PASSWORD || DEFAULT_MEMBER_PASSWORD;
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

function getSessionMember(event) {
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

  try {
    const sessionData = JSON.parse(base64UrlDecode(payload));
    if (!sessionData.expiresAt || sessionData.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return findMember(sessionData.username) || null;
  } catch (error) {
    return null;
  }
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
  serializeMember,
  jsonResponse,
  verifyPassword
};

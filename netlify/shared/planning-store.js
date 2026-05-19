const { getDatabaseClient, normalizeDatabaseRows } = require('./database');

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

function normalizeDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value || '').slice(0, 10).trim();
}

function normalizeTime(value) {
  return String(value || '').slice(0, 5).trim();
}

function normalizeEvent(event) {
  return {
    id: String(event.id || `${event.date || event.event_date}-${event.time || event.event_time}-${event.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    date: normalizeDate(event.date || event.event_date),
    time: normalizeTime(event.time || event.event_time),
    title: String(event.title || '').trim(),
    location: String(event.location || '').trim(),
    targetRoles: normalizeArtistRoles(event.targetRoles || event.target_roles),
    attendees: event.attendees || [],
    currentUserIsPresent: Boolean(event.currentUserIsPresent)
  };
}

function validateEvent(event) {
  const normalizedEvent = normalizeEvent(event);

  if (!normalizedEvent.date || !normalizedEvent.time || !normalizedEvent.title || !normalizedEvent.location) {
    return { error: 'La date, l’heure, le titre et le lieu sont obligatoires.' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedEvent.date)) {
    return { error: 'La date doit être au format AAAA-MM-JJ.' };
  }

  if (!/^\d{2}:\d{2}$/.test(normalizedEvent.time)) {
    return { error: 'L’heure doit être au format HH:MM.' };
  }

  return { event: normalizedEvent };
}

function sortEvents(events) {
  return [...events].sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
}

async function ensurePlanningAttendanceTables(db) {
  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS image_path TEXT
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS artist_roles JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await db.sql`
    ALTER TABLE planning_events
    ADD COLUMN IF NOT EXISTS target_roles JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS planning_attendance (
      event_id BIGINT NOT NULL REFERENCES planning_events(id) ON DELETE CASCADE,
      username TEXT NOT NULL REFERENCES members(username) ON DELETE CASCADE,
      is_present BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, username)
    )
  `;
}

async function getMemberForPlanning(db, username = '') {
  const normalizedUsername = String(username || '').trim();
  if (!normalizedUsername) return null;

  const result = await db.sql`
    SELECT username, role, artist_roles
    FROM members
    WHERE lower(username) = lower(${normalizedUsername})
    LIMIT 1
  `;
  const member = normalizeDatabaseRows(result)[0];
  if (!member) return null;

  return {
    username: member.username,
    role: member.role === 'admin' ? 'admin' : 'member',
    artistRoles: normalizeArtistRoles(member.artist_roles)
  };
}

function eventIsVisibleForMember(event, member) {
  const targetRoles = normalizeArtistRoles(event.target_roles || event.targetRoles);
  if (!targetRoles.length) return true;
  if (member?.role === 'admin') return true;

  const memberRoles = normalizeArtistRoles(member?.artistRoles || member?.artist_roles);
  return targetRoles.some((role) => memberRoles.includes(role));
}

function normalizeAttendee(attendee) {
  return {
    username: attendee.username,
    displayName: attendee.displayName || attendee.display_name || attendee.username,
    imagePath: attendee.imagePath || attendee.image_path || ''
  };
}

async function getEventAttendees(db, eventId) {
  const result = await db.sql`
    SELECT members.username, members.display_name, members.image_path
    FROM planning_attendance
    INNER JOIN members ON members.username = planning_attendance.username
    WHERE planning_attendance.event_id = ${eventId}
      AND planning_attendance.is_present = true
    ORDER BY members.display_name ASC, members.username ASC
  `;

  return normalizeDatabaseRows(result).map(normalizeAttendee);
}

async function getPlanningEvents(currentUsername = '') {
  const db = await getDatabaseClient();
  await ensurePlanningAttendanceTables(db);
  const currentMember = await getMemberForPlanning(db, currentUsername);

  const result = await db.sql`
    SELECT id, event_date, event_time, title, location, target_roles
    FROM planning_events
    ORDER BY event_date ASC, event_time ASC, id ASC
  `;
  const events = normalizeDatabaseRows(result).filter((event) => (
    currentUsername ? eventIsVisibleForMember(event, currentMember) : true
  ));

  const normalizedEvents = [];

  for (const event of events) {
    const currentAttendanceResult = currentUsername
      ? await db.sql`
          SELECT is_present
          FROM planning_attendance
          WHERE event_id = ${event.id}
            AND lower(username) = lower(${currentUsername})
          LIMIT 1
        `
      : [];
    const currentAttendance = normalizeDatabaseRows(currentAttendanceResult)[0];

    normalizedEvents.push(normalizeEvent({
      ...event,
      attendees: await getEventAttendees(db, event.id),
      currentUserIsPresent: currentAttendance?.is_present === true
    }));
  }

  return normalizedEvents;
}

async function addPlanningEvent(event, createdBy) {
  const validation = validateEvent(event);
  if (validation.error) {
    return validation;
  }

  let db;

  try {
    db = await getDatabaseClient();
  } catch (error) {
    return { error: 'La base de données Netlify est nécessaire pour ajouter une date.' };
  }

  const result = await db.sql`
    INSERT INTO planning_events (event_date, event_time, title, location, target_roles, created_by)
    VALUES (${validation.event.date}::date, ${validation.event.time}::time, ${validation.event.title}, ${validation.event.location}, ${JSON.stringify(validation.event.targetRoles)}::jsonb, ${createdBy})
    ON CONFLICT (event_date, event_time, title, location) DO NOTHING
    RETURNING id, event_date, event_time, title, location, target_roles
  `;
  const rows = normalizeDatabaseRows(result);

  if (!rows[0]) {
    return { error: 'Cette date existe déjà dans le planning.' };
  }

  const addedEvent = normalizeEvent(rows[0]);

  return {
    event: addedEvent,
    events: sortEvents([...(await getPlanningEvents(createdBy))])
  };
}

async function deletePlanningEvent(id) {
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return { error: 'Date introuvable.' };
  }

  const db = await getDatabaseClient();
  const result = await db.sql`
    DELETE FROM planning_events
    WHERE id = ${eventId}
    RETURNING id
  `;
  const rows = normalizeDatabaseRows(result);

  if (!rows[0]) {
    return { error: 'Date introuvable.' };
  }

  return {
    deletedId: String(eventId),
    events: await getPlanningEvents()
  };
}

async function updatePlanningAttendance(eventId, username, isPresent) {
  const normalizedEventId = Number(eventId);
  const normalizedUsername = String(username || '').trim();

  if (!Number.isInteger(normalizedEventId) || normalizedEventId <= 0 || !normalizedUsername) {
    return { error: 'Evenement introuvable.' };
  }

  const db = await getDatabaseClient();
  await ensurePlanningAttendanceTables(db);

  const eventResult = await db.sql`
    SELECT id, target_roles
    FROM planning_events
    WHERE id = ${normalizedEventId}
    LIMIT 1
  `;

  const event = normalizeDatabaseRows(eventResult)[0];
  const member = await getMemberForPlanning(db, normalizedUsername);

  if (!event || !eventIsVisibleForMember(event, member)) {
    return { error: 'Evenement introuvable.' };
  }

  await db.sql`
    INSERT INTO planning_attendance (event_id, username, is_present, updated_at)
    VALUES (${normalizedEventId}, ${normalizedUsername}, ${Boolean(isPresent)}, NOW())
    ON CONFLICT (event_id, username) DO UPDATE SET
      is_present = EXCLUDED.is_present,
      updated_at = NOW()
  `;

  return {
    events: await getPlanningEvents(normalizedUsername)
  };
}

module.exports = {
  ARTIST_ROLES,
  addPlanningEvent,
  deletePlanningEvent,
  getPlanningEvents,
  normalizeArtistRoles,
  updatePlanningAttendance,
  validateEvent
};

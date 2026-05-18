const { getDatabaseClient, normalizeDatabaseRows } = require('./database');

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
    location: String(event.location || '').trim()
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

async function getPlanningEvents() {
  const db = await getDatabaseClient();
  const result = await db.sql`
    SELECT id, event_date, event_time, title, location
    FROM planning_events
    ORDER BY event_date ASC, event_time ASC, id ASC
  `;
  const events = normalizeDatabaseRows(result);

  return events.map(normalizeEvent);
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
    INSERT INTO planning_events (event_date, event_time, title, location, created_by)
    VALUES (${validation.event.date}::date, ${validation.event.time}::time, ${validation.event.title}, ${validation.event.location}, ${createdBy})
    ON CONFLICT (event_date, event_time, title, location) DO NOTHING
    RETURNING id, event_date, event_time, title, location
  `;
  const rows = normalizeDatabaseRows(result);

  if (!rows[0]) {
    return { error: 'Cette date existe déjà dans le planning.' };
  }

  const addedEvent = normalizeEvent(rows[0]);

  return {
    event: addedEvent,
    events: sortEvents([...(await getPlanningEvents())])
  };
}

module.exports = {
  addPlanningEvent,
  getPlanningEvents,
  validateEvent
};

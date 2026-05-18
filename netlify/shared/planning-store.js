const defaultPlanningEvents = require('../data/planning.json');

const STORE_NAME = 'alfred-planning';
const CUSTOM_EVENTS_KEY = 'custom-events';

function normalizeEvent(event) {
  return {
    id: event.id || `${event.date}-${event.time}-${event.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    date: String(event.date || '').trim(),
    time: String(event.time || '').trim(),
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

async function getBlobStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    return getStore(STORE_NAME);
  } catch (error) {
    return null;
  }
}

async function getCustomEvents() {
  const store = await getBlobStore();
  if (!store) return [];

  const events = await store.get(CUSTOM_EVENTS_KEY, { type: 'json' });
  return Array.isArray(events) ? events.map(normalizeEvent) : [];
}

async function getPlanningEvents() {
  const customEvents = await getCustomEvents();
  return sortEvents([...defaultPlanningEvents.map(normalizeEvent), ...customEvents]);
}

async function addPlanningEvent(event) {
  const validation = validateEvent(event);
  if (validation.error) {
    return validation;
  }

  const store = await getBlobStore();
  if (!store) {
    return { error: 'Le stockage Netlify Blobs n’est pas disponible.' };
  }

  const customEvents = await getCustomEvents();
  const eventWithId = {
    ...validation.event,
    id: `${Date.now()}-${validation.event.id}`
  };

  await store.setJSON(CUSTOM_EVENTS_KEY, [...customEvents, eventWithId]);

  return { event: eventWithId, events: await getPlanningEvents() };
}

module.exports = {
  addPlanningEvent,
  getPlanningEvents,
  validateEvent
};

const { addPlanningEvent } = require('../shared/planning-store');
const { getSessionMember, isAdmin, jsonResponse } = require('../shared/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  }

  const member = getSessionMember(event);
  if (!member) {
    return jsonResponse(401, { error: 'Connexion requise.' });
  }

  if (!isAdmin(member)) {
    return jsonResponse(403, { error: 'Accès réservé aux administrateurs.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Requête invalide.' });
  }

  const result = await addPlanningEvent(payload);
  if (result.error) {
    return jsonResponse(400, { error: result.error });
  }

  return jsonResponse(201, {
    event: result.event,
    events: result.events
  });
};

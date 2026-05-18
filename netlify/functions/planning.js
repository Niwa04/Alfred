const { getSessionMember, jsonResponse } = require('../shared/auth');

const PLANNING_EVENTS = require('../data/planning.json');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });
  }

  const member = getSessionMember(event);
  if (!member) {
    return jsonResponse(401, { error: 'Connexion requise.' });
  }

  return jsonResponse(200, {
    message: `Bonjour ${member.displayName}`,
    member: { username: member.username, displayName: member.displayName },
    events: PLANNING_EVENTS
  });
};

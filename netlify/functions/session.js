const { getSessionMember, jsonResponse } = require('../shared/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });
  }

  const member = getSessionMember(event);
  if (!member) {
    return jsonResponse(401, { authenticated: false });
  }

  return jsonResponse(200, {
    authenticated: true,
    member: { username: member.username, displayName: member.displayName }
  });
};

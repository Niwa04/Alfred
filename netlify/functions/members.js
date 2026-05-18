const { getSessionMember, isAdmin, jsonResponse } = require('../shared/auth');
const { AVAILABLE_IMAGES, getMembers } = require('../shared/member-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Methode non autorisee.' }, { Allow: 'GET' });
  }

  let member;
  try {
    member = await getSessionMember(event);
  } catch (error) {
    return jsonResponse(503, { error: 'La base de donnees Netlify n est pas disponible.' });
  }

  if (!member) {
    return jsonResponse(401, { error: 'Connexion requise.' });
  }

  if (!isAdmin(member)) {
    return jsonResponse(403, { error: 'Acces reserve aux administrateurs.' });
  }

  try {
    return jsonResponse(200, {
      member,
      images: AVAILABLE_IMAGES,
      members: await getMembers()
    });
  } catch (error) {
    return jsonResponse(503, { error: 'La base de donnees Netlify n est pas disponible.' });
  }
};

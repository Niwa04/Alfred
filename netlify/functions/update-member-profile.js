const { getSessionMember, isAdmin, jsonResponse } = require('../shared/auth');
const { updateMemberProfile } = require('../shared/member-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Methode non autorisee.' }, { Allow: 'POST' });
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

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Requete invalide.' });
  }

  const targetUsername = isAdmin(member) && payload.username ? payload.username : member.username;

  try {
    const result = await updateMemberProfile(targetUsername, {
      displayName: payload.displayName,
      imagePath: payload.imagePath,
      artistRoles: payload.artistRoles,
      age: payload.age,
      displayRole: payload.displayRole,
      description: payload.description,
      gallery: payload.gallery,
      displayOrder: payload.displayOrder
    });
    if (result.error) {
      return jsonResponse(400, { error: result.error });
    }

    return jsonResponse(200, {
      member: result.member
    });
  } catch (error) {
    return jsonResponse(503, { error: 'La base de donnees Netlify n est pas disponible.' });
  }
};

const { jsonResponse } = require('../shared/auth');
const { getMembers } = require('../shared/member-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Methode non autorisee.' }, { Allow: 'GET' });
  }

  try {
    const members = await getMembers();
    return jsonResponse(200, {
      members: members.map((member) => ({
        username: member.username,
        displayName: member.displayName,
        imagePath: member.imagePath,
        artistRoles: member.artistRoles,
        age: member.age,
        displayRole: member.displayRole,
        description: member.description,
        gallery: member.gallery,
        displayOrder: member.displayOrder
      }))
    });
  } catch (error) {
    return jsonResponse(503, { error: 'La base de donnees Netlify n est pas disponible.' });
  }
};

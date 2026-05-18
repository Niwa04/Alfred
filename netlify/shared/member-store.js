const { getDatabaseClient, normalizeDatabaseRows } = require('./database');

const AVAILABLE_IMAGES = [
  'assets/membres/alfred_proxy.png',
  'assets/membres/ambre_proxy.png',
  'assets/membres/aylin_proxy.png',
  'assets/membres/benji_proxy.png',
  'assets/membres/ezio_proxy.png',
  'assets/membres/luse_proxy.png',
  'assets/membres/majda_proxy.png',
  'assets/membres/marie_proxy.png',
  'assets/membres/niwa_proxy.png',
  'assets/membres/noah_proxy.png',
  'assets/membres/stacy_proxy.png',
  'assets/membres/tom_eliott_proxy.png'
];

const DEFAULT_MEMBER_IMAGES = {
  Ambre: 'assets/membres/ambre_proxy.png',
  Ayline: 'assets/membres/aylin_proxy.png',
  Ezio: 'assets/membres/ezio_proxy.png',
  Luce: 'assets/membres/luse_proxy.png',
  Majda: 'assets/membres/majda_proxy.png',
  Marie: 'assets/membres/marie_proxy.png',
  Niwa: 'assets/membres/niwa_proxy.png',
  Noah: 'assets/membres/noah_proxy.png',
  Stecy: 'assets/membres/stacy_proxy.png',
  Thomas: 'assets/membres/alfred_proxy.png',
  TomEliott: 'assets/membres/tom_eliott_proxy.png'
};

function normalizeMember(row) {
  return {
    username: row.username,
    displayName: row.displayName || row.display_name || row.username,
    role: row.role === 'admin' ? 'admin' : 'member',
    imagePath: row.imagePath || row.image_path || DEFAULT_MEMBER_IMAGES[row.username] || ''
  };
}

function validateImagePath(imagePath = '') {
  const normalizedPath = String(imagePath).trim();

  if (!normalizedPath) {
    return { imagePath: '' };
  }

  if (!/^assets\/(?:membres\/)?[\w .'-]+\.png$/i.test(normalizedPath) || normalizedPath.includes('..')) {
    return { error: 'Chemin d image invalide.' };
  }

  return { imagePath: normalizedPath };
}

async function ensureMemberImageColumn(db) {
  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS image_path TEXT
  `;

  for (const [username, imagePath] of Object.entries(DEFAULT_MEMBER_IMAGES)) {
    await db.sql`
      UPDATE members
      SET image_path = COALESCE(NULLIF(image_path, ''), ${imagePath})
      WHERE username = ${username}
    `;
  }
}

async function getMembers() {
  const db = await getDatabaseClient();
  await ensureMemberImageColumn(db);

  const result = await db.sql`
    SELECT username, display_name, role, image_path
    FROM members
    ORDER BY display_name ASC, username ASC
  `;

  return normalizeDatabaseRows(result).map(normalizeMember);
}

async function updateMemberImage(username = '', imagePath = '') {
  const normalizedUsername = String(username).trim();
  if (!normalizedUsername) {
    return { error: 'Membre introuvable.' };
  }

  const validation = validateImagePath(imagePath);
  if (validation.error) {
    return validation;
  }

  const db = await getDatabaseClient();
  await ensureMemberImageColumn(db);

  const result = await db.sql`
    UPDATE members
    SET image_path = ${validation.imagePath}
    WHERE lower(username) = lower(${normalizedUsername})
    RETURNING username, display_name, role, image_path
  `;
  const rows = normalizeDatabaseRows(result);

  if (!rows[0]) {
    return { error: 'Membre introuvable.' };
  }

  return {
    member: normalizeMember(rows[0]),
    members: await getMembers()
  };
}

module.exports = {
  AVAILABLE_IMAGES,
  getMembers,
  updateMemberImage
};

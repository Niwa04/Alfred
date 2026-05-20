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

const ARTIST_ROLES = ['chanteur', 'comedien', 'danseur'];
const DEFAULT_MEMBER_PROFILES = {
  Marie: { displayOrder: 1, displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Thomas: { displayOrder: 2, displayName: 'Alfred', displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  TomEliott: { displayOrder: 3, displayName: 'Tom Eliott', displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Ezio: { displayOrder: 4, displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Noah: { displayOrder: 5, displayRole: 'Artiste / producteur', description: 'Membre de la troupe ALFRED.' },
  Ambre: { displayOrder: 6, displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Stecy: { displayOrder: 7, displayName: 'Stacy', displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Luce: { displayOrder: 8, displayName: 'Luse', displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Niwa: { displayOrder: 9, displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Ayline: { displayOrder: 10, displayName: 'Aylin', displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' },
  Majda: { displayOrder: 11, displayRole: 'Artiste', description: 'Membre de la troupe ALFRED.' }
};

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

function normalizeMember(row) {
  const defaults = DEFAULT_MEMBER_PROFILES[row.username] || {};
  const storedDisplayName = row.displayName || row.display_name;

  return {
    username: row.username,
    displayName: storedDisplayName && storedDisplayName !== row.username ? storedDisplayName : defaults.displayName || storedDisplayName || row.username,
    role: row.role === 'admin' ? 'admin' : 'member',
    imagePath: row.imagePath || row.image_path || DEFAULT_MEMBER_IMAGES[row.username] || '',
    artistRoles: normalizeArtistRoles(row.artistRoles || row.artist_roles),
    age: normalizeAge(row.age),
    displayRole: row.displayRole || row.display_role || defaults.displayRole || '',
    description: row.description || defaults.description || '',
    gallery: normalizeGallery(row.gallery),
    displayOrder: normalizeDisplayOrder(row.displayOrder || row.display_order) ?? defaults.displayOrder ?? null
  };
}

function normalizeAge(value) {
  const age = Number.parseInt(value, 10);
  return Number.isFinite(age) && age > 0 && age < 130 ? age : null;
}

function normalizeDisplayOrder(value) {
  const order = Number.parseInt(value, 10);
  return Number.isFinite(order) && order > 0 && order < 1000 ? order : null;
}

function normalizeGallery(value) {
  let gallery = value;

  if (typeof gallery === 'string') {
    try {
      gallery = JSON.parse(gallery);
    } catch (error) {
      gallery = gallery
        .split('\n')
        .map((url) => ({ url }));
    }
  }

  if (!Array.isArray(gallery)) {
    gallery = [];
  }

  return gallery
    .map((item) => normalizeGalleryItem(item))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeGalleryItem(item) {
  const rawUrl = typeof item === 'string' ? item : item?.url;
  const url = String(rawUrl || '').trim();
  if (!url || url.includes('<') || url.includes('>')) return null;

  const type = getGalleryItemType(url);
  if (!type) return null;

  return {
    type,
    url,
    title: String(item?.title || '').trim().slice(0, 80)
  };
}

function getGalleryItemType(url) {
  if (/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[\w-]+/i.test(url)) {
    return 'youtube';
  }

  if (/^assets\/[\w ./'-]+\.(?:png|jpe?g|webp|gif|mp4|webm)$/i.test(url) && !url.includes('..')) {
    return /\.(?:mp4|webm)$/i.test(url) ? 'video' : 'image';
  }

  if (/^https:\/\/[\w.-]+\/[^\s<>]+\.(?:png|jpe?g|webp|gif|mp4|webm)(?:\?[^\s<>]*)?$/i.test(url)) {
    return /\.(?:mp4|webm)(?:\?|$)/i.test(url) ? 'video' : 'image';
  }

  return null;
}

function validateImagePath(imagePath = '') {
  const normalizedPath = String(imagePath).trim();

  if (!normalizedPath) {
    return { imagePath: '' };
  }

  const isLocalImage = /^assets\/(?:membres\/)?[\w .'-]+\.(?:png|jpe?g|webp|gif)$/i.test(normalizedPath)
    && !normalizedPath.includes('..');
  const isRemoteImage = /^https:\/\/[^\s<>]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>]*)?$/i.test(normalizedPath);

  if (!isLocalImage && !isRemoteImage) {
    return { error: 'Chemin d image invalide.' };
  }

  return { imagePath: normalizedPath };
}

async function ensureMemberImageColumn(db) {
  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS image_path TEXT
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS artist_roles JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS age INTEGER
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS display_role TEXT
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS description TEXT
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await db.sql`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS display_order INTEGER
  `;

  for (const [username, imagePath] of Object.entries(DEFAULT_MEMBER_IMAGES)) {
    const profile = DEFAULT_MEMBER_PROFILES[username] || {};
    await db.sql`
      UPDATE members
      SET
        display_name = COALESCE(NULLIF(display_name, ''), ${profile.displayName || username}),
        image_path = COALESCE(NULLIF(image_path, ''), ${imagePath}),
        display_role = COALESCE(NULLIF(display_role, ''), ${profile.displayRole || ''}),
        description = COALESCE(NULLIF(description, ''), ${profile.description || ''}),
        display_order = COALESCE(display_order, ${profile.displayOrder || null})
      WHERE username = ${username}
    `;
  }
}

async function getMembers() {
  const db = await getDatabaseClient();
  await ensureMemberImageColumn(db);

  const result = await db.sql`
    SELECT username, display_name, role, image_path, artist_roles, age, display_role, description, gallery, display_order
    FROM members
    ORDER BY COALESCE(display_order, 999) ASC, display_name ASC, username ASC
  `;

  return normalizeDatabaseRows(result).map(normalizeMember);
}

async function updateMemberImage(username = '', imagePath = '') {
  return updateMemberProfile(username, { imagePath });
}

async function updateMemberProfile(username = '', profile = {}) {
  const normalizedUsername = String(username).trim();
  if (!normalizedUsername) {
    return { error: 'Membre introuvable.' };
  }

  const shouldUpdateImage = Object.prototype.hasOwnProperty.call(profile, 'imagePath');
  const validation = shouldUpdateImage ? validateImagePath(profile.imagePath) : { imagePath: null };
  if (validation.error) {
    return validation;
  }
  const shouldUpdateArtistRoles = Object.prototype.hasOwnProperty.call(profile, 'artistRoles');
  const shouldUpdateDisplayName = Object.prototype.hasOwnProperty.call(profile, 'displayName');
  const shouldUpdateAge = Object.prototype.hasOwnProperty.call(profile, 'age');
  const shouldUpdateDisplayRole = Object.prototype.hasOwnProperty.call(profile, 'displayRole');
  const shouldUpdateDescription = Object.prototype.hasOwnProperty.call(profile, 'description');
  const shouldUpdateGallery = Object.prototype.hasOwnProperty.call(profile, 'gallery');
  const shouldUpdateDisplayOrder = Object.prototype.hasOwnProperty.call(profile, 'displayOrder');
  const artistRoles = normalizeArtistRoles(profile.artistRoles);
  const age = normalizeAge(profile.age);
  const displayName = String(profile.displayName || '').trim().slice(0, 80);
  const displayRole = String(profile.displayRole || '').trim().slice(0, 80);
  const description = String(profile.description || '').trim().slice(0, 700);
  const gallery = normalizeGallery(profile.gallery);
  const displayOrder = normalizeDisplayOrder(profile.displayOrder);

  const db = await getDatabaseClient();
  await ensureMemberImageColumn(db);

  const result = await db.sql`
    UPDATE members
    SET
      display_name = CASE WHEN ${shouldUpdateDisplayName} THEN COALESCE(NULLIF(${displayName}, ''), display_name) ELSE display_name END,
      image_path = CASE WHEN ${shouldUpdateImage} THEN ${validation.imagePath} ELSE image_path END,
      artist_roles = CASE WHEN ${shouldUpdateArtistRoles} THEN ${JSON.stringify(artistRoles)}::jsonb ELSE artist_roles END,
      age = CASE WHEN ${shouldUpdateAge} THEN ${age} ELSE age END,
      display_role = CASE WHEN ${shouldUpdateDisplayRole} THEN ${displayRole} ELSE display_role END,
      description = CASE WHEN ${shouldUpdateDescription} THEN ${description} ELSE description END,
      gallery = CASE WHEN ${shouldUpdateGallery} THEN ${JSON.stringify(gallery)}::jsonb ELSE gallery END,
      display_order = CASE WHEN ${shouldUpdateDisplayOrder} THEN ${displayOrder} ELSE display_order END
    WHERE lower(username) = lower(${normalizedUsername})
    RETURNING username, display_name, role, image_path, artist_roles, age, display_role, description, gallery, display_order
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
  ARTIST_ROLES,
  getMembers,
  normalizeGallery,
  normalizeArtistRoles,
  updateMemberImage,
  updateMemberProfile
};

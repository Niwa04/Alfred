let databaseClient;

async function getDatabaseClient() {
  if (!databaseClient) {
    const { getDatabase } = await import('@netlify/database');
    databaseClient = getDatabase();
  }

  return databaseClient;
}

module.exports = {
  getDatabaseClient
};

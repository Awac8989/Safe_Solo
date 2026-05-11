const database = require('./database');

async function connectDatabase() {
  return database.$connect();
}

module.exports = {
  connectDatabase,
  ...database,
};

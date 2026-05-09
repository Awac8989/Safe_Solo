const { readState } = require('../data/store');

async function $connect() {
  readState();
  return true;
}

async function $disconnect() {
  return true;
}

module.exports = {
  $connect,
  $disconnect,
};

const User = require('../models').User;

module.exports = {
  async findOrCreate(keycloakId, displayName, username) {
    return await User.findOrCreate({
      where: {
        keycloakId: keycloakId
      },
      defaults: {
        displayName: displayName,
        username: username
      }
    });
  }
};
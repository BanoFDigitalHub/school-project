const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');

const AdminSchema = new Schema({ username: String, passwordHash: String });

AdminSchema.methods.verify = function(password){
  return bcrypt.compare(password, this.passwordHash);
}

module.exports = mongoose.model('AdminUser', AdminSchema);

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SettingsSchema = new Schema({
  releaseAt: Date,
  siteTitle: String,
});

module.exports = mongoose.model('Settings', SettingsSchema);

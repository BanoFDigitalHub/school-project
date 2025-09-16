const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SubjectSchema = new Schema({ 
  name: String, 
  max: Number, 
  obtained: { type: Schema.Types.Mixed }   // Ab number bhi chalega, "Absent" bhi
});

const StudentResultSchema = new Schema({
  class: { type: String, index: true },
  name: String,
  fatherName: String,
  normalizedName: { type: String, index: true },
  normalizedFather: { type: String, index: true },
  subjects: [SubjectSchema],
  grandTotal: Number,
  obtainedTotal: Number,
  percentage: Number,
  grade: String,
  status: String,
  session: String,
  uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StudentResult', StudentResultSchema);

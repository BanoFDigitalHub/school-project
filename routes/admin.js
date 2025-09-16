const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const StudentResult = require('../models/StudentResult');

const upload = multer({ dest: 'uploads/' });

// normalize helper
function normalize(s){
  return String(s || '').replace(/\s+/g,' ').trim().toLowerCase();
}

// normalize class helper
function normalizeClass(val) {
  if (!val) return '';

  const str = String(val).trim().toLowerCase();

  // check numbers directly
  if (/^\d+$/.test(str)) return str; // "9" → "9"

  // remove common suffixes (9th → 9)
  if (/^\d+(st|nd|rd|th)$/.test(str)) {
    return str.replace(/(st|nd|rd|th)$/,'');
  }

  // "class 9" → 9
  if (/^class\s*\d+$/.test(str)) {
    return str.replace(/class\s*/,'');
  }

  // words → numbers
  const wordsToNumbers = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12
  };
  if (wordsToNumbers[str]) return String(wordsToNumbers[str]);

  return str; // fallback
}

// non-subject columns list
const NON_SUBJECT_COLUMNS = [
  "class", "student", "student name", "name",
  "roll", "roll no", "roll number",
  "father", "father name", "f name", "fname", "fathername",
  "mother", "mother name", "m name", "mname", "mothername",
  "guardian", "guardian name",
  "total", "grand total", "overall total", 
  "marks", "total marks", "grand total marks",
  "obtained", "obtained marks", "marks obtained",
  "overall obtained", "grand obtained", "overall marks",
  "percentage", "grade", "status", "result"
];

function isNonSubject(header){
  return NON_SUBJECT_COLUMNS.includes(normalize(header));
}

// auth middleware
function auth(req, res, next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({ ok:false });
  const token = h.split(' ')[1];
  try{ 
    req.user = jwt.verify(token, process.env.JWT_SECRET); 
    next(); 
  }
  catch(e){ return res.status(401).json({ ok:false }); }
}

// clean subject name
function extractSubjectName(header){
  // e.g. "English Max", "English Obtained" → "English"
  return header.replace(/ (Max|Obt|Obtained|Total|Marks)$/i, '').trim();
}

router.post('/upload', auth, upload.single('csv'), async (req, res)=>{
  if(!req.file) return res.status(400).json({ ok:false, message:'No file uploaded' });

  const rows = [];
  const headers = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('headers', (h)=>{ headers.push(...h); })
    .on('data', (data)=> rows.push(data))
    .on('end', async ()=>{
      try{
        const docs = [];

        for(const row of rows){
          const classVal = normalizeClass(row[headers[0]]) || '';
          const nameVal = row[headers[1]] || '';
          const fatherVal = row[headers[2]] || '';
          const subjects = [];
          let totMax = 0, totObtained = 0;

          let failCount = 0;
          let hasAbsent = false;

          for(let i = 3; i < headers.length; i += 2){
            const h1 = headers[i];
            const h2 = headers[i+1];
            if(!h2) break;

            // skip non-subject columns
            if(isNonSubject(h1) || isNonSubject(h2)) continue;

            const maxRaw = row[h1];
            const obtRaw = row[h2];

            // case1: both max & obtained blank → skip
            if ((maxRaw === undefined || maxRaw === '') && (obtRaw === undefined || obtRaw === '')) continue;

            // case2: max given but obtained blank → skip
            if ((maxRaw && maxRaw.trim() !== '') && (!obtRaw || obtRaw.trim() === '')) continue;

            const maxVal = parseInt(maxRaw) || 0;
            let obtained;
            let subjectStatus = 'Pass';

            // check for absent
            if(!obtRaw || /^a(b|bs|bsent)?$/i.test(obtRaw.trim())){
              obtained = 'Absent';        
              subjectStatus = 'Absent';
              hasAbsent = true;
            } else {
              obtained = parseInt(obtRaw) || 0;
              if(obtained === 0 || obtained < (maxVal * 0.33)) {
                subjectStatus = 'Fail';
                failCount++;
              }
              totObtained += obtained;   // only add numeric marks
            }

            subjects.push({
              name: extractSubjectName(h1),
              max: maxVal,
              obtained,
              status: subjectStatus
            });

            totMax += maxVal;
          }

          // percentage
          let percentage = totMax ? (totObtained / totMax) * 100 : 0;
          percentage = Math.min(percentage, 100);
          percentage = Math.round(percentage * 100) / 100;

          // overall status
          let status = 'Fail';
          if(hasAbsent){
            status = 'Absent';
          } else if(failCount >= 3 || percentage < 33){
            status = 'Fail';
          } else if(failCount === 1 || failCount === 2){
            status = 'Fail Supply';
          } else {
            status = 'Pass';
          }

          // grade mapping
          let grade = 'F';
          if(percentage >= 90) grade = 'A+';
          else if(percentage >= 80) grade = 'A';
          else if(percentage >= 70) grade = 'B+';
          else if(percentage >= 60) grade = 'B';
          else if(percentage >= 50) grade = 'C+';
          else if(percentage >= 40) grade = 'C';
          else if(percentage >= 33) grade = 'D+';

          docs.push({
            class: classVal,
            name: nameVal,
            fatherName: fatherVal,
            normalizedName: normalize(nameVal),
            normalizedFather: normalize(fatherVal),
            subjects,
            grandTotal: totMax,
            obtainedTotal: totObtained,
            percentage,
            grade,
            status,
            uploadedBy: req.user.username
          });
        }

        await StudentResult.insertMany(docs);
        fs.unlinkSync(req.file.path);
        res.json({ ok:true, inserted: docs.length });

      } catch(err){
        console.error(err);
        res.status(500).json({ ok:false, err: err.message });
      }
    });
});

router.post('/schedule', auth, async (req,res)=>{
  const { releaseAt } = req.body;
  let s = await Settings.findOne();
  if(!s) s = new Settings();
  s.releaseAt = releaseAt ? new Date(releaseAt) : null;
  await s.save();
  res.json({ ok:true });
});

router.post('/clean', auth, async (req,res)=>{
  await StudentResult.deleteMany({});
  res.json({ ok:true });
});

router.get('/status', auth, async (req, res) => {
  try {
    const count = await StudentResult.countDocuments();
    res.json({ ok: true, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, err: err.message });
  }
});

module.exports = router;

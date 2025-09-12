const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const StudentResult = require('../models/StudentResult');

const upload = multer({ dest: 'uploads/' });

function normalize(s){
  return String(s || '')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

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

// find subject name from a header
function extractSubjectName(header){
  return header
    .replace(/ (Max|Obt|Total|Obtained)$/i, '') // remove known suffix
    .trim();
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
          const classVal = row[headers[0]] || '';
          const nameVal = row[headers[1]] || '';
          const fatherVal = row[headers[2]] || '';
          const subjects = [];
          let totMax = 0, totObtained = 0;

          // process pairs dynamically
          for(let i = 3; i < headers.length; i += 2){
            const h1 = headers[i];
            const h2 = headers[i+1];
            if(!h2) break; // odd column at end

            const maxRaw = row[h1];
            const obtRaw = row[h2];

            if((maxRaw === undefined || maxRaw === '') && (obtRaw === undefined || obtRaw === '')) continue;

            const maxVal = parseInt(maxRaw) || 0;
            const obtained = parseInt(obtRaw) || 0;

            const subjectName = extractSubjectName(h1);

            subjects.push({
              name: subjectName,
              max: maxVal,
              obtained
            });

            totMax += maxVal;
            totObtained += obtained;
          }

          // calculate percentage safely
          let percentage = totMax ? (totObtained / totMax) * 100 : 0;
          if(percentage > 100) percentage = 100; 
          percentage = Math.round(percentage * 100) / 100; 

          // pass/fail logic
          const status = percentage >= 33 ? 'Pass' : 'Fail';

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

// Get DB status (number of records)
router.get('/status', auth, async (req, res) => {
  try {
    const count = await StudentResult.countDocuments(); // Count all student results
    res.json({ ok: true, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, err: err.message });
  }
});

module.exports = router;

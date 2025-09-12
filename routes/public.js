const express = require('express');
const router = express.Router();
const StudentResult = require('../models/StudentResult');
const Settings = require('../models/Settings');

function normalize(s){
  return String(s || '').replace(/\s+/g,' ').trim().toLowerCase();
}

router.get('/status', async (req,res)=>{
  const s = await Settings.findOne();
  const releaseAt = s && s.releaseAt ? s.releaseAt : null;
  const now = new Date();
  res.json({ showInput: !releaseAt || now >= releaseAt, releaseAt, dbEmpty: (await StudentResult.countDocuments({})) === 0 });
});

router.get('/result', async (req,res)=>{
  const { class: cls, name, father } = req.query;
  if(!cls || !name || !father) return res.status(400).json({ ok:false, message:'Missing' });
  const q = {
    class: String(cls)
  };
  q.normalizedName = normalize(name);
  q.normalizedFather = normalize(father);
  const found = await StudentResult.find(q);
  if(!found || found.length === 0) return res.json({ ok:true, results: [] });
  res.json({ ok:true, results: found });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const AdminUser = require('../models/AdminUser');

// init admin if not exists (simple)
(async ()=>{
  const adminName = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'changeme';
  const found = await AdminUser.findOne({ username: adminName });
  if(!found){
    const hash = await bcrypt.hash(adminPass, 10);
    await AdminUser.create({ username: adminName, passwordHash: hash });
    console.log('Created default admin');
  }
})();

router.post('/login', async (req, res)=>{
  const { username, password } = req.body;
  const user = await AdminUser.findOne({ username });
  if(!user) return res.status(401).json({ ok:false, message:'Invalid' });
  const ok = await user.verify(password);
  if(!ok) return res.status(401).json({ ok:false, message:'Invalid' });
  const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET);
  res.json({ ok:true, token });
});

module.exports = router;

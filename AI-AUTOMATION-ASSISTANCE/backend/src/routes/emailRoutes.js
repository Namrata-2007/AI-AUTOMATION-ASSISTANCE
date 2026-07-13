const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/generate', emailController.generateEmail);
router.post('/send', emailController.sendEmail);
router.post('/schedule', emailController.scheduleEmail);
router.post('/improve-subject', emailController.improveSubject);
router.post('/correct-grammar', emailController.correctGrammar);
module.exports = router;
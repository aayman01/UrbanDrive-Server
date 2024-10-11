const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();

router.post('/users', userController.createUser);
router.get('/user/:email', userController.getUserByEmail);
router.post('/send-verification-code', userController.sendVerificationCode);

module.exports = router;

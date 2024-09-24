const express = require('express');
const { createToken, logout } = require('../controller/authController.js');

const router = express.Router();

// router.post('/jwt', createToken);   
// router.get('/logout', logout);      

module.exports = router;

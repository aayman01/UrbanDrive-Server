const express = require('express');
// const { saveUser } = require('../controllers/userController');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// router.put('/user', verifyToken);  

module.exports = router;

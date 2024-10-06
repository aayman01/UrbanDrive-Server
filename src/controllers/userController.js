const usersCollection = require('../config/db').db("urbanDrive").collection("users");
const crypto = require("crypto");
const transporter = require('../services/emailService');

exports.createUser = async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const existUser = await usersCollection.findOne(query);

  if (existUser) {
    return res.send({ message: "User already exists", insertedId: null });
  }
  
  const result = await usersCollection.insertOne(user);
  res.send(result);
};

exports.getUserByEmail = async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  res.send(user);
};

exports.sendVerificationCode = async (req, res) => {
  const { email } = req.body;
  const verificationCode = crypto.randomInt(100000, 999999).toString();

  await usersCollection.updateOne(
    { email },
    { $set: { verificationCode, verificationCodeExpires: Date.now() + 3600000 } },
    { upsert: true }
  );

  const mailOptions = {
    from: `UrbanDrive <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Email Verification Code',
    text: `Your verification code is: ${verificationCode}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      res.status(500).send({ success: false, message: 'Error sending verification email' });
    } else {
      res.send({ success: true, message: 'Verification email sent' });
    }
  });
};

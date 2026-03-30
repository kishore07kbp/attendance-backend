const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Student = require("../models/Student");
const User = require("../models/User");
const sendEmail = require("../utils/emailSender");
const { updateStudentInCache } = require("../utils/studentCache");

const router = express.Router();

/*
-----------------------------------------
TEMP STORAGE FOR OTP
-----------------------------------------
*/
const otpStore = {};


/*
-----------------------------------------
1️⃣ REGISTER (MOBILE APP)
-----------------------------------------
*/
router.post("/register", async (req, res) => {

  console.log("\n📱 MOBILE REGISTER REQUEST:", req.body);

  try {

    const { fullname, rollNumber, phoneNumber } = req.body;

    if (!fullname || !rollNumber || !phoneNumber) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const student = await Student.findOne({ rollNumber });

    if (!student) {
      return res.status(400).json({
        message: "Please register in website first"
      });
    }

    if (student.mobileRegistered) {
      return res.status(400).json({
        message: "Mobile already registered"
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    // Send OTP via email
    try {

      const emailSubject = "Smart Attendance - Registration OTP";
      const emailMessage = `Your OTP for mobile registration is: ${otp}\n\nPlease do not share this OTP with anyone.`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 500px; margin: auto;">
          <h2 style="color: #4CAF50; text-align: center;">Smart Attendance</h2>
          <hr />
          <p>Hi ${student.name || 'Student'},</p>
          <p>Your OTP for mobile registration is:</p>
          <div style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #333;">
            ${otp}
          </div>
          <p>Please use this OTP to complete your registration in the app. This OTP will be valid for 10 minutes.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr />
          <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2024 Smart Attendance System. All rights reserved.</p>
        </div>
      `;

      await sendEmail({
        email: student.email,
        subject: emailSubject,
        message: emailMessage,
        html: emailHtml
      });

      console.log(`✅ OTP SENT TO: ${student.email}`);

    } catch (emailError) {
      console.error("❌ FAILED TO SEND OTP EMAIL:", emailError);
      return res.status(500).json({
        message: "Failed to send OTP email. Please check your internet connection and try again."
      });
    }

    otpStore[phoneNumber] = {
      otp,
      rollNumber,
      createdAt: Date.now()
    };

    console.log("\n==============================");
    console.log("📱 MOBILE REGISTRATION OTP");
    console.log("==============================");
    console.log("PHONE :", phoneNumber);
    console.log("ROLL  :", rollNumber);
    console.log("EMAIL :", student.email);
    console.log("OTP   :", otp);
    console.log("==============================\n");

    res.json({
      success: true,
      message: "OTP generated"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});


/*
-----------------------------------------
2️⃣ VERIFY OTP
-----------------------------------------
*/
router.post("/verify-otp", async (req, res) => {

  console.log("\n📩 VERIFY OTP REQUEST:", req.body);

  try {

    const { phoneNumber, otp, deviceSystemID, permanentID } = req.body;

    const record = otpStore[phoneNumber];

    if (!record) {
      return res.status(400).json({
        message: "OTP expired or not found"
      });
    }

    if (record.otp != otp) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    const rollNumber = record.rollNumber;

    // Find student using roll number
    const student = await Student.findOne({ rollNumber });

    if (!student) {
      return res.status(404).json({
        message: "Student record not found. Register in website first"
      });
    }

    // Find user using student.userId
    const user = await User.findById(student.userId);

    if (!user) {
      return res.status(404).json({
        message: "User account not found"
      });
    }

    // Update student with mobile details
    student.phoneNumber = phoneNumber;
    student.mobileRegistered = true;
    student.deviceSystemId = deviceSystemID;
    student.permanentId = permanentID;

    await student.save();
    
    // 🚀 Update RAM Cache
    updateStudentInCache(student);

    delete otpStore[phoneNumber];

    console.log("✅ OTP VERIFIED SUCCESSFULLY");

    res.json({
      success: true,
      message: "Mobile registered successfully"
    });

  } catch (error) {

    console.error("VERIFY OTP ERROR:", error);

    res.status(500).json({
      message: error.message
    });

  }

});


/*
-----------------------------------------
3️⃣ LOGIN
-----------------------------------------
*/
router.post("/login", async (req, res) => {

  console.log("\n🔐 LOGIN REQUEST:", req.body);

  try {

    const { rollNumber, password, deviceSystemId } = req.body;

    const student = await Student.findOne({ rollNumber });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const user = await User.findById(student.userId).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid password. Please use the same password you used on the website."
      });
    }

    if (!student.mobileRegistered) {
      return res.status(403).json({
        message: "Please register this phone using OTP first"
      });
    }

    if (student.deviceSystemId !== deviceSystemId) {
      return res.status(403).json({
        message: "Login allowed only from registered phone"
      });
    }

    res.json({
      success: true,
      rollNumber: student.rollNumber,
      permanentId: student.permanentId
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});


/*
-----------------------------------------
4️⃣ LOGOUT
-----------------------------------------
*/
router.post("/logout", async (req, res) => {

  try {

    const { rollNumber } = req.body;

    const student = await Student.findOne({ rollNumber });

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    student.activeSession = false;

    await student.save();

    res.json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

module.exports = router;
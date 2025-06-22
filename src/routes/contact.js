const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Contact = require("../models/Contact");
const nodemailer = require("nodemailer");

// Validation middleware
const validateContact = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("message").notEmpty().withMessage("Message is required"),
];

// Submit contact form
router.post("/submit", validateContact, async (req, res) => {
  try {
    console.log("Received contact form submission:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const contact = new Contact({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || "",
      subject: req.body.subject || "Contact Form Submission",
      message: req.body.message,
    });

    console.log("Creating contact document:", contact);
    await contact.save();
    console.log("Contact document saved successfully");

    // Send email notification
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: `New Contact Form Submission: ${contact.subject}`,
        text: `
          Name: ${contact.name}
          Email: ${contact.email}
          Phone: ${contact.phone || "Not provided"}
          Subject: ${contact.subject}
          Message: ${contact.message}
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("Email notification sent successfully");
    } catch (emailError) {
      console.error("Error sending email notification:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: "Contact form submitted successfully",
    });
  } catch (error) {
    console.error("Contact form submission error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting contact form",
      error: error.message,
    });
  }
});

// Get all contact submissions (admin only)
router.get("/all", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching contact submissions",
    });
  }
});

module.exports = router;

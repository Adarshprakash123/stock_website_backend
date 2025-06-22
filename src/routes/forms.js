const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const FormSubmission = require("../models/FormSubmission");

// Validation middleware
const validateForm = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("formType").notEmpty().withMessage("Form type is required"),
];

// Create form submission
router.post("/", validateForm, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, whatsapp, formType } = req.body;

    const submission = new FormSubmission({
      name,
      email,
      phone,
      whatsapp,
      formType,
      submittedAt: new Date(),
    });

    await submission.save();

    res.json({
      success: true,
      message: "Form submitted successfully",
      data: {
        id: submission._id,
        formType,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    console.error("Form submission error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting form",
    });
  }
});

module.exports = router;

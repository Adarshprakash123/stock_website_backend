const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Brochure = require("../models/Brochure");

// Validation middleware
const validateBrochure = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("interest").notEmpty().withMessage("Interest is required"),
];

// Submit brochure request
router.post("/submit", validateBrochure, async (req, res) => {
  try {
    console.log("Received brochure submission request:", req.body);
    console.log("Request headers:", req.headers);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // Create new brochure document
    const brochure = new Brochure({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      interest: req.body.interest,
    });

    console.log("Creating new brochure document:", brochure);

    // Save to database
    const savedBrochure = await brochure.save();
    console.log("Brochure saved successfully:", savedBrochure);

    // Verify the document was saved
    const verifiedBrochure = await Brochure.findById(savedBrochure._id);
    console.log("Verified saved brochure:", verifiedBrochure);

    // Send response
    res.status(201).json({
      success: true,
      message: "Brochure request submitted successfully",
      data: savedBrochure,
    });
  } catch (error) {
    console.error("Brochure submission error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error submitting brochure request",
      error: error.message,
    });
  }
});

// Get all brochure requests (admin only)
router.get("/all", async (req, res) => {
  try {
    console.log("Fetching all brochures...");
    const brochures = await Brochure.find().sort({ createdAt: -1 });
    console.log("Found brochures:", brochures);
    res.json({
      success: true,
      data: brochures,
    });
  } catch (error) {
    console.error("Error fetching brochures:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error fetching brochure requests",
    });
  }
});

module.exports = router;

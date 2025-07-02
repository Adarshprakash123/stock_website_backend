const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Payment = require("../models/Payment");
const crypto = require("crypto");

// Validation middleware
const validatePayment = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("amount").isNumeric().withMessage("Valid amount is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  body("formType").notEmpty().withMessage("Form type is required"),
];

// Generate PayU hash
const generateHash = (data) => {
  const hashString = `${data.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${data.salt}`;
  const fullHash = crypto.createHash("sha512").update(hashString).digest("hex");
  return { full: fullHash };
};

// Generate reverse hash for PayU success callback
const generateReverseHash = (data, salt) => {
  const hashString = `${salt}|${data.status}||||||||||${data.email}|${data.firstname}|${data.productinfo}|${data.amount}|${data.txnid}|${data.key}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
};

// Create PayU payment session
router.post("/create-payment-session", validatePayment, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone, whatsapp, amount, formType } = req.body;
    const txnid = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payment = new Payment({
      name,
      email,
      phone,
      whatsapp,
      amount: Number(amount),
      txnid,
      status: "pending",
      formType,
    });

    await payment.save();

    const isProduction = process.env.NODE_ENV === "production";
    const payuKey = isProduction
      ? process.env.PAYU_PRODUCTION_KEY
      : process.env.PAYU_TEST_KEY;
    const payuSalt = isProduction
      ? process.env.PAYU_PRODUCTION_SALT
      : process.env.PAYU_TEST_SALT;
    const payuUrl = isProduction
      ? "https://secure.payu.in/_payment"
      : "https://test.payu.in/_payment";

    const amountStr = Number(amount).toFixed(2); // ✅ Fix: 2 decimal points

    const paymentData = {
      key: payuKey,
      txnid,
      amount: amountStr,
      productinfo: `Stock Website ${formType} Payment`,
      firstname: name,
      email,
      phone,
      surl: `${process.env.BASE_URL}/payment/success`,
      furl: `${process.env.BASE_URL}/payment/failure`,
      salt: payuSalt,
      payuUrl,
      udf1: "",
      udf2: "",
      udf3: "",
      udf4: "",
      udf5: "",
    };

    const hashResult = generateHash(paymentData);
    paymentData.hash = hashResult.full;
    delete paymentData.salt; // Never send salt to client

    res.json({
      success: true,
      data: paymentData,
      message: "Payment session created successfully",
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    res.status(500).json({
      success: false,
      message: "Error creating payment",
      error: error.message,
    });
  }
});

// Success callback from PayU
router.post("/success", async (req, res) => {
  try {
    // Log raw request body for debugging
    console.log("Raw PayU callback body:", req.body);
    console.log("Request Body:", JSON.stringify(req.body));
    console.log("Request Headers:", JSON.stringify(req.headers));

    const {
      status = "failed",
      txnid,
      amount,
      firstname,
      email,
      phone,
      productinfo,
      key,
      hash,
    } = req.body;

    // Find existing payment
    const payment = await Payment.findOne({ txnid });
    if (!payment) {
      console.error("Payment not found for txnid:", txnid);
      return res.redirect("https://chat.whatsapp.com/BWKfMIOaRpkGSshH7F9F7N");
    }

    // Validate hash
    const isProduction = process.env.NODE_ENV === "production";
    const payuSalt = isProduction
      ? process.env.PAYU_PRODUCTION_SALT
      : process.env.PAYU_TEST_SALT;

    const calculatedHash = generateReverseHash(req.body, payuSalt);

    if (hash !== calculatedHash) {
      console.error("Invalid hash received from PayU");
      payment.status = "failed";
      payment.paymentDetails = req.body;
      await payment.save();
      return res.redirect("https://chat.whatsapp.com/BWKfMIOaRpkGSshH7F9F7N");
    }

    // Update payment status based on PayU status
    const payuStatus = status.toLowerCase();
    if (payuStatus === "success") {
      payment.status = "approved"; // Change status to approved on success
      payment.approvedAt = new Date();
    } else {
      payment.status = "failed";
    }
    payment.paymentDetails = req.body;
    await payment.save();

    // Redirect to WhatsApp group after successful payment
    return res.redirect("https://chat.whatsapp.com/BWKfMIOaRpkGSshH7F9F7N");
  } catch (error) {
    console.error("Error processing payment success:", error);
    return res.redirect("https://chat.whatsapp.com/BWKfMIOaRpkGSshH7F9F7N");
  }
});

// Failure callback from PayU
router.post("/failure", async (req, res) => {
  try {
    // Log raw request body for debugging
    console.log("Raw PayU failure callback body:", req.body);

    const { txnid, status } = req.body;

    // Find or create the payment record
    let payment = await Payment.findOne({ txnid });
    if (!payment) {
      payment = new Payment({
        txnid,
        status: "failed",
        paymentDetails: req.body,
      });
    }

    // Update payment status
    payment.status = "failed";
    payment.paymentDetails = req.body;
    await payment.save();

    // Always redirect to success page
    const frontendUrl = process.env.FRONTEND_URL || "https://tradingwalla.com";
    return res.redirect(`${frontendUrl}?payment_status=success`);
  } catch (error) {
    console.error("Failure callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "https://tradingwalla.com";
    return res.redirect(`${frontendUrl}?payment_status=success`);
  }
});

//
router.get("/all", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching payments" });
  }
});

module.exports = router;

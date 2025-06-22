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
  body("formType").notEmpty().withMessage("Form type is required")
];

// Generate PayU hash
const generateHash = (data) => {
  const hashString = `${data.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${data.salt}`;
  const fullHash = crypto.createHash("sha512").update(hashString).digest("hex");
  return { full: fullHash };
};

// Generate reverse hash for PayU response verification
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
      formType
    });

    await payment.save();

    const isProduction = process.env.NODE_ENV === "production";
    const payuKey = isProduction ? process.env.PAYU_PRODUCTION_KEY : process.env.PAYU_TEST_KEY;
    const payuSalt = isProduction ? process.env.PAYU_PRODUCTION_SALT : process.env.PAYU_TEST_SALT;
    const payuUrl = isProduction ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment";

    const amountStr = Number(amount).toFixed(2);

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
      udf5: ""
    };

    const hashResult = generateHash(paymentData);
    paymentData.hash = hashResult.full;
    delete paymentData.salt;

    res.json({
      success: true,
      data: paymentData,
      message: "Payment session created successfully"
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    res.status(500).json({ success: false, message: "Error creating payment", error: error.message });
  }
});

// PayU success callback
router.post("/success", async (req, res) => {
  try {
    console.log("Success callback received:", req.body);
    
    const { txnid, status, hash, amount, productinfo, firstname, email, key } = req.body;
    
    // Always redirect to your frontend domain
    const frontendUrl = process.env.FRONTEND_URL || "https://tradingwalla.com";
    const redirectUrl = `${frontendUrl}?payment_status=${status || 'failed'}${txnid ? `&txnid=${txnid}` : ''}`;
    
    if (!txnid || !hash) {
      console.error("Missing required parameters");
      return res.redirect(redirectUrl);
    }

    const isProduction = process.env.NODE_ENV === "production";
    const payuSalt = isProduction ? process.env.PAYU_PRODUCTION_SALT : process.env.PAYU_TEST_SALT;

    const calculatedHash = generateReverseHash({ status, email, firstname, productinfo, amount, txnid, key }, payuSalt);

    if (calculatedHash !== hash) {
      console.error("Hash mismatch. Possible tampering.");
      return res.redirect(redirectUrl);
    }

    const payment = await Payment.findOne({ txnid });
    if (!payment) {
      console.error("Payment not found");
      return res.redirect(redirectUrl);
    }

    payment.status = status === "success" ? "succeeded" : "failed";
    payment.paymentDetails = req.body;
    await payment.save();

    // Redirect to home page with payment status
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error("Success callback error:", error);
    return res.redirect(`${frontendUrl}?payment_status=failed&error=${encodeURIComponent(error.message)}`);
  }
});

// PayU failure callback
router.post("/failure", async (req, res) => {
  try {
    const { txnid, status } = req.body;

    const payment = await Payment.findOne({ txnid });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    payment.status = "failed";
    payment.paymentDetails = req.body;
    await payment.save();

    const isForm = req.headers["content-type"]?.includes("application/x-www-form-urlencoded");
    if (isForm) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failure?txnid=${txnid}&status=${status}`);
    }

    res.json({ success: true, message: "Payment marked as failed", data: payment });
  } catch (error) {
    console.error("Failure callback error:", error);
    res.status(500).json({ success: false, message: "Error in failure callback" });
  }
});

// Get payment status
router.get("/status/:txnid", async (req, res) => {
  try {
    const { txnid } = req.params;
    const payment = await Payment.findOne({ txnid });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.json({
      success: true,
      data: {
        txnid: payment.txnid,
        status: payment.status,
        amount: payment.amount,
        name: payment.name,
        email: payment.email,
        formType: payment.formType,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error("Fetch payment status error:", error);
    res.status(500).json({ success: false, message: "Error fetching payment status" });
  }
});

// Test hash route (for debugging)
router.post("/test-hash", (req, res) => {
  try {
    const { key, txnid, amount, productinfo, firstname, email, salt } = req.body;
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const fullHash = crypto.createHash("sha512").update(hashString).digest("hex");

    res.json({
      success: true,
      hashString,
      hash: fullHash
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all payments
router.get("/all", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ success: false, message: "Error fetching payments" });
  }
});

module.exports = router;

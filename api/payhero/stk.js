function normalizePhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.startsWith("7") && digits.length === 9) {
    digits = `0${digits}`;
  }
  if (/^0[17]\d{8}$/.test(digits)) return digits;
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const auth = (process.env.PAYHERO_BASIC_AUTH || "").trim();
  const channel = (process.env.PAYHERO_CHANNEL_ID || "").trim();

  if (!auth || !channel) {
    return res.status(500).json({
      success: false,
      message: "PayHero is not configured on the server.",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const amount = Number(body.amount);
  const name = String(body.name || "").trim().slice(0, 80);
  const cause = String(body.cause || "gift")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
  const phone = normalizePhone(body.phone || body.mpesaPhone);

  if (!Number.isFinite(amount) || amount < 100) {
    return res.status(400).json({ success: false, message: "Minimum donation is KSh 100." });
  }
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid Safaricom M-Pesa number.",
    });
  }

  const reference = `KINDRED-${cause || "gift"}-${Date.now().toString(36).toUpperCase()}`;
  const payload = {
    amount: Math.round(amount),
    phone_number: phone,
    channel_id: Number(channel),
    provider: "m-pesa",
    external_reference: reference,
    customer_name: name || "Kindred donor",
  };

  const callback = (process.env.PAYHERO_CALLBACK_URL || "").trim();
  if (callback) payload.callback_url = callback;

  try {
    const response = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        "User-Agent": "KindredDonate/1.0",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let message =
        data.error_message || data.message || `PayHero error (${response.status})`;
      if (String(message).toLowerCase().includes("insufficient balance")) {
        message =
          "PayHero merchant wallet has insufficient balance. Top up the service wallet in PayHero, then try again.";
      }
      return res.status(response.status).json({
        success: false,
        message,
        payhero: data,
      });
    }

    return res.status(200).json({
      success: true,
      message: "STK push sent. Enter your M-Pesa PIN on your phone.",
      reference,
      payhero: data,
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: `Could not reach PayHero: ${error.message || "network error"}`,
    });
  }
};

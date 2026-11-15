// Receives the "Start a project" form and emails it through Resend.
// Private settings (set in Vercel, never in the page):
//   RESEND_API_KEY  Resend key
//   CONTACT_TO      inbox that receives submissions
//   CONTACT_FROM    verified sender, e.g. "LWD Website <website@yourdomain.com>"

const clean = (v, max) => String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim().slice(0, max);
const BUDGETS = ["$10k to $15k", "$15k to $20k", "$20k and up", "Not sure yet"];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};

  // Spam check: the page's own script adds a marker and how long the visitor was on the page.
  // Bots that post straight to this address have neither. Pretend success so they move on.
  if (body.k !== "lwd-form-1" || !(Number(body.t) >= 1500)) return res.status(200).json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const budget = BUDGETS.includes(body.budget) ? body.budget : "Not given";
  const message = String(body.message == null ? "" : body.message).trim().slice(0, 5000);

  if (!name) return res.status(400).json({ ok: false, error: "I need a name to reply to." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: "That email doesn't look right." });
  if (message.length < 10) return res.status(400).json({ ok: false, error: "A sentence or two about the project is plenty." });

  const { RESEND_API_KEY, CONTACT_TO, CONTACT_FROM } = process.env;
  if (!RESEND_API_KEY || !CONTACT_TO || !CONTACT_FROM) {
    console.error("Contact form is missing RESEND_API_KEY, CONTACT_TO or CONTACT_FROM");
    return res.status(500).json({ ok: false, error: "The form isn't set up yet. Please try again soon." });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_TO],
        reply_to: email,
        subject: "New project inquiry from " + name,
        text: "Name: " + name + "\nEmail: " + email + "\nBudget: " + budget + "\n\n" + message + "\n"
      })
    });
    if (!r.ok) {
      console.error("Resend error", r.status, await r.text());
      return res.status(502).json({ ok: false, error: "That didn't send. Please try again in a minute." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact form failed", err);
    return res.status(502).json({ ok: false, error: "That didn't send. Please try again in a minute." });
  }
};

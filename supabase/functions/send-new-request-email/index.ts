// WEBCRAFT: send an email when a customer_requests row is inserted.
// Deploy with JWT verification disabled because Supabase Database Webhooks call this endpoint.
// Protect the endpoint with WEBHOOK_SECRET in a custom x-webhook-secret header.
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const suppliedSecret = req.headers.get("x-webhook-secret");
  if (!webhookSecret || suppliedSecret !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const record = payload?.record;
  if (payload?.type !== "INSERT" || !record?.id || !record?.name || !record?.message) {
    return new Response("Ignored: not a customer request insert", { status: 200 });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return new Response("Missing RESEND_API_KEY secret", { status: 500 });

  const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]!));

  const subject = `New WEBCRAFT request #${record.id} — ${String(record.name).slice(0, 80)}`;
  const bodyHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033">
      <h2>New customer request — WEBCRAFT</h2>
      <p>A new request has been submitted through webcraftdz.online.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
        <tr><td><b>Request ID</b></td><td>${escapeHtml(record.id)}</td></tr>
        <tr><td><b>Name</b></td><td>${escapeHtml(record.name)}</td></tr>
        <tr><td><b>Email</b></td><td>${escapeHtml(record.email)}</td></tr>
        <tr><td><b>Phone</b></td><td>${escapeHtml(record.phone)}</td></tr>
        <tr><td><b>Service</b></td><td>${escapeHtml(record.service)}</td></tr>
        <tr><td><b>Budget</b></td><td>${escapeHtml(record.budget)}</td></tr>
        <tr><td><b>Message</b></td><td>${escapeHtml(record.message)}</td></tr>
      </table>
      <p><a href="https://webcraftdz.online/admin/dashboard.html">Open WEBCRAFT admin dashboard</a></p>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "WEBCRAFT Notifications <notifications@webcraftdz.online>",
      to: ["contact@webcraftdz.online"],
      subject,
      html: bodyHtml
    })
  });

  const result = await response.text();
  if (!response.ok) {
    console.error("Resend error", response.status, result);
    return new Response("Email provider rejected the message", { status: 502 });
  }
  return new Response("Notification email sent", { status: 200 });
});

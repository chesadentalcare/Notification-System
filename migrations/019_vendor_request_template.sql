INSERT INTO templates (template_key, channel, subject, body)
SELECT 'vendor-request-new', 'email',
'New vendor request: {{vendorName}} (from {{requestedFrom}})',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,40,80,0.10); font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header -->
        <tr><td style="background:#1f4e78; background-image:linear-gradient(135deg,#1f4e78 0%,#2a6099 100%); padding:28px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:21px; font-weight:700; letter-spacing:0.2px;">New Vendor Request</td>
            <td align="right" style="color:#bcd4ea; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#cfe0f0; font-size:13px;">Awaiting your approval in Accounts</div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:26px 34px 6px;">
          <p style="margin:0 0 14px; font-size:15px; color:#4b5563; line-height:1.6;">A new vendor has been requested and needs your approval. Details below:</p>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:6px 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:13px;">
            <tr style="background:#f6f8fc;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:38%;">Vendor</td><td style="padding:10px 12px; color:#1f2937; font-weight:700;">{{vendorName}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Phone</td><td style="padding:10px 12px; color:#1f2937;">{{phone}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Location</td><td style="padding:10px 12px; color:#4b5563;">{{location}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Address</td><td style="padding:10px 12px; color:#4b5563;">{{address}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">GSTIN</td><td style="padding:10px 12px; color:#4b5563;">{{gstin}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">PAN</td><td style="padding:10px 12px; color:#4b5563;">{{pan}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Reason</td><td style="padding:10px 12px; color:#4b5563;">{{reason}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Raised from</td><td style="padding:10px 12px; color:#4b5563;">{{requestedFrom}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Raised by</td><td style="padding:10px 12px; color:#4b5563;">{{requestedBy}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Request ID</td><td style="padding:10px 12px; color:#1f2937;"><span style="background:#eef4ff; color:#1e3a5f; border-radius:6px; padding:2px 7px; font-weight:700; font-size:12px;">#{{requestId}}</span></td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:22px 34px 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:8px; background:#1f4e78; background-image:linear-gradient(135deg,#1f4e78 0%,#2a6099 100%);">
              <a href="https://finance.chesadentalcare.com/vendor-requests" style="display:inline-block; padding:13px 32px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">Review &amp; Approve &rarr;</a>
            </td>
          </tr></table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 34px 26px; border-top:1px solid #eef2f7;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Automated Reporting System</strong><br/>Ashva Health Tech</p>
          <p style="margin:12px 0 0; font-size:11px; color:#aab3bf;">This is an automated alert for every new vendor request, so you no longer need a phone call.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'vendor-request-new' AND channel = 'email');

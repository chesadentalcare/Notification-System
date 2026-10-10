INSERT INTO templates (template_key, channel, subject, body)
SELECT 'tada-approved-payment', 'email',
'{{subjectLine}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,40,80,0.10); font-family:''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header (green = approved) -->
        <tr><td style="background:#065f46; background-image:linear-gradient(135deg,#065f46 0%,#0f766e 100%); padding:30px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.2px;">TADA Approved — Payment Required</td>
            <td align="right" style="color:#b7e4d3; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#a7e0cf; font-size:13px;">Travel &amp; DA Claim &middot; Accounts / Payment</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px 34px 8px;">
          <p style="margin:0 0 6px; font-size:16px; color:#1f2937;">Dear <strong>{{recipient.name}}</strong>,</p>
          <p style="margin:0 0 16px; font-size:15px; color:#4b5563; line-height:1.6;">{{intro}}</p>
          <div style="display:inline-block; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; border-radius:999px; padding:7px 16px; font-size:13px; font-weight:700;">
            ✅ Approved by {{approvedBy}}
          </div>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:18px 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:14px;">
            <tr style="border-bottom:1px solid #eef2f7;"><td style="padding:11px 14px; color:#64748b; width:40%;">Technician</td><td style="padding:11px 14px; color:#1f2937; font-weight:600;">{{technicianName}}</td></tr>
            <tr style="border-bottom:1px solid #eef2f7;"><td style="padding:11px 14px; color:#64748b;">Service Call</td><td style="padding:11px 14px; color:#1f2937;">{{serviceCallId}}</td></tr>
            <tr style="border-bottom:1px solid #eef2f7;"><td style="padding:11px 14px; color:#64748b;">Doctor / Customer</td><td style="padding:11px 14px; color:#1f2937;">{{doctorName}}</td></tr>
            <tr style="border-bottom:1px solid #eef2f7;"><td style="padding:11px 14px; color:#64748b;">Visit Date</td><td style="padding:11px 14px; color:#1f2937;">{{visitDate}}</td></tr>
            <tr style="border-bottom:1px solid #eef2f7;"><td style="padding:11px 14px; color:#64748b;">Station</td><td style="padding:11px 14px; color:#1f2937;">{{stationType}}</td></tr>
            <tr><td style="padding:11px 14px; color:#64748b;">Amount</td><td style="padding:11px 14px; color:#0f766e; font-weight:700; font-size:16px;">{{amount}}</td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:26px 34px 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:8px; background:#065f46; background-image:linear-gradient(135deg,#065f46 0%,#0f766e 100%);">
              <a href="{{paymentUrl}}" style="display:inline-block; padding:14px 34px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">Process Payment &rarr;</a>
            </td>
          </tr></table>
          <p style="margin:14px 0 0; font-size:12px; color:#9aa5b1;">This TADA claim has been approved by the coordinator and is ready for payment.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 34px 26px; border-top:1px solid #eef2f7;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Automated Reporting System</strong><br/>Pappu Kumar</p>
          <p style="margin:12px 0 0; font-size:11px; color:#aab3bf;">This is an automated payment notice.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'tada-approved-payment' AND channel = 'email');

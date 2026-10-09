INSERT INTO templates (template_key, channel, subject, body)
SELECT 'engineer-leave-rejected', 'email',
'Leave Request Update: {{startDate}} to {{endDate}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,40,80,0.10); font-family:''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header (red = rejected) -->
        <tr><td style="background:#991b1b; background-image:linear-gradient(135deg,#991b1b 0%,#dc2626 100%); padding:28px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:21px; font-weight:700;">Leave Not Approved</td>
            <td align="right" style="color:#fecaca; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#fecaca; font-size:13px;">Service Team &middot; Leave Request</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 34px 6px;">
          <p style="margin:0 0 16px; font-size:16px; color:#1f2937;">Dear <strong>{{engineerName}}</strong>,</p>
          <div style="background:#fef2f2; border-radius:8px; padding:20px 18px; margin:0 0 18px; text-align:center;">
            <p style="margin:0; font-size:22px; color:#b91c1c; font-weight:700;">Your leave request was not approved</p>
            <p style="margin:6px 0 0; font-size:14px; color:#8f3030;">by {{reviewedBy}} on {{reviewedOn}}</p>
          </div>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:0 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:14px;">
            <tr style="border-bottom:1px solid #eef2f7;">
              <td style="padding:12px 14px; background:#f6f8fc; color:#64748b; width:38%;"><strong>Leave dates</strong></td>
              <td style="padding:12px 14px; color:#1f2937;">{{startDate}} &rarr; {{endDate}} &nbsp;<span style="background:#fef2f2; color:#b91c1c; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700;">{{days}} day(s)</span></td>
            </tr>
            <tr>
              <td style="padding:12px 14px; background:#f6f8fc; color:#64748b;"><strong>Reason</strong></td>
              <td style="padding:12px 14px; color:#4b5563;">{{reason}}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:18px 34px 2px;">
          <p style="margin:0; font-size:14px; color:#b91c1c; font-weight:600; line-height:1.6;">Please contact HR or your service coordinator for details, and re-apply if required.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 34px 26px; border-top:1px solid #eef2f7;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Service Operations</strong><br/>Ashva Health Tech</p>
          <p style="margin:12px 0 0; font-size:11px; color:#aab3bf;">This is an automated leave-status notice.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'engineer-leave-rejected' AND channel = 'email');

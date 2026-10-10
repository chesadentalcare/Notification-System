INSERT INTO templates (template_key, channel, subject, body)
SELECT 'engineer-leave-approval-request', 'email',
'Leave approval needed: {{engineerName}} ({{startDate}} to {{endDate}})',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,40,80,0.10); font-family:''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header -->
        <tr><td style="background:#3730a3; background-image:linear-gradient(135deg,#3730a3 0%,#4f46e5 100%); padding:28px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:21px; font-weight:700; letter-spacing:0.2px;">Leave Approval Required</td>
            <td align="right" style="color:#c7d2fe; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#c7d2fe; font-size:13px;">Service Team &middot; Leave Request</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px 34px 6px;">
          <p style="margin:0 0 6px; font-size:16px; color:#1f2937;">Dear <strong>{{approverName}}</strong>,</p>
          <p style="margin:0 0 18px; font-size:15px; color:#4b5563; line-height:1.6;"><strong>{{engineerName}}</strong> has applied for leave and needs your approval.</p>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:0 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:14px;">
            <tr style="border-bottom:1px solid #eef2f7;">
              <td style="padding:12px 14px; background:#f6f8fc; color:#64748b; width:38%;"><strong>Employee</strong></td>
              <td style="padding:12px 14px; color:#1f2937;">{{engineerName}}</td>
            </tr>
            <tr style="border-bottom:1px solid #eef2f7;">
              <td style="padding:12px 14px; background:#f6f8fc; color:#64748b;"><strong>Leave dates</strong></td>
              <td style="padding:12px 14px; color:#1f2937;">{{startDate}} &rarr; {{endDate}} &nbsp;<span style="background:#eef2ff; color:#4338ca; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700;">{{days}} day(s)</span></td>
            </tr>
            <tr style="border-bottom:1px solid #eef2f7;">
              <td style="padding:12px 14px; background:#f6f8fc; color:#64748b;"><strong>Reason</strong></td>
              <td style="padding:12px 14px; color:#4b5563;">{{reason}}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px; background:#f6f8fc; color:#64748b;"><strong>Applied on</strong></td>
              <td style="padding:12px 14px; color:#6b7280;">{{appliedOn}}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Action buttons -->
        <tr><td align="center" style="padding:26px 34px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding:0 7px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border-radius:8px; background:#065f46; background-image:linear-gradient(135deg,#047857 0%,#059669 100%);">
                  <a href="{{approveUrl}}" style="display:inline-block; padding:14px 38px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">Approve</a>
                </td>
              </tr></table>
            </td>
            <td style="padding:0 7px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="border-radius:8px; background:#b91c1c; background-image:linear-gradient(135deg,#b91c1c 0%,#dc2626 100%);">
                  <a href="{{rejectUrl}}" style="display:inline-block; padding:14px 38px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">Reject</a>
                </td>
              </tr></table>
            </td>
          </tr></table>
          <p style="margin:16px 0 0; font-size:12px; color:#9aa5b1; line-height:1.6;">Any one of HR, Dheeraj or Anjum can approve &mdash; the first action is applied. This link expires in 14 days.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 34px 26px; border-top:1px solid #eef2f7;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Service Operations</strong><br/>Ashva Health Tech</p>
          <p style="margin:12px 0 0; font-size:11px; color:#aab3bf;">This is an automated leave-approval request.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'engineer-leave-approval-request' AND channel = 'email');

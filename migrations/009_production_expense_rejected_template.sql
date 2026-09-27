INSERT INTO templates (template_key, channel, subject, body)
SELECT 'production-expense-rejected', 'email',
'Action needed: expense #{{expenseId}} was returned',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="700" cellpadding="0" cellspacing="0" style="max-width:700px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,40,80,0.10); font-family:''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header (red = returned/rejected) -->
        <tr><td style="background:#991b1b; background-image:linear-gradient(135deg,#991b1b 0%,#b91c1c 100%); padding:30px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.2px;">Expense Returned — Action Needed</td>
            <td align="right" style="color:#f2c9c9; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#f0bcbc; font-size:13px;">Production Expenses &middot; Reapply required</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px 34px 8px;">
          <p style="margin:0 0 6px; font-size:16px; color:#1f2937;">Dear <strong>{{submittedBy}}</strong>,</p>
          <p style="margin:0 0 16px; font-size:15px; color:#4b5563; line-height:1.6;">Your production expense <strong>#{{expenseId}}</strong> was reviewed and <strong>returned</strong> by management. It has <strong>not</strong> been approved and will not move to accounts until you fix the issue below and resubmit it.</p>
          <div style="display:inline-block; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:999px; padding:7px 16px; font-size:13px; font-weight:700;">
            ↩ Returned by {{rejectedBy}}
          </div>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:18px 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:13px;">
            <tr style="border-top:1px solid #eef2f7; background:#f6f8fc;">
              <td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:40%;">Expense ID</td>
              <td style="padding:10px 12px; color:#1f2937;"><span style="background:#eef4ff; color:#1e3a5f; border-radius:6px; padding:2px 7px; font-weight:700; font-size:12px;">#{{expenseId}}</span></td>
            </tr>
            <tr style="border-top:1px solid #eef2f7;">
              <td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Category</td>
              <td style="padding:10px 12px; color:#1f2937;">{{category}}</td>
            </tr>
            <tr style="border-top:1px solid #eef2f7;">
              <td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Amount</td>
              <td style="padding:10px 12px; color:#0f766e; font-weight:700; white-space:nowrap;">{{amount}}</td>
            </tr>
            <tr style="border-top:1px solid #eef2f7;">
              <td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Paid to</td>
              <td style="padding:10px 12px; color:#4b5563;">{{payTo}}</td>
            </tr>
            <tr style="border-top:1px solid #eef2f7;">
              <td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Submitted by</td>
              <td style="padding:10px 12px; color:#4b5563;">{{submittedBy}}</td>
            </tr>
            <tr style="border-top:1px solid #eef2f7;">
              <td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Returned by</td>
              <td style="padding:10px 12px; color:#4b5563;">{{rejectedBy}}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Reason (highlighted) -->
        <tr><td style="padding:18px 34px 6px;">
          <div style="background:#fef2f2; border:1px solid #fecaca; border-left:4px solid #b91c1c; border-radius:10px; padding:16px 18px;">
            <div style="color:#b91c1c; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px;">Reason for return</div>
            <div style="color:#7f1d1d; font-size:15px; font-weight:600; line-height:1.55;">{{rejectionReason}}</div>
          </div>
        </td></tr>

        <!-- Next step -->
        <tr><td style="padding:20px 34px 4px;">
          <p style="margin:0 0 6px; font-size:15px; color:#1f2937; font-weight:700;">What to do next</p>
          <p style="margin:0 0 14px; font-size:14px; color:#4b5563; line-height:1.6;">Open the expense portal and use <strong>&ldquo;Reapply&rdquo;</strong> on this same expense (<strong>#{{expenseId}}</strong>). Fix the issue noted above &mdash; for example add the missing breakup &mdash; and resubmit. There is <strong>no need to create a new expense</strong>; the same record will go back for approval.</p>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:8px 34px 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:8px; background:#991b1b; background-image:linear-gradient(135deg,#991b1b 0%,#b91c1c 100%);">
              <a href="{{reapplyUrl}}" style="display:inline-block; padding:14px 34px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">Reapply this expense &rarr;</a>
            </td>
          </tr></table>
          <p style="margin:14px 0 0; font-size:12px; color:#9aa5b1;">Reapply reopens expense #{{expenseId}} for editing &mdash; it does not create a duplicate.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 34px 26px; border-top:1px solid #eef2f7;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Automated Reporting System</strong><br/>Pappu Kumar</p>
          <p style="margin:12px 0 0; font-size:11px; color:#aab3bf;">This is an automated notice. Already reapplied it? You can ignore this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'production-expense-rejected' AND channel = 'email');

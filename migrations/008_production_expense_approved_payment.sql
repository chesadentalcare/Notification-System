INSERT INTO templates (template_key, channel, subject, body)
SELECT 'production-expense-approved-payment', 'email',
'{{subjectLine}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="700" cellpadding="0" cellspacing="0" style="max-width:700px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,40,80,0.10); font-family:''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header (green = approved) -->
        <tr><td style="background:#065f46; background-image:linear-gradient(135deg,#065f46 0%,#0f766e 100%); padding:30px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.2px;">Expense Approved — Payment Required</td>
            <td align="right" style="color:#b7e4d3; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#a7e0cf; font-size:13px;">Production Expenses &middot; Accounts / Payment</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px 34px 8px;">
          <p style="margin:0 0 6px; font-size:16px; color:#1f2937;">Dear <strong>{{recipient.name}}</strong>,</p>
          <p style="margin:0 0 16px; font-size:15px; color:#4b5563; line-height:1.6;">{{intro}}</p>
          <div style="display:inline-block; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; border-radius:999px; padding:7px 16px; font-size:13px; font-weight:700;">
            ✅ Approved by {{approvedBy}}
          </div>
        </td></tr>

        <!-- Table -->
        <tr><td style="padding:18px 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:13px;">
            <tr style="background:#f6f8fc; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">
              <th align="left" style="padding:10px 10px;">ID</th>
              <th align="left" style="padding:10px 10px;">Category</th>
              <th align="left" style="padding:10px 10px;">Type</th>
              <th align="right" style="padding:10px 10px;">Amount</th>
              <th align="left" style="padding:10px 10px;">Paid To</th>
              <th align="left" style="padding:10px 10px;">Submitted by</th>
              <th align="left" style="padding:10px 10px;">Bill date</th>
              <th align="left" style="padding:10px 10px;">Note</th>
            </tr>
            {{#each expenses}}
            <tr style="border-top:1px solid #eef2f7;">
              <td style="padding:10px 10px;"><span style="background:#eef4ff; color:#1e3a5f; border-radius:6px; padding:2px 7px; font-weight:700; font-size:12px;">#{{this.id}}</span></td>
              <td style="padding:10px 10px; color:#1f2937;">{{this.category}}</td>
              <td style="padding:10px 10px;"><span style="background:#ecfdf5; color:#047857; border-radius:6px; padding:2px 7px; font-size:11px; font-weight:600;">{{this.type}}</span></td>
              <td align="right" style="padding:10px 10px; color:#0f766e; font-weight:700; white-space:nowrap;">{{this.amount}}</td>
              <td style="padding:10px 10px; color:#4b5563;">{{this.paidTo}}</td>
              <td style="padding:10px 10px; color:#4b5563;">{{this.submittedBy}}</td>
              <td style="padding:10px 10px; color:#6b7280; white-space:nowrap;">{{this.billDate}}</td>
              <td style="padding:10px 10px; color:#4b5563;">{{this.note}}</td>
            </tr>
            {{/each}}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:26px 34px 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:8px; background:#065f46; background-image:linear-gradient(135deg,#065f46 0%,#0f766e 100%);">
              <a href="{{paymentUrl}}" style="display:inline-block; padding:14px 34px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">Process Payment &rarr;</a>
            </td>
          </tr></table>
          <p style="margin:14px 0 0; font-size:12px; color:#9aa5b1;">This expense has been approved by management and is ready for payment.</p>
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
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = ''production-expense-approved-payment'' AND channel = ''email'');

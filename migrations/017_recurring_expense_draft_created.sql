INSERT INTO templates (template_key, channel, subject, body)
SELECT 'recurring-expense-draft-created', 'email',
'{{subjectLine}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="700" cellpadding="0" cellspacing="0" style="max-width:700px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,40,80,0.10); font-family:''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2b5a8c 100%); padding:30px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.2px;">Monthly Recurring Expenses</td>
            <td align="right" style="color:#bcd4ee; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#a9c4e0; font-size:13px;">{{month}} &middot; Drafts ready for your review</div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:28px 34px 10px;">
          <p style="margin:0 0 8px; font-size:16px; color:#1f2937;">Hi <strong>Sathish</strong>,</p>
          <p style="margin:0 0 18px; font-size:15px; color:#4b5563; line-height:1.6;">
            Your <strong>{{expenses.length}} recurring expense draft(s)</strong> for <strong>{{month}}</strong> have been automatically created and are waiting for you.
          </p>
          <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:14px 18px; font-size:14px; color:#92400e;">
            <strong>What you need to do:</strong>
            <ol style="margin:8px 0 0; padding-left:18px; line-height:1.9;">
              <li>Open each draft expense in the production dashboard</li>
              <li>Enter the correct amount (if not pre-filled)</li>
              <li>Upload the bill / invoice image</li>
              <li>Add any remarks or description needed</li>
              <li>Click <strong>Submit</strong> to send for approval</li>
            </ol>
          </div>
        </td></tr>

        <!-- Expense List -->
        <tr><td style="padding:16px 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:13px;">
            <tr style="background:#f6f8fc; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">
              <th align="left"  style="padding:10px 12px;">#</th>
              <th align="left"  style="padding:10px 12px;">Expense</th>
              <th align="right" style="padding:10px 12px;">Default Amount</th>
              <th align="left"  style="padding:10px 12px;">Note</th>
            </tr>
            {{#each expenses}}
            <tr style="border-top:1px solid #eef2f7; background:{{#if @odd}}#fafbfc{{else}}#ffffff{{/if}}">
              <td style="padding:10px 12px;"><span style="background:#eef4ff; color:#1e3a5f; border-radius:6px; padding:2px 8px; font-weight:700; font-size:12px;">{{this.id}}</span></td>
              <td style="padding:10px 12px; color:#1f2937; font-weight:600;">{{this.name}}</td>
              <td align="right" style="padding:10px 12px; color:#0f766e; font-weight:700; white-space:nowrap;">
                {{#if this.amount}}₹{{this.amount}}{{else}}<span style="color:#b45309;">Enter amount</span>{{/if}}
              </td>
              <td style="padding:10px 12px; color:#6b7280; font-size:12px;">{{this.notes}}</td>
            </tr>
            {{/each}}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:28px 34px 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:8px; background:linear-gradient(135deg,#1e3a5f 0%,#2b5a8c 100%);">
              <a href="{{expenseUrl}}" style="display:inline-block; padding:14px 36px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; border-radius:8px;">
                Open Expenses &rarr;
              </a>
            </td>
          </tr></table>
          <p style="margin:14px 0 0; font-size:12px; color:#9aa5b1;">Please complete all drafts before month end so they can be processed in time.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 34px 26px; border-top:1px solid #eef2f7;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Automated System</strong><br/>Ashva Health Tech</p>
          <p style="margin:10px 0 0; font-size:11px; color:#aab3bf;">This email is sent automatically when monthly recurring expense drafts are generated.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'recurring-expense-draft-created' AND channel = 'email');

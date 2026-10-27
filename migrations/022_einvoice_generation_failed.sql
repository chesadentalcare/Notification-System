INSERT INTO templates (template_key, channel, subject, body)
SELECT 'einvoice-generation-failed', 'email',
'ACTION NEEDED: {{kind}} generation failed for doc {{docEntry}} ({{db}})',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#fdf2f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f2; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(120,20,20,0.12); font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

        <!-- Header -->
        <tr><td style="background:#b42318; background-image:linear-gradient(135deg,#b42318 0%,#d64535 100%); padding:26px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="color:#ffffff; font-size:20px; font-weight:700;">E-Invoicing — Generation Failed</td>
            <td align="right" style="color:#ffd9d4; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#ffe3df; font-size:13px;">Automated retries are exhausted — manual action is needed</div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:24px 32px 6px;">
          <p style="margin:0 0 14px; font-size:15px; color:#4b5563; line-height:1.6;">A <strong>{{kind}}</strong> could not be generated on the Government portal after repeated attempts. Please review and generate it manually.</p>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:6px 32px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0d4d0; border-radius:10px; overflow:hidden; font-size:13px;">
            <tr style="background:#fcf3f2;"><td style="padding:10px 12px; color:#8a5a55; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:36%;">Type</td><td style="padding:10px 12px; color:#1f2937; font-weight:700;">{{kind}}</td></tr>
            <tr style="border-top:1px solid #f6e7e5;"><td style="padding:10px 12px; color:#8a5a55; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Company (DB)</td><td style="padding:10px 12px; color:#1f2937;">{{db}}</td></tr>
            <tr style="border-top:1px solid #f6e7e5;"><td style="padding:10px 12px; color:#8a5a55; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Document (DocEntry)</td><td style="padding:10px 12px; color:#1f2937; font-weight:700;">{{docEntry}}</td></tr>
            <tr style="border-top:1px solid #f6e7e5;"><td style="padding:10px 12px; color:#8a5a55; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Reason</td><td style="padding:10px 12px; color:#4b5563;">{{reason}}</td></tr>
            <tr style="border-top:1px solid #f6e7e5;"><td style="padding:10px 12px; color:#8a5a55; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Attempts</td><td style="padding:10px 12px; color:#4b5563;">{{attempts}}</td></tr>
            <tr style="border-top:1px solid #f6e7e5;"><td style="padding:10px 12px; color:#8a5a55; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">First tried</td><td style="padding:10px 12px; color:#4b5563;">{{firstTriedAt}}</td></tr>
            <tr style="border-top:1px solid #f6e7e5;"><td style="padding:10px 12px; color:#8a5a55; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Last error</td><td style="padding:10px 12px; color:#b42318; font-family:Consolas,monospace; font-size:11px;">{{error}}</td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px 26px; border-top:1px solid #f6e7e5;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Automated E-Invoicing System</strong><br/>Ashva Health Tech</p>
          <p style="margin:12px 0 0; font-size:11px; color:#c3a9a5;">Sent only when a queued e-invoice / e-way bill gives up after all automatic retries.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'einvoice-generation-failed' AND channel = 'email');

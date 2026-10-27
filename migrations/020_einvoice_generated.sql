INSERT INTO templates (template_key, channel, subject, body)
SELECT 'einvoice-generated', 'email',
'E-Invoice generated — Invoice {{docNo}} ({{buyerName}})',
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
            <td style="color:#ffffff; font-size:21px; font-weight:700; letter-spacing:0.2px;">E-Invoice Generated</td>
            <td align="right" style="color:#bcd4ea; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Ashva Health Tech</td>
          </tr></table>
          <div style="margin-top:6px; color:#cfe0f0; font-size:13px;">IRN registered on the Government e-Invoice portal &middot; {{environment}}</div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:26px 34px 6px;">
          <p style="margin:0 0 14px; font-size:15px; color:#4b5563; line-height:1.6;">An e-invoice (IRN) has been generated for the invoice below. The signed e-invoice copy with the IRN &amp; QR code is <strong>attached as a PDF</strong>.</p>
        </td></tr>

        <!-- Details -->
        <tr><td style="padding:6px 34px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0; border-radius:10px; overflow:hidden; font-size:13px;">
            <tr style="background:#f6f8fc;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; width:38%;">Invoice No</td><td style="padding:10px 12px; color:#1f2937; font-weight:700;">{{docNo}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Invoice Date</td><td style="padding:10px 12px; color:#4b5563;">{{docDate}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Buyer</td><td style="padding:10px 12px; color:#1f2937; font-weight:700;">{{buyerName}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Buyer GSTIN</td><td style="padding:10px 12px; color:#4b5563;">{{buyerGstin}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Invoice Value</td><td style="padding:10px 12px; color:#1f2937; font-weight:700;">&#8377; {{totalValue}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">IRN</td><td style="padding:10px 12px; color:#1f2937; font-family:Consolas,monospace; font-size:11px; word-break:break-all;">{{irn}}</td></tr>
            <tr style="border-top:1px solid #eef2f7;"><td style="padding:10px 12px; color:#64748b; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">Ack No</td><td style="padding:10px 12px; color:#4b5563;">{{ackNo}}</td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:22px 34px 26px; border-top:1px solid #eef2f7;">
          <p style="margin:0; font-size:14px; color:#374151;">Regards,<br/><strong>Automated E-Invoicing System</strong><br/>Ashva Health Tech</p>
          <p style="margin:12px 0 0; font-size:11px; color:#aab3bf;">This is an automated notification sent whenever an e-invoice is generated. The attached PDF is the IRP-signed copy for your records.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'einvoice-generated' AND channel = 'email');

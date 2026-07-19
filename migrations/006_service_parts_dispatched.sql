INSERT INTO templates (template_key, channel, subject, body)
SELECT 'service-parts-dispatched', 'email',
'Spare Parts Dispatched - SC {{serviceCallId}} - LR {{lrNumber}}',
'<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background: #0e7490; padding: 24px 30px;">
    <h1 style="margin: 0; color: #ffffff; font-size: 20px;">Spare Parts Dispatched</h1>
    <p style="margin: 4px 0 0; color: #b6e3ee; font-size: 13px;">Chesa Dental Care &middot; Service Logistics</p>
  </div>
  <div style="padding: 28px 30px;">
    <p style="font-size: 16px; color: #333;">Dear <strong>{{recipient.name}}</strong>,</p>
    <p style="font-size: 15px; color: #444; line-height: 1.6;">
      The spare parts for the following service order have been <strong>dispatched</strong>.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px;">
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555; width: 38%;"><strong>Service Call</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">SC {{serviceCallId}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Doctor / Customer</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">{{customerName}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Customer Phone</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">{{customerPhone}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>LR / Waybill</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #0e7490; font-weight: bold;">{{lrNumber}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Carrier</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">{{carrier}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Company</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">{{company}}</td>
      </tr>
    </table>
    <p style="font-size: 15px; color: #333; margin: 22px 0 10px; font-weight: bold;">Dispatched Items</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f0f9ff;">
          <th style="padding: 9px 12px; border: 1px solid #e0e0e0; text-align: left; color: #555;">Item Code</th>
          <th style="padding: 9px 12px; border: 1px solid #e0e0e0; text-align: left; color: #555;">Description</th>
          <th style="padding: 9px 12px; border: 1px solid #e0e0e0; text-align: center; color: #555;">Qty</th>
        </tr>
      </thead>
      <tbody>
        {{#each dispatchedItems}}
        <tr>
          <td style="padding: 9px 12px; border: 1px solid #e0e0e0; color: #333;">{{this.code}}</td>
          <td style="padding: 9px 12px; border: 1px solid #e0e0e0; color: #333;">{{this.description}}</td>
          <td style="padding: 9px 12px; border: 1px solid #e0e0e0; text-align: center; color: #333;">{{this.qty}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    <p style="font-size: 15px; color: #333; margin-top: 24px;">
      Regards,<br/>
      <strong>Service Logistics Team</strong><br/>
      Chesa Dental Care
    </p>
  </div>
  <div style="background: #f5f5f5; padding: 14px 30px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">Automated dispatch notification &middot; Chesa Dental Care</p>
  </div>
</div>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'service-parts-dispatched' AND channel = 'email');

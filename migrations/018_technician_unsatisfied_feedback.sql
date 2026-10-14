INSERT INTO templates (template_key, channel, subject, body)
SELECT 'technician-unsatisfied-feedback', 'email',
'⚠️ Dr {{doctorName}} is NOT satisfied — please call now (Service Call #{{serviceCallId}})',
'<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="background: #b91c1c; background-image: linear-gradient(135deg,#b91c1c 0%,#dc2626 100%); padding: 24px 30px;">
    <h1 style="margin: 0; color: #ffffff; font-size: 20px;">Customer Not Satisfied &mdash; Action Needed</h1>
    <p style="margin: 4px 0 0; color: #fecaca; font-size: 13px;">Chesa Dental Care &middot; Service Feedback</p>
  </div>
  <div style="padding: 28px 30px;">
    <p style="font-size: 16px; color: #333;">Dear <strong>{{technicianName}}</strong>,</p>
    <div style="background:#fef2f2; border:1px solid #fecaca; border-left:5px solid #dc2626; border-radius:8px; padding:16px 18px; margin:16px 0;">
      <p style="margin:0; font-size:17px; color:#991b1b; font-weight:bold; line-height:1.5;">Dr. {{doctorName}} is NOT satisfied with your service work.</p>
    </div>
    <p style="font-size: 15px; color: #444; line-height: 1.6;">
      Please call the doctor and try to understand the problem, then resolve it at the earliest. If any assistance is needed, please inform the coordination team immediately.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px;">
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555; width: 38%;"><strong>Doctor</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">{{doctorName}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Phone</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;"><a href="tel:{{doctorPhone}}" style="color:#dc2626; font-weight:bold; text-decoration:none;">{{doctorPhone}}</a></td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Location</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">{{doctorLocation}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Service Call</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">SC {{serviceCallId}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #f8f9fa; color: #555;"><strong>Company</strong></td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333;">{{company}}</td>
      </tr>
    </table>
    <div style="text-align:center; margin:24px 0 8px;">
      <a href="tel:{{doctorPhone}}" style="display:inline-block; background:#dc2626; color:#ffffff; font-size:15px; font-weight:bold; text-decoration:none; padding:13px 34px; border-radius:8px;">Call the Doctor</a>
    </div>
    <p style="font-size: 15px; color: #333; margin-top: 24px;">
      Regards,<br/>
      <strong>Service Coordination Team</strong><br/>
      Chesa Dental Care
    </p>
  </div>
  <div style="background: #f5f5f5; padding: 14px 30px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">Automated service-feedback alert &middot; Chesa Dental Care</p>
  </div>
</div>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'technician-unsatisfied-feedback' AND channel = 'email');

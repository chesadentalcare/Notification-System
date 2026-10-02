-- Care campaigns: bulk "care message" sends to past chair buyers.
-- The buyer contact base (care_customers) is synced from SAP into
-- production_dashboard by chesa_api_gateway and read cross-DB; only the
-- campaign bookkeeping lives here in notification_service.

CREATE TABLE IF NOT EXISTS care_campaigns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  channel VARCHAR(16) NOT NULL,
  template_key VARCHAR(120) NOT NULL,
  filter_json JSON NULL,
  complaint_url VARCHAR(500) NULL,
  total INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS care_campaign_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id CHAR(36) NOT NULL,
  company VARCHAR(20) NULL,
  card_code VARCHAR(50) NULL,
  channel VARCHAR(16) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  name VARCHAR(200) NULL,
  notification_id CHAR(36) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_campaign_recipient (campaign_id, channel, recipient),
  KEY idx_campaign (campaign_id),
  KEY idx_notification (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default care-message email template (Handlebars). {{complaintUrl}} is a
-- per-recipient deep link into the complaint site, prefilled with their phone.
INSERT INTO templates (template_key, channel, subject, body)
SELECT 'care-checkin', 'email',
'A quick check-in on your dental chair — {{company}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background:#0e7490;padding:22px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:20px;">We''re here for you</h1>
  </div>
  <div style="padding:26px 28px;border:1px solid #e4e8ee;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:15px;color:#333;">Dear {{recipient.name}},</p>
    <p style="font-size:15px;color:#444;line-height:1.6;">
      Thank you for being a valued customer. We just wanted to check in and make
      sure your dental equipment is working well for you.
    </p>
    <p style="font-size:15px;color:#444;line-height:1.6;">
      If you are facing any issue, you can raise a service request in under a
      minute — our team will take it from there.
    </p>
    <p style="text-align:center;margin:26px 0;">
      <a href="{{complaintUrl}}" style="background:#0e7490;color:#fff;text-decoration:none;padding:12px 26px;border-radius:7px;font-weight:bold;display:inline-block;">
        Raise a service request
      </a>
    </p>
    <p style="font-size:13px;color:#888;">Or copy this link: {{complaintUrl}}</p>
    <p style="font-size:15px;color:#333;margin-top:22px;">Warm regards,<br/><strong>{{company}} Care Team</strong></p>
  </div>
</div>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'care-checkin' AND channel = 'email');

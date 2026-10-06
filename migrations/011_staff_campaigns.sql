-- Staff campaigns: bulk announcements/alerts to our own employees.
-- The employee contact base (employees) is synced from SAP into
-- production_dashboard the same way care_customers is (salary GL codes 36xxx
-- under the Ashva "Salary" head, enriched with EmployeesInfo eMail/MobilePhone),
-- and read cross-DB; only the campaign bookkeeping lives here in
-- notification_service.

CREATE TABLE IF NOT EXISTS staff_campaigns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  channel VARCHAR(16) NOT NULL,
  template_key VARCHAR(120) NOT NULL,
  filter_json JSON NULL,
  portal_url VARCHAR(500) NULL,
  total INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_campaign_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaign_id CHAR(36) NOT NULL,
  company VARCHAR(20) NULL,
  gl_code VARCHAR(50) NULL,
  department VARCHAR(120) NULL,
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

-- Default staff-announcement email template (Handlebars). The announcement copy
-- lives in the template; the campaign supplies {{company}}, {{department}} and an
-- optional {{portalUrl}} deep link into the staff portal/superapp.
INSERT INTO templates (template_key, channel, subject, body)
SELECT 'staff-announcement', 'email',
'{{company}} — a note for the team',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background:#1d4ed8;padding:22px 28px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:20px;">A quick note for the team</h1>
  </div>
  <div style="padding:26px 28px;border:1px solid #e4e8ee;border-top:none;border-radius:0 0 8px 8px;">
    <p style="font-size:15px;color:#333;">Hi {{recipient.name}},</p>
    <p style="font-size:15px;color:#444;line-height:1.6;">
      This is a message for everyone at {{company}}. Please read it when you get a
      moment — if anything needs your action, the details are below.
    </p>
    <p style="text-align:center;margin:26px 0;">
      <a href="{{portalUrl}}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 26px;border-radius:7px;font-weight:bold;display:inline-block;">
        Open the staff portal
      </a>
    </p>
    <p style="font-size:13px;color:#888;">Or copy this link: {{portalUrl}}</p>
    <p style="font-size:15px;color:#333;margin-top:22px;">Thanks,<br/><strong>{{company}}</strong></p>
  </div>
</div>'
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE template_key = 'staff-announcement' AND channel = 'email');

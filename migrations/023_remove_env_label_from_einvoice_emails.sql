-- Production e-invoice / e-way-bill emails should not be stamped with the environment
-- ("· PROD") — a real production notification has no reason to show it. Strip the
-- " · {{environment}}" suffix from both templates. Idempotent (REPLACE is a no-op if
-- already removed). The PDF keeps a TEST-only badge via the microservice renderer.
UPDATE templates
SET body = REPLACE(body, ' &middot; {{environment}}', '')
WHERE template_key IN ('einvoice-generated', 'ewaybill-generated');

-- Migration 005 rollback
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS payment_events CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP SEQUENCE IF EXISTS invoice_number_seq;
ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS paypal_subscription_id,
  DROP COLUMN IF EXISTS paypal_order_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS trial_end,
  DROP COLUMN IF EXISTS cancel_at;

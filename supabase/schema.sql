-- ============================================================
-- ฟู๊ด ธันเดอร์ (FoodFlow2026) — สคีมาฐานข้อมูล Supabase/Postgres
-- สร้างอัตโนมัติจากโปรเจกต์จริง (OpenAPI + ข้อมูลจริง) วันที่ 2026-11-09
-- วิธีใช้: Supabase ใหม่ → SQL Editor → รันไฟล์นี้ทั้งหมด → รัน scripts/seed-thai.mjs
-- หมายเหตุ: ต้องเปิดส่วนเสริม PostGIS และ pgcrypto ตามคำสั่งด้านล่าง
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector; -- สำหรับ rag_documents.embedding vector(1536)

-- ---------- ชนิด enum (รื้อค่าจากข้อมูลจริง) ----------
CREATE TYPE "AiUsageOutcome" AS ENUM ('success', 'error');
CREATE TYPE "ChatSenderType" AS ENUM ('ai', 'customer', 'system');
CREATE TYPE "ChatSessionType" AS ENUM ('ai_support', 'customer_restaurant');
CREATE TYPE "DeliveryTaskStatus" AS ENUM ('delivered', 'assigned', 'picked_up');
CREATE TYPE "ExportFormat" AS ENUM ('csv', 'xlsx', 'json');
CREATE TYPE "ExportJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE "KycStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "LocaleCode" AS ENUM ('en');
CREATE TYPE "LoyaltyTxnType" AS ENUM ('credit');
CREATE TYPE "OrderStatus" AS ENUM ('completed', 'delivered', 'paid', 'pending_payment', 'cancelled', 'delivering', 'driver_assigned', 'picked_up', 'preparing', 'ready_for_pickup', 'refunded', 'restaurant_accepted');
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'promptpay');
CREATE TYPE "PaymentStatus" AS ENUM ('completed', 'pending');
CREATE TYPE "PriceRange" AS ENUM ('$', '$$');
CREATE TYPE "PromotionStatus" AS ENUM ('active', 'inactive', 'expired');
CREATE TYPE "PromotionType" AS ENUM ('fixed', 'percentage');
CREATE TYPE "RestaurantApprovalStatus" AS ENUM ('approved', 'pending', 'rejected', 'suspended');
CREATE TYPE "StaffInviteStatus" AS ENUM ('invited', 'accepted', 'expired', 'revoked');
CREATE TYPE "StaffRole" AS ENUM ('owner');
CREATE TYPE "StaffShiftStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "SupportChannel" AS ENUM ('in_app');
CREATE TYPE "SupportMessageType" AS ENUM ('message', 'note', 'system');
CREATE TYPE "TicketIssueType" AS ENUM ('late_delivery');
CREATE TYPE "TicketPriority" AS ENUM ('medium');
CREATE TYPE "TicketStatus" AS ENUM ('open');
CREATE TYPE "UserRole" AS ENUM ('admin', 'customer', 'driver', 'restaurant');
CREATE TYPE "VehicleType" AS ENUM ('motorbike');
CREATE TYPE "WalletTxnType" AS ENUM ('credit', 'debit');

-- ---------- ตาราง (ไม่มี FK — ใส่ท้ายไฟล์เพื่อไม่ติดลำดับ) ----------
CREATE TABLE addresses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  label character varying(255) NOT NULL,
  address_line character varying(255) NOT NULL,
  location geography(Point,4326) NOT NULL,
  is_default boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE admin_audit_logs (
  id bigint PRIMARY KEY,
  admin_id uuid NOT NULL,
  action character varying(255) NOT NULL,
  target_type character varying(255) NOT NULL,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet NOT NULL,
  created_at timestamptz NOT NULL,
  user_agent character varying(255),
  correlation_id character varying(255),
  severity character varying(255) NOT NULL,
  metadata jsonb,
  search_vector tsvector
);

CREATE TABLE admin_export_jobs (
  id uuid PRIMARY KEY,
  requested_by_id uuid NOT NULL,
  resource character varying(255) NOT NULL,
  format "ExportFormat" NOT NULL,
  status "ExportJobStatus" NOT NULL,
  filters jsonb,
  progress integer NOT NULL,
  file_url character varying(255),
  error_message text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE ai_support_tickets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  order_id uuid,
  issue_type "TicketIssueType" NOT NULL,
  summary text NOT NULL,
  priority "TicketPriority" NOT NULL,
  status "TicketStatus" NOT NULL,
  assigned_admin_id uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  channel "SupportChannel" NOT NULL,
  tags text[] NOT NULL,
  first_responded_at timestamptz,
  waiting_started_at timestamptz,
  sla_deadline_at timestamptz,
  updated_at timestamptz NOT NULL
);

CREATE TABLE ai_usage_events (
  id uuid PRIMARY KEY,
  session_id uuid,
  user_id uuid,
  provider character varying(255) NOT NULL,
  model character varying(255) NOT NULL,
  outcome "AiUsageOutcome" NOT NULL,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer NOT NULL,
  error_code character varying(255),
  created_at timestamptz NOT NULL
);

CREATE TABLE cart_items (
  id uuid PRIMARY KEY,
  cart_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  quantity integer NOT NULL,
  selected_options jsonb NOT NULL,
  unit_price numeric NOT NULL,
  notes character varying(255)
);

CREATE TABLE carts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  restaurant_id uuid,
  promotion_code character varying(255),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE categories (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  sort_order integer NOT NULL,
  parent_id uuid,
  icon character varying(255),
  is_visible boolean NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  sender_type "ChatSenderType" NOT NULL,
  sender_id uuid,
  content text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  type "ChatSessionType" NOT NULL,
  order_id uuid,
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  closed_at timestamptz
);

CREATE TABLE customer_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  default_address_id uuid,
  saved_payment_methods jsonb,
  preferences jsonb,
  total_orders integer NOT NULL
);

CREATE TABLE delivery_tasks (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  pickupLocation geography(Point,4326) NOT NULL,
  dropoffLocation geography(Point,4326) NOT NULL,
  status "DeliveryTaskStatus" NOT NULL,
  pickup_distance_km numeric,
  delivery_distance_km numeric,
  driver_rating numeric,
  assigned_at timestamptz NOT NULL,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  route_geojson jsonb,
  duration_in_traffic integer
);

CREATE TABLE dispatch_offers (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  token_hash character NOT NULL,
  status character varying(255) NOT NULL,
  attempt integer NOT NULL,
  restaurant_lat double precision NOT NULL,
  restaurant_lng double precision NOT NULL,
  distance_km double precision NOT NULL,
  driver_rating double precision NOT NULL,
  total_deliveries integer NOT NULL,
  surge_multiplier double precision NOT NULL,
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE driver_bank_accounts (
  id uuid PRIMARY KEY,
  driver_id uuid NOT NULL,
  bank_code character varying(255) NOT NULL,
  bank_name character varying(255) NOT NULL,
  account_number character varying(255) NOT NULL,
  account_holder_name character varying(255) NOT NULL,
  is_default boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE driver_incentive_campaigns (
  id uuid PRIMARY KEY,
  title character varying(255) NOT NULL,
  reward_amount integer NOT NULL,
  target_orders integer NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE driver_kyc_submissions (
  id uuid PRIMARY KEY,
  driver_profile_id uuid NOT NULL,
  status "KycStatus" NOT NULL,
  document_urls jsonb NOT NULL,
  rejection_reason text,
  reviewed_by_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE driver_location_history (
  id bigint PRIMARY KEY,
  driver_id uuid NOT NULL,
  location geography(Point,4326) NOT NULL,
  order_id uuid,
  recorded_at timestamptz NOT NULL
);

CREATE TABLE driver_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  license_number character varying(255),
  vehicle_type "VehicleType" NOT NULL,
  vehicle_plate character varying(255),
  is_online boolean NOT NULL,
  is_verified boolean NOT NULL,
  current_lat double precision,
  current_lng double precision,
  rating numeric NOT NULL,
  total_deliveries integer NOT NULL,
  total_earnings numeric NOT NULL,
  max_delivery_radius_km integer NOT NULL,
  terms_accepted_at timestamptz,
  terms_version character varying(255)
);

CREATE TABLE driver_tip_reports (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  amount integer NOT NULL,
  currency character varying(255) NOT NULL,
  status character varying(255) NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  token character varying(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE favorite_restaurants (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE fcm_token_revocations (
  registration_id character varying(255) PRIMARY KEY,
  token character varying(255) PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE idempotency_requests (
  id uuid PRIMARY KEY,
  user_id uuid,
  idempotency_key character varying(255) NOT NULL,
  status_code integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE job_outbox (
  id uuid PRIMARY KEY,
  queue text NOT NULL,
  name text NOT NULL,
  payload jsonb NOT NULL,
  options jsonb,
  status text NOT NULL,
  attempts integer NOT NULL,
  run_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  failed_at timestamptz,
  error text,
  dedupe_key character varying(255)
);

CREATE TABLE loyalty_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  points integer NOT NULL,
  type "LoyaltyTxnType" NOT NULL,
  description text NOT NULL,
  order_id uuid,
  created_at timestamptz NOT NULL
);

CREATE TABLE menu_item_option_values (
  id uuid PRIMARY KEY,
  option_id uuid NOT NULL,
  value character varying(255) NOT NULL,
  price_modifier numeric NOT NULL
);

CREATE TABLE menu_item_options (
  id uuid PRIMARY KEY,
  menu_item_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  is_required boolean NOT NULL,
  is_multiple boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE menu_items (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  image_url character varying(255),
  base_price numeric NOT NULL,
  is_available boolean NOT NULL,
  is_popular boolean NOT NULL,
  created_at timestamptz NOT NULL,
  sort_order integer NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE notification_settings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type character varying(255) NOT NULL,
  channels text[] NOT NULL,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  title character varying(255) NOT NULL,
  body text NOT NULL,
  type character varying(255) NOT NULL,
  data jsonb,
  is_read boolean NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  name_snapshot character varying(255) NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  selected_options jsonb NOT NULL,
  notes character varying(255)
);

CREATE TABLE order_status_history (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  status character varying(255) NOT NULL,
  changed_by character varying(255) NOT NULL,
  note text,
  created_at timestamptz NOT NULL
);

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  order_code character varying(255) NOT NULL,
  customer_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  driver_id uuid,
  delivery_address_id uuid NOT NULL,
  status "OrderStatus" NOT NULL,
  subtotal numeric NOT NULL,
  delivery_fee numeric NOT NULL,
  promotion_discount numeric NOT NULL,
  total numeric NOT NULL,
  payment_method "PaymentMethod" NOT NULL,
  notes text,
  estimated_prep_time_minutes integer,
  estimated_delivery_time_minutes integer,
  actual_delivery_time_minutes integer,
  cancelled_reason text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  commission_rate_at_order_time numeric NOT NULL,
  route_polyline text,
  route_waypoints jsonb
);

CREATE TABLE otp_codes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  purpose character varying(255) NOT NULL,
  code_hash character varying(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  token character varying(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE payment_intents (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  provider character varying(255) NOT NULL,
  transaction_ref character varying(255) NOT NULL,
  qr_code_url text,
  amount integer NOT NULL,
  status character varying(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE payment_refund_requests (
  id uuid PRIMARY KEY,
  refund_key character varying(255) NOT NULL,
  order_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  amount integer NOT NULL,
  kind character varying(255) NOT NULL,
  reason text NOT NULL,
  method "PaymentMethod" NOT NULL,
  status character varying(255) NOT NULL,
  attempts integer NOT NULL,
  processing_job_id character varying(255),
  failure_code character varying(255),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE TABLE payment_webhook_receipts (
  id uuid PRIMARY KEY,
  provider character varying(255) NOT NULL,
  provider_transaction_id character varying(255) NOT NULL,
  payment_intent_id uuid,
  order_id uuid,
  amount integer NOT NULL,
  bank_reference character varying(255),
  status character varying(255) NOT NULL,
  failure_code character varying(255),
  received_at timestamptz NOT NULL,
  processed_at timestamptz,
  updated_at timestamptz NOT NULL
);

CREATE TABLE payments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  amount numeric NOT NULL,
  method "PaymentMethod" NOT NULL,
  status "PaymentStatus" NOT NULL,
  transaction_id character varying(255) NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE payout_ledger (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  recipient_type character varying(255) NOT NULL,
  recipient_id uuid,
  amount integer NOT NULL,
  currency character varying(255) NOT NULL,
  status character varying(255) NOT NULL,
  settlement_batch_id uuid,
  created_at timestamptz NOT NULL,
  settled_at timestamptz,
  dedupe_key character varying(255) NOT NULL,
  refund_request_id uuid
);

CREATE TABLE platform_settings (
  id uuid PRIMARY KEY,
  key character varying(255) NOT NULL,
  value jsonb NOT NULL,
  updated_by_id uuid,
  updated_at timestamptz NOT NULL
);

CREATE TABLE production_role_smoke_runs (
  run_id character varying(255) PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  restaurant_slug character varying(255) NOT NULL,
  admin_user_id uuid NOT NULL,
  restaurant_user_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  driver_user_id uuid NOT NULL,
  state character varying(255) NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deletion_committed_at timestamptz,
  capability_drain_done_at timestamptz
);

CREATE TABLE promotion_items (
  id uuid PRIMARY KEY,
  promotion_id uuid NOT NULL,
  menu_item_id uuid,
  category_id uuid
);

CREATE TABLE promotion_usages (
  id uuid PRIMARY KEY,
  promotion_id uuid NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid NOT NULL,
  discount_amount numeric NOT NULL,
  used_at timestamptz NOT NULL
);

CREATE TABLE promotions (
  id uuid PRIMARY KEY,
  code character varying(255) NOT NULL,
  type "PromotionType" NOT NULL,
  value numeric NOT NULL,
  min_order_amount numeric NOT NULL,
  max_discount numeric,
  usage_limit integer NOT NULL,
  usage_count integer NOT NULL,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  current_usage_count integer NOT NULL,
  max_per_user integer,
  first_order_only boolean NOT NULL,
  restaurant_id uuid,
  name character varying(255) NOT NULL,
  description text,
  status "PromotionStatus" NOT NULL,
  is_stackable boolean NOT NULL,
  budget numeric DEFAULT 0,
  used_budget numeric NOT NULL,
  recurrence jsonb,
  targeting jsonb,
  channels text[] NOT NULL,
  created_by_id uuid,
  updated_at timestamptz NOT NULL
);

CREATE TABLE rag_documents (
  id uuid PRIMARY KEY,
  doc_type character varying(255) NOT NULL,
  locale character varying(255) NOT NULL,
  title character varying(255) NOT NULL,
  content text NOT NULL,
  source_id character varying(255),
  embedding vector(1536),
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  content_hash character
);

CREATE TABLE realtime_outbox (
  id uuid PRIMARY KEY,
  channel text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  delivered_at timestamptz,
  error text
);

CREATE TABLE referral_codes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  code character varying(255) NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE referral_redemptions (
  id uuid PRIMARY KEY,
  referrer_user_id uuid NOT NULL,
  invitee_user_id uuid NOT NULL,
  reward_amount integer NOT NULL,
  redeemed_at timestamptz NOT NULL
);

CREATE TABLE restaurant_holiday_closures (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  date date NOT NULL,
  reason character varying(255),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE restaurant_opening_hours (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  open_time character varying(255) NOT NULL,
  close_time character varying(255) NOT NULL,
  is_closed boolean NOT NULL
);

CREATE TABLE restaurant_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  staff_role "StaffRole" NOT NULL,
  permissions jsonb NOT NULL,
  is_active boolean NOT NULL,
  joined_at timestamptz NOT NULL,
  onboarding_completed_at timestamptz
);

CREATE TABLE restaurants (
  id uuid PRIMARY KEY,
  name character varying(255) NOT NULL,
  slug character varying(255) NOT NULL,
  description text,
  logo_url character varying(255),
  cover_url character varying(255),
  location geography(Point,4326) NOT NULL,
  address_line character varying(255) NOT NULL,
  city character varying(255) NOT NULL,
  district character varying(255),
  phone character varying(255),
  cuisine_types text[],
  price_range "PriceRange" NOT NULL,
  rating numeric NOT NULL,
  total_reviews integer NOT NULL,
  is_open boolean NOT NULL,
  is_active boolean NOT NULL,
  prep_time_avg_minutes integer NOT NULL,
  min_order_amount numeric NOT NULL,
  created_at timestamptz NOT NULL,
  approval_status "RestaurantApprovalStatus" NOT NULL,
  approval_notes text,
  approved_at timestamptz,
  approved_by_id uuid,
  onboarding_state jsonb,
  updated_at timestamptz NOT NULL
);

CREATE TABLE reviews (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  restaurant_id uuid,
  driver_id uuid,
  food_rating integer NOT NULL,
  delivery_rating integer,
  comment text,
  created_at timestamptz NOT NULL,
  hidden_reason text,
  is_hidden boolean NOT NULL,
  photos text[] NOT NULL,
  reply text,
  reply_at timestamptz
);

CREATE TABLE staff_invites (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  email character varying(255) NOT NULL,
  role "StaffRole" NOT NULL,
  permissions jsonb NOT NULL,
  token_hash character varying(255) NOT NULL,
  status "StaffInviteStatus" NOT NULL,
  invited_by_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE staff_shifts (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  restaurant_profile_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status "StaffShiftStatus" NOT NULL,
  note character varying(255),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE support_csat_responses (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL
);

CREATE TABLE support_macros (
  id uuid PRIMARY KEY,
  name character varying(255) NOT NULL,
  body text NOT NULL,
  tags text[] NOT NULL,
  is_active boolean NOT NULL,
  created_by_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE support_ticket_messages (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL,
  sender_id uuid,
  type "SupportMessageType" NOT NULL,
  body text NOT NULL,
  attachments jsonb,
  created_at timestamptz NOT NULL
);

CREATE TABLE user_fcm_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  token character varying(255) NOT NULL,
  device_id character varying(255),
  is_stale boolean NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  platform character varying(255) NOT NULL,
  registration_id character varying(255)
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email character varying(255) NOT NULL,
  phone character varying(255),
  password_hash character varying(255) NOT NULL,
  full_name character varying(255) NOT NULL,
  role "UserRole" NOT NULL,
  avatar_url character varying(255),
  is_active boolean NOT NULL,
  failed_login_count integer NOT NULL,
  locked_until timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  preferred_locale "LocaleCode" NOT NULL,
  phone_verified_at timestamptz
);

CREATE TABLE wallet_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  amount_delta integer NOT NULL,
  type "WalletTxnType" NOT NULL,
  reason text NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL,
  status character varying(255) NOT NULL,
  refund_request_id uuid
);

-- ---------- Foreign Keys ----------
ALTER TABLE referral_codes ADD CONSTRAINT fk_referral_codes_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_cart_id FOREIGN KEY (cart_id) REFERENCES carts(id);
ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_menu_item_id FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);
ALTER TABLE payout_ledger ADD CONSTRAINT fk_payout_ledger_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE payout_ledger ADD CONSTRAINT fk_payout_ledger_refund_request_id FOREIGN KEY (refund_request_id) REFERENCES payment_refund_requests(id);
ALTER TABLE notification_settings ADD CONSTRAINT fk_notification_settings_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE payment_refund_requests ADD CONSTRAINT fk_payment_refund_requests_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE payment_refund_requests ADD CONSTRAINT fk_payment_refund_requests_payment_id FOREIGN KEY (payment_id) REFERENCES payments(id);
ALTER TABLE driver_kyc_submissions ADD CONSTRAINT fk_driver_kyc_submissions_driver_profile_id FOREIGN KEY (driver_profile_id) REFERENCES driver_profiles(id);
ALTER TABLE driver_kyc_submissions ADD CONSTRAINT fk_driver_kyc_submissions_reviewed_by_id FOREIGN KEY (reviewed_by_id) REFERENCES users(id);
ALTER TABLE email_verification_tokens ADD CONSTRAINT fk_email_verification_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE order_status_history ADD CONSTRAINT fk_order_status_history_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE support_macros ADD CONSTRAINT fk_support_macros_created_by_id FOREIGN KEY (created_by_id) REFERENCES users(id);
ALTER TABLE driver_bank_accounts ADD CONSTRAINT fk_driver_bank_accounts_driver_id FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE user_fcm_tokens ADD CONSTRAINT fk_user_fcm_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE customer_profiles ADD CONSTRAINT fk_customer_profiles_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE customer_profiles ADD CONSTRAINT fk_customer_profiles_default_address_id FOREIGN KEY (default_address_id) REFERENCES addresses(id);
ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES users(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_driver_id FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_delivery_address_id FOREIGN KEY (delivery_address_id) REFERENCES addresses(id);
ALTER TABLE payment_webhook_receipts ADD CONSTRAINT fk_payment_webhook_receipts_payment_intent_id FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id);
ALTER TABLE payment_webhook_receipts ADD CONSTRAINT fk_payment_webhook_receipts_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE restaurants ADD CONSTRAINT fk_restaurants_approved_by_id FOREIGN KEY (approved_by_id) REFERENCES users(id);
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_menu_item_id FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);
ALTER TABLE driver_location_history ADD CONSTRAINT fk_driver_location_history_driver_id FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE otp_codes ADD CONSTRAINT fk_otp_codes_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE driver_tip_reports ADD CONSTRAINT fk_driver_tip_reports_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE driver_tip_reports ADD CONSTRAINT fk_driver_tip_reports_driver_id FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE driver_profiles ADD CONSTRAINT fk_driver_profiles_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE favorite_restaurants ADD CONSTRAINT fk_favorite_restaurants_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE favorite_restaurants ADD CONSTRAINT fk_favorite_restaurants_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE support_ticket_messages ADD CONSTRAINT fk_support_ticket_messages_ticket_id FOREIGN KEY (ticket_id) REFERENCES ai_support_tickets(id);
ALTER TABLE support_ticket_messages ADD CONSTRAINT fk_support_ticket_messages_sender_id FOREIGN KEY (sender_id) REFERENCES users(id);
ALTER TABLE carts ADD CONSTRAINT fk_carts_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE carts ADD CONSTRAINT fk_carts_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE admin_audit_logs ADD CONSTRAINT fk_admin_audit_logs_admin_id FOREIGN KEY (admin_id) REFERENCES users(id);
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_customer_id FOREIGN KEY (customer_id) REFERENCES users(id);
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_driver_id FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE staff_shifts ADD CONSTRAINT fk_staff_shifts_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE staff_shifts ADD CONSTRAINT fk_staff_shifts_restaurant_profile_id FOREIGN KEY (restaurant_profile_id) REFERENCES restaurant_profiles(id);
ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE promotion_items ADD CONSTRAINT fk_promotion_items_promotion_id FOREIGN KEY (promotion_id) REFERENCES promotions(id);
ALTER TABLE promotion_items ADD CONSTRAINT fk_promotion_items_menu_item_id FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);
ALTER TABLE promotion_items ADD CONSTRAINT fk_promotion_items_category_id FOREIGN KEY (category_id) REFERENCES categories(id);
ALTER TABLE support_csat_responses ADD CONSTRAINT fk_support_csat_responses_ticket_id FOREIGN KEY (ticket_id) REFERENCES ai_support_tickets(id);
ALTER TABLE support_csat_responses ADD CONSTRAINT fk_support_csat_responses_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE restaurant_opening_hours ADD CONSTRAINT fk_restaurant_opening_hours_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE referral_redemptions ADD CONSTRAINT fk_referral_redemptions_referrer_user_id FOREIGN KEY (referrer_user_id) REFERENCES users(id);
ALTER TABLE referral_redemptions ADD CONSTRAINT fk_referral_redemptions_invitee_user_id FOREIGN KEY (invitee_user_id) REFERENCES users(id);
ALTER TABLE staff_invites ADD CONSTRAINT fk_staff_invites_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE staff_invites ADD CONSTRAINT fk_staff_invites_invited_by_id FOREIGN KEY (invited_by_id) REFERENCES users(id);
ALTER TABLE promotions ADD CONSTRAINT fk_promotions_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE promotions ADD CONSTRAINT fk_promotions_created_by_id FOREIGN KEY (created_by_id) REFERENCES users(id);
ALTER TABLE ai_support_tickets ADD CONSTRAINT fk_ai_support_tickets_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ai_support_tickets ADD CONSTRAINT fk_ai_support_tickets_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE ai_support_tickets ADD CONSTRAINT fk_ai_support_tickets_assigned_admin_id FOREIGN KEY (assigned_admin_id) REFERENCES users(id);
ALTER TABLE delivery_tasks ADD CONSTRAINT fk_delivery_tasks_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE delivery_tasks ADD CONSTRAINT fk_delivery_tasks_driver_id FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE menu_item_options ADD CONSTRAINT fk_menu_item_options_menu_item_id FOREIGN KEY (menu_item_id) REFERENCES menu_items(id);
ALTER TABLE addresses ADD CONSTRAINT fk_addresses_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ai_usage_events ADD CONSTRAINT fk_ai_usage_events_session_id FOREIGN KEY (session_id) REFERENCES chat_sessions(id);
ALTER TABLE ai_usage_events ADD CONSTRAINT fk_ai_usage_events_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE loyalty_transactions ADD CONSTRAINT fk_loyalty_transactions_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE restaurant_profiles ADD CONSTRAINT fk_restaurant_profiles_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE restaurant_profiles ADD CONSTRAINT fk_restaurant_profiles_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE menu_item_option_values ADD CONSTRAINT fk_menu_item_option_values_option_id FOREIGN KEY (option_id) REFERENCES menu_item_options(id);
ALTER TABLE categories ADD CONSTRAINT fk_categories_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE categories ADD CONSTRAINT fk_categories_parent_id FOREIGN KEY (parent_id) REFERENCES categories(id);
ALTER TABLE promotion_usages ADD CONSTRAINT fk_promotion_usages_promotion_id FOREIGN KEY (promotion_id) REFERENCES promotions(id);
ALTER TABLE promotion_usages ADD CONSTRAINT fk_promotion_usages_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE promotion_usages ADD CONSTRAINT fk_promotion_usages_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE platform_settings ADD CONSTRAINT fk_platform_settings_updated_by_id FOREIGN KEY (updated_by_id) REFERENCES users(id);
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_session_id FOREIGN KEY (session_id) REFERENCES chat_sessions(id);
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_sender_id FOREIGN KEY (sender_id) REFERENCES users(id);
ALTER TABLE menu_items ADD CONSTRAINT fk_menu_items_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE menu_items ADD CONSTRAINT fk_menu_items_category_id FOREIGN KEY (category_id) REFERENCES categories(id);
ALTER TABLE admin_export_jobs ADD CONSTRAINT fk_admin_export_jobs_requested_by_id FOREIGN KEY (requested_by_id) REFERENCES users(id);
ALTER TABLE dispatch_offers ADD CONSTRAINT fk_dispatch_offers_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE dispatch_offers ADD CONSTRAINT fk_dispatch_offers_driver_id FOREIGN KEY (driver_id) REFERENCES users(id);
ALTER TABLE restaurant_holiday_closures ADD CONSTRAINT fk_restaurant_holiday_closures_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
ALTER TABLE wallet_transactions ADD CONSTRAINT fk_wallet_transactions_user_id FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE wallet_transactions ADD CONSTRAINT fk_wallet_transactions_refund_request_id FOREIGN KEY (refund_request_id) REFERENCES payment_refund_requests(id);
ALTER TABLE payment_intents ADD CONSTRAINT fk_payment_intents_order_id FOREIGN KEY (order_id) REFERENCES orders(id);

-- จบสคีมา — ขั้นถัดไป: bun scripts/seed-thai.mjs (ต้องตั้ง SUPABASE_URL + SBK ก่อน)

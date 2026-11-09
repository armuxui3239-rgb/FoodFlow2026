-- ================= FULL-INSTALL FoodFlow (schema: foodflow) =================
-- วางไฟล์นี้ใน Supabase SQL Editor ครั้งเดียว — ไม่แตะตารางเดิมแม้แต่แถวเดียว
CREATE SCHEMA IF NOT EXISTS foodflow;
SET search_path TO foodflow, extensions, public;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ===== migration: 20260606000000_initial_schema =====
-- PostGIS is required by geography columns in the baseline schema.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('customer', 'driver', 'restaurant', 'admin');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('created', 'pending_payment', 'paid', 'restaurant_pending', 'restaurant_accepted', 'preparing', 'ready_for_pickup', 'driver_assigned', 'driver_arriving_restaurant', 'picked_up', 'delivering', 'delivered', 'completed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'mock_wallet');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('motorbike', 'car', 'bicycle');

-- CreateEnum
CREATE TYPE "PriceRange" AS ENUM ('$', '$$', '$$$');

-- CreateEnum
CREATE TYPE "DeliveryTaskStatus" AS ENUM ('assigned', 'heading_to_restaurant', 'at_restaurant', 'picked_up', 'heading_to_customer', 'delivered');

-- CreateEnum
CREATE TYPE "TicketIssueType" AS ENUM ('late_delivery', 'wrong_item', 'missing_item', 'driver_issue', 'refund_request', 'other');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ChatSenderType" AS ENUM ('customer', 'driver', 'ai', 'system');

-- CreateEnum
CREATE TYPE "ChatSessionType" AS ENUM ('ai_support', 'driver_customer');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('percentage', 'fixed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'customer',
    "avatar_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "default_address_id" UUID,
    "saved_payment_methods" JSONB,
    "preferences" JSONB,
    "total_orders" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "license_number" VARCHAR(50),
    "vehicle_type" "VehicleType" NOT NULL DEFAULT 'motorbike',
    "vehicle_plate" VARCHAR(20),
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "current_lat" DOUBLE PRECISION,
    "current_lng" DOUBLE PRECISION,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 5.0,
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "total_earnings" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "max_delivery_radius_km" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,

    CONSTRAINT "restaurant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "logo_url" VARCHAR(500),
    "cover_url" VARCHAR(500),
    "location" geography(Point, 4326) NOT NULL,
    "address_line" VARCHAR(300) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100),
    "phone" VARCHAR(20),
    "cuisine_types" TEXT[],
    "price_range" "PriceRange" NOT NULL DEFAULT '$$',
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 5.0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "prep_time_avg_minutes" INTEGER NOT NULL DEFAULT 15,
    "min_order_amount" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_opening_hours" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "open_time" VARCHAR(5) NOT NULL,
    "close_time" VARCHAR(5) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "restaurant_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "image_url" VARCHAR(500),
    "base_price" DECIMAL(10,0) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_options" (
    "id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_multiple" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_option_values" (
    "id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "value" VARCHAR(100) NOT NULL,
    "price_modifier" DECIMAL(10,0) NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "restaurant_id" UUID,
    "promotion_code" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "selected_options" JSONB NOT NULL DEFAULT '[]',
    "unit_price" DECIMAL(10,0) NOT NULL,
    "notes" VARCHAR(300),

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_code" VARCHAR(12) NOT NULL,
    "customer_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "driver_id" UUID,
    "delivery_address_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'created',
    "subtotal" DECIMAL(10,0) NOT NULL,
    "delivery_fee" DECIMAL(10,0) NOT NULL,
    "promotion_discount" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,0) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "notes" TEXT,
    "estimated_prep_time_minutes" INTEGER,
    "estimated_delivery_time_minutes" INTEGER,
    "actual_delivery_time_minutes" INTEGER,
    "cancelled_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "name_snapshot" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,0) NOT NULL,
    "selected_options" JSONB NOT NULL DEFAULT '[]',
    "notes" VARCHAR(300),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "changed_by" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(10,0) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "transaction_id" VARCHAR(100) NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tasks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "pickupLocation" geography(Point, 4326) NOT NULL,
    "dropoffLocation" geography(Point, 4326) NOT NULL,
    "status" "DeliveryTaskStatus" NOT NULL DEFAULT 'assigned',
    "pickup_distance_km" DECIMAL(5,2),
    "delivery_distance_km" DECIMAL(5,2),
    "driver_rating" DECIMAL(2,1),
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picked_up_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,

    CONSTRAINT "delivery_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_location_history" (
    "id" BIGSERIAL NOT NULL,
    "driver_id" UUID NOT NULL,
    "location" geography(Point, 4326) NOT NULL,
    "order_id" UUID,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "address_line" VARCHAR(300) NOT NULL,
    "location" geography(Point, 4326) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "restaurant_id" UUID,
    "driver_id" UUID,
    "food_rating" SMALLINT NOT NULL,
    "delivery_rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" "PromotionType" NOT NULL,
    "value" DECIMAL(10,0) NOT NULL,
    "min_order_amount" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "max_discount" DECIMAL(10,0),
    "usage_limit" INTEGER NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_usages" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "discount_amount" DECIMAL(10,0) NOT NULL,
    "used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ChatSessionType" NOT NULL,
    "order_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sender_type" "ChatSenderType" NOT NULL,
    "sender_id" UUID,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "issue_type" "TicketIssueType" NOT NULL,
    "summary" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'medium',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "assigned_admin_id" UUID,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "ai_support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" INET NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_user_id_key" ON "driver_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_profiles_user_id_key" ON "restaurant_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE INDEX "restaurants_city_idx" ON "restaurants"("city");

-- CreateIndex
CREATE INDEX "restaurant_opening_hours_restaurant_id_idx" ON "restaurant_opening_hours"("restaurant_id");

-- CreateIndex
CREATE INDEX "menu_items_restaurant_id_idx" ON "menu_items"("restaurant_id");

-- CreateIndex
CREATE INDEX "menu_items_category_id_idx" ON "menu_items"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_restaurant_id_status_idx" ON "orders"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "orders_driver_id_status_idx" ON "orders"("driver_id", "status");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_tasks_order_id_key" ON "delivery_tasks"("order_id");

-- CreateIndex
CREATE INDEX "driver_location_history_driver_id_recorded_at_idx" ON "driver_location_history"("driver_id", "recorded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_key" ON "reviews"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_usages_promotion_id_user_id_key" ON "promotion_usages"("promotion_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_usages_promotion_id_order_id_key" ON "promotion_usages"("promotion_id", "order_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_created_at_idx" ON "admin_audit_logs"("admin_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_default_address_id_fkey" FOREIGN KEY ("default_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_profiles" ADD CONSTRAINT "restaurant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_profiles" ADD CONSTRAINT "restaurant_profiles_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_opening_hours" ADD CONSTRAINT "restaurant_opening_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_options" ADD CONSTRAINT "menu_item_options_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_option_values" ADD CONSTRAINT "menu_item_option_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "menu_item_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_location_history" ADD CONSTRAINT "driver_location_history_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_usages" ADD CONSTRAINT "promotion_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_support_tickets" ADD CONSTRAINT "ai_support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_support_tickets" ADD CONSTRAINT "ai_support_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== migration: 20260607000000_add_notification_settings =====
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(500) NOT NULL UNIQUE,
  device_id  VARCHAR(200),
  is_stale   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_stale
  ON user_fcm_tokens (user_id, is_stale);

CREATE TABLE IF NOT EXISTS notification_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  channels   TEXT[]      NOT NULL DEFAULT '{}',
  enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notification_settings_user_event UNIQUE (user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user
  ON notification_settings (user_id);

-- ===== migration: 20260607010000_changedby_to_varchar =====
-- AlterTable
ALTER TABLE "order_status_history"
  ALTER COLUMN "changed_by" TYPE VARCHAR(50)
  USING "changed_by"::text;

-- ===== migration: 20260607020000_add_payment_provider =====
-- Extend PaymentMethod enum with SePay provider
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'sepay';

-- Add commission rate snapshot to orders
ALTER TABLE "orders" ADD COLUMN "commission_rate_at_order_time" DECIMAL(4,2) NOT NULL DEFAULT 15.0;

-- Create payment_intents table for VietQR / SePay flow
CREATE TABLE "payment_intents" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "order_id"        UUID         NOT NULL,
  "provider"        VARCHAR(20)  NOT NULL,
  "transaction_ref" VARCHAR(100) NOT NULL,
  "qr_code_url"     TEXT,
  "amount"          INTEGER      NOT NULL,
  "status"          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "expires_at"      TIMESTAMPTZ  NOT NULL,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "payment_intents_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "payment_intents_order_id_key"    UNIQUE ("order_id"),
  CONSTRAINT "payment_intents_transaction_ref_key" UNIQUE ("transaction_ref"),
  CONSTRAINT "payment_intents_order_id_fkey"   FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create payout_ledger table for commission tracking
CREATE TABLE "payout_ledger" (
  "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  "order_id"             UUID         NOT NULL,
  "recipient_type"       VARCHAR(20)  NOT NULL,
  "recipient_id"         UUID,
  "amount"               INTEGER      NOT NULL,
  "currency"             VARCHAR(3)   NOT NULL DEFAULT 'VND',
  "status"               VARCHAR(20)  NOT NULL DEFAULT 'pending',
  "settlement_batch_id"  UUID,
  "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "settled_at"           TIMESTAMPTZ,

  CONSTRAINT "payout_ledger_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "payout_ledger_order_fkey"  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "payment_intents_order_id_idx"              ON "payment_intents"("order_id");
CREATE INDEX "payout_ledger_order_id_idx"                ON "payout_ledger"("order_id");
CREATE INDEX "payout_ledger_recipient_type_id_status_idx" ON "payout_ledger"("recipient_type", "recipient_id", "status");

-- ===== migration: 20260607030000_promotions_engine =====
-- Promotions engine: enum extension + new columns
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a Postgres transaction block.
-- Prisma will execute this migration outside a transaction automatically.

-- Add free_delivery promotion type
ALTER TYPE "PromotionType" ADD VALUE IF NOT EXISTS 'free_delivery';

-- Denormalized usage counter for atomic FOR-UPDATE claim path
ALTER TABLE "promotions"
  ADD COLUMN IF NOT EXISTS "current_usage_count" INTEGER NOT NULL DEFAULT 0;

-- Per-user cap (null = single use enforced by unique constraint on promotion_usages)
ALTER TABLE "promotions"
  ADD COLUMN IF NOT EXISTS "max_per_user" INTEGER;

-- First-order-only restriction
ALTER TABLE "promotions"
  ADD COLUMN IF NOT EXISTS "first_order_only" BOOLEAN NOT NULL DEFAULT false;

-- Optional restaurant-level restriction (null = applies to all restaurants)
ALTER TABLE "promotions"
  ADD COLUMN IF NOT EXISTS "restaurant_id" UUID;

-- Seed counter from existing usage records
UPDATE "promotions" p
SET "current_usage_count" = (
  SELECT COUNT(*)::INTEGER
  FROM "promotion_usages" pu
  WHERE pu.promotion_id = p.id
);

-- Index for restaurant-scoped promo lookups
CREATE INDEX IF NOT EXISTS "promotions_restaurant_id_idx"
  ON "promotions"("restaurant_id");

-- ===== migration: 20260607040000_add_route_columns =====
-- Add route polyline and waypoints to orders for ETA caching and display
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "route_polyline" TEXT,
  ADD COLUMN IF NOT EXISTS "route_waypoints" JSONB;

-- Add route GeoJSON and traffic duration to delivery_tasks for route persistence
ALTER TABLE "delivery_tasks"
  ADD COLUMN IF NOT EXISTS "route_geojson" JSONB,
  ADD COLUMN IF NOT EXISTS "duration_in_traffic" INTEGER;

-- ===== migration: 20260607050000_add_preferred_locale =====
-- CreateEnum
CREATE TYPE "LocaleCode" AS ENUM ('vi', 'en', 'ja');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "preferred_locale" "LocaleCode" NOT NULL DEFAULT 'vi';

-- ===== migration: 20260607060000_add_loyalty_transactions =====
-- CreateTable: loyalty_transactions
CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "points" INTEGER NOT NULL,
  "type" VARCHAR(10) NOT NULL DEFAULT 'credit',
  "description" TEXT NOT NULL DEFAULT '',
  "order_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_transactions_type_check" CHECK ("type" IN ('credit', 'debit'))
);

CREATE INDEX IF NOT EXISTS "loyalty_transactions_user_id_idx"
  ON "loyalty_transactions" ("user_id");

CREATE INDEX IF NOT EXISTS "loyalty_transactions_user_id_created_at_idx"
  ON "loyalty_transactions" ("user_id", "created_at" DESC);

ALTER TABLE "loyalty_transactions"
  ADD CONSTRAINT "loyalty_transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== migration: 20260607070000_add_wallet_transactions =====
CREATE TABLE wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_delta INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
  reason TEXT NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC);

-- ===== migration: 20260607080000_add_referral_codes =====
-- Migration: add referral_codes and referral_redemptions tables

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(16) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_amount INTEGER NOT NULL DEFAULT 0,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_user_id, invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referrer ON referral_redemptions(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_invitee ON referral_redemptions(invitee_user_id);

-- ===== migration: 20260701090000_batch4_web_portal =====
-- Batch 4 web portal: additive schema for approvals, staff, promotions,
-- support operations, exports, settings, KYC, and analytics indexes.

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'waiting_customer';
ALTER TYPE "PromotionType" ADD VALUE IF NOT EXISTS 'bogo';
ALTER TYPE "PromotionType" ADD VALUE IF NOT EXISTS 'combo';

DO $$ BEGIN CREATE TYPE "RestaurantApprovalStatus" AS ENUM ('pending', 'approved', 'changes_requested', 'rejected', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "StaffRole" AS ENUM ('owner', 'manager', 'kitchen', 'cashier', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "StaffInviteStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "StaffShiftStatus" AS ENUM ('scheduled', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PromotionStatus" AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SupportChannel" AS ENUM ('ai_chat', 'email', 'phone', 'in_app'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SupportMessageType" AS ENUM ('public_reply', 'internal_note', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ExportJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ExportFormat" AS ENUM ('csv', 'xlsx', 'parquet'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "KycStatus" AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "restaurant_profiles"
  ADD COLUMN IF NOT EXISTS "staff_role" "StaffRole" NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMPTZ;

ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "approval_status" "RestaurantApprovalStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "approval_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "approved_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "onboarding_state" JSONB,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE "restaurants"
SET "approval_status" = 'approved', "approved_at" = COALESCE("approved_at", "created_at")
WHERE "is_active" = true AND "approval_status" = 'pending';

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "parent_id" UUID,
  ADD COLUMN IF NOT EXISTS "icon" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "is_visible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "menu_items"
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ BEGIN
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "staff_invites" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "email" VARCHAR(255) NOT NULL,
  "role" "StaffRole" NOT NULL,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "token_hash" VARCHAR(128) NOT NULL UNIQUE,
  "status" "StaffInviteStatus" NOT NULL DEFAULT 'pending',
  "invited_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "accepted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "staff_shifts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "restaurant_profile_id" UUID NOT NULL REFERENCES "restaurant_profiles"("id") ON DELETE CASCADE,
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ NOT NULL,
  "status" "StaffShiftStatus" NOT NULL DEFAULT 'scheduled',
  "note" VARCHAR(300),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_shifts_time_check" CHECK ("ends_at" > "starts_at")
);

ALTER TABLE "promotions"
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "PromotionStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "is_stackable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "budget" DECIMAL(12,0),
  ADD COLUMN IF NOT EXISTS "used_budget" DECIMAL(12,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recurrence" JSONB,
  ADD COLUMN IF NOT EXISTS "targeting" JSONB,
  ADD COLUMN IF NOT EXISTS "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "created_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE "promotions" SET "name" = "code" WHERE "name" = '';

DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_restaurant_id_fkey"
    FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "promotion_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "promotion_id" UUID NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
  "menu_item_id" UUID REFERENCES "menu_items"("id") ON DELETE CASCADE,
  "category_id" UUID REFERENCES "categories"("id") ON DELETE CASCADE,
  CONSTRAINT "promotion_items_scope_check" CHECK ("menu_item_id" IS NOT NULL OR "category_id" IS NOT NULL)
);

DROP INDEX IF EXISTS "promotion_usages_promotion_id_user_id_key";

ALTER TABLE "ai_support_tickets"
  ADD COLUMN IF NOT EXISTS "channel" "SupportChannel" NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "first_responded_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "waiting_started_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "sla_deadline_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ BEGIN
  ALTER TABLE "ai_support_tickets" ADD CONSTRAINT "ai_support_tickets_assigned_admin_id_fkey"
    FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "ai_support_tickets"("id") ON DELETE CASCADE,
  "sender_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "type" "SupportMessageType" NOT NULL DEFAULT 'public_reply',
  "body" TEXT NOT NULL,
  "attachments" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "support_macros" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "body" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "support_csat_responses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL UNIQUE REFERENCES "ai_support_tickets"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL,
  "rating" SMALLINT NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "admin_audit_logs"
  ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20) NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "search_vector" TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', COALESCE("action", '') || ' ' || COALESCE("target_type", '') || ' ' || COALESCE("target_id"::text, '') || ' ' || COALESCE("correlation_id", ''))
  ) STORED;

CREATE TABLE IF NOT EXISTS "admin_export_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requested_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "resource" VARCHAR(80) NOT NULL,
  "format" "ExportFormat" NOT NULL,
  "status" "ExportJobStatus" NOT NULL DEFAULT 'queued',
  "filters" JSONB,
  "progress" SMALLINT NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
  "file_url" VARCHAR(1000),
  "error_message" TEXT,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL UNIQUE,
  "value" JSONB NOT NULL,
  "updated_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "driver_kyc_submissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "driver_profile_id" UUID NOT NULL REFERENCES "driver_profiles"("id") ON DELETE CASCADE,
  "status" "KycStatus" NOT NULL DEFAULT 'pending',
  "document_urls" JSONB NOT NULL,
  "rejection_reason" TEXT,
  "reviewed_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "restaurant_profiles_restaurant_id_staff_role_is_active_idx" ON "restaurant_profiles"("restaurant_id", "staff_role", "is_active");
CREATE INDEX IF NOT EXISTS "restaurants_approval_status_created_at_idx" ON "restaurants"("approval_status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "categories_restaurant_id_parent_id_sort_order_idx" ON "categories"("restaurant_id", "parent_id", "sort_order");
CREATE INDEX IF NOT EXISTS "menu_items_restaurant_id_category_id_sort_order_idx" ON "menu_items"("restaurant_id", "category_id", "sort_order");
CREATE INDEX IF NOT EXISTS "staff_invites_restaurant_id_status_created_at_idx" ON "staff_invites"("restaurant_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "staff_invites_email_status_idx" ON "staff_invites"("email", "status");
CREATE INDEX IF NOT EXISTS "staff_shifts_restaurant_id_starts_at_ends_at_idx" ON "staff_shifts"("restaurant_id", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "staff_shifts_restaurant_profile_id_starts_at_idx" ON "staff_shifts"("restaurant_profile_id", "starts_at");
CREATE INDEX IF NOT EXISTS "promotions_restaurant_id_status_starts_at_expires_at_idx" ON "promotions"("restaurant_id", "status", "starts_at", "expires_at");
CREATE INDEX IF NOT EXISTS "promotions_status_starts_at_expires_at_idx" ON "promotions"("status", "starts_at", "expires_at");
CREATE INDEX IF NOT EXISTS "promotion_items_promotion_id_idx" ON "promotion_items"("promotion_id");
CREATE INDEX IF NOT EXISTS "promotion_items_menu_item_id_idx" ON "promotion_items"("menu_item_id");
CREATE INDEX IF NOT EXISTS "promotion_items_category_id_idx" ON "promotion_items"("category_id");
CREATE INDEX IF NOT EXISTS "promotion_usages_promotion_id_user_id_used_at_idx" ON "promotion_usages"("promotion_id", "user_id", "used_at" DESC);
CREATE INDEX IF NOT EXISTS "ai_support_tickets_status_priority_created_at_idx" ON "ai_support_tickets"("status", "priority", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ai_support_tickets_assigned_admin_id_status_idx" ON "ai_support_tickets"("assigned_admin_id", "status");
CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");
CREATE INDEX IF NOT EXISTS "support_macros_is_active_name_idx" ON "support_macros"("is_active", "name");
CREATE INDEX IF NOT EXISTS "support_csat_responses_created_at_idx" ON "support_csat_responses"("created_at");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_correlation_id_idx" ON "admin_audit_logs"("correlation_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_search_vector_idx" ON "admin_audit_logs" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "admin_export_jobs_requested_by_id_created_at_idx" ON "admin_export_jobs"("requested_by_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "admin_export_jobs_status_created_at_idx" ON "admin_export_jobs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "driver_kyc_submissions_status_created_at_idx" ON "driver_kyc_submissions"("status", "created_at");
CREATE INDEX IF NOT EXISTS "driver_kyc_submissions_driver_profile_id_created_at_idx" ON "driver_kyc_submissions"("driver_profile_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "orders_restaurant_id_created_at_status_idx" ON "orders"("restaurant_id", "created_at" DESC, "status");
CREATE INDEX IF NOT EXISTS "order_items_menu_item_id_order_id_idx" ON "order_items"("menu_item_id", "order_id");

-- ===== migration: 20260702170000_add_restaurant_driver_chat =====
ALTER TYPE "ChatSenderType" ADD VALUE IF NOT EXISTS 'restaurant';
ALTER TYPE "ChatSessionType" ADD VALUE IF NOT EXISTS 'restaurant_driver';

-- ===== migration: 20260702180000_sync_prisma_schema =====
-- Bring tables that predate tracked migrations in sync with the current
-- Prisma schema. Every change is additive or converts existing values in place.

DO $$ BEGIN
  CREATE TYPE "LoyaltyTxnType" AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WalletTxnType" AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "loyalty_transactions"
  DROP CONSTRAINT IF EXISTS "loyalty_transactions_type_check";
ALTER TABLE "loyalty_transactions"
  ALTER COLUMN "type" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "LoyaltyTxnType"
    USING "type"::text::"LoyaltyTxnType",
  ALTER COLUMN "type" SET DEFAULT 'credit';

ALTER TABLE "wallet_transactions"
  DROP CONSTRAINT IF EXISTS "wallet_transactions_type_check";
ALTER TABLE "wallet_transactions"
  ALTER COLUMN "type" TYPE "WalletTxnType"
    USING "type"::text::"WalletTxnType",
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED';

ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "hidden_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "is_hidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "reply" TEXT,
  ADD COLUMN IF NOT EXISTS "reply_at" TIMESTAMPTZ,
  ALTER COLUMN "delivery_rating" DROP NOT NULL;

ALTER TABLE "user_fcm_tokens"
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "platform" VARCHAR(20);
UPDATE "user_fcm_tokens" SET "platform" = 'unknown' WHERE "platform" IS NULL;
ALTER TABLE "user_fcm_tokens" ALTER COLUMN "platform" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" VARCHAR(128) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" VARCHAR(128) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "idempotency_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "status_code" INTEGER NOT NULL,
  "response_body" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "idempotency_requests_user_id_idempotency_key_key"
    UNIQUE ("user_id", "idempotency_key")
);

CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx"
  ON "email_verification_tokens"("token");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx"
  ON "email_verification_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx"
  ON "password_reset_tokens"("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx"
  ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "idempotency_requests_user_id_idx"
  ON "idempotency_requests"("user_id");
CREATE INDEX IF NOT EXISTS "idempotency_requests_created_at_idx"
  ON "idempotency_requests"("created_at");
CREATE INDEX IF NOT EXISTS "wallet_transactions_user_id_status_idx"
  ON "wallet_transactions"("user_id", "status");

-- ===== migration: 20260703190000_add_driver_bank_accounts =====
CREATE TABLE "driver_bank_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL,
  "bank_code" VARCHAR(32) NOT NULL,
  "bank_name" VARCHAR(160) NOT NULL,
  "account_number" VARCHAR(64) NOT NULL,
  "account_holder_name" VARCHAR(160) NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_bank_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "driver_bank_accounts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "driver_bank_accounts_driver_bank_number_key"
  ON "driver_bank_accounts"("driver_id", "bank_code", "account_number");

CREATE INDEX "driver_bank_accounts_driver_default_idx"
  ON "driver_bank_accounts"("driver_id", "is_default");

CREATE UNIQUE INDEX "driver_bank_accounts_one_default_per_driver_idx"
  ON "driver_bank_accounts"("driver_id")
  WHERE "is_default" = true;

-- ===== migration: 20260703193000_add_driver_tip_reports =====
CREATE TABLE "driver_tip_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "driver_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
  "status" VARCHAR(20) NOT NULL DEFAULT 'reported',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_tip_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "driver_tip_reports_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "driver_tip_reports_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "driver_tip_reports_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "driver_tip_reports_order_driver_key"
  ON "driver_tip_reports"("order_id", "driver_id");

CREATE INDEX "driver_tip_reports_driver_created_idx"
  ON "driver_tip_reports"("driver_id", "created_at" DESC);

-- ===== migration: 20260703194500_add_driver_terms_acceptance =====
ALTER TABLE "driver_profiles"
  ADD COLUMN "terms_accepted_at" TIMESTAMPTZ,
  ADD COLUMN "terms_version" VARCHAR(32);

CREATE INDEX "driver_profiles_terms_accepted_at_idx"
  ON "driver_profiles"("terms_accepted_at");

-- ===== migration: 20260703201000_rename_wallet_payment_method =====
-- Rename the legacy wallet enum label so stored payment data matches the public API contract.
ALTER TYPE "PaymentMethod" RENAME VALUE 'mock_wallet' TO 'wallet';

-- ===== migration: 20260703212000_add_restaurant_holiday_closures =====
CREATE TABLE "restaurant_holiday_closures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "reason" VARCHAR(200),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "restaurant_holiday_closures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_holiday_closures_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "restaurant_holiday_closures_restaurant_date_key"
  ON "restaurant_holiday_closures"("restaurant_id", "date");

CREATE INDEX "restaurant_holiday_closures_restaurant_date_idx"
  ON "restaurant_holiday_closures"("restaurant_id", "date");

COMMENT ON TABLE "restaurant_holiday_closures" IS 'Restaurant-owned calendar dates when regular weekly opening hours are overridden by a full-day closure.';
COMMENT ON COLUMN "restaurant_holiday_closures"."date" IS 'Local business date for the closure, stored as DATE without time.';

-- ===== migration: 20260707112000_add_driver_incentive_campaigns =====
CREATE TABLE "driver_incentive_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(150) NOT NULL,
    "reward_amount" INTEGER NOT NULL,
    "target_orders" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_incentive_campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driver_incentive_campaigns_reward_amount_check" CHECK ("reward_amount" >= 0),
    CONSTRAINT "driver_incentive_campaigns_target_orders_check" CHECK ("target_orders" > 0),
    CONSTRAINT "driver_incentive_campaigns_window_check" CHECK ("ends_at" > "starts_at")
);

CREATE INDEX "driver_incentive_campaigns_is_active_starts_at_ends_at_idx"
    ON "driver_incentive_campaigns"("is_active", "starts_at", "ends_at");

-- ===== migration: 20260709143000_add_realtime_outbox =====
-- FoodFlow production realtime outbox.
-- Supabase Realtime streams inserts from this table. Row-level security keeps
-- clients scoped to channels granted by the backend-issued realtime JWT.

CREATE TABLE "realtime_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "channel" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "delivered_at" TIMESTAMPTZ,
  "error" TEXT,

  CONSTRAINT "realtime_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "realtime_outbox_channel_created_at_idx"
  ON "realtime_outbox" ("channel", "created_at");

ALTER TABLE "realtime_outbox" ENABLE ROW LEVEL SECURITY;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT ON TABLE "realtime_outbox" TO authenticated';
    EXECUTE $policy$
      CREATE POLICY "foodflow_realtime_outbox_read_allowed_channels"
        ON "realtime_outbox"
        FOR SELECT
        TO authenticated
        USING (
          "channel" IN (
            SELECT jsonb_array_elements_text(
              COALESCE(
                (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'realtime_channels'),
                '[]'::jsonb
              )
            )
          )
        )
    $policy$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "realtime_outbox" TO service_role';
    EXECUTE $policy$
      CREATE POLICY "foodflow_realtime_outbox_service_role_all"
        ON "realtime_outbox"
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END
$roles$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "realtime_outbox";
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ===== migration: 20260709150000_add_job_outbox =====
-- FoodFlow production job outbox for Supabase/Postgres-backed queues.
-- Railway worker/secure recovery endpoints drain this table; local development keeps BullMQ.

CREATE TABLE "job_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "queue" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "options" JSONB,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "run_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ,
  "error" TEXT,

  CONSTRAINT "job_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_outbox_queue_status_run_at_idx"
  ON "job_outbox" ("queue", "status", "run_at");

ALTER TABLE "job_outbox" ENABLE ROW LEVEL SECURITY;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "job_outbox" TO service_role';
    EXECUTE $policy$
      CREATE POLICY "foodflow_job_outbox_service_role_all"
        ON "job_outbox"
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END
$roles$;

-- ===== migration: 20260710080000_add_ai_usage_telemetry =====
-- Records only actual AI provider attempts. Cost is intentionally excluded: it
-- must come from a provider billing source, never a locally invented estimate.

ALTER TYPE "ChatSenderType" ADD VALUE IF NOT EXISTS 'admin';

CREATE TYPE "AiUsageOutcome" AS ENUM ('succeeded', 'failed');

CREATE TABLE "ai_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID,
  "user_id" UUID,
  "provider" VARCHAR(64) NOT NULL,
  "model" VARCHAR(128) NOT NULL,
  "outcome" "AiUsageOutcome" NOT NULL,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "latency_ms" INTEGER NOT NULL,
  "error_code" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_events_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL,
  CONSTRAINT "ai_usage_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "ai_usage_events_created_at_idx"
  ON "ai_usage_events" ("created_at");

CREATE INDEX "ai_usage_events_provider_outcome_created_at_idx"
  ON "ai_usage_events" ("provider", "outcome", "created_at");

CREATE INDEX "ai_usage_events_user_id_created_at_idx"
  ON "ai_usage_events" ("user_id", "created_at");

ALTER TABLE "ai_usage_events" ENABLE ROW LEVEL SECURITY;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ai_usage_events" TO service_role';
    EXECUTE $policy$
      CREATE POLICY "foodflow_ai_usage_events_service_role_all"
        ON "ai_usage_events"
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END
$roles$;

-- ===== migration: 20260710200000_add_dispatch_offers =====
CREATE TABLE "dispatch_offers" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "driver_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "attempt" SMALLINT NOT NULL,
  "restaurant_lat" DOUBLE PRECISION NOT NULL,
  "restaurant_lng" DOUBLE PRECISION NOT NULL,
  "distance_km" DOUBLE PRECISION NOT NULL,
  "driver_rating" DOUBLE PRECISION NOT NULL,
  "total_deliveries" INTEGER NOT NULL,
  "surge_multiplier" DOUBLE PRECISION NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "responded_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "dispatch_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dispatch_offers_status_check" CHECK ("status" IN ('pending', 'accepted', 'rejected', 'expired', 'assigned', 'failed')),
  CONSTRAINT "dispatch_offers_attempt_check" CHECK ("attempt" BETWEEN 1 AND 20),
  CONSTRAINT "dispatch_offers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dispatch_offers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "dispatch_offers_order_id_status_idx"
  ON "dispatch_offers"("order_id", "status");

CREATE INDEX "dispatch_offers_driver_id_status_expires_at_idx"
  ON "dispatch_offers"("driver_id", "status", "expires_at");

CREATE UNIQUE INDEX "dispatch_offers_one_active_per_order_idx"
  ON "dispatch_offers"("order_id")
  WHERE "status" IN ('pending', 'accepted');

ALTER TABLE "dispatch_offers" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "dispatch_offers" IS
  'Server-only dispatch offer state. No direct browser or mobile RLS policy is granted.';

-- ===== migration: 20260710220000_secure_driver_kyc =====
CREATE UNIQUE INDEX IF NOT EXISTS "driver_kyc_one_pending_per_profile_idx"
  ON "driver_kyc_submissions"("driver_profile_id")
  WHERE "status" = 'pending';

ALTER TABLE "driver_kyc_submissions" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "driver_kyc_submissions" IS
  'Server-managed private driver identity review state. document_urls stores private object keys, never public URLs.';

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "driver_kyc_submissions" TO service_role';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'driver_kyc_submissions'
        AND policyname = 'foodflow_driver_kyc_service_role_all'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "foodflow_driver_kyc_service_role_all"
          ON "driver_kyc_submissions"
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true)
      $policy$;
    END IF;
  END IF;
END
$roles$;

DO $storage$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE $bucket$
      INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
      )
      VALUES (
        'foodflow-kyc',
        'foodflow-kyc',
        false,
        4194304,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
      )
      ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types
    $bucket$;
  END IF;
END
$storage$;

-- ===== migration: 20260711160000_add_payment_webhook_receipts =====
-- Durable SePay receipt ledger. The provider transaction id remains stable
-- across automatic retries and historical manual replays, so database
-- uniqueness is the authoritative idempotency boundary.

CREATE TABLE "payment_webhook_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" VARCHAR(20) NOT NULL,
  "provider_transaction_id" VARCHAR(100) NOT NULL,
  "payment_intent_id" UUID,
  "order_id" UUID,
  "amount" INTEGER NOT NULL,
  "bank_reference" VARCHAR(100),
  "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
  "failure_code" VARCHAR(100),
  "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processed_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "payment_webhook_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhook_receipts_payment_intent_id_fkey"
    FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "payment_webhook_receipts_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "payment_webhook_receipts_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "payment_webhook_receipts_status_valid"
    CHECK ("status" IN ('processing', 'completed', 'manual_review', 'failed', 'ignored'))
);

CREATE UNIQUE INDEX "payment_webhook_receipts_provider_provider_transaction_id_key"
  ON "payment_webhook_receipts" ("provider", "provider_transaction_id");

CREATE INDEX "payment_webhook_receipts_order_id_received_at_idx"
  ON "payment_webhook_receipts" ("order_id", "received_at" DESC);

CREATE INDEX "payment_webhook_receipts_status_updated_at_idx"
  ON "payment_webhook_receipts" ("status", "updated_at");

ALTER TABLE "payment_webhook_receipts" ENABLE ROW LEVEL SECURITY;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payment_webhook_receipts" TO service_role';
    EXECUTE $policy$
      CREATE POLICY "foodflow_payment_webhook_receipts_service_role_all"
        ON "payment_webhook_receipts"
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END
$roles$;

-- ===== migration: 20260711170000_harden_job_outbox =====
-- Preserve BullMQ-style jobId deduplication when production uses the
-- Supabase/Postgres queue adapter. Existing rows remain nullable because
-- historical options may contain legacy/invalid identifiers.

ALTER TABLE "job_outbox"
  ADD COLUMN "dedupe_key" VARCHAR(200);

CREATE UNIQUE INDEX "job_outbox_queue_dedupe_key_key"
  ON "job_outbox" ("queue", "dedupe_key");

-- ===== migration: 20260711180000_harden_refund_ledger =====
-- Durable refund workflow and ledger idempotency. Existing payout rows receive
-- a legacy key based on their primary key so this migration is safe even if a
-- previous worker retry already produced duplicates.

CREATE TABLE "payment_refund_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "refund_key" VARCHAR(200) NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "reason" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processing_job_id" VARCHAR(200),
  "failure_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,

  CONSTRAINT "payment_refund_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_refund_requests_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "payment_refund_requests_kind_valid" CHECK ("kind" IN ('full', 'partial')),
  CONSTRAINT "payment_refund_requests_status_valid"
    CHECK ("status" IN ('queued', 'processing', 'completed', 'manual_review', 'failed')),
  CONSTRAINT "payment_refund_requests_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_refund_requests_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_refund_requests_refund_key_key"
  ON "payment_refund_requests" ("refund_key");
CREATE INDEX "payment_refund_requests_order_id_status_idx"
  ON "payment_refund_requests" ("order_id", "status");
CREATE INDEX "payment_refund_requests_status_updated_at_idx"
  ON "payment_refund_requests" ("status", "updated_at");

ALTER TABLE "wallet_transactions"
  ADD COLUMN "refund_request_id" UUID;
CREATE UNIQUE INDEX "wallet_transactions_refund_request_id_key"
  ON "wallet_transactions" ("refund_request_id");
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_refund_request_id_fkey"
  FOREIGN KEY ("refund_request_id") REFERENCES "payment_refund_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payout_ledger"
  ADD COLUMN "dedupe_key" VARCHAR(200),
  ADD COLUMN "refund_request_id" UUID;

UPDATE "payout_ledger"
SET "dedupe_key" = 'legacy:' || "id"::text
WHERE "dedupe_key" IS NULL;

ALTER TABLE "payout_ledger"
  ALTER COLUMN "dedupe_key" SET NOT NULL;

CREATE UNIQUE INDEX "payout_ledger_dedupe_key_key"
  ON "payout_ledger" ("dedupe_key");
CREATE UNIQUE INDEX "payout_ledger_refund_request_id_key"
  ON "payout_ledger" ("refund_request_id");
ALTER TABLE "payout_ledger"
  ADD CONSTRAINT "payout_ledger_refund_request_id_fkey"
  FOREIGN KEY ("refund_request_id") REFERENCES "payment_refund_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_refund_requests" ENABLE ROW LEVEL SECURITY;

DO $roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payment_refund_requests" TO service_role';
    EXECUTE $policy$
      CREATE POLICY "foodflow_payment_refund_requests_service_role_all"
        ON "payment_refund_requests"
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END
$roles$;

-- ===== migration: 20260712143000_add_production_storage_bucket =====
DO $storage$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    VALUES (
      'foodflow-production',
      'foodflow-production',
      true,
      5242880,
      ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif'
      ]::text[]
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END
$storage$;


-- ===== migration: 20260712150000_harden_supabase_advisors =====
DO $functions$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.rls_auto_enable()'
  ]
  LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', signature);

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', signature);
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', signature);
      END IF;
    END IF;
  END LOOP;
END
$functions$;

DO $realtime_policy$
BEGIN
  IF to_regclass('public.realtime_outbox') IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    DROP POLICY IF EXISTS "foodflow_realtime_outbox_read_allowed_channels"
      ON public.realtime_outbox;

    CREATE POLICY "foodflow_realtime_outbox_read_allowed_channels"
      ON public.realtime_outbox
      FOR SELECT
      TO authenticated
      USING (
        channel IN (
          SELECT jsonb_array_elements_text(
            COALESCE(
              (SELECT auth.jwt()) -> 'realtime_channels',
              '[]'::jsonb
            )
          )
        )
      );
  END IF;
END
$realtime_policy$;

-- ===== migration: 20260712161000_authorize_private_broadcast_and_split_storage =====
-- FoodFlow private Broadcast authorization. Clients can only join topics that
-- the API placed in their short-lived ES256 JWT. Clients receive only; all
-- business-event publishing happens server-side with SUPABASE_SECRET_KEY.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "foodflow scoped broadcast receive" ON realtime.messages;
    CREATE POLICY "foodflow scoped broadcast receive"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND (SELECT realtime.topic()) IN (
          SELECT jsonb_array_elements_text(
            COALESCE((SELECT auth.jwt()) -> 'realtime_channels', '[]'::jsonb)
          )
        )
      );
  END IF;
END
$$;

-- Retain the former outbox for one rollback cycle, but remove public/client
-- access and stop exposing new rows through Postgres Changes.
ALTER TABLE IF EXISTS public.realtime_outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.realtime_outbox') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON TABLE public.realtime_outbox FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON TABLE public.realtime_outbox FROM authenticated;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'realtime_outbox'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.realtime_outbox;
  END IF;
END
$$;

-- Supabase Storage is absent in a plain PostgreSQL test database, so all
-- provider-owned objects are guarded while still applying on linked projects.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      (
        'foodflow-public',
        'foodflow-public',
        true,
        5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
      ),
      (
        'foodflow-private',
        'foodflow-private',
        false,
        4194304,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      )
    ON CONFLICT (id) DO UPDATE SET
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    DROP POLICY IF EXISTS "public can read published foodflow media" ON storage.objects;
    CREATE POLICY "public can read published foodflow media"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'foodflow-public');
  END IF;
END
$$;

-- ===== migration: 20260713064000_harden_postgis_data_api_surface =====
-- PostGIS was installed in public by the initial production migration. On
-- hosted Supabase its objects are owned by supabase_admin, and the project
-- postgres role cannot safely alter their RLS or privileges. PostGIS is also
-- non-relocatable without dropping dependent geometry columns.
--
-- FoodFlow does not use PostgREST tables or RPCs. The hosted project therefore
-- disables the Data API schema surface through the Supabase project setting,
-- while Storage and private Realtime remain enabled on their dedicated APIs.
-- Keep this migration as an explicit no-op so local and remote Prisma history
-- remain identical without attempting to take ownership of provider objects.
SELECT 1;

-- ===== migration: 20260713070000_add_rag_knowledge_base =====
-- Prisma declares RagDocument as a pgvector-backed model, but earlier
-- migrations never created its backing table. Provision the extension and
-- table together so the application's raw vector queries have a stable
-- database contract in every environment.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "rag_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "doc_type" VARCHAR(50) NOT NULL,
  "locale" VARCHAR(10) NOT NULL DEFAULT 'vi',
  "title" VARCHAR(300) NOT NULL,
  "content" TEXT NOT NULL,
  "source_id" VARCHAR(100),
  "embedding" vector(1536),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rag_documents_doc_type_locale_idx"
  ON "rag_documents" ("doc_type", "locale");

-- Retrieval orders by cosine distance. HNSW avoids a full table scan once the
-- knowledge base grows beyond local fixtures; NULL embeddings remain stored
-- for later backfill but are excluded from the ANN index.
CREATE INDEX "rag_documents_embedding_hnsw_idx"
  ON "rag_documents"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;

-- ===== migration: 20260713072000_harden_rag_incremental_indexing =====
-- Dynamic RAG documents are keyed by their source business record. Remove any
-- duplicates created by the former conflict-less insert before enforcing the
-- idempotency contract used by the incremental worker.
WITH ranked_documents AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY doc_type, locale, source_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS duplicate_rank
  FROM rag_documents
  WHERE source_id IS NOT NULL
)
DELETE FROM rag_documents AS document
USING ranked_documents AS ranked
WHERE document.id = ranked.id
  AND ranked.duplicate_rank > 1;

ALTER TABLE rag_documents
  ADD COLUMN content_hash CHAR(64);

CREATE UNIQUE INDEX rag_documents_source_key
  ON rag_documents (doc_type, locale, source_id)
  WHERE source_id IS NOT NULL;

-- The worker scans only currently searchable business rows in stable ID order.
-- Partial indexes keep those cursor scans bounded as inactive history grows.
CREATE INDEX menu_items_rag_sync_idx
  ON menu_items (id)
  WHERE is_available = true;

CREATE INDEX restaurants_rag_sync_idx
  ON restaurants (id)
  WHERE is_active = true
    AND is_open = true
    AND approval_status = 'approved';

-- ===== migration: 20260714003000_add_fcm_registration_revocations =====
ALTER TABLE user_fcm_tokens
  ADD COLUMN registration_id VARCHAR(64);

CREATE TABLE fcm_token_revocations (
  registration_id VARCHAR(64) PRIMARY KEY,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX fcm_token_revocations_expires_at_idx
  ON fcm_token_revocations (expires_at);

-- ===== migration: 20260714040000_remove_public_storage_listing_policy =====
-- Public Supabase buckets serve object URLs without a SELECT policy. Keeping
-- this policy would let anon/authenticated clients enumerate every object key.
-- Storage is provider-owned and absent from plain PostgreSQL test databases.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "public can read published foodflow media"
      ON storage.objects;
  END IF;
END
$$;

-- ===== migration: 20260714043000_scope_fcm_revocation_capabilities =====
ALTER TABLE fcm_token_revocations
  DROP CONSTRAINT fcm_token_revocations_pkey,
  ADD CONSTRAINT fcm_token_revocations_pkey
    PRIMARY KEY (token, registration_id);

-- ===== migration: 20260714110000_enforce_single_default_address =====
BEGIN;

-- Block address writes across the cleanup/index gap so a concurrent insert
-- cannot recreate a duplicate default before the invariant exists.
LOCK TABLE addresses IN SHARE ROW EXCLUSIVE MODE;

-- Preserve the newest default in case legacy data already contains duplicates.
WITH ranked_defaults AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM addresses
  WHERE is_default = TRUE
)
UPDATE addresses
SET is_default = FALSE
FROM ranked_defaults
WHERE addresses.id = ranked_defaults.id
  AND ranked_defaults.row_number > 1;

-- Application transactions lock the user row before changing a default. The
-- partial unique index keeps the invariant true for every caller and migration.
CREATE UNIQUE INDEX "addresses_one_default_per_user_key"
  ON addresses (user_id)
  WHERE is_default = TRUE;

COMMIT;

-- ===== migration: 20260714113000_set_address_uuid_default =====
-- Keep the database default aligned with the Prisma Address id contract.
ALTER TABLE addresses
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ===== migration: 20260715010000_remove_empty_legacy_storage_buckets =====
-- Remove the pre-split Storage buckets after the rollback grace period.
-- Fail closed if any legacy bucket still contains data or an active upload.
DO $$
DECLARE
  legacy_bucket text;
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;

  -- Storage does not declare bucket foreign keys for every dependent table.
  -- Block concurrent writes during the emptiness check and bucket deletion.
  EXECUTE 'LOCK TABLE storage.buckets IN SHARE ROW EXCLUSIVE MODE';
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE';
  END IF;
  IF to_regclass('storage.s3_multipart_uploads') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE storage.s3_multipart_uploads IN SHARE ROW EXCLUSIVE MODE';
  END IF;
  IF to_regclass('storage.vector_indexes') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE storage.vector_indexes IN SHARE ROW EXCLUSIVE MODE';
  END IF;

  FOREACH legacy_bucket IN ARRAY ARRAY['foodflow-kyc', 'foodflow-production']
  LOOP
    IF to_regclass('storage.objects') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM storage.objects
        WHERE bucket_id = legacy_bucket
      )
    THEN
      RAISE EXCEPTION 'legacy Storage bucket % is not empty', legacy_bucket;
    END IF;

    IF to_regclass('storage.s3_multipart_uploads') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM storage.s3_multipart_uploads
        WHERE bucket_id = legacy_bucket
      )
    THEN
      RAISE EXCEPTION 'legacy Storage bucket % has active multipart uploads', legacy_bucket;
    END IF;

    IF to_regclass('storage.vector_indexes') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM storage.vector_indexes
        WHERE bucket_id = legacy_bucket
      )
    THEN
      RAISE EXCEPTION 'legacy Storage bucket % has vector indexes', legacy_bucket;
    END IF;
  END LOOP;

  DELETE FROM storage.buckets
  WHERE id IN ('foodflow-kyc', 'foodflow-production');
END
$$;

-- ===== migration: 20260715093000_add_spatial_query_indexes =====
-- Back the two production ST_DWithin/ST_Distance query paths with PostGIS
-- indexes. Keep this separate from Storage cleanup so either rollout can be
-- reviewed and recovered independently.
CREATE INDEX IF NOT EXISTS restaurants_location_gist_idx
  ON restaurants USING GIST (location);

CREATE INDEX IF NOT EXISTS driver_location_history_location_gist_idx
  ON driver_location_history USING GIST (location);

-- ===== migration: 20260715101500_verify_legacy_storage_bucket_cleanup =====
-- The Supabase Storage API removes the legacy buckets before Prisma runs.
-- Keep database migration history forward-only and verify the required state.
DO $$
DECLARE
  has_legacy_buckets boolean;
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $query$
    SELECT EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id IN ('foodflow-kyc', 'foodflow-production')
    )
  $query$ INTO has_legacy_buckets;

  IF has_legacy_buckets THEN
    RAISE EXCEPTION 'legacy Supabase Storage bucket cleanup did not complete';
  END IF;
END
$$;

-- ===== migration: 20260715183000_enforce_semantic_identity_references =====
BEGIN;

-- Keep the semantic FK rollout atomic. A late orphan must not leave earlier DDL applied.

CREATE TABLE "production_role_smoke_runs" (
  "run_id" VARCHAR(32) NOT NULL,
  "restaurant_id" UUID NOT NULL,
  "restaurant_slug" VARCHAR(200) NOT NULL,
  "admin_user_id" UUID NOT NULL,
  "restaurant_user_id" UUID NOT NULL,
  "customer_user_id" UUID NOT NULL,
  "driver_user_id" UUID NOT NULL,
  "state" VARCHAR(32) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletion_committed_at" TIMESTAMPTZ,
  "capability_drain_done_at" TIMESTAMPTZ,

  CONSTRAINT "production_role_smoke_runs_pkey" PRIMARY KEY ("run_id"),
  CONSTRAINT "production_role_smoke_runs_state_check"
    CHECK ("state" IN ('active', 'deletion_committed', 'complete'))
);

-- The table is operational recovery metadata, not a Data API contract.
ALTER TABLE "production_role_smoke_runs" ENABLE ROW LEVEL SECURITY;

-- Give operators a table-specific failure before any FK or index is installed.
DO $migration$
DECLARE
  orphan_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "restaurants" child
  LEFT JOIN "users" parent ON parent."id" = child."approved_by_id"
  WHERE child."approved_by_id" IS NOT NULL AND parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'restaurants.approved_by_id has % orphan row(s)', orphan_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM "carts" child
  LEFT JOIN "restaurants" parent ON parent."id" = child."restaurant_id"
  WHERE child."restaurant_id" IS NOT NULL AND parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'carts.restaurant_id has % orphan row(s)', orphan_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM "promotions" child
  LEFT JOIN "users" parent ON parent."id" = child."created_by_id"
  WHERE child."created_by_id" IS NOT NULL AND parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'promotions.created_by_id has % orphan row(s)', orphan_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM "chat_messages" child
  LEFT JOIN "users" parent ON parent."id" = child."sender_id"
  WHERE child."sender_id" IS NOT NULL AND parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'chat_messages.sender_id has % orphan row(s)', orphan_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM "support_macros" child
  LEFT JOIN "users" parent ON parent."id" = child."created_by_id"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'support_macros.created_by_id has % orphan row(s)', orphan_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM "support_csat_responses" child
  LEFT JOIN "users" parent ON parent."id" = child."user_id"
  WHERE parent."id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'support_csat_responses.user_id has % orphan row(s)', orphan_count;
  END IF;
END
$migration$;

ALTER TABLE "restaurants"
  ADD CONSTRAINT "restaurants_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "carts"
  ADD CONSTRAINT "carts_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promotions"
  ADD CONSTRAINT "promotions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "support_macros"
  ADD CONSTRAINT "support_macros_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "support_csat_responses"
  ADD CONSTRAINT "support_csat_responses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "production_role_smoke_runs_state_created_at_idx"
  ON "production_role_smoke_runs"("state", "created_at");
CREATE INDEX "restaurants_approved_by_id_idx" ON "restaurants"("approved_by_id");
CREATE INDEX "carts_restaurant_id_idx" ON "carts"("restaurant_id");
CREATE INDEX "promotions_created_by_id_idx" ON "promotions"("created_by_id");
CREATE INDEX "chat_messages_sender_id_idx" ON "chat_messages"("sender_id");
CREATE INDEX "support_macros_created_by_id_idx" ON "support_macros"("created_by_id");
CREATE INDEX "support_csat_responses_user_id_idx" ON "support_csat_responses"("user_id");

COMMIT;

-- ===== migration: 20261029011500_confine_managed_application_tables =====
-- Application data is accessed through the Nest API. Browser roles use only
-- separately scoped Realtime/Storage policies, never application table reads.
-- Exclude extension-owned tables such as PostGIS spatial_ref_sys.
DO $app_tables$
DECLARE
  relation record;
BEGIN
  FOR relation IN
    SELECT c.oid, n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> '_prisma_migrations'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass
          AND d.objid = c.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', relation.nspname, relation.relname);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', relation.nspname, relation.relname);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', relation.nspname, relation.relname);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM authenticated', relation.nspname, relation.relname);
    END IF;
  END LOOP;
END
$app_tables$;

-- ===== migration: 20261029012500_retire_legacy_outbox_browser_policy =====
-- Private Broadcast supersedes browser reads of the retained rollback outbox.
-- Remove the historical policy so a future accidental table grant cannot
-- reactivate direct access. Provider realtime.messages policies are unchanged.
DO $legacy_outbox$
BEGIN
  IF to_regclass('public.realtime_outbox') IS NOT NULL THEN
    DROP POLICY IF EXISTS foodflow_realtime_outbox_read_allowed_channels
      ON public.realtime_outbox;
  END IF;
END
$legacy_outbox$;

SET search_path TO public;

-- 001_extensions_and_types.sql
-- Execute primeiro no SQL Editor do Supabase.

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('customer', 'admin', 'super_admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.sale_type as enum ('unit', 'kg', 'both');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum (
    'pending_payment',
    'awaiting_confirmation',
    'paid',
    'preparing',
    'out_for_delivery',
    'delivered',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_method as enum ('pix', 'card');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum (
    'pending_configuration',
    'pending',
    'authorized',
    'paid',
    'failed',
    'refunded'
  );
exception
  when duplicate_object then null;
end $$;

-- 002_tables_and_indexes.sql
-- Execute em seguida ao script 001 no SQL Editor do Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 3),
  email text not null unique,
  cpf text not null unique check (cpf ~ '^\d{11}$'),
  phone text not null check (char_length(regexp_replace(phone, '\D', '', 'g')) >= 10),
  role public.user_role not null default 'customer',
  must_change_password boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_cpf on public.profiles(cpf);

create table if not exists public.system_bootstrap (
  id integer primary key check (id = 1),
  super_admin_id uuid not null references public.profiles(id) on delete restrict,
  initialized_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  description text not null check (char_length(trim(description)) >= 5),
  category text,
  additional_categories text[] not null default '{}',
  subcategory text,
  image_url text,
  image_path text,
  sale_type public.sale_type not null default 'unit',
  price_unit numeric(10,2) check (price_unit is null or price_unit > 0),
  promo_price_unit numeric(10,2) check (promo_price_unit is null or promo_price_unit > 0),
  price_kg numeric(10,2) check (price_kg is null or price_kg > 0),
  promo_price_kg numeric(10,2) check (promo_price_kg is null or promo_price_kg > 0),
  sort_price numeric(10,2) generated always as (
    coalesce(
      least(
        coalesce(promo_price_unit, price_unit),
        coalesce(promo_price_kg, price_kg)
      ),
      0
    )
  ) stored,
  manage_stock boolean not null default true,
  stock_quantity numeric(10,3) check (stock_quantity is null or stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_sale_type_prices check (
    (sale_type = 'unit' and price_unit is not null) or
    (sale_type = 'kg' and price_kg is not null) or
    (sale_type = 'both' and price_unit is not null and price_kg is not null)
  ),
  constraint chk_promo_unit_lower check (
    promo_price_unit is null or (price_unit is not null and promo_price_unit < price_unit)
  ),
  constraint chk_promo_kg_lower check (
    promo_price_kg is null or (price_kg is not null and promo_price_kg < price_kg)
  )
);

create index if not exists idx_products_active_sort on public.products(is_active, sort_price);
create index if not exists idx_products_category on public.products(category) where is_active = true;
create index if not exists idx_products_additional_categories on public.products using gin (additional_categories);
create index if not exists idx_products_subcategory on public.products(subcategory) where is_active = true;

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cep text not null check (cep ~ '^\d{8}$'),
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state char(2) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on public.addresses(user_id);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_mode text not null check (unit_mode in ('unit', 'kg')),
  quantity numeric(10,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, product_id, unit_mode)
);

create index if not exists idx_cart_items_user on public.cart_items(user_id);
create index if not exists idx_cart_items_cart on public.cart_items(cart_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigserial unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null,
  status public.order_status not null default 'pending_payment',
  delivery_mode text not null default 'delivery' check (delivery_mode in ('delivery', 'pickup')),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  shipping_fee numeric(10,2) not null check (shipping_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  shipping_cep text not null check (shipping_cep ~ '^\d{8}$'),
  shipping_street text not null,
  shipping_number text not null,
  shipping_complement text,
  shipping_neighborhood text not null,
  shipping_city text not null,
  shipping_state char(2) not null,
  customer_name text not null,
  customer_cpf text not null,
  customer_phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);

create index if not exists idx_orders_user_created on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status_created on public.orders(status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  product_image_url text,
  unit_mode text not null check (unit_mode in ('unit', 'kg')),
  quantity numeric(10,3) not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price > 0),
  line_total numeric(10,2) not null check (line_total >= 0)
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'pending_configuration',
  amount numeric(10,2) not null check (amount >= 0),
  provider text,
  provider_reference text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user on public.payments(user_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null check (char_length(trim(comment)) > 0 and char_length(comment) <= 150),
  created_at timestamptz not null default now(),
  unique(order_id, product_id, user_id)
);

create index if not exists idx_reviews_product on public.reviews(product_id, created_at desc);
create index if not exists idx_reviews_user on public.reviews(user_id);

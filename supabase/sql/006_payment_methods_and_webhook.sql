-- 006_payment_methods_and_webhook.sql
-- Migração aditiva e segura: NÃO apaga tabelas, usuários nem pedidos existentes.
-- Execute no SQL Editor do Supabase para suportar:
--   - Pagar na entrega (dinheiro, crédito na entrega, débito na entrega)
--   - Cartão de crédito (online com parcelamento ou na entrega)
--   - Cartão de débito (online ou na entrega)
--   - Pix (preservado)

alter type public.payment_method add value if not exists 'credit_card';
alter type public.payment_method add value if not exists 'debit_card';
alter type public.payment_method add value if not exists 'cash_on_delivery';

create or replace function public.create_order_atomic(
  p_user_id uuid,
  p_idempotency_key text,
  p_payment_method public.payment_method,
  p_shipping_cep text,
  p_shipping_street text,
  p_shipping_number text,
  p_shipping_complement text,
  p_shipping_neighborhood text,
  p_shipping_city text,
  p_shipping_state text,
  p_notes text default null,
  p_payment_configured boolean default false,
  p_payment_details jsonb default '{}'::jsonb,
  p_order_status public.order_status default 'pending_payment',
  p_payment_status public.payment_status default null,
  p_provider text default null
)
returns table (
  order_id uuid,
  order_number bigint,
  status public.order_status,
  subtotal numeric,
  shipping_fee numeric,
  total numeric,
  already_existed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_profile record;
  v_cart_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_shipping_fee numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_order_id uuid;
  v_order_number bigint;
  v_item record;
  v_unit_price numeric(10,2);
  v_line_total numeric(10,2);
  v_item_count integer := 0;
  v_order_status public.order_status;
  v_payment_status public.payment_status;
  v_provider text;
begin
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  -- Idempotência: retorna pedido já criado se a mesma chave for reenviada
  select o.id, o.order_number, o.status, o.subtotal, o.shipping_fee, o.total
    into v_existing
  from public.orders o
  where o.user_id = p_user_id
    and o.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return query select
      v_existing.id,
      v_existing.order_number,
      v_existing.status,
      v_existing.subtotal,
      v_existing.shipping_fee,
      v_existing.total,
      true;
    return;
  end if;

  -- Regra obrigatória de frete: apenas Irati / PR com frete fixo de R$ 4,99
  if public.normalize_city_text(p_shipping_city) <> 'irati'
     or upper(trim(coalesce(p_shipping_state, ''))) <> 'PR' then
    raise exception 'OUTSIDE_IRATI_DELIVERY_REQUIRES_WHATSAPP';
  end if;
  v_shipping_fee := 4.99;

  select id, full_name, cpf, phone, is_active
    into v_profile
  from public.profiles
  where id = p_user_id;

  if not found or not v_profile.is_active then
    raise exception 'USER_PROFILE_INACTIVE';
  end if;

  select id into v_cart_id
  from public.carts
  where user_id = p_user_id;

  if not found then
    raise exception 'CART_EMPTY';
  end if;

  -- Bloqueia linhas do carrinho e produtos em ordem determinística para evitar race conditions
  for v_item in
    select
      ci.id as cart_item_id,
      ci.product_id,
      ci.unit_mode,
      ci.quantity,
      p.name as product_name,
      p.image_url,
      p.sale_type,
      p.price_unit,
      p.promo_price_unit,
      p.price_kg,
      p.promo_price_kg,
      p.manage_stock,
      p.stock_quantity,
      p.is_active
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id
      and ci.user_id = p_user_id
    order by ci.product_id asc, ci.unit_mode asc
    for update of ci, p
  loop
    v_item_count := v_item_count + 1;

    if not v_item.is_active then
      raise exception 'PRODUCT_UNAVAILABLE:%', v_item.product_name;
    end if;

    if v_item.unit_mode = 'unit' then
      if v_item.sale_type not in ('unit', 'both') or v_item.price_unit is null then
        raise exception 'INVALID_SALE_MODE:%', v_item.product_name;
      end if;
      if v_item.quantity <> floor(v_item.quantity) then
        raise exception 'UNIT_QUANTITY_MUST_BE_INTEGER:%', v_item.product_name;
      end if;
      v_unit_price := coalesce(
        case when v_item.promo_price_unit is not null and v_item.promo_price_unit < v_item.price_unit
             then v_item.promo_price_unit else null end,
        v_item.price_unit
      );
    elsif v_item.unit_mode = 'kg' then
      if v_item.sale_type not in ('kg', 'both') or v_item.price_kg is null then
        raise exception 'INVALID_SALE_MODE:%', v_item.product_name;
      end if;
      v_unit_price := coalesce(
        case when v_item.promo_price_kg is not null and v_item.promo_price_kg < v_item.price_kg
             then v_item.promo_price_kg else null end,
        v_item.price_kg
      );
    else
      raise exception 'INVALID_UNIT_MODE';
    end if;

    if v_item.manage_stock then
      if v_item.stock_quantity is null or v_item.stock_quantity < v_item.quantity then
        raise exception 'INSUFFICIENT_STOCK:%', v_item.product_name;
      end if;
      update public.products
      set stock_quantity = stock_quantity - v_item.quantity
      where id = v_item.product_id;
    end if;

    v_line_total := round((v_unit_price * v_item.quantity)::numeric, 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if v_item_count = 0 then
    raise exception 'CART_EMPTY';
  end if;

  v_total := round((v_subtotal + v_shipping_fee)::numeric, 2);

  -- Segurança: nunca permite criar pedido já pago via RPC de checkout
  v_order_status := case
    when p_order_status in ('pending_payment', 'awaiting_confirmation') then p_order_status
    else 'pending_payment'::public.order_status
  end;

  v_payment_status := coalesce(
    case
      when p_payment_status in ('pending_configuration', 'pending') then p_payment_status
      else null
    end,
    case when p_payment_configured then 'pending'::public.payment_status else 'pending_configuration'::public.payment_status end
  );

  v_provider := coalesce(
    nullif(trim(coalesce(p_provider, '')), ''),
    case when p_payment_configured then 'mercadopago' else 'unconfigured' end
  );

  insert into public.orders (
    user_id,
    idempotency_key,
    status,
    subtotal,
    shipping_fee,
    total,
    shipping_cep,
    shipping_street,
    shipping_number,
    shipping_complement,
    shipping_neighborhood,
    shipping_city,
    shipping_state,
    customer_name,
    customer_cpf,
    customer_phone,
    notes
  ) values (
    p_user_id,
    p_idempotency_key,
    v_order_status,
    v_subtotal,
    v_shipping_fee,
    v_total,
    regexp_replace(p_shipping_cep, '\D', '', 'g'),
    trim(p_shipping_street),
    trim(p_shipping_number),
    nullif(trim(coalesce(p_shipping_complement, '')), ''),
    trim(p_shipping_neighborhood),
    trim(p_shipping_city),
    upper(trim(p_shipping_state)),
    v_profile.full_name,
    v_profile.cpf,
    v_profile.phone,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id, orders.order_number into v_order_id, v_order_number;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    product_image_url,
    unit_mode,
    quantity,
    unit_price,
    line_total
  )
  select
    v_order_id,
    ci.product_id,
    p.name,
    p.image_url,
    ci.unit_mode,
    ci.quantity,
    case
      when ci.unit_mode = 'unit' then
        coalesce(case when p.promo_price_unit is not null and p.promo_price_unit < p.price_unit then p.promo_price_unit else null end, p.price_unit)
      else
        coalesce(case when p.promo_price_kg is not null and p.promo_price_kg < p.price_kg then p.promo_price_kg else null end, p.price_kg)
    end,
    round((
      ci.quantity *
      case
        when ci.unit_mode = 'unit' then
          coalesce(case when p.promo_price_unit is not null and p.promo_price_unit < p.price_unit then p.promo_price_unit else null end, p.price_unit)
        else
          coalesce(case when p.promo_price_kg is not null and p.promo_price_kg < p.price_kg then p.promo_price_kg else null end, p.price_kg)
      end
    )::numeric, 2)
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id
    and ci.user_id = p_user_id;

  insert into public.payments (
    order_id,
    user_id,
    method,
    status,
    amount,
    provider,
    details
  ) values (
    v_order_id,
    p_user_id,
    p_payment_method,
    v_payment_status,
    v_total,
    v_provider,
    coalesce(p_payment_details, '{}'::jsonb)
  );

  delete from public.cart_items
  where cart_id = v_cart_id
    and user_id = p_user_id;

  return query select
    v_order_id,
    v_order_number,
    v_order_status,
    v_subtotal,
    v_shipping_fee,
    v_total,
    false;
end;
$$;

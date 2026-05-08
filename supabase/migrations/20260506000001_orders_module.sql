-- =============================================
-- Módulo de Pedidos — Produtos, Preços e Orders
-- =============================================

-- Catálogo de produtos
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text,
  unit text not null default 'un', -- un, cx, kg, L, etc.
  min_qty int not null default 1,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Preços por segmento
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  segment text not null check (segment in ('franquia', 'multimarca_pdv')),
  price decimal(10,2) not null,
  unique(product_id, segment)
);

create index idx_product_prices_product on public.product_prices(product_id);
create index idx_product_prices_segment on public.product_prices(segment);

-- Pedidos
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references public.franchises(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'enviado' check (status in ('rascunho', 'enviado', 'confirmado', 'faturado', 'cancelado')),
  notes text,
  total decimal(10,2) not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index idx_orders_franchise on public.orders(franchise_id, created_at desc);
create index idx_orders_status on public.orders(status);

-- Itens do pedido
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null, -- snapshot do nome no momento do pedido
  quantity int not null default 1,
  unit_price decimal(10,2) not null,
  subtotal decimal(10,2) not null
);

create index idx_order_items_order on public.order_items(order_id);

-- RLS
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Products: all authenticated can read, admins can manage
create policy "products_select" on public.products for select to authenticated using (true);
create policy "products_manage" on public.products for all to authenticated using (true) with check (true);

-- Prices: all authenticated can read
create policy "prices_select" on public.product_prices for select to authenticated using (true);
create policy "prices_manage" on public.product_prices for all to authenticated using (true) with check (true);

-- Orders: user sees own franchise orders, admins see all
create policy "orders_select" on public.orders for select to authenticated using (
  franchise_id in (select franchise_id from public.profiles where id = auth.uid())
  or exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name in ('admin', 'superadmin')
  )
);
create policy "orders_insert" on public.orders for insert to authenticated with check (
  franchise_id in (select franchise_id from public.profiles where id = auth.uid())
);
create policy "orders_update" on public.orders for update to authenticated using (true);

-- Order items: same as orders
create policy "order_items_select" on public.order_items for select to authenticated using (true);
create policy "order_items_insert" on public.order_items for insert to authenticated with check (true);

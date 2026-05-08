-- Adicionar slug às franquias
alter table public.franchises
  add column slug text unique;

-- Gerar slugs para registros existentes
update public.franchises
set slug = lower(
  regexp_replace(
    regexp_replace(
      translate(name, 'áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
);

-- Tornar not null após preencher
alter table public.franchises
  alter column slug set not null;

create index idx_franchises_slug on public.franchises(slug);

-- Função helper pra gerar slug automaticamente
create or replace function public.generate_franchise_slug()
returns trigger as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(
      regexp_replace(
        regexp_replace(
          translate(new.name, 'áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'aaaaeeeiiioooouuucAAAAEEEIIIOOOOUUUC'),
          '[^a-zA-Z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      )
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger franchise_auto_slug
  before insert on public.franchises
  for each row execute function public.generate_franchise_slug();

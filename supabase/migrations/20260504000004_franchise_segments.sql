-- Adicionar segmento às franquias
alter table public.franchises
  add column segment text not null default 'franquia'
  check (segment in ('franquia', 'multimarca_pdv'));

create index idx_franchises_segment on public.franchises(segment);

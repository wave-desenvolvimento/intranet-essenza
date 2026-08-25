-- Aumenta limite de tamanho do bucket assets de 10MB para 500MB
-- para permitir upload de videos e arquivos grandes
update storage.buckets
set file_size_limit = 524288000 -- 500MB
where id = 'assets';

-- Remove limite de tamanho do bucket assets para permitir qualquer arquivo
update storage.buckets
set file_size_limit = null
where id = 'assets';

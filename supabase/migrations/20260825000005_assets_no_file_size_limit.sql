-- Remove limite de tamanho do bucket assets
update storage.buckets
set file_size_limit = null
where id = 'assets';

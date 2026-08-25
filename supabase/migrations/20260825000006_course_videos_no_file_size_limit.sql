-- Remove limite de tamanho do bucket course-videos
update storage.buckets
set file_size_limit = null
where id = 'course-videos';

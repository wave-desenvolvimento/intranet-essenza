-- Remove mime type restriction from assets bucket to allow all file formats
update storage.buckets
set allowed_mime_types = null
where id = 'assets';

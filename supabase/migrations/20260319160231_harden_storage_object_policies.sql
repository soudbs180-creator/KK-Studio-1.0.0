DROP POLICY IF EXISTS "Allow authenticated uploads to own folder" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Allow authenticated reads from own folder" ON storage.objects;
CREATE POLICY "Allow authenticated reads from own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Allow authenticated updates to own folder" ON storage.objects;
CREATE POLICY "Allow authenticated updates to own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
)
WITH CHECK (
  bucket_id = 'generated-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

DROP POLICY IF EXISTS "Allow authenticated deletes from own folder" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
);

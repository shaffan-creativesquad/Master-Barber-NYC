ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS receipt_photo_path text;

CREATE POLICY "staff reads cash receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cash-receipts' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "staff uploads cash receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cash-receipts' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "admin deletes cash receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cash-receipts' AND private.has_role(auth.uid(), 'admin'::app_role));
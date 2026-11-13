CREATE POLICY "staff reads member photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'member-photos' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "staff uploads member photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'member-photos' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "staff updates member photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'member-photos' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "admin deletes member photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'member-photos' AND private.has_role(auth.uid(), 'admin'::app_role));
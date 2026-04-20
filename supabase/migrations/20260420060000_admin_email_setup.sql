-- Update handle_new_user so naveen.f.senanayake@gmail.com is auto-granted admin on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
  assigned_role public.app_role;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, final_username);

  IF NEW.email = 'naveen.f.senanayake@gmail.com' THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

-- Backfill: if the account already exists, grant admin now
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'naveen.f.senanayake@gmail.com';
  IF admin_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

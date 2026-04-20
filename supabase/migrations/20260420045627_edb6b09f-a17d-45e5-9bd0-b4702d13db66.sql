-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles are viewable by everyone" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, final_username);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Queue
CREATE TYPE public.track_source AS ENUM ('youtube', 'upload');
CREATE TYPE public.queue_status AS ENUM ('pending', 'playing', 'played', 'skipped');

CREATE TABLE public.queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source track_source NOT NULL,
  external_id TEXT,
  file_url TEXT,
  title TEXT NOT NULL,
  artist TEXT,
  thumbnail TEXT,
  duration_seconds INT,
  position BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status queue_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Queue viewable by everyone" ON public.queue FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert (request) songs" ON public.queue FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update queue" ON public.queue FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete from queue" ON public.queue FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Playback state (singleton, id=1)
CREATE TABLE public.playback_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_queue_id UUID REFERENCES public.queue(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playback_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.playback_state (id, is_playing) VALUES (1, false);

CREATE POLICY "Playback viewable by everyone" ON public.playback_state FOR SELECT USING (true);
CREATE POLICY "Admins can update playback" ON public.playback_state FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Messages
CREATE TYPE public.message_type AS ENUM ('chat', 'request', 'system');

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type message_type NOT NULL DEFAULT 'chat',
  queue_id UUID REFERENCES public.queue(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by everyone" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send messages" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND banned = true)
  );
CREATE POLICY "Admins can delete messages" ON public.messages FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.queue REPLICA IDENTITY FULL;
ALTER TABLE public.playback_state REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Storage bucket for uploaded audio (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true);

CREATE POLICY "Audio publicly readable" ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');
CREATE POLICY "Admins can upload audio" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete audio" ON storage.objects FOR DELETE
  USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));
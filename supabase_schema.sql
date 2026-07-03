-- ==============================================================================================
-- Trade Journal — Supabase Schema & Row-Level Security Policies
-- Copy and paste this entire script into your Supabase SQL Editor and hit "Run".
-- ==============================================================================================

-- 1. Create Tables
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at timestamp with time zone,
  username text unique,
  full_name text
);

CREATE TABLE public.user_settings (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  instruments text[] DEFAULT '{"EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "ES", "NQ", "YM", "CL"}'::text[],
  sessions text[] DEFAULT '{"London", "New York", "Asian"}'::text[],
  setup_names text[] DEFAULT '{"Breakout", "Pullback", "Reversal", "Range"}'::text[],
  emotions text[] DEFAULT '{"Confident", "Calm", "Anxious", "Frustrated", "FOMO", "Neutral"}'::text[],
  mistake_tags text[] DEFAULT '{"Chased price", "Moved stop loss", "Overleveraged", "Ignored plan", "Boredom trade", "Revenge trade"}'::text[],
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date timestamp with time zone NOT NULL,
  session text,
  instrument text,
  direction text,
  timeframe text,
  setup_name text,
  entry_price numeric,
  stop_price numeric,
  target_price numeric,
  exit_price numeric,
  quantity numeric,
  risk_money numeric,
  planned_rr numeric,
  result_money numeric,
  result_r numeric,
  fees numeric,
  screenshot_before text, -- Stores Storage bucket object path
  screenshot_after text,  -- Stores Storage bucket object path
  rule_followed boolean,
  emotion_before text,
  emotion_during text,
  emotion_after text,
  mistake_tags text[],
  review_note text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.journal_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  content text,
  mood text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, date) -- One entry per day per user
);

-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- 3. Define Security Policies (Users can only read/write their OWN data)
-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Settings
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Trades
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- Journal
CREATE POLICY "Users can view own journal" ON public.journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal" ON public.journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal" ON public.journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal" ON public.journal_entries FOR DELETE USING (auth.uid() = user_id);

-- 4. Create Trigger to automatically create a user_settings row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Create Storage Bucket for Screenshots (Private)
INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);

-- 6. Storage Security Policies
CREATE POLICY "Users can view their own screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'screenshots' AND auth.uid() = owner);
CREATE POLICY "Users can upload their own screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'screenshots' AND auth.uid() = owner);
CREATE POLICY "Users can update their own screenshots" ON storage.objects FOR UPDATE USING (bucket_id = 'screenshots' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own screenshots" ON storage.objects FOR DELETE USING (bucket_id = 'screenshots' AND auth.uid() = owner);

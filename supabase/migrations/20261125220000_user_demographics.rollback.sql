-- 20261125220000_user_demographics.sql を戻す。貯めた性別・年代は消える。
begin;
drop table if exists public.user_demographics;
commit;

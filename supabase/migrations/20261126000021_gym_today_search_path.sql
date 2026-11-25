-- Advisor lint 0011: pin the search_path of the new date helper.
alter function public.gym_today() set search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_client_checkin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_checkin_time timestamptz;
  v_gym_id uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_checkin_time := COALESCE(NEW.checkin_time, now());
  v_gym_id := NEW.gym_id;

  PERFORM pg_advisory_xact_lock(hashtext('client_checkins:' || NEW.user_id::text || ':' || COALESCE(v_gym_id::text, 'no-gym')));

  IF EXISTS (
    SELECT 1
    FROM public.client_checkins existing
    WHERE existing.user_id = NEW.user_id
      AND (v_gym_id IS NULL OR existing.gym_id = v_gym_id)
      AND ABS(EXTRACT(EPOCH FROM (v_checkin_time - existing.checkin_time))) < 60
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Duplicate client check-in blocked: this member was checked in less than 60 seconds ago.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_client_checkin_trigger ON public.client_checkins;

CREATE TRIGGER prevent_duplicate_client_checkin_trigger
BEFORE INSERT ON public.client_checkins
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_client_checkin();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_staff_checkin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_checkin_time timestamptz;
  v_gym_id uuid;
BEGIN
  IF NEW.staff_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_checkin_time := COALESCE(NEW.checkin_time, now());
  v_gym_id := NEW.gym_id;

  PERFORM pg_advisory_xact_lock(hashtext('staff_checkins:' || NEW.staff_id::text || ':' || COALESCE(v_gym_id::text, 'no-gym')));

  IF EXISTS (
    SELECT 1
    FROM public.staff_checkins existing
    WHERE existing.staff_id = NEW.staff_id
      AND (v_gym_id IS NULL OR existing.gym_id = v_gym_id)
      AND ABS(EXTRACT(EPOCH FROM (v_checkin_time - existing.checkin_time))) < 60
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Duplicate staff check-in blocked: this staff member was checked in less than 60 seconds ago.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_staff_checkin_trigger ON public.staff_checkins;

CREATE TRIGGER prevent_duplicate_staff_checkin_trigger
BEFORE INSERT ON public.staff_checkins
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_staff_checkin();

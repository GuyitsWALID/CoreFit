CREATE OR REPLACE FUNCTION public.record_offline_freeze(
  p_user_id uuid,
  p_freeze_start_date timestamptz,
  p_freeze_days integer,
  p_remarks text DEFAULT NULL
)
RETURNS TABLE (
  old_expiry_date timestamptz,
  freeze_start_date timestamptz,
  freeze_end_date timestamptz,
  freeze_days integer,
  new_expiry_date timestamptz,
  freeze_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_freeze_start timestamptz;
  v_freeze_end timestamptz;
  v_new_expiry timestamptz;
  v_freeze_id uuid;
  v_new_status text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Member is required.';
  END IF;

  IF p_freeze_start_date IS NULL THEN
    RAISE EXCEPTION 'Freeze start date is required.';
  END IF;

  IF p_freeze_start_date::date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Freeze start date cannot be in the future.';
  END IF;

  IF p_freeze_days IS NULL OR p_freeze_days <= 0 THEN
    RAISE EXCEPTION 'Freeze days must be greater than zero.';
  END IF;

  IF p_freeze_days > 365 THEN
    RAISE EXCEPTION 'Freeze days cannot be greater than 365.';
  END IF;

  SELECT id, gym_id, membership_expiry
    INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member was not found.';
  END IF;

  IF v_user.membership_expiry IS NULL THEN
    RAISE EXCEPTION 'Member does not have a membership expiry to adjust.';
  END IF;

  v_freeze_start := date_trunc('day', p_freeze_start_date);
  v_freeze_end := v_freeze_start + make_interval(days => p_freeze_days);
  v_new_expiry := v_user.membership_expiry + make_interval(days => p_freeze_days);

  v_new_status := CASE
    WHEN CURRENT_DATE < v_freeze_end::date THEN 'paused'
    WHEN v_new_expiry::date >= CURRENT_DATE THEN 'active'
    ELSE 'expired'
  END;

  INSERT INTO public.membership_freezes (
    user_id,
    start_date,
    end_date,
    created_at,
    total_days,
    applied,
    gym_id
  )
  VALUES (
    p_user_id,
    v_freeze_start,
    v_freeze_end,
    now(),
    p_freeze_days,
    true,
    v_user.gym_id
  )
  RETURNING id INTO v_freeze_id;

  UPDATE public.users
  SET
    membership_expiry = v_new_expiry,
    status = v_new_status
  WHERE id = p_user_id;

  old_expiry_date := v_user.membership_expiry;
  freeze_start_date := v_freeze_start;
  freeze_end_date := v_freeze_end;
  freeze_days := p_freeze_days;
  new_expiry_date := v_new_expiry;
  freeze_id := v_freeze_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_offline_freeze(uuid, timestamptz, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_offline_renewal(
  p_user_id uuid,
  p_package_id uuid,
  p_payment_date timestamptz,
  p_amount numeric,
  p_payment_method text DEFAULT 'offline',
  p_remarks text DEFAULT NULL
)
RETURNS TABLE (
  old_expiry_date timestamptz,
  renewal_start_date timestamptz,
  new_expiry_date timestamptz,
  payment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_package record;
  v_payment_date timestamptz;
  v_start_date timestamptz;
  v_new_expiry timestamptz;
  v_payment_id uuid;
  v_audit jsonb;
BEGIN
  IF p_user_id IS NULL OR p_package_id IS NULL THEN
    RAISE EXCEPTION 'Member and package are required.';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Payment date is required.';
  END IF;

  IF p_payment_date::date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Payment date cannot be in the future.';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Payment amount must be zero or greater.';
  END IF;

  SELECT id, gym_id, package_id, membership_expiry
    INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member was not found.';
  END IF;

  SELECT id, gym_id, name, duration_value, duration_unit
    INTO v_package
  FROM public.packages
  WHERE id = p_package_id
    AND gym_id = v_user.gym_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Package was not found for this gym.';
  END IF;

  IF COALESCE(v_package.duration_value, 0) <= 0 THEN
    RAISE EXCEPTION 'Selected package has an invalid duration.';
  END IF;

  v_payment_date := date_trunc('day', p_payment_date);
  v_start_date := CASE
    WHEN v_user.membership_expiry IS NOT NULL
      AND v_user.membership_expiry > v_payment_date
      THEN v_user.membership_expiry
    ELSE v_payment_date
  END;

  v_new_expiry := CASE lower(COALESCE(v_package.duration_unit::text, 'days'))
    WHEN 'day' THEN v_start_date + make_interval(days => v_package.duration_value::int)
    WHEN 'days' THEN v_start_date + make_interval(days => v_package.duration_value::int)
    WHEN 'week' THEN v_start_date + make_interval(weeks => v_package.duration_value::int)
    WHEN 'weeks' THEN v_start_date + make_interval(weeks => v_package.duration_value::int)
    WHEN 'month' THEN v_start_date + make_interval(months => v_package.duration_value::int)
    WHEN 'months' THEN v_start_date + make_interval(months => v_package.duration_value::int)
    WHEN 'year' THEN v_start_date + make_interval(years => v_package.duration_value::int)
    WHEN 'years' THEN v_start_date + make_interval(years => v_package.duration_value::int)
    ELSE v_start_date + make_interval(days => v_package.duration_value::int)
  END;

  UPDATE public.users
  SET
    package_id = p_package_id,
    membership_expiry = v_new_expiry,
    status = 'active'
  WHERE id = p_user_id;

  v_audit := jsonb_build_object(
    'type', 'offline_backdated_renewal',
    'note', p_remarks,
    'package_name', v_package.name,
    'payment_date', v_payment_date,
    'entered_at', now(),
    'old_expiry_date', v_user.membership_expiry,
    'renewal_start_date', v_start_date,
    'new_expiry_date', v_new_expiry
  );

  INSERT INTO public.payments (
    user_id,
    package_id,
    gym_id,
    amount,
    payment_method,
    payment_status,
    remarks,
    migrated_from_legacy
  )
  VALUES (
    p_user_id,
    p_package_id,
    v_user.gym_id,
    p_amount,
    COALESCE(NULLIF(trim(p_payment_method), ''), 'offline'),
    'completed',
    v_audit::text,
    false
  )
  RETURNING id INTO v_payment_id;

  old_expiry_date := v_user.membership_expiry;
  renewal_start_date := v_start_date;
  new_expiry_date := v_new_expiry;
  payment_id := v_payment_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_offline_renewal(uuid, uuid, timestamptz, numeric, text, text) TO authenticated;

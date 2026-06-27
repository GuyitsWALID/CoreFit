CREATE OR REPLACE FUNCTION public.delete_member_completely(p_user_id uuid)
RETURNS TABLE (
  deleted_user_id uuid,
  deleted_auth_user boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_auth_deleted boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Member id is required.';
  END IF;

  SELECT id
    INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member was not found.';
  END IF;

  DELETE FROM public.client_checkins
  WHERE user_id = p_user_id;

  DELETE FROM public.one_to_one_coaching
  WHERE user_id = p_user_id;

  DELETE FROM public.payments
  WHERE user_id = p_user_id;

  DELETE FROM public.users
  WHERE id = p_user_id;

  DELETE FROM auth.users
  WHERE id = p_user_id
  RETURNING true INTO v_auth_deleted;

  deleted_user_id := p_user_id;
  deleted_auth_user := COALESCE(v_auth_deleted, false);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_member_completely(uuid) TO authenticated;

import { supabase } from "@/supabaseClient"; // Adjust import path as needed

// Function to fetch trainers from staff table
export async function fetchTrainers() {
  try {
    const { data: trainers, error } = await supabase
      .from('staff')
      .select(`
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        roles!inner(name)
      `)
      .eq('roles.name', 'trainer')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching trainers:', error);
      return [];
    }

    return trainers || [];
  } catch (error) {
    console.error('Error fetching trainers:', error);
    return [];
  }
}

// Alternative query if you have role_id instead of role name
export async function fetchTrainersByRoleId(trainerRoleId: string) {
  try {
    const { data: trainers, error } = await supabase
      .from('staff')
      .select(`
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone
      `)
      .eq('role_id', trainerRoleId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching trainers:', error);
      return [];
    }

    return trainers || [];
  } catch (error) {
    console.error('Error fetching trainers:', error);
    return [];
  }
}

// Function to submit coaching data to Supabase
export async function createOneToOneCoaching(coachingData: {
  user_id: string;
  trainer_id: string;
  hourly_rate: number;
  days_per_week: number;
  hours_per_session: number;
  start_date: string;
  end_date?: string;
  status?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('one_to_one_coaching')
      .insert([coachingData])
      .select();

    if (error) {
      console.error('Error creating coaching session:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error creating coaching session:', error);
    throw error;
  }
}

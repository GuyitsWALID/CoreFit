/**
 * Import Service for handling data imports
 * Supports Users, Memberships, Check-ins, Packages
 */

import { supabase } from '@/lib/supabaseClient';
import { ParsedRecord } from '@/utils/importParsers';

export type ImportDataType = 'users' | 'memberships' | 'check_ins' | 'packages' | 'staff';
export type DuplicateHandling = 'skip' | 'update' | 'create_new';

export interface FieldMapping {
  sourceField: string;
  targetField: string;
}

export interface ImportConfig {
  gymId: string;
  dataType: ImportDataType;
  duplicateHandling: DuplicateHandling;
  fieldMappings: FieldMapping[];
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  imported: number;
  skipped: number;
  updated: number;
  failed: number;
  errors: string[];
  cancelled?: boolean;
}

// Target fields for each data type
export const TARGET_FIELDS: Record<ImportDataType, { field: string; label: string; required: boolean }[]> = {
  users: [
    { field: 'full_name', label: 'Full Name (will split into first/last)', required: false },
    { field: 'first_name', label: 'First Name', required: false },
    { field: 'last_name', label: 'Last Name', required: false },
    { field: 'email', label: 'Email', required: false },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'gender', label: 'Gender', required: false },
    { field: 'date_of_birth', label: 'Date of Birth', required: false },
    { field: 'emergency_name', label: 'Emergency Contact Name', required: false },
    { field: 'emergency_phone', label: 'Emergency Contact Phone', required: false },
    { field: 'relationship', label: 'Emergency Contact Relationship', required: false },
    { field: 'fitness_goal', label: 'Fitness Goal', required: false },
    { field: 'status', label: 'Status (active/inactive)', required: false },
    { field: 'membership_expiry', label: 'Membership Expiry', required: false },
  ],
  memberships: [
    { field: 'user_email', label: 'User Email (to match)', required: true },
    { field: 'package_name', label: 'Package Name', required: false },
    { field: 'start_date', label: 'Start Date', required: false },
    { field: 'expiry_date', label: 'Expiry Date', required: true },
    { field: 'status', label: 'Status', required: false },
  ],
  check_ins: [
    { field: 'user_email', label: 'User Email (to match)', required: true },
    { field: 'check_in_time', label: 'Check-in Time', required: true },
    { field: 'check_in_date', label: 'Check-in Date', required: false },
    { field: 'check_out_time', label: 'Check-out Time', required: false },
    { field: 'notes', label: 'Notes', required: false },
  ],
  packages: [
    { field: 'name', label: 'Package Name', required: true },
    { field: 'price', label: 'Price', required: true },
    { field: 'duration', label: 'Duration', required: true },
    { field: 'duration_unit', label: 'Duration Unit (days/weeks/months/years)', required: true },
    { field: 'access_type', label: 'Access Type', required: false },
    { field: 'max_freezes', label: 'Max Freezes', required: false },
    { field: 'description', label: 'Description', required: false },
    { field: 'is_active', label: 'Is Active', required: false },
  ],
  staff: [
    { field: 'full_name', label: 'Full Name (will split into first/last)', required: false },
    { field: 'first_name', label: 'First Name', required: false },
    { field: 'last_name', label: 'Last Name', required: false },
    { field: 'email', label: 'Email', required: true },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'date_of_birth', label: 'Date of Birth', required: false },
    { field: 'gender', label: 'Gender', required: false },
    { field: 'role_name', label: 'Role Name', required: false },
    { field: 'hire_date', label: 'Hire Date', required: false },
    { field: 'salary', label: 'Salary', required: false },
    { field: 'is_active', label: 'Is Active', required: false },
  ],
};

// Auto-detect field mappings based on common field names
export function autoDetectMappings(sourceHeaders: string[], dataType: ImportDataType): FieldMapping[] {
  const targetFields = TARGET_FIELDS[dataType];
  const mappings: FieldMapping[] = [];
  
  const commonAliases: Record<string, string[]> = {
    full_name: ['fullname', 'fullName', 'full_name', 'name', 'member_name', 'client_name'],
    first_name: ['first_name', 'firstname', 'firstName', 'first', 'fname', 'given_name', 'givenname'],
    last_name: ['last_name', 'lastname', 'lastName', 'last', 'lname', 'surname', 'family_name', 'familyname'],
    email: ['email', 'e-mail', 'email_address', 'emailaddress', 'mail'],
    phone: ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone_number', 'phonenumber', 'contact'],
    gender: ['gender', 'sex'],
    date_of_birth: ['date_of_birth', 'dateOfBirth', 'dob', 'birth_date', 'birthdate', 'birthday'],
    status: ['status', 'state', 'isActive', 'is_active', 'active'],
    membership_expiry: ['membership_expiry', 'expiry', 'expiry_date', 'expires', 'end_date', 'valid_until'],
    emergency_name: ['emergency_name', 'emergencyContactName', 'emergency_contact', 'emergency_contact_name', 'ice_name'],
    emergency_phone: ['emergency_phone', 'emergencyContactPhone', 'emergency_contact_phone', 'emergency_number', 'ice_phone'],
    relationship: ['relationship', 'emergencyContactRelationship', 'emergency_relationship', 'ice_relationship'],
    fitness_goal: ['fitness_goal', 'fitnessGoals', 'fitnessGoal', 'fitness_goals', 'goals'],
    name: ['name', 'package_name', 'title'],
    price: ['price', 'cost', 'amount', 'fee'],
    duration: ['duration', 'length', 'period'],
    duration_unit: ['duration_unit', 'unit', 'period_type'],
    check_in_time: ['check_in_time', 'checkin_time', 'check_in', 'checkin', 'time_in', 'arrival'],
    check_out_time: ['check_out_time', 'checkout_time', 'check_out', 'checkout', 'time_out', 'departure'],
    user_email: ['user_email', 'email', 'member_email', 'client_email'],
    package_name: ['package_name', 'package', 'membership_type', 'plan'],
    start_date: ['start_date', 'start', 'begin_date', 'from_date'],
    expiry_date: ['expiry_date', 'end_date', 'expires', 'valid_until', 'to_date'],
    role_name: ['role_name', 'role', 'position', 'job_title', 'title'],
    hire_date: ['hire_date', 'hired_date', 'start_date', 'join_date', 'joined'],
    salary: ['salary', 'pay', 'wage', 'compensation'],
    is_active: ['is_active', 'active', 'status', 'enabled'],
  };
  
  for (const target of targetFields) {
    const aliases = commonAliases[target.field] || [target.field];
    const normalizedHeaders = sourceHeaders.map(h => h.toLowerCase().replace(/[\s-]/g, '_'));
    
    let matchedSource = '';
    for (const alias of aliases) {
      const index = normalizedHeaders.findIndex(h => h === alias || h.includes(alias));
      if (index !== -1) {
        matchedSource = sourceHeaders[index];
        break;
      }
    }
    
    mappings.push({
      sourceField: matchedSource,
      targetField: target.field,
    });
  }
  
  return mappings;
}

// Import users
async function importUsers(
  data: ParsedRecord[],
  config: ImportConfig,
  signal?: AbortSignal
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRecords: data.length,
    imported: 0,
    skipped: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };
  
  for (let i = 0; i < data.length; i++) {
    // Check for cancellation at the start of each iteration
    if (signal?.aborted) {
      result.cancelled = true;
      result.errors.push(`Import cancelled by user after ${result.imported} records`);
      break;
    }
    
    const record = data[i];
    try {
      const mappedData: Record<string, any> = {};
      
      for (const mapping of config.fieldMappings) {
        if (mapping.sourceField && record[mapping.sourceField] !== undefined) {
          mappedData[mapping.targetField] = record[mapping.sourceField];
        }
      }
      
      // Handle full_name - split into first_name and last_name
      if (mappedData.full_name && (!mappedData.first_name || !mappedData.last_name)) {
        const nameParts = String(mappedData.full_name).trim().split(/\s+/);
        if (nameParts.length >= 2) {
          mappedData.first_name = nameParts[0];
          mappedData.last_name = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          mappedData.first_name = nameParts[0];
          mappedData.last_name = '';
        }
      }
      
      // Handle isActive -> status conversion
      if (mappedData.status === '1' || mappedData.status === 'true' || mappedData.status === true) {
        mappedData.status = 'active';
      } else if (mappedData.status === '0' || mappedData.status === 'false' || mappedData.status === false) {
        mappedData.status = 'inactive';
      }
      
      // Handle fitnessGoals array format
      if (mappedData.fitness_goal && typeof mappedData.fitness_goal === 'string') {
        // Remove brackets and quotes if it's a JSON array string
        if (mappedData.fitness_goal.startsWith('[')) {
          try {
            const goals = JSON.parse(mappedData.fitness_goal);
            mappedData.fitness_goal = Array.isArray(goals) ? goals.join(', ') : mappedData.fitness_goal;
          } catch {
            // Keep as-is if parsing fails
          }
        }
      }
      
      // Validate - need at least a name
      if (!mappedData.first_name && !mappedData.full_name) {
        result.skipped++;
        result.errors.push(`Row ${i + 1}: Missing required field (first_name or full_name)`);
        continue;
      }
      
      // Check for duplicates - use maybeSingle() instead of single() to avoid 406 errors
      const email = mappedData.email;
      const phone = mappedData.phone;
      
      let existingUser = null;
      if (email) {
        const { data: existing, error } = await supabase
          .from('users')
          .select('id')
          .eq('gym_id', config.gymId)
          .eq('email', email)
          .maybeSingle();
        if (!error) existingUser = existing;
      }
      if (!existingUser && phone) {
        const { data: existing, error } = await supabase
          .from('users')
          .select('id')
          .eq('gym_id', config.gymId)
          .eq('phone', phone)
          .maybeSingle();
        if (!error) existingUser = existing;
      }
      
      if (existingUser) {
        if (config.duplicateHandling === 'skip') {
          result.skipped++;
          continue;
        } else if (config.duplicateHandling === 'update') {
          // Update existing user directly
          const { error } = await supabase
            .from('users')
            .update({
              first_name: mappedData.first_name,
              last_name: mappedData.last_name || '',
              gender: mappedData.gender || null,
              date_of_birth: mappedData.date_of_birth || null,
              emergency_name: mappedData.emergency_name || null,
              emergency_phone: mappedData.emergency_phone || null,
              relationship: mappedData.relationship || null,
              fitness_goal: mappedData.fitness_goal || null,
              status: mappedData.status || 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);
          
          if (error) throw error;
          result.updated++;
          continue;
        }
        // If 'create_new', continue to insert
      }
      
      // Helper function to validate and clean date fields
      const cleanDate = (dateValue: string | null | undefined): string | null => {
        if (!dateValue) return null;
        // Invalid dates from MySQL exports
        if (dateValue === '0000-00-00' || dateValue === '0000-00-00 00:00:00') return null;
        // Check if it's a valid date
        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) return null;
        return dateValue;
      };
      
      // Clean date fields
      mappedData.date_of_birth = cleanDate(mappedData.date_of_birth);
      mappedData.membership_expiry = cleanDate(mappedData.membership_expiry);
      
      // Generate a temporary password for auth (users will need to reset)
      const tempPassword = `Temp${crypto.randomUUID().slice(0, 8)}!`;
      
      // Try to create Supabase Auth account if email exists
      let userId: string | null = null;
      
      if (mappedData.email) {
        // Add delay to avoid rate limiting (Supabase free tier: ~4 signups per minute)
        // Wait 1.5 seconds between signups
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: mappedData.email,
          password: tempPassword,
          options: {
            // Don't send confirmation email for bulk imports
            emailRedirectTo: undefined,
          }
        });
        
        if (authError) {
          // If rate limited, wait longer and retry once
          if (authError.message?.includes('rate limit') || authError.status === 429) {
            console.warn(`Row ${i + 1}: Rate limited, waiting 10 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const { data: retryData, error: retryError } = await supabase.auth.signUp({
              email: mappedData.email,
              password: tempPassword,
            });
            
            if (retryError) {
              console.warn(`Row ${i + 1}: Auth creation failed after retry for ${mappedData.email}:`, retryError.message);
              userId = crypto.randomUUID();
            } else {
              userId = retryData?.user?.id || crypto.randomUUID();
            }
          } else {
            console.warn(`Row ${i + 1}: Auth creation failed for ${mappedData.email}:`, authError.message);
            userId = crypto.randomUUID();
          }
        } else {
          userId = authData?.user?.id || crypto.randomUUID();
        }
      } else {
        // No email - generate UUID without auth
        userId = crypto.randomUUID();
      }
      
      // Generate QR code data
      const qrData = JSON.stringify({
        userId: userId,
        firstName: mappedData.first_name,
        lastName: mappedData.last_name || '',
        gymId: config.gymId,
      });
      
      // Insert into users table (full_name is a generated column, don't include it)
      const { error } = await supabase
        .from('users')
        .insert({
          id: userId,
          first_name: mappedData.first_name,
          last_name: mappedData.last_name || '',
          email: mappedData.email || null,
          phone: mappedData.phone || '',  // phone is NOT NULL, use empty string
          gender: mappedData.gender || null,
          date_of_birth: mappedData.date_of_birth || null,
          emergency_name: mappedData.emergency_name || null,
          emergency_phone: mappedData.emergency_phone || null,
          relationship: mappedData.relationship || null,
          fitness_goal: mappedData.fitness_goal || null,
          status: mappedData.status || 'active',
          membership_expiry: mappedData.membership_expiry || null,
          gym_id: config.gymId,
          qr_code_data: qrData,
          created_at: new Date().toISOString(),
        });
      
      if (error) {
        // Log detailed error for debugging
        console.error(`Row ${i + 1} Insert Error:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          mappedData: mappedData,
        });
        throw error;
      }
      result.imported++;
      
    } catch (error: any) {
      result.failed++;
      const errorMsg = error.details || error.hint || error.message || 'Unknown error';
      result.errors.push(`Row ${i + 1}: ${errorMsg}`);
      console.error(`Import failed for row ${i + 1}:`, error);
    }
  }
  
  result.success = result.failed === 0;
  return result;
}

// Import packages
async function importPackages(
  data: ParsedRecord[],
  config: ImportConfig,
  signal?: AbortSignal
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRecords: data.length,
    imported: 0,
    skipped: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };
  
  for (let i = 0; i < data.length; i++) {
    // Check for cancellation at the start of each iteration
    if (signal?.aborted) {
      result.cancelled = true;
      result.errors.push(`Import cancelled by user after ${result.imported} records`);
      break;
    }
    
    const record = data[i];
    try {
      const mappedData: Record<string, any> = {};
      
      for (const mapping of config.fieldMappings) {
        if (mapping.sourceField && record[mapping.sourceField] !== undefined) {
          mappedData[mapping.targetField] = record[mapping.sourceField];
        }
      }
      
      if (!mappedData.name || !mappedData.price || !mappedData.duration) {
        result.skipped++;
        result.errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }
      
      // Check for duplicate package name
      const { data: existing } = await supabase
        .from('packages')
        .select('id')
        .eq('gym_id', config.gymId)
        .eq('name', mappedData.name)
        .single();
      
      if (existing) {
        if (config.duplicateHandling === 'skip') {
          result.skipped++;
          continue;
        } else if (config.duplicateHandling === 'update') {
          const { error } = await supabase
            .from('packages')
            .update({
              price: parseFloat(mappedData.price),
              duration: parseInt(mappedData.duration),
              duration_unit: mappedData.duration_unit || 'months',
              access_type: mappedData.access_type || 'all_hours',
              max_freezes: mappedData.max_freezes ? parseInt(mappedData.max_freezes) : 0,
              description: mappedData.description || null,
              is_active: mappedData.is_active !== 'false',
            })
            .eq('id', existing.id);
          
          if (error) throw error;
          result.updated++;
          continue;
        }
      }
      
      const { error } = await supabase
        .from('packages')
        .insert({
          name: mappedData.name,
          price: parseFloat(mappedData.price),
          duration: parseInt(mappedData.duration),
          duration_unit: mappedData.duration_unit || 'months',
          access_type: mappedData.access_type || 'all_hours',
          max_freezes: mappedData.max_freezes ? parseInt(mappedData.max_freezes) : 0,
          description: mappedData.description || null,
          is_active: mappedData.is_active !== 'false',
          gym_id: config.gymId,
          created_at: new Date().toISOString(),
        });
      
      if (error) throw error;
      result.imported++;
      
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }
  
  result.success = result.failed === 0;
  return result;
}

// Import check-ins
async function importCheckIns(
  data: ParsedRecord[],
  config: ImportConfig,
  signal?: AbortSignal
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRecords: data.length,
    imported: 0,
    skipped: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };
  
  // Cache user lookups
  const userCache: Record<string, string> = {};
  
  for (let i = 0; i < data.length; i++) {
    // Check for cancellation at the start of each iteration
    if (signal?.aborted) {
      result.cancelled = true;
      result.errors.push(`Import cancelled by user after ${result.imported} records`);
      break;
    }
    
    const record = data[i];
    try {
      const mappedData: Record<string, any> = {};
      
      for (const mapping of config.fieldMappings) {
        if (mapping.sourceField && record[mapping.sourceField] !== undefined) {
          mappedData[mapping.targetField] = record[mapping.sourceField];
        }
      }
      
      if (!mappedData.user_email || !mappedData.check_in_time) {
        result.skipped++;
        result.errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }
      
      // Look up user by email
      let userId = userCache[mappedData.user_email];
      if (!userId) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('gym_id', config.gymId)
          .eq('email', mappedData.user_email)
          .single();
        
        if (!user) {
          result.skipped++;
          result.errors.push(`Row ${i + 1}: User not found with email ${mappedData.user_email}`);
          continue;
        }
        userId = user.id;
        userCache[mappedData.user_email] = userId;
      }
      
      const checkInTime = new Date(mappedData.check_in_time);
      const checkInDate = mappedData.check_in_date || checkInTime.toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('client_checkins')
        .insert({
          user_id: userId,
          check_in_time: checkInTime.toISOString(),
          check_in_date: checkInDate,
          check_out_time: mappedData.check_out_time ? new Date(mappedData.check_out_time).toISOString() : null,
          notes: mappedData.notes || null,
          gym_id: config.gymId,
        });
      
      if (error) throw error;
      result.imported++;
      
    } catch (error: any) {
      result.failed++;
      result.errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }
  
  result.success = result.failed === 0;
  return result;
}

// Import staff/team members
async function importStaff(
  data: ParsedRecord[],
  config: ImportConfig,
  signal?: AbortSignal
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRecords: data.length,
    imported: 0,
    skipped: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };
  
  // Fetch roles for mapping
  const { data: roles } = await supabase.from('roles').select('id, name');
  const roleMap = new Map(roles?.map(r => [r.name.toLowerCase(), r.id]) || []);
  
  for (let i = 0; i < data.length; i++) {
    // Check for cancellation at the start of each iteration
    if (signal?.aborted) {
      result.cancelled = true;
      result.errors.push(`Import cancelled by user after ${result.imported} records`);
      break;
    }
    
    const record = data[i];
    try {
      const mappedData: Record<string, any> = {};
      
      for (const mapping of config.fieldMappings) {
        if (mapping.sourceField && record[mapping.sourceField] !== undefined) {
          mappedData[mapping.targetField] = record[mapping.sourceField];
        }
      }
      
      // Handle full_name - split into first_name and last_name
      if (mappedData.full_name && (!mappedData.first_name || !mappedData.last_name)) {
        const nameParts = String(mappedData.full_name).trim().split(/\s+/);
        if (nameParts.length >= 2) {
          mappedData.first_name = nameParts[0];
          mappedData.last_name = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          mappedData.first_name = nameParts[0];
          mappedData.last_name = '';
        }
      }
      
      // Validate required fields
      if (!mappedData.email) {
        throw new Error('Email is required for staff import');
      }
      
      // Helper function to validate dates
      const cleanDate = (dateValue: string | null | undefined): string | null => {
        if (!dateValue) return null;
        if (dateValue === '0000-00-00' || dateValue === '0000-00-00 00:00:00') return null;
        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) return null;
        return dateValue;
      };
      
      // Map role name to role_id
      let roleId: string | null = null;
      if (mappedData.role_name) {
        roleId = roleMap.get(String(mappedData.role_name).toLowerCase()) || null;
      }
      
      // Handle is_active conversion
      let isActive = true;
      if (mappedData.is_active !== undefined) {
        isActive = mappedData.is_active === '1' || 
                   mappedData.is_active === 'true' || 
                   mappedData.is_active === true ||
                   mappedData.is_active === 'active';
      }
      
      // Check for existing staff by email
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('email', mappedData.email)
        .eq('gym_id', config.gymId)
        .maybeSingle();
      
      if (existingStaff) {
        if (config.duplicateHandling === 'skip') {
          result.skipped++;
          continue;
        } else if (config.duplicateHandling === 'update') {
          const { error } = await supabase
            .from('staff')
            .update({
              first_name: mappedData.first_name || undefined,
              last_name: mappedData.last_name || undefined,
              phone: mappedData.phone || undefined,
              date_of_birth: cleanDate(mappedData.date_of_birth),
              gender: mappedData.gender || undefined,
              role_id: roleId || undefined,
              hire_date: cleanDate(mappedData.hire_date),
              salary: mappedData.salary ? parseFloat(mappedData.salary) : undefined,
              is_active: isActive,
            })
            .eq('id', existingStaff.id);
          
          if (error) throw error;
          result.updated++;
          continue;
        }
      }
      
      // Generate a temporary password for auth
      const tempPassword = `Temp${crypto.randomUUID().slice(0, 8)}!`;
      
      // Create auth account for staff
      let userId: string | null = null;
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: mappedData.email,
        password: tempPassword,
      });
      
      if (authError) {
        // If rate limited, wait and retry
        if (authError.message?.includes('rate limit') || (authError as any).status === 429) {
          console.warn(`Row ${i + 1}: Rate limited, waiting 10 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          const { data: retryData, error: retryError } = await supabase.auth.signUp({
            email: mappedData.email,
            password: tempPassword,
          });
          
          if (retryError) {
            console.warn(`Row ${i + 1}: Auth creation failed after retry:`, retryError.message);
            userId = crypto.randomUUID();
          } else {
            userId = retryData?.user?.id || crypto.randomUUID();
          }
        } else {
          console.warn(`Row ${i + 1}: Auth creation failed:`, authError.message);
          userId = crypto.randomUUID();
        }
      } else {
        userId = authData?.user?.id || crypto.randomUUID();
      }
      
      // Generate QR code data for staff
      const qrData = JSON.stringify({
        staffId: userId,
        firstName: mappedData.first_name,
        lastName: mappedData.last_name || '',
        roleId: roleId,
        gymId: config.gymId,
      });
      
      // Insert into staff table
      const { error } = await supabase
        .from('staff')
        .insert({
          id: userId,
          first_name: mappedData.first_name || '',
          last_name: mappedData.last_name || '',
          email: mappedData.email,
          phone: mappedData.phone || null,
          date_of_birth: cleanDate(mappedData.date_of_birth),
          gender: mappedData.gender || null,
          role_id: roleId,
          hire_date: cleanDate(mappedData.hire_date) || new Date().toISOString().split('T')[0],
          salary: mappedData.salary ? parseFloat(mappedData.salary) : 0,
          is_active: isActive,
          gym_id: config.gymId,
          qr_code: qrData,
          created_at: new Date().toISOString(),
        });
      
      if (error) {
        console.error(`Row ${i + 1} Staff Insert Error:`, {
          code: error.code,
          message: error.message,
          details: error.details,
        });
        throw error;
      }
      result.imported++;
      
    } catch (error: any) {
      result.failed++;
      const errorMsg = error.details || error.hint || error.message || 'Unknown error';
      result.errors.push(`Row ${i + 1}: ${errorMsg}`);
      console.error(`Import failed for row ${i + 1}:`, error);
    }
  }
  
  result.success = result.failed === 0;
  return result;
}

// Main import function
export async function importData(
  data: ParsedRecord[],
  config: ImportConfig,
  signal?: AbortSignal
): Promise<ImportResult> {
  switch (config.dataType) {
    case 'users':
      return importUsers(data, config, signal);
    case 'packages':
      return importPackages(data, config, signal);
    case 'check_ins':
      return importCheckIns(data, config, signal);
    case 'memberships':
      // Memberships are handled as part of users for now
      return importUsers(data, config, signal);
    case 'staff':
      return importStaff(data, config, signal);
    default:
      return {
        success: false,
        totalRecords: 0,
        imported: 0,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: ['Unknown data type'],
      };
  }
}

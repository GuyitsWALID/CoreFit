/**
 * Import Service for handling data imports
 * Supports Users, Memberships, Check-ins, Packages
 */

import { supabase } from '@/lib/supabaseClient';
import { ParsedRecord } from '@/utils/importParsers';

export type ImportDataType = 'users' | 'memberships' | 'check_ins' | 'packages';
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
}

// Target fields for each data type
export const TARGET_FIELDS: Record<ImportDataType, { field: string; label: string; required: boolean }[]> = {
  users: [
    { field: 'first_name', label: 'First Name', required: true },
    { field: 'last_name', label: 'Last Name', required: true },
    { field: 'email', label: 'Email', required: false },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'gender', label: 'Gender', required: false },
    { field: 'date_of_birth', label: 'Date of Birth', required: false },
    { field: 'emergency_name', label: 'Emergency Contact Name', required: false },
    { field: 'emergency_phone', label: 'Emergency Contact Phone', required: false },
    { field: 'relationship', label: 'Emergency Contact Relationship', required: false },
    { field: 'fitness_goal', label: 'Fitness Goal', required: false },
    { field: 'status', label: 'Status', required: false },
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
};

// Auto-detect field mappings based on common field names
export function autoDetectMappings(sourceHeaders: string[], dataType: ImportDataType): FieldMapping[] {
  const targetFields = TARGET_FIELDS[dataType];
  const mappings: FieldMapping[] = [];
  
  const commonAliases: Record<string, string[]> = {
    first_name: ['first_name', 'firstname', 'first', 'fname', 'given_name', 'givenname'],
    last_name: ['last_name', 'lastname', 'last', 'lname', 'surname', 'family_name', 'familyname'],
    email: ['email', 'e-mail', 'email_address', 'emailaddress', 'mail'],
    phone: ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone_number', 'phonenumber', 'contact'],
    gender: ['gender', 'sex'],
    date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'birthdate', 'birthday'],
    status: ['status', 'state', 'active'],
    membership_expiry: ['membership_expiry', 'expiry', 'expiry_date', 'expires', 'end_date', 'valid_until'],
    emergency_name: ['emergency_name', 'emergency_contact', 'emergency_contact_name', 'ice_name'],
    emergency_phone: ['emergency_phone', 'emergency_contact_phone', 'emergency_number', 'ice_phone'],
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
  config: ImportConfig
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
    const record = data[i];
    try {
      const mappedData: Record<string, any> = {};
      
      for (const mapping of config.fieldMappings) {
        if (mapping.sourceField && record[mapping.sourceField] !== undefined) {
          mappedData[mapping.targetField] = record[mapping.sourceField];
        }
      }
      
      // Validate required fields
      if (!mappedData.first_name || !mappedData.last_name) {
        result.skipped++;
        result.errors.push(`Row ${i + 1}: Missing required fields (first_name or last_name)`);
        continue;
      }
      
      // Check for duplicates
      const email = mappedData.email;
      const phone = mappedData.phone;
      
      let existingUser = null;
      if (email) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('gym_id', config.gymId)
          .eq('email', email)
          .single();
        existingUser = existing;
      } else if (phone) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('gym_id', config.gymId)
          .eq('phone', phone)
          .single();
        existingUser = existing;
      }
      
      if (existingUser) {
        if (config.duplicateHandling === 'skip') {
          result.skipped++;
          continue;
        } else if (config.duplicateHandling === 'update') {
          const { error } = await supabase
            .from('users')
            .update({
              ...mappedData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);
          
          if (error) throw error;
          result.updated++;
          continue;
        }
        // If 'create_new', continue to insert
      }
      
      // Generate QR code data
      const qrData = JSON.stringify({
        name: `${mappedData.first_name} ${mappedData.last_name}`,
        email: mappedData.email || '',
        phone: mappedData.phone || '',
        gym_id: config.gymId,
        created_at: new Date().toISOString(),
      });
      
      // Insert new user
      const { error } = await supabase
        .from('users')
        .insert({
          first_name: mappedData.first_name,
          last_name: mappedData.last_name,
          full_name: `${mappedData.first_name} ${mappedData.last_name}`,
          email: mappedData.email || null,
          phone: mappedData.phone || null,
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

// Import packages
async function importPackages(
  data: ParsedRecord[],
  config: ImportConfig
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
  config: ImportConfig
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

// Main import function
export async function importData(
  data: ParsedRecord[],
  config: ImportConfig
): Promise<ImportResult> {
  switch (config.dataType) {
    case 'users':
      return importUsers(data, config);
    case 'packages':
      return importPackages(data, config);
    case 'check_ins':
      return importCheckIns(data, config);
    case 'memberships':
      // Memberships are handled as part of users for now
      return importUsers(data, config);
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

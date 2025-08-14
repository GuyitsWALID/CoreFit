// src/services/smsService.ts
import { supabase } from '@/supabaseClient'
import type { User, Staff } from '@/types/db'

export interface SendManualSMSRequest {
  recipients: string[]
  message: string
  sender_id: string // staff.id
  notification_id?: string
}

export interface SendWelcomeSMSRequest {
  recipient_phone: string
  recipient_name: string
  username: string
  password: string
  gym_name?: string
  gym_address?: string
  gym_phone?: string
  recipient_id?: string // user.id
}

export interface SMSResponse {
  success: boolean
  data?: any
  error?: string
}

type GenericResponse<T = any> = Promise<{ success: boolean; data?: T; error?: string }>

/**
 * Types for joined package result (Supabase returns an array for joins)
 */
type JoinedPackageArray = { name?: string }[]
type JoinedPackageObject = { name?: string } | null
type PackageJoin = JoinedPackageArray | JoinedPackageObject | null

class SMSService {
  private async callEdgeFunction(functionName: string, payload: any): Promise<SMSResponse> {
    try {
      const res: any = await supabase.functions.invoke(functionName, { body: payload })
      if (res?.error) {
        console.error(`Edge function ${functionName} error:`, res.error)
        return { success: false, error: res.error?.message ?? JSON.stringify(res.error) }
      }
      if (res?.data) {
        if (typeof res.data === 'object' && 'success' in res.data) {
          return res.data as SMSResponse
        }
        return { success: true, data: res.data }
      }
      return { success: true, data: res }
    } catch (err: unknown) {
      console.error(`Exception calling ${functionName}:`, err)
      const message = err instanceof Error ? err.message : JSON.stringify(err)
      return { success: false, error: message }
    }
  }

  /* Edge function callers */
  async sendManualSMS(request: SendManualSMSRequest): Promise<SMSResponse> {
    return this.callEdgeFunction('send-sms', { type: 'send_manual_sms', data: request })
  }

  async sendWelcomeSMS(request: SendWelcomeSMSRequest): Promise<SMSResponse> {
    return this.callEdgeFunction('send-sms', { type: 'send_welcome_message', data: request })
  }

  /* DB queries */
  async getNotifications(limit = 50, offset = 0): GenericResponse {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async getNotificationTemplates(): GenericResponse {
    try {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async getDeliveryLogs(notificationId: string): GenericResponse {
    try {
      const { data, error } = await supabase
        .from('notification_delivery_logs')
        .select('*')
        .eq('notification_id', notificationId)
        .order('created_at', { ascending: false })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async getPackages(): GenericResponse<{ id: string; name: string }[]> {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name')
        .eq('archived', false)
        .order('name', { ascending: true })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async getRoles(): GenericResponse<{ id: string; name: string }[]> {
    try {
      const { data, error } = await supabase.from('roles').select('id, name').order('name', { ascending: true })
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * Fetch staff for a given role name (e.g., "trainer", "receptionist", "admin")
   * Returns them mapped into a User-like shape for the selector.
   */
  async getStaffByRole(roleName: string): GenericResponse<User[]> {
    try {
      // 1) find role id
      const { data: roleData, error: roleErr } = await supabase.from('roles').select('id, name').eq('name', roleName).limit(1).single()
      if (roleErr || !roleData) {
        return { success: false, error: roleErr?.message ?? 'Role not found' }
      }
      const roleId = roleData.id

      // 2) fetch staff with that role_id
      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
        .select('id, first_name, last_name, full_name, email, phone, role_id, is_active')
        .eq('role_id', roleId)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (staffErr) return { success: false, error: staffErr.message }

      // Map staff rows to User-like interface so UI can display uniformly
      const mapped: User[] = (staffData || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name ?? '',
        last_name: s.last_name ?? '',
        full_name: s.full_name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        email: s.email ?? '',
        phone: s.phone ?? null,
        membership_type: roleName, // show role name in membership_type for display
        membership_expiry: null,
        status: s.is_active ? 'active' : 'inactive',
        created_at: s.created_at ?? null,
      }))

      return { success: true, data: mapped }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * Search users (members). Returns membership_type from package.name for compatibility.
   */
  async searchUsers(searchTerm = '', limit = 50): GenericResponse {
    try {
      let query = supabase
        .from('users')
        .select('id, first_name, last_name, full_name, email, phone, package_id, membership_expiry, created_at, status, package:packages(name)')
        .limit(limit)

      if (searchTerm && searchTerm.trim().length > 0) {
        const like = `%${searchTerm.replace(/%/g, '\\%')}%`
        query = query.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      }

      const { data, error } = await query.order('full_name', { ascending: true })
      if (error) return { success: false, error: error.message }

      const transformed: User[] = (data || []).map((u: any) => {
        const pkg: PackageJoin = u.package ?? null
        let pkgName: string | null = null
        if (Array.isArray(pkg)) pkgName = pkg[0]?.name ?? null
        else if (pkg && typeof pkg === 'object') pkgName = (pkg as JoinedPackageObject).name ?? null

        return {
          id: u.id,
          first_name: u.first_name ?? '',
          last_name: u.last_name ?? '',
          full_name: u.full_name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
          email: u.email ?? '',
          phone: u.phone ?? null,
          package_id: u.package_id ?? null,
          membership_type: pkgName ?? null,
          membership_expiry: u.membership_expiry ?? null,
          status: u.status ?? null,
          created_at: u.created_at ?? null,
        }
      })

      return { success: true, data: transformed }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async getUserById(userId: string): GenericResponse {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, full_name, email, phone, package_id, membership_expiry, created_at, status, package:packages(name)')
        .eq('id', userId)
        .single()
      if (error) return { success: false, error: error.message }

      const pkg: PackageJoin = (data as any)?.package ?? null
      let pkgName: string | null = null
      if (Array.isArray(pkg)) pkgName = pkg[0]?.name ?? null
      else if (pkg && typeof pkg === 'object') pkgName = (pkg as JoinedPackageObject).name ?? null

      const out: User = {
        id: data.id,
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        full_name: data.full_name ?? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
        email: data.email ?? '',
        phone: data.phone ?? null,
        package_id: data.package_id ?? null,
        membership_type: pkgName ?? null,
        membership_expiry: data.membership_expiry ?? null,
        status: data.status ?? null,
        created_at: data.created_at ?? null,
      }
      return { success: true, data: out }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async getGymSettings(): GenericResponse {
    try {
      const { data, error } = await supabase.from('gym_settings').select('*').single()
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const smsService = new SMSService()
export default smsService

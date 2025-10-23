import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, MessageSquare, Wand2 } from 'lucide-react'
import { smsService, SendManualSMSRequest } from '../services/smsService'
import { supabase } from '@/lib/supabaseClient'
import { UserSelector } from './UserSelector'
import type { User as DBuser } from '@/types/db'
import { formatPhoneNumberForSms } from '@/utils/phone' // <-- Added

interface NotificationTemplate {
  id: string
  name: string
  title: string
  body: string
  variables?: string[]
  template_type: string
}

interface GymInfo {
  name: string
  address: string
  phone: string
  email: string
}

export const EnhancedSMSSender: React.FC = () => {
  const [activeTab, setActiveTab] = useState('template')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  const [selectedUsers, setSelectedUsers] = useState<DBuser[]>([])
  const [gymInfo, setGymInfo] = useState<GymInfo>({
    name: 'ATL Fitness',
    address: 'Your Gym Address',
    phone: 'Your Gym Phone',
    email: 'info@atlfitness.com'
  })
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    loadTemplates()
    loadGymInfo()
  }, [])

  useEffect(() => {
    if (selectedTemplate && selectedUsers.length > 0) {
      autoPopulateVariables()
    }
  }, [selectedTemplate, selectedUsers])

  const loadTemplates = async () => {
    const result = await smsService.getNotificationTemplates()
    if (result.success) setTemplates(result.data || [])
  }

  const loadGymInfo = async () => {
    try {
      const result = await smsService.getGymSettings()
      if (result.success && result.data) setGymInfo(result.data)
    } catch (error) {
      console.error('Error loading gym info:', error)
    }
  }

  // Extract variables from message body
  const extractVariablesFromBody = (body: string): string[] => {
    const matches = body.match(/{(.*?)}/g) || []
    return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())))
  }

  const autoPopulateVariables = () => {
    if (!selectedTemplate || selectedUsers.length === 0) return
    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return

    const variables = extractVariablesFromBody(template.body)
    const firstUser = selectedUsers[0]
    const newVars: Record<string, string> = {}

    variables.forEach(variable => {
      const key = variable.toLowerCase()
      switch (key) {
        case 'name': newVars[variable] = firstUser.full_name; break
        case 'first_name': newVars[variable] = firstUser.first_name; break
        case 'last_name': newVars[variable] = firstUser.last_name; break
        case 'email': newVars[variable] = firstUser.email; break
        case 'phone': newVars[variable] = formatPhoneNumberForSms(firstUser.phone); break // formatted
        case 'membership_type': newVars[variable] = firstUser.membership_type || 'Standard'; break
        case 'membership_expiry':
          newVars[variable] = firstUser.membership_expiry
            ? new Date(firstUser.membership_expiry).toLocaleDateString()
            : 'N/A'; break
        case 'member_since':
          newVars[variable] = new Date(firstUser.created_at).toLocaleDateString(); break
        case 'gym_name': newVars[variable] = gymInfo.name; break
        case 'gym_address': newVars[variable] = gymInfo.address; break
        case 'gym_phone': newVars[variable] = gymInfo.phone; break
        case 'gym_email': newVars[variable] = gymInfo.email; break
        default: newVars[variable] = ''
      }
    })

    setTemplateVariables(newVars)
  }

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleTemplateSMS = async () => {
    if (!selectedTemplate) return showAlert('error', 'Please select a template')
    if (selectedUsers.length === 0) return showAlert('error', 'Please select at least one user')

    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return showAlert('error', 'Selected template not found')

    const variables = extractVariablesFromBody(template.body)
    const missingVars = variables.filter(v => !templateVariables[v]?.trim())
    if (missingVars.length > 0) {
      return showAlert('error', `Please fill in all variables: ${missingVars.join(', ')}`)
    }

    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return showAlert('error', 'You must be logged in to send SMS')

      const results = await Promise.all(
        selectedUsers.map(async (u) => {
          let msg = template.body
          variables.forEach(v => {
            let val = ''
            switch (v.toLowerCase()) {
              case 'name': val = u.full_name; break
              case 'first_name': val = u.first_name; break
              case 'last_name': val = u.last_name; break
              case 'email': val = u.email; break
              case 'phone': val = formatPhoneNumberForSms(u.phone); break // formatted
              case 'membership_type': val = u.membership_type || 'Standard'; break
              case 'membership_expiry':
                val = u.membership_expiry
                  ? new Date(u.membership_expiry).toLocaleDateString()
                  : 'N/A'; break
              case 'member_since': val = new Date(u.created_at).toLocaleDateString(); break
              case 'gym_name': val = gymInfo.name; break
              case 'gym_address': val = gymInfo.address; break
              case 'gym_phone': val = gymInfo.phone; break
              case 'gym_email': val = gymInfo.email; break
              default: val = templateVariables[v] || ''
            }
            msg = msg.replace(new RegExp(`{${v}}`, 'g'), val)
          })

          const formattedPhone = formatPhoneNumberForSms(u.phone) // formatted
          if (!formattedPhone.startsWith('+')) {
            return { success: false, error: 'Invalid phone format' }
          }

          const request: SendManualSMSRequest = {
            recipients: [formattedPhone],
            message: msg,
            sender_id: user.id,
          }
          return smsService.sendManualSMS(request)
        })
      )

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount
      if (successCount > 0) {
        showAlert('success', `SMS sent to ${successCount} user(s)${failCount > 0 ? `, ${failCount} failed` : ''}`)
        if (failCount === 0) {
          setSelectedUsers([])
          setTemplateVariables({})
        }
      } else {
        showAlert('error', 'Failed to send SMS to all users')
      }
    } catch (err) {
      console.error(err)
      showAlert('error', 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualSMS = async () => {
    if (!message.trim()) return showAlert('error', 'Please enter a message')
    if (selectedUsers.length === 0) return showAlert('error', 'Please select at least one user')

    const recipients = selectedUsers
      .map(u => formatPhoneNumberForSms(u.phone)) // formatted
      .filter(num => num && num.startsWith('+'))

    if (recipients.length === 0) return showAlert('error', 'No valid phone numbers found')

    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return showAlert('error', 'You must be logged in to send SMS')

      const request: SendManualSMSRequest = {
        recipients,
        message: message.trim(),
        sender_id: user.id,
      }
      const result = await smsService.sendManualSMS(request)

      if (result.success) {
        showAlert('success', `SMS sent to ${recipients.length} user(s)`)
        setMessage('')
        setSelectedUsers([])
      } else {
        showAlert('error', result.error || 'Failed to send SMS')
      }
    } catch (err) {
      console.error(err)
      showAlert('error', 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const getPreviewMessage = (): string => {
    if (!selectedTemplate) return ''
    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return ''
    let preview = template.body
    extractVariablesFromBody(template.body).forEach(v => {
      preview = preview.replace(new RegExp(`{${v}}`, 'g'), templateVariables[v] || `{${v}}`)
    })
    return preview
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Enhanced SMS Notification Center
          </CardTitle>
          <CardDescription>Send SMS notifications with automatic variable population</CardDescription>
        </CardHeader>
        <CardContent>
          {alert && (
            <Alert className={`mb-4 ${alert.type === 'error' ? 'border-red-500' : 'border-green-500'}`}>
              <AlertDescription className={alert.type === 'error' ? 'text-red-700' : 'text-green-700'}>
                {alert.message}
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template"><Wand2 className="h-4 w-4" /> Template SMS</TabsTrigger>
              <TabsTrigger value="manual"><Send className="h-4 w-4" /> Manual SMS</TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-4">
              <Label>Select Users</Label>
              <UserSelector
                mode="multiple"
                selectedUsers={selectedUsers}
                onUserSelect={(u: DBuser) => setSelectedUsers([u])}
                onUsersSelect={(u: DBuser[]) => setSelectedUsers(u)}
              />

              <Label>Select Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} <Badge variant="outline">{t.template_type}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate && extractVariablesFromBody(templates.find(t => t.id === selectedTemplate)?.body || '')
                .map(v => (
                  <div key={v}>
                    <Label>{v}</Label>
                    <Input
                      value={templateVariables[v] || ''}
                      onChange={(e) => setTemplateVariables(prev => ({ ...prev, [v]: e.target.value }))}
                    />
                  </div>
              ))}

              <Label>Message Preview</Label>
              <div className="p-3 bg-gray-50 rounded-md border text-sm">{getPreviewMessage()}</div>

              <Button onClick={handleTemplateSMS} disabled={isLoading || !selectedTemplate || selectedUsers.length === 0} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : <>Send Template SMS</>}
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <Label>Select Users</Label>
              <UserSelector
                mode="multiple"
                selectedUsers={selectedUsers}
                onUserSelect={(u: DBuser) => setSelectedUsers([u])}
                onUsersSelect={(u: DBuser[]) => setSelectedUsers(u)}
              />

              <Label>Message</Label>
              <Textarea
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
              <p className="text-sm text-gray-500">{message.length}/160 characters</p>

              <Button onClick={handleManualSMS} disabled={isLoading || !message.trim() || selectedUsers.length === 0} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : <>Send Manual SMS</>}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

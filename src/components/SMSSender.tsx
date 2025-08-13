// src/components/EnhancedSMSSender.tsx
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
import { Loader2, Send, Users, User, MessageSquare, Wand2 } from 'lucide-react'
import { smsService, SendManualSMSRequest } from '../services/smsService'
import { supabase } from '@/supabaseClient'
import { UserSelector } from '@/components/UserSelector'

interface NotificationTemplate {
  id: string
  name: string
  title: string
  body: string
  variables: string[]
  template_type: string
}

interface User {
  id: string
  name: string
  email: string
  phone: string
  membership_type?: string
  membership_expiry?: string
  created_at: string
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
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
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
    if (selectedTemplate && selectedUsers.length === 1) {
      autoPopulateVariables()
    }
  }, [selectedTemplate, selectedUsers])

  const loadTemplates = async () => {
    const result = await smsService.getNotificationTemplates()
    if (result.success) {
      setTemplates(result.data || [])
    }
  }

  const loadGymInfo = async () => {
    try {
      // Load gym information from your settings table
      const { data, error } = await supabase
        .from('gym_settings') // Adjust table name based on your schema
        .select('name, address, phone, email')
        .single()

      if (!error && data) {
        setGymInfo(data)
      }
    } catch (error) {
      console.error('Error loading gym info:', error)
    }
  }

  const autoPopulateVariables = () => {
    if (!selectedTemplate || selectedUsers.length !== 1) return

    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return

    const user = selectedUsers[0]
    const newVariables: Record<string, string> = {}

    // Auto-populate common variables
    template.variables.forEach(variable => {
      switch (variable.toLowerCase()) {
        case 'name':
          newVariables[variable] = user.name
          break
        case 'email':
          newVariables[variable] = user.email
          break
        case 'phone':
          newVariables[variable] = user.phone
          break
        case 'membership_type':
          newVariables[variable] = user.membership_type || 'Standard'
          break
        case 'membership_expiry':
          newVariables[variable] = user.membership_expiry ? 
            new Date(user.membership_expiry).toLocaleDateString() : 'N/A'
          break
        case 'gym_name':
          newVariables[variable] = gymInfo.name
          break
        case 'gym_address':
          newVariables[variable] = gymInfo.address
          break
        case 'gym_phone':
          newVariables[variable] = gymInfo.phone
          break
        case 'gym_email':
          newVariables[variable] = gymInfo.email
          break
        case 'member_since':
          newVariables[variable] = new Date(user.created_at).toLocaleDateString()
          break
        default:
          // Keep existing value or set empty
          newVariables[variable] = templateVariables[variable] || ''
      }
    })

    setTemplateVariables(newVariables)
  }

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleTemplateSMS = async () => {
    if (!selectedTemplate) {
      showAlert('error', 'Please select a template')
      return
    }

    if (selectedUsers.length === 0) {
      showAlert('error', 'Please select at least one user')
      return
    }

    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) {
      showAlert('error', 'Selected template not found')
      return
    }

    // Check if all required variables are filled
    const missingVariables = template.variables.filter(variable => !templateVariables[variable]?.trim())
    if (missingVariables.length > 0) {
      showAlert('error', `Please fill in all variables: ${missingVariables.join(', ')}`)
      return
    }

    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showAlert('error', 'You must be logged in to send SMS')
        return
      }

      // Send SMS to each selected user
      const results = await Promise.all(
        selectedUsers.map(async (selectedUser) => {
          // Replace template variables with user-specific data
          let messageBody = template.body
          
          // Create user-specific variables
          const userSpecificVariables = { ...templateVariables }
          
          // Override with user-specific data if sending to multiple users
          if (selectedUsers.length > 1) {
            template.variables.forEach(variable => {
              switch (variable.toLowerCase()) {
                case 'name':
                  userSpecificVariables[variable] = selectedUser.name
                  break
                case 'email':
                  userSpecificVariables[variable] = selectedUser.email
                  break
                case 'phone':
                  userSpecificVariables[variable] = selectedUser.phone
                  break
                case 'membership_type':
                  userSpecificVariables[variable] = selectedUser.membership_type || 'Standard'
                  break
                case 'membership_expiry':
                  userSpecificVariables[variable] = selectedUser.membership_expiry ? 
                    new Date(selectedUser.membership_expiry).toLocaleDateString() : 'N/A'
                  break
                case 'member_since':
                  userSpecificVariables[variable] = new Date(selectedUser.created_at).toLocaleDateString()
                  break
              }
            })
          }

          // Replace all variables in the message
          template.variables.forEach(variable => {
            const value = userSpecificVariables[variable] || ''
            messageBody = messageBody.replace(new RegExp(`{${variable}}`, 'g'), value)
          })

          const request: SendManualSMSRequest = {
            recipients: [selectedUser.phone],
            message: messageBody,
            sender_id: user.id,
          }

          return await smsService.sendManualSMS(request)
        })
      )

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        showAlert('success', `Template SMS sent successfully to ${successCount} user(s)${failCount > 0 ? `, ${failCount} failed` : ''}`)
        if (successCount === results.length) {
          // Reset form only if all messages were successful
          setSelectedUsers([])
          setTemplateVariables({})
        }
      } else {
        showAlert('error', 'Failed to send SMS to all users')
      }
    } catch (error) {
      showAlert('error', 'An unexpected error occurred')
      console.error('Template SMS error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualSMS = async () => {
    if (!message.trim()) {
      showAlert('error', 'Please enter a message')
      return
    }

    if (selectedUsers.length === 0) {
      showAlert('error', 'Please select at least one user')
      return
    }

    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showAlert('error', 'You must be logged in to send SMS')
        return
      }

      const recipients = selectedUsers.map(u => u.phone)
      const request: SendManualSMSRequest = {
        recipients,
        message: message.trim(),
        sender_id: user.id,
      }

      const result = await smsService.sendManualSMS(request)

      if (result.success) {
        showAlert('success', `SMS sent successfully to ${recipients.length} user(s)`)
        setMessage('')
        setSelectedUsers([])
      } else {
        showAlert('error', result.error || 'Failed to send SMS')
      }
    } catch (error) {
      showAlert('error', 'An unexpected error occurred')
      console.error('Manual SMS error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getPreviewMessage = (): string => {
    if (!selectedTemplate) return ''

    const template = templates.find(t => t.id === selectedTemplate)
    if (!template) return ''

    let preview = template.body
    template.variables.forEach(variable => {
      const value = templateVariables[variable] || `{${variable}}`
      preview = preview.replace(new RegExp(`{${variable}}`, 'g'), value)
    })

    return preview
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enhanced SMS Notification Center
          </CardTitle>
          <CardDescription>
            Send SMS notifications with automatic template variable population
          </CardDescription>
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
              <TabsTrigger value="template" className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                Template SMS
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Manual SMS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-4">
              <div className="space-y-2">
                <Label>Select Users</Label>
                <UserSelector
                  mode="multiple"
                  selectedUsers={selectedUsers}
                  onUserSelect={(user) => setSelectedUsers([user])}
                  onUsersSelect={setSelectedUsers}
                />
                {selectedUsers.length > 0 && (
                  <p className="text-sm text-gray-500">
                    {selectedUsers.length} user(s) selected
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-select">Select Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a notification template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          <Badge variant="outline">{template.template_type}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <>
                  {selectedUsers.length === 1 && (
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Auto-populated for {selectedUsers[0].name}</span>
                      </div>
                      <p className="text-xs text-blue-600">
                        Template variables have been automatically filled with user data. You can modify them below if needed.
                      </p>
                    </div>
                  )}

                  {templates.find(t => t.id === selectedTemplate)?.variables.map((variable) => (
                    <div key={variable} className="space-y-2">
                      <Label htmlFor={`var-${variable}`}>
                        {variable}
                        {selectedUsers.length === 1 && templateVariables[variable] && (
                          <Badge variant="secondary" className="ml-2 text-xs">auto-filled</Badge>
                        )}
                      </Label>
                      <Input
                        id={`var-${variable}`}
                        placeholder={`Enter ${variable}`}
                        value={templateVariables[variable] || ''}
                        onChange={(e) => setTemplateVariables(prev => ({
                          ...prev,
                          [variable]: e.target.value
                        }))}
                      />
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Label>Message Preview</Label>
                    <div className="p-3 bg-gray-50 rounded-md border">
                      <p className="text-sm whitespace-pre-wrap">
                        {getPreviewMessage() || 'Select template and fill variables to see preview'}
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={handleTemplateSMS} 
                    disabled={isLoading || !selectedTemplate || selectedUsers.length === 0}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Template SMS to {selectedUsers.length} User(s)
                      </>
                    )}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <Label>Select Users</Label>
                <UserSelector
                  mode="multiple"
                  selectedUsers={selectedUsers}
                  onUserSelect={(user) => setSelectedUsers([user])}
                  onUsersSelect={setSelectedUsers}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-message">Message</Label>
                <Textarea
                  id="manual-message"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
                <p className="text-sm text-gray-500">
                  {message.length}/160 characters
                </p>
              </div>

              <Button 
                onClick={handleManualSMS} 
                disabled={isLoading || !message.trim() || selectedUsers.length === 0}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Manual SMS to {selectedUsers.length} User(s)
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
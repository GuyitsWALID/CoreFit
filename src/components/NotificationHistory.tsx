// src/components/NotificationHistory.tsx
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
// Remove Dialog import
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, Search, Eye, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { smsService } from '../services/smsService'
import { supabase } from '@/supabaseClient'

interface Notification {
  id: string
  template_id?: string
  title: string
  body: string
  recipient_type: 'user' | 'staff' | 'member'
  recipient_id?: string
  recipient_phone: string
  sent_by_admin_id?: string
  trigger_source: 'manual' | 'system_auto' | 'scheduled'
  trigger_event?: string
  channels: string[]
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled'
  sms_status?: 'pending' | 'sent' | 'delivered' | 'failed'
  sms_provider_id?: string
  scheduled_at?: string
  sent_at?: string
  delivered_at?: string
  error_message?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

interface DeliveryLog {
  id: string
  notification_id: string
  channel: string
  status: string
  provider_response: Record<string, any> | null
  error_message?: string
  attempt_number: number
  metadata: Record<string, any>
  created_at: string
}

export const NotificationHistory: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([])
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)

  useEffect(() => {
    loadNotifications()
    
    // Set up real-time subscription for notifications
    const notificationSubscription = supabase
      .channel('notifications_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('Notification change received:', payload)
          loadNotifications() // Reload notifications when changes occur
        }
      )
      .subscribe()

    return () => {
      notificationSubscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    filterNotifications()
  }, [notifications, searchTerm, statusFilter, sourceFilter])

  const loadNotifications = async () => {
    setIsLoading(true)
    try {
      const result = await smsService.getNotifications(100, 0)
      if (result.success) {
        setNotifications(result.data || [])
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterNotifications = () => {
    let filtered = notifications

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(notification =>
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.recipient_phone.includes(searchTerm)
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(notification => notification.status === statusFilter)
    }

    // Apply source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(notification => notification.trigger_source === sourceFilter)
    }

    setFilteredNotifications(filtered)
  }

  const loadDeliveryLogs = async (notificationId: string) => {
    try {
      const result = await smsService.getDeliveryLogs(notificationId)
      if (result.success) {
        setDeliveryLogs(result.data || [])
      }
    } catch (error) {
      console.error('Error loading delivery logs:', error)
    }
  }

  const handleViewDetails = async (notification: Notification) => {
    setSelectedNotification(notification)
    await loadDeliveryLogs(notification.id)
    setIsLogDialogOpen(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'sent':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      delivered: 'default',
      sent: 'secondary',
      failed: 'destructive',
      pending: 'outline',
      cancelled: 'outline'
    }

    return (
      <Badge variant={variants[status] || 'outline'} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-blue-100 text-blue-800',
      system_auto: 'bg-green-100 text-green-800',
      scheduled: 'bg-purple-100 text-purple-800'
    }

    return (
      <Badge variant="outline" className={colors[source] || 'bg-gray-100 text-gray-800'}>
        {source.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Notification History
          </CardTitle>
          <CardDescription>
          View and monitor all SMS notifications sent from your system
          </CardDescription>
        </div>
        <Button onClick={loadNotifications} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by title, message, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
          <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="delivered">Delivered</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48">
          <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
          <SelectItem value="system_auto">System Auto</SelectItem>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <div>
            <p className="text-sm font-medium">Total</p>
            <p className="text-2xl font-bold">{notifications.length}</p>
            </div>
          </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
            <p className="text-sm font-medium">Delivered</p>
            <p className="text-2xl font-bold">
              {notifications.filter(n => n.status === 'delivered').length}
            </p>
            </div>
          </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <div>
            <p className="text-sm font-medium">Pending</p>
            <p className="text-2xl font-bold">
              {notifications.filter(n => n.status === 'pending').length}
            </p>
            </div>
          </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <div>
            <p className="text-sm font-medium">Failed</p>
            <p className="text-2xl font-bold">
              {notifications.filter(n => n.status === 'failed').length}
            </p>
            </div>
          </div>
          </CardContent>
        </Card>
        </div>

        {/* Notifications Table */}
        <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Sent At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
          </TableHeader>
          <TableBody>
          {isLoading ? (
            <TableRow>
            <TableCell colSpan={6} className="text-center py-8">
              Loading notifications...
            </TableCell>
            </TableRow>
          ) : filteredNotifications.length === 0 ? (
            <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
              No notifications found
            </TableCell>
            </TableRow>
          ) : (
            filteredNotifications.map((notification) => (
            <TableRow key={notification.id}>
              <TableCell>
              <div>
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm text-gray-500 truncate max-w-xs">
                {notification.body}
                </p>
              </div>
              </TableCell>
              <TableCell>
              <div>
                <p className="font-medium">{notification.recipient_phone}</p>
                <p className="text-sm text-gray-500">
                {notification.recipient_type}
                </p>
              </div>
              </TableCell>
              <TableCell>
              {getStatusBadge(notification.status)}
              </TableCell>
              <TableCell>
              {getSourceBadge(notification.trigger_source)}
              </TableCell>
              <TableCell>
              {notification.sent_at ? formatDate(notification.sent_at) : 'Not sent'}
              </TableCell>
              <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewDetails(notification)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Details
              </Button>
              </TableCell>
            </TableRow>
            ))
          )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
      </Card>

      {/* Notification Details Modal (replaces Dialog) */}
      {isLogDialogOpen && selectedNotification && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsLogDialogOpen(false)}
          aria-modal="true"
          role="dialog"
          aria-labelledby="notif-details-title"
        >
          <div
            className="relative bg-white rounded-lg shadow-lg max-w-5xl w-[95vw] sm:w-[90vw] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-start justify-between">
              <div>
                <h2 id="notif-details-title" className="text-lg font-semibold">Notification Details</h2>
                <p className="text-sm text-gray-500">Detailed information and delivery logs for this notification</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsLogDialogOpen(false)} aria-label="Close">
                ×
              </Button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-6">
              {/* Notification Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Basic Information</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Title:</strong> {selectedNotification.title}</p>
                    <p><strong>Recipient:</strong> {selectedNotification.recipient_phone}</p>
                    <p><strong>Type:</strong> {selectedNotification.recipient_type}</p>
                    {/* Replace <p> wrapping a Badge (div) with a div container */}
                    <div className="flex items-center gap-2">
                      <strong>Status:</strong>
                      {getStatusBadge(selectedNotification.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      <strong>Source:</strong>
                      {getSourceBadge(selectedNotification.trigger_source)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Timestamps</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Created:</strong> {formatDate(selectedNotification.created_at)}</p>
                    <p><strong>Sent:</strong> {selectedNotification.sent_at ? formatDate(selectedNotification.sent_at) : 'Not sent'}</p>
                    <p><strong>Delivered:</strong> {selectedNotification.delivered_at ? formatDate(selectedNotification.delivered_at) : 'Not delivered'}</p>
                    {selectedNotification.error_message && (
                      <p><strong>Error:</strong> <span className="text-red-600">{selectedNotification.error_message}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Content (horizontal scroll only here) */}
              <div className="space-y-2 overflow-x-auto">
                <h4 className="font-semibold">Message Content</h4>
                <div className="p-3 bg-gray-50 rounded-md border">
                  <p className="text-sm whitespace-pre-wrap break-words">{selectedNotification.body}</p>
                </div>
              </div>

              {/* Delivery Logs (horizontal scroll only here) */}
              <div className="space-y-2">
                <h4 className="font-semibold">Delivery Logs</h4>
                <ScrollArea className="h-64 border rounded-md overflow-x-auto">
                  <div className="p-4 space-y-3 min-w-[600px]">
                    {deliveryLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">No delivery logs available</p>
                    ) : (
                      deliveryLogs.map((log) => (
                        <div key={log.id} className="border-l-4 border-l-blue-500 pl-4 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusIcon(log.status)}
                            <span className="font-medium text-sm">{log.status.toUpperCase()}</span>
                            <span className="text-xs text-gray-500">Attempt #{log.attempt_number}</span>
                            <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
                          </div>
                          {log.error_message && (
                            <p className="text-sm text-red-600 mb-2 break-words">{log.error_message}</p>
                          )}
                          {log.provider_response && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                                Provider Response
                              </summary>
                              <div className="overflow-x-auto">
                                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs min-w-[400px] max-w-full whitespace-pre">
{JSON.stringify(log.provider_response, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
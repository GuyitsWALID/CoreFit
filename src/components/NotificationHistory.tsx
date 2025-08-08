import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Eye,
  Calendar,
  Phone,
  MessageSquare
} from 'lucide-react';

interface Notification {
  id: string;
  template_id?: string;
  title: string;
  body: string;
  recipient_type: string;
  recipient_id?: string;
  recipient_phone: string;
  sent_by_admin_id?: string;
  trigger_source: string;
  trigger_event?: string;
  channels?: string[];
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  sms_status?: string;
  sms_provider_id?: string;
  scheduled_at?: string;
  sent_at?: string;
  delivered_at?: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

export function NotificationHistory() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    recipient_type: 'all',
    limit: 50,
    offset: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [filters]);

  useEffect(() => {
    // Setup realtime subscription with better error handling
    let channel: any = null;
    
    try {
      channel = supabase
        .channel('notifications-changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'notifications' 
          },
          (payload) => {
            console.log('Realtime change received:', payload);
            if (payload.eventType === 'INSERT') {
              setNotifications((prev) => [payload.new as Notification, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setNotifications((prev) =>
                prev.map((notif) => (notif.id === payload.new.id ? payload.new as Notification : notif))
              );
            } else if (payload.eventType === 'DELETE') {
              setNotifications((prev) =>
                prev.filter((notif) => notif.id !== payload.old.id)
              );
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to notifications changes');
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Failed to subscribe to notifications changes');
          }
        });
    } catch (err) {
      console.warn('Realtime subscription failed:', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.recipient_type && filters.recipient_type !== 'all') {
        query = query.eq('recipient_type', filters.recipient_type);
      }

      query = query.range(filters.offset, filters.offset + filters.limit - 1);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }
      
      console.log('Loaded notifications:', data);
      setNotifications(data || []);
    } catch (err: any) {
      console.error('Error loading notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadNotifications();
  };

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0
    }));
  };

  const getStatusBadge = (status: string, smsStatus?: string) => {
    const statusConfig = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      'sent': { color: 'bg-blue-100 text-blue-800', icon: Send },
      'delivered': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'failed': { color: 'bg-red-100 text-red-800', icon: XCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['pending'];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {smsStatus || status}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return 'N/A';
    // Format phone number for better readability
    return phone.replace(/(\+\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
  };

  const filteredNotifications = notifications.filter(notification => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      notification.title?.toLowerCase().includes(searchLower) ||
      notification.body?.toLowerCase().includes(searchLower) ||
      notification.recipient_phone?.includes(searchTerm) ||
      notification.status?.toLowerCase().includes(searchLower) ||
      notification.sms_status?.toLowerCase().includes(searchLower)
    );
  });

  const viewNotificationDetails = (notification: Notification) => {
    setSelectedNotification(notification);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <History className="h-8 w-8" />
            Notification History
          </h1>
          <p className="text-gray-600 mt-1">Track and monitor SMS notification delivery</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert className="border-red-500 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2" 
              onClick={handleRefresh}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">Notification List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="search"
                      placeholder="Search notifications..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient-type-filter">Recipient Type</Label>
                  <Select value={filters.recipient_type} onValueChange={(value) => handleFilterChange('recipient_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limit-filter">Results per page</Label>
                  <Select value={filters.limit.toString()} onValueChange={(value) => handleFilterChange('limit', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
              <CardDescription>
                Showing {filteredNotifications.length} of {notifications.length} notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading notifications...
                </div>
              ) : notifications.length === 0 && !loading ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No notifications found</p>
                  <p className="text-sm">No SMS notifications have been sent yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={handleRefresh}
                  >
                    Refresh
                  </Button>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No notifications match your search criteria</p>
                  <p className="text-sm">Try adjusting your filters or search terms</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNotifications.map((notification) => (
                        <TableRow key={notification.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{notification.title}</div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {notification.body}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span className="font-mono text-sm">
                                {formatPhone(notification.recipient_phone)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {notification.recipient_type}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {notification.trigger_source}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(notification.status, notification.sms_status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatDate(notification.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatDate(notification.sent_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewNotificationDetails(notification)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {filteredNotifications.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {filters.offset + 1} to {Math.min(filters.offset + filters.limit, filteredNotifications.length)} of {notifications.length} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.offset === 0}
                  onClick={() => handleFilterChange('offset', Math.max(0, filters.offset - filters.limit))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.offset + filters.limit >= notifications.length}
                  onClick={() => handleFilterChange('offset', filters.offset + filters.limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Notification Analytics</CardTitle>
              <CardDescription>Overview of notification performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-600">Total Sent</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">
                    {notifications.filter(n => n.status === 'sent' || n.status === 'delivered').length}
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Delivered</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900 mt-1">
                    {notifications.filter(n => n.status === 'delivered').length}
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-600">Pending</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-900 mt-1">
                    {notifications.filter(n => n.status === 'pending').length}
                  </div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">Failed</span>
                  </div>
                  <div className="text-2xl font-bold text-red-900 mt-1">
                    {notifications.filter(n => n.status === 'failed').length}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Delivery Rate</h3>
                <div className="bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-green-500 h-4 rounded-full transition-all duration-300"
                    style={{
                      width: `${notifications.length > 0 ? 
                        (notifications.filter(n => n.status === 'delivered').length / notifications.length) * 100 : 0}%`
                    }}
                  ></div>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {notifications.length > 0 ? 
                    Math.round((notifications.filter(n => n.status === 'delivered').length / notifications.length) * 100) : 0}% 
                  delivery rate
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notification Details Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Notification Details</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-4 right-4"
                onClick={() => setSelectedNotification(null)}
              >
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Title</Label>
                  <p className="font-medium">{selectedNotification.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedNotification.status, selectedNotification.sms_status)}
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Message</Label>
                <p className="mt-1 p-3 bg-gray-50 rounded border">{selectedNotification.body}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Recipient Phone</Label>
                  <p className="font-mono">{formatPhone(selectedNotification.recipient_phone)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Provider Message ID</Label>
                  <p className="font-mono text-sm">{selectedNotification.sms_provider_id || 'N/A'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Sent At</Label>
                  <p>{formatDate(selectedNotification.sent_at)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Delivered At</Label>
                  <p>{formatDate(selectedNotification.delivered_at)}</p>
                </div>
              </div>
              
              {selectedNotification.metadata && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Metadata</Label>
                  <pre className="mt-1 p-3 bg-gray-50 rounded border text-xs overflow-x-auto">
                    {JSON.stringify(selectedNotification.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


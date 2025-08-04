import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';
import { Search, Filter, Bell, Edit, Users, CheckCircle2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Notification {
  id: string;
  title: string;
  message: string;
  recipients: string;
  sent_at: string;
  sent_by: string;
}

interface Template {
  id: string;
  title: string;
  message: string;
  type: string;
  active: boolean;
}

export default function Notifications() {
  const { toast } = useToast();
  const [tab, setTab] = useState('history');
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recipient, setRecipient] = useState('all');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchTemplates();
  }, []);

  const fetchNotifications = async () => {
    // Replace with your notifications table/view
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('sent_at', { ascending: false });
    setNotifications(data || []);
  };

  const fetchTemplates = async () => {
    // Replace with your notification_templates table
    const { data } = await supabase
      .from('notification_templates')
      .select('*')
      .order('title');
    setTemplates(data || []);
  };

  const filteredNotifications = notifications.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.message.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast({ title: "Fill all fields", description: "Title and message are required.", variant: "destructive" });
      return;
    }
    setIsSending(true);
    // Replace with your notification sending logic
    const { error } = await supabase.from('notifications').insert([{
      title: notifTitle,
      message: notifMessage,
      recipients: recipient,
      sent_at: new Date().toISOString(),
      sent_by: 'Admin'
    }]);
    setIsSending(false);
    if (error) {
      toast({ title: "Send failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notification sent", description: "Your notification has been sent." });
      setNotifTitle('');
      setNotifMessage('');
      fetchNotifications();
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight mb-6">Notifications</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        <div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="history">Notification History</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="history">
              <div className="flex items-center gap-2 mb-4">
                <Input
                  placeholder="Search notifications..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-80"
                />
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" /> Filter
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Notification</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNotifications.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No notifications found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredNotifications.map(n => (
                          <TableRow key={n.id}>
                            <TableCell>
                              <div>
                                <span className="font-semibold">{n.title}</span>
                                <div className="text-xs text-gray-500 truncate">{n.message}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{n.recipients}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs">{new Date(n.sent_at).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-500">by {n.sent_by}</div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="templates">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No templates found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        templates.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>
                              <div>
                                <span className="font-semibold">{t.title}</span>
                                <div className="text-xs text-gray-500 truncate">{t.message}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{t.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={t.active ? "default" : "secondary"}>
                                {t.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Send Notification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Recipient</label>
                  <Select value={recipient} onValueChange={setRecipient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="members">Members</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notification Title</label>
                  <Input
                    placeholder="Enter notification title"
                    value={notifTitle}
                    onChange={e => setNotifTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Message</label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={4}
                    placeholder="Enter notification message"
                    value={notifMessage}
                    onChange={e => setNotifMessage(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-fitness-primary hover:bg-fitness-primary/90 text-white"
                  onClick={handleSend}
                  disabled={isSending}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  {isSending ? "Sending..." : "Send Notification"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
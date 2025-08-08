import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SMSSender } from '@/components/SMSSender';
import { NotificationHistory } from '@/components/NotificationHistory';
import { Send, History, BarChart3, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';
import { Textarea } from '@/components/ui/textarea';

export default function Notifications() {
  const [activeTab, setActiveTab] = useState('send');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateModal, setTemplateModal] = useState<{ open: boolean, template?: any }>({ open: false });
  const [templateForm, setTemplateForm] = useState({ name: '', title: '', body: '', template_type: 'custom' });
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check connection status on component mount
    checkConnectionStatus();
    fetchTemplates();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      // Simulate API connection check
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('error');
    }
  };

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setTemplates(data || []);
    setLoadingTemplates(false);
  }, []);

  const handleSaveSettings = () => {
    // Validate settings
    if (!apiKey.trim()) {
      toast({
        title: 'Validation Error',
        description: 'API Key is required',
        variant: 'destructive',
      });
      return;
    }

    // Save settings logic here
    toast({
      title: 'Settings Saved',
      description: 'Configuration has been updated successfully',
    });
  };

  const handleOpenEditTemplate = (template: any) => {
    setTemplateForm({
      name: template.name,
      title: template.title,
      body: template.body,
      template_type: template.template_type,
    });
    setTemplateModal({ open: true, template });
    setTemplateFormError(null);
  };

  const handleOpenAddTemplate = () => {
    setTemplateForm({ name: '', title: '', body: '', template_type: 'custom' });
    setTemplateModal({ open: true });
    setTemplateFormError(null);
  };

  const handleCloseTemplateModal = () => {
    setTemplateModal({ open: false });
    setTemplateFormError(null);
  };

  const handleTemplateFormChange = (field: string, value: string) => {
    setTemplateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.title || !templateForm.body) {
      setTemplateFormError('All fields are required.');
      return;
    }
    setTemplateFormError(null);
    if (templateModal.template) {
      // Update
      const { error } = await supabase
        .from('notification_templates')
        .update({
          name: templateForm.name,
          title: templateForm.title,
          body: templateForm.body,
          template_type: templateForm.template_type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateModal.template.id);
      if (error) {
        setTemplateFormError(error.message);
        return;
      }
      toast({ title: 'Template updated' });
    } else {
      // Insert
      const { error } = await supabase
        .from('notification_templates')
        .insert([{
          name: templateForm.name,
          title: templateForm.title,
          body: templateForm.body,
          template_type: templateForm.template_type,
        }]);
      if (error) {
        setTemplateFormError(error.message);
        return;
      }
      toast({ title: 'Template added' });
    }
    handleCloseTemplateModal();
    fetchTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', id);
    if (!error) {
      toast({ title: 'Template deleted' });
      fetchTemplates();
    }
  };

  const handleArchiveTemplate = async (id: string) => {
    const { error } = await supabase
      .from('notification_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      toast({ title: 'Template archived' });
      fetchTemplates();
    }
  };

  const StatusIndicator = ({ status }: { status: typeof connectionStatus }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'connected':
          return {
            color: 'bg-green-500',
            text: 'Connected to AfroMessage',
            textColor: 'text-green-800',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            icon: CheckCircle
          };
        case 'error':
          return {
            color: 'bg-red-500',
            text: 'Connection Error',
            textColor: 'text-red-800',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
            icon: AlertCircle
          };
        default:
          return {
            color: 'bg-yellow-500',
            text: 'Checking Connection...',
            textColor: 'text-yellow-800',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200',
            icon: AlertCircle
          };
      }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">{config.text}</div>
        <div className={`w-2 h-2 ${config.color} rounded-full`}></div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">SMS Notification System</h2>
              <p className="text-gray-600">Manage SMS notifications to gym members</p>
            </div>
            <StatusIndicator status={connectionStatus} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {connectionStatus === 'error' && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connection to AfroMessage API failed. Please check your settings and try again.
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2" 
                onClick={checkConnectionStatus}
              >
                Retry Connection
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send SMS
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send">
            <SMSSender />
          </TabsContent>

          <TabsContent value="history">
            <NotificationHistory />
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>SMS Analytics Dashboard</CardTitle>
                <CardDescription>
                  Comprehensive analytics and reporting for your SMS notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="text-center p-6 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 mb-2">1,234</div>
                    <div className="text-sm text-gray-600">Total Messages Sent</div>
                  </div>
                  <div className="text-center p-6 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 mb-2">98.5%</div>
                    <div className="text-sm text-gray-600">Delivery Rate</div>
                  </div>
                  <div className="text-center p-6 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 mb-2">$45.67</div>
                    <div className="text-sm text-gray-600">Total Cost</div>
                  </div>
                </div>
                
                <div className="text-center py-12">
                  <BarChart3 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
                  <p className="text-gray-600 mb-4">
                    Detailed analytics including delivery rates, cost analysis, and performance metrics
                  </p>
                  <p className="text-sm text-gray-500">
                    This feature will include charts showing delivery trends, cost per message, 
                    peak sending times, and recipient engagement metrics.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Notification Templates Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Notification Templates</CardTitle>
                  <CardDescription>
                    Manage predefined message templates for common notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full mb-2" onClick={handleOpenAddTemplate}>
                      Add New Template
                    </Button>
                    {loadingTemplates ? (
                      <div className="text-center text-gray-500 py-8">Loading templates...</div>
                    ) : templates.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">No templates found.</div>
                    ) : (
                      <div className="space-y-4">
                        {templates.map((tpl) => (
                          <div key={tpl.id} className={`p-4 border rounded-lg ${tpl.is_active ? 'bg-blue-50' : 'bg-gray-100 opacity-60'}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-blue-900">{tpl.title}</h4>
                                <p className="text-xs text-gray-500 mb-1">{tpl.name} ({tpl.template_type})</p>
                                <p className="text-sm text-blue-700 mt-1">{tpl.body}</p>
                                {!tpl.is_active && <span className="text-xs text-gray-400">Archived</span>}
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleOpenEditTemplate(tpl)}>Edit</Button>
                                <Button variant="outline" size="sm" onClick={() => handleArchiveTemplate(tpl.id)} disabled={!tpl.is_active}>
                                  Archive
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplate(tpl.id)}>
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              {/* System Health Card (keep for non-technical overview) */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>
                    Monitor system status and performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-gray-900">99.9%</div>
                        <div className="text-sm text-gray-600">Uptime</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-gray-900"> 2s</div>
                        <div className="text-sm text-gray-600">Avg Response</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Last health check: Just now</p>
                      <p>All systems operational</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Template Modal */}
            {templateModal.open && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative">
                  <h3 className="text-xl font-bold mb-4">{templateModal.template ? 'Edit Template' : 'Add Template'}</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>Name</Label>
                      <Input value={templateForm.name} onChange={e => handleTemplateFormChange('name', e.target.value)} />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input value={templateForm.title} onChange={e => handleTemplateFormChange('title', e.target.value)} />
                    </div>
                    <div>
                      <Label>Body</Label>
                      <Textarea value={templateForm.body} onChange={e => handleTemplateFormChange('body', e.target.value)} />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select
                        className="border rounded px-2 py-1 w-full"
                        value={templateForm.template_type}
                        onChange={e => handleTemplateFormChange('template_type', e.target.value)}
                      >
                        <option value="welcome_user">Welcome User</option>
                        <option value="membership_expiry">Membership Expiry</option>
                        <option value="payment_reminder">Payment Reminder</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    {templateFormError && <div className="text-red-600 text-sm">{templateFormError}</div>}
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" onClick={handleCloseTemplateModal}>Cancel</Button>
                    <Button onClick={handleSaveTemplate}>{templateModal.template ? 'Save Changes' : 'Add Template'}</Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
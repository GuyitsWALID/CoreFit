// src/components/SMSSender.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Info, XCircle, CheckCircle, Users, UserCheck, Phone } from 'lucide-react';
import { Badge } from './ui/badge';

interface User {
id: string;
first_name: string;
last_name: string;
full_name: string;
phone: string;
email: string;
status: string;
}

interface Staff {
id: string;
first_name: string;
last_name: string;
full_name: string;
phone: string;
email: string;
role_id: string;
is_active: boolean;
}

interface PersonalizedMessage {
id: number;
phone: string;
message: string;
user_id?: string;
}

export function SMSSender() {
const { toast } = useToast();
const [selectedUser, setSelectedUser] = useState<User | null>(null);
const [singleMessage, setSingleMessage] = useState('');
const [bulkRecipientType, setBulkRecipientType] = useState('');
const [bulkMessage, setBulkMessage] = useState('');
const [personalizedMessages, setPersonalizedMessages] =
useState<PersonalizedMessage[]>([{ id: 1, phone: '', message: '' }]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// Data states
const [users, setUsers] = useState<User[]>([]);
const [trainers, setTrainers] = useState<Staff[]>([]);
const [receptionists, setReceptionists] = useState<Staff[]>([]);
const [loadingData, setLoadingData] = useState(true);
const [recipientCounts, setRecipientCounts] = useState({
members: 0,
trainers: 0,
receptionists: 0
});

useEffect(() => {
loadUsersAndStaff();
}, []);

const loadUsersAndStaff = async () => {
setLoadingData(true);
try {
// Load active members
const { data: membersData, error: membersError } = await supabase
.from('users_with_membership_info')
.select('user_id, first_name, last_name, full_name, phone, email, status')
.eq('status', 'active');

if (membersError) throw membersError;

// Load staff with roles
const { data: staffData, error: staffError } = await supabase
.from('staff')
.select(`
id, first_name, last_name, full_name, phone, email, role_id, is_active,
roles!inner(name)
`)
.eq('is_active', true);

if (staffError) throw staffError;

// Process members data
const processedMembers = (membersData || []).map(member => ({
id: member.user_id,
first_name: member.first_name,
last_name: member.last_name,
full_name: member.full_name,
phone: member.phone,
email: member.email,
status: member.status
}));

// Filter trainers and receptionists
const trainersData = (staffData || []).filter(staff =>
staff.roles?.name?.toLowerCase() === 'trainer'
);
const receptionistsData = (staffData || []).filter(staff =>
staff.roles?.name?.toLowerCase() === 'receptionist'
);

setUsers(processedMembers);
setTrainers(trainersData);
setReceptionists(receptionistsData);

setRecipientCounts({
members: processedMembers.length,
trainers: trainersData.length,
receptionists: receptionistsData.length
});

} catch (err: any) {
console.error('Error loading users and staff:', err);
setError('Failed to load users and staff data');
} finally {
setLoadingData(false);
}
};

const formatPhoneNumber = (phone: string | null): string => {
if (!phone) return '';
const cleanPhone = phone.replace(/\s+/g, '').trim();
if (cleanPhone.startsWith('+')) {
return cleanPhone;
}
// Add country code for Ethiopia if not present
if (cleanPhone.startsWith('9') && cleanPhone.length === 9) {
return `+251${cleanPhone}`;
}
if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
return `+251${cleanPhone.substring(1)}`;
}
return cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
};

const getBulkRecipients = (): string[] => {
switch (bulkRecipientType) {
case 'members':
return users
.filter(user => user.phone)
.map(user => formatPhoneNumber(user.phone));
case 'trainers':
return trainers
.filter(trainer => trainer.phone)
.map(trainer => formatPhoneNumber(trainer.phone));
case 'receptionists':
return receptionists
.filter(receptionist => receptionist.phone)
.map(receptionist => formatPhoneNumber(receptionist.phone));
default:
return [];
}
};

const sendSms = async (type: string, payload: any) => {
setLoading(true);
setError(null);
try {
const { data, error: functionError } = await supabase.functions.invoke('send-sms', {
body: JSON.stringify({ type, data: payload }),
headers: { 'Content-Type': 'application/json' },
});

if (functionError) {
throw new Error(functionError.message);
}
if (data.error) {
throw new Error(data.error);
}

toast({
title: 'SMS Sent Successfully',
description: `Message ID: ${data.notification_id || data.campaign_id || 'N/A'}`,
});

// Clear form fields after successful send
setSelectedUser(null);
setSingleMessage('');
setBulkRecipientType('');
setBulkMessage('');
setPersonalizedMessages([{ id: 1, phone: '', message: '' }]);
} catch (err: any) {
console.error('Error sending SMS:', err);
setError(err.message || 'Failed to send SMS. Please try again.');
toast({
title: 'Failed to Send SMS',
description: err.message || 'An unexpected error occurred.',
variant: "destructive",
});
} finally {
setLoading(false);
}
};

const handleSendSingleSms = () => {
if (!selectedUser || !singleMessage) {
setError('Please select a recipient and enter a message.');
return;
}

const formattedPhone = formatPhoneNumber(selectedUser.phone);
if (!formattedPhone) {
setError('Selected user does not have a valid phone number.');
return;
}

setError(null);
sendSms('send_manual_sms', {
recipients: [formattedPhone],
message: singleMessage,
sender_id: 'admin'
});
};

const handleSendBulkSms = () => {
if (!bulkRecipientType || !bulkMessage) {
setError('Please select recipient type and enter a message.');
return;
}

const recipients = getBulkRecipients();
if (recipients.length === 0) {
setError(`No valid phone numbers found for ${bulkRecipientType}.`);
return;
}

setError(null);
sendSms('send_manual_sms', {
recipients,
message: bulkMessage,
sender_id: 'admin'
});
};

const handleAddPersonalizedMessage = () => {
setPersonalizedMessages([...personalizedMessages, { id:
personalizedMessages.length + 1, phone: '', message: '' }]);
};
const handleRemovePersonalizedMessage = (id: number) => {
setPersonalizedMessages(personalizedMessages.filter(msg => msg.id !==
id));
};
const handlePersonalizedMessageChange = (id: number, field: keyof
PersonalizedMessage, value: string) => {
setPersonalizedMessages(personalizedMessages.map(msg =>
msg.id === id ? { ...msg, [field]: value } : msg
));
};
const handleSendPersonalizedSms = () => {
const validMessages = personalizedMessages.filter(msg => msg.phone &&
msg.message);
if (validMessages.length === 0) {
setError('At least one personalized message with a recipient andmessage is required.');
return;
}
setError(null);
sendSms('send_personalized_bulk_sms', { messages: validMessages,
sender_id: 'your_admin_id' }); // Replace 'your_admin_id'
};
return (
<div className="max-w-4xl mx-auto p-6 space-y-6">
<h1 className="text-3xl font-bold text-gray-900">SMS Notification
Center</h1>
<p className="text-gray-600">Send SMS notifications to gym members and staff</p>
{error && (
<Alert variant="destructive">
<XCircle className="h-4 w-4" />
<AlertTitle>Error</AlertTitle>
<AlertDescription>{error}</AlertDescription>
</Alert>
)}

{loadingData && (
<Alert>
<Info className="h-4 w-4" />
<AlertDescription>Loading users and staff data...</AlertDescription>
</Alert>
)}

<Tabs defaultValue="single">
<TabsList className="grid w-full grid-cols-3">
<TabsTrigger value="single">Single SMS</TabsTrigger>
<TabsTrigger value="bulk">Bulk SMS</TabsTrigger>
<TabsTrigger value="personalized">Personalized</TabsTrigger>
</TabsList>

<TabsContent value="single">
<Card>
<CardHeader>
<CardTitle>Send Single SMS</CardTitle>
<CardDescription>Send an SMS to a single member</CardDescription>
</CardHeader>
<CardContent className="space-y-4">
<div className="space-y-2">
<Label htmlFor="single-recipient">Select Recipient</Label>
<Select
value={selectedUser?.id || ''}
onValueChange={(value) => {
const user = users.find(u => u.id === value);
setSelectedUser(user || null);
}}
>
<SelectTrigger>
<SelectValue placeholder="Search and select a member..." />
</SelectTrigger>
<SelectContent>
{users.map((user) => (
<SelectItem key={user.id} value={user.id}>
<div className="flex items-center justify-between w-full">
<span>{user.full_name}</span>
<div className="flex items-center gap-2 ml-2">
<Badge variant="outline" className="text-xs">
{user.email}
</Badge>
{user.phone && (
<Phone className="h-3 w-3 text-gray-400" />
)}
</div>
</div>
</SelectItem>
))}
</SelectContent>
</Select>

{selectedUser && (
<div className="mt-2 p-3 bg-gray-50 rounded border">
<div className="flex items-center justify-between">
<div>
<p className="font-medium">{selectedUser.full_name}</p>
<p className="text-sm text-gray-600">{selectedUser.email}</p>
</div>
<div className="text-right">
<p className="text-sm font-mono">
{formatPhoneNumber(selectedUser.phone) || 'No phone number'}
</p>
<Badge variant={selectedUser.phone ? 'default' : 'destructive'}>
{selectedUser.phone ? 'Valid' : 'No Phone'}
</Badge>
</div>
</div>
</div>
)}
</div>

<div className="space-y-2">
<Label htmlFor="single-message">Message</Label>
<Textarea
id="single-message"
placeholder="Enter your message here..."
value={singleMessage}
onChange={(e) => setSingleMessage(e.target.value)}
/>
<p className="text-sm text-gray-500">Characters: {singleMessage.length}/160</p>
</div>

<Button
onClick={handleSendSingleSms}
disabled={loading || !selectedUser || !selectedUser.phone}
>
{loading ? 'Sending...' : 'Send SMS'}
</Button>
</CardContent>
</Card>
</TabsContent>
<TabsContent value="bulk">
<Card>
<CardHeader>
<CardTitle>Send Bulk SMS</CardTitle>
<CardDescription>Send the same message to multiple recipients</CardDescription>
</CardHeader>
<CardContent className="space-y-4">
<div className="space-y-2">
<Label htmlFor="bulk-recipients">Select Recipients</Label>
<Select value={bulkRecipientType} onValueChange={setBulkRecipientType}>
<SelectTrigger>
<SelectValue placeholder="Choose recipient group..." />
</SelectTrigger>
<SelectContent>
<SelectItem value="members">
<div className="flex items-center justify-between w-full">
<div className="flex items-center gap-2">
<Users className="h-4 w-4" />
<span>All Active Members</span>
</div>
<Badge variant="secondary">{recipientCounts.members}</Badge>
</div>
</SelectItem>
<SelectItem value="trainers">
<div className="flex items-center justify-between w-full">
<div className="flex items-center gap-2">
<UserCheck className="h-4 w-4" />
<span>All Trainers</span>
</div>
<Badge variant="secondary">{recipientCounts.trainers}</Badge>
</div>
</SelectItem>
<SelectItem value="receptionists">
<div className="flex items-center justify-between w-full">
<div className="flex items-center gap-2">
<UserCheck className="h-4 w-4" />
<span>All Receptionists</span>
</div>
<Badge variant="secondary">{recipientCounts.receptionists}</Badge>
</div>
</SelectItem>
</SelectContent>
</Select>

{bulkRecipientType && (
<div className="mt-2 p-3 bg-blue-50 rounded border">
<p className="text-sm text-blue-800">
<strong>{getBulkRecipients().length}</strong> recipients will receive this message
{bulkRecipientType === 'members' && ' (active members only)'}
{bulkRecipientType === 'trainers' && ' (active trainers only)'}
{bulkRecipientType === 'receptionists' && ' (active receptionists only)'}
</p>
</div>
)}
</div>

<div className="space-y-2">
<Label htmlFor="bulk-message">Message</Label>
<Textarea
id="bulk-message"
placeholder="Enter your message here..."
value={bulkMessage}
onChange={(e) => setBulkMessage(e.target.value)}
/>
<p className="text-sm text-gray-500">Characters: {bulkMessage.length}/160</p>
</div>

<Button
onClick={handleSendBulkSms}
disabled={loading || !bulkRecipientType || getBulkRecipients().length === 0}
>
{loading ? 'Sending...' : `Send to ${getBulkRecipients().length} Recipients`}
</Button>
</CardContent>
</Card>
</TabsContent>
<TabsContent value="personalized">
<Card>
<CardHeader>
<CardTitle>Send Personalized SMS</CardTitle>
<CardDescription>Send different messages to different recipients</CardDescription>
</CardHeader>
<CardContent className="space-y-4">
{personalizedMessages.map((msg, index) => (
<div key={msg.id} className="border p-4 rounded-md space-y-3
relative">
<h3 className="text-lg font-semibold">Message {index + 1}
</h3>
<div className="grid grid-cols-2 gap-4">
<div className="space-y-2">
<Label htmlFor={`personalized-phone-${msg.id}`}>Phone
Number</Label>
<Input
id={`personalized-phone-${msg.id}`}
placeholder="+251912345678"
value={msg.phone}
onChange={(e) =>
handlePersonalizedMessageChange(msg.id, 'phone', e.target.value)}
/>
</div>
<div className="space-y-2">
<Label htmlFor={`personalizedmessage-${
msg.id}`}>Message</Label>
<Textarea
id={`personalized-message-${msg.id}`}
placeholder="Enter personalized message..."
value={msg.message}
onChange={(e) =>
handlePersonalizedMessageChange(msg.id, 'message', e.target.value)}
/>
</div>
</div>
{personalizedMessages.length > 1 && (
<Button
variant="destructive"
size="sm"
className="absolute top-4 right-4"
onClick={() => handleRemovePersonalizedMessage(msg.id)}
>
Remove
</Button>
)}
</div>
))}
<Button variant="outline" onClick={handleAddPersonalizedMessage}>
Add Another Message
</Button>
<Button onClick={handleSendPersonalizedSms} disabled={loading}>
{loading ? 'Sending...' : 'Send Personalized SMS'}
</Button>
</CardContent>
</Card>
</TabsContent>
</Tabs>
</div>
);
}
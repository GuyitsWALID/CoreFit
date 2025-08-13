// src/components/UserSelector.tsx
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, User, Users, Phone, Mail } from 'lucide-react'
import { supabase } from '@/supabaseClient'

interface User {
  id: string
  name: string
  email: string
  phone: string
  membership_type?: string
  membership_expiry?: string
  created_at: string
  // Add other user fields from your database
}

interface UserSelectorProps {
  onUserSelect: (user: User) => void
  onUsersSelect: (users: User[]) => void
  selectedUsers: User[]
  mode: 'single' | 'multiple'
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  onUserSelect,
  onUsersSelect,
  selectedUsers,
  mode
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [membershipFilter, setMembershipFilter] = useState<string>('all')

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, membershipFilter])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('users') // Adjust table name based on your schema
        .select('id, name, email, phone, membership_type, membership_expiry, created_at')
        .order('name')

      if (error) {
        console.error('Error loading users:', error)
        return
      }

      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm)
      )
    }

    // Apply membership filter
    if (membershipFilter !== 'all') {
      filtered = filtered.filter(user => user.membership_type === membershipFilter)
    }

    setFilteredUsers(filtered)
  }

  const handleUserSelect = (user: User) => {
    if (mode === 'single') {
      onUserSelect(user)
      setIsOpen(false)
    } else {
      const isSelected = selectedUsers.some(u => u.id === user.id)
      if (isSelected) {
        onUsersSelect(selectedUsers.filter(u => u.id !== user.id))
      } else {
        onUsersSelect([...selectedUsers, user])
      }
    }
  }

  const isUserSelected = (user: User) => {
    return selectedUsers.some(u => u.id === user.id)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          {mode === 'single' ? (
            <>
              <User className="h-4 w-4 mr-2" />
              {selectedUsers.length > 0 ? selectedUsers[0].name : 'Select User'}
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              {selectedUsers.length > 0 ? `${selectedUsers.length} users selected` : 'Select Users'}
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'single' ? 'Select User' : 'Select Users'}
          </DialogTitle>
          <DialogDescription>
            Choose {mode === 'single' ? 'a user' : 'users'} to send SMS notifications to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={membershipFilter} onValueChange={setMembershipFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by membership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Memberships</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selected Users Display */}
          {mode === 'multiple' && selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Users ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                    {user.name}
                    <button
                      onClick={() => handleUserSelect(user)}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No users found</div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      isUserSelected(user) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{user.name}</span>
                          {user.membership_type && (
                            <Badge variant="outline">{user.membership_type}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </div>
                        </div>
                      </div>
                      {isUserSelected(user) && (
                        <div className="text-blue-600">✓</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            {mode === 'multiple' && (
              <Button onClick={() => setIsOpen(false)} disabled={selectedUsers.length === 0}>
                Done ({selectedUsers.length} selected)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
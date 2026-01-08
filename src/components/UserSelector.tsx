// src/components/UserSelector.tsx
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, User as UserIcon, Users as UsersIcon, Phone, Mail } from 'lucide-react'
import { smsService } from '@/services/smsService'
import { useGym } from '@/contexts/GymContext'
import type { User } from '@/types/db'

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
  const { gym } = useGym()
  const [isOpen, setIsOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [membershipFilter, setMembershipFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all') // new: all | member | admin | trainer | receptionist | ...
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (isOpen) {
      loadPackages()
      loadRoles()
      loadUsersOrStaff() // initial load
    }
  }, [isOpen])

  useEffect(() => {
    // whenever filters change, if userType changed we reload the source list
    if (userTypeFilter === 'member') {
      loadUsersOrStaff()
    } else if (userTypeFilter === 'all') {
      loadUsersOrStaff()
    } else {
      // a staff role (admin, trainer, receptionist, etc.)
      loadUsersOrStaff()
    }
  }, [userTypeFilter])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, membershipFilter, statusFilter, userTypeFilter])

  const loadPackages = async () => {
    const res = await smsService.getPackages(gym?.id)
    if (res.success) setPackages(res.data || [])
    else setPackages([])
  }

  const loadRoles = async () => {
    const res = await smsService.getRoles()
    if (res.success) setRoles(res.data || [])
    else setRoles([])
  }

  const loadUsersOrStaff = async () => {
    setIsLoading(true)
    try {
      if (userTypeFilter === 'all' || userTypeFilter === 'member') {
        const res = await smsService.searchUsers('', 200, gym?.id)
        if (res.success) setUsers(res.data || [])
        else setUsers([])
      } else {
        // treat userTypeFilter as a role name for staff
        const roleName = userTypeFilter
        const res = await smsService.getStaffByRole(roleName, gym?.id)
        if (res.success) setUsers(res.data || [])
        else setUsers([])
      }
    } catch (err) {
      console.error('Error loading users/staff:', err)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  const normalize = (s?: string | null) => (s ?? '').toString().toLowerCase().trim()

  const filterUsers = () => {
    let filtered = users.slice()

    // search
    if (searchTerm && searchTerm.trim() !== '') {
      const term = normalize(searchTerm)
      filtered = filtered.filter(user =>
        (normalize(user.full_name).includes(term)) ||
        (normalize(user.email).includes(term)) ||
        (normalize(user.phone).includes(term))
      )
    }

    // membership filter by package name
    if (membershipFilter !== 'all') {
      filtered = filtered.filter(user => normalize(user.membership_type) === membershipFilter.toLowerCase())
    }

    // status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => normalize(user.status) === statusFilter.toLowerCase())
    }

    setFilteredUsers(filtered)
  }

  const handleUserSelect = (user: User) => {
    if (mode === 'single') {
      onUserSelect(user)
      setIsOpen(false)
    } else {
      const isSelected = selectedUsers.some(u => u.id === user.id)
      if (isSelected) onUsersSelect(selectedUsers.filter(u => u.id !== user.id))
      else onUsersSelect([...selectedUsers, user])
    }
  }

  const isUserSelected = (user: User) => selectedUsers.some(u => u.id === user.id)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          {mode === 'single' ? (
            <>
              <UserIcon className="h-4 w-4 mr-2" />
              {selectedUsers.length > 0 ? selectedUsers[0].full_name : 'Select User'}
            </>
          ) : (
            <>
              <UsersIcon className="h-4 w-4 mr-2" />
              {selectedUsers.length > 0 ? `${selectedUsers.length} users selected` : 'Select Users'}
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{mode === 'single' ? 'Select User' : 'Select Users'}</DialogTitle>
          <DialogDescription>Choose {mode === 'single' ? 'a user' : 'users'} to send SMS to</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search by name, email or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>

            {/* Membership packages */}
            <Select value={membershipFilter} onValueChange={setMembershipFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Membership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Memberships</SelectItem>
                {packages.map(p => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* User type filter (member or staff roles) */}
            <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="User type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                {/* dynamic staff roles */}
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected users (multiple) */}
          {mode === 'multiple' && selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Users ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(u => (
                  <Badge key={u.id} variant="secondary" className="flex items-center gap-1">
                    {u.full_name}
                    <button onClick={() => handleUserSelect(u)} className="ml-1 hover:bg-gray-300 rounded-full p-0.5" aria-label={`Remove ${u.full_name}`}>×</button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Users list */}
          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No users found</div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map(user => (
                  <div key={user.id} className={`p-4 hover:bg-gray-50 cursor-pointer ${isUserSelected(user) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`} onClick={() => handleUserSelect(user)} role="button" tabIndex={0}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{user.full_name}</span>
                          {user.membership_type && <Badge variant="outline">{user.membership_type}</Badge>}
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>{user.status ?? 'unknown'}</Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email ?? '—'}</div>
                          <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {user.phone ?? '—'}</div>
                        </div>

                        {user.membership_expiry && <div className="text-xs text-gray-400">Expires: {new Date(user.membership_expiry).toLocaleDateString()}</div>}
                      </div>

                      {isUserSelected(user) && <div className="text-blue-600">✓</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            {mode === 'multiple' && <Button onClick={() => setIsOpen(false)} disabled={selectedUsers.length === 0}>Done ({selectedUsers.length} selected)</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UserSelector


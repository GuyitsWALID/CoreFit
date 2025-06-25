
import React from 'react';
import { Bell, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {/*Welcome back, either Admin,.....*/}
        <p className="text-gray-500 text-sm">Welcome back, Admin</p>
      </div>
      
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Below this the mock notifications has to be replaced by actual notification fetched fromt the database
            * notification types should be discussed that are relavant to user */}
            <DropdownMenuItem className="py-2 cursor-pointer">
              <div className="flex flex-col gap-1">
                <span className="font-medium">John Doe's membership is expiring</span>
                <span className="text-sm text-gray-500">Membership expires in 3 days</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2 cursor-pointer">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Sara Smith's membership is expiring</span>
                <span className="text-sm text-gray-500">Membership expires in 4 days</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2 cursor-pointer">
              <div className="flex flex-col gap-1">
                <span className="font-medium">5 new check-ins today</span>
                <span className="text-sm text-gray-500">Check the daily report</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <div className="bg-fitness-primary text-white rounded-full p-1">
                <User size={18} />
              </div>
              <span>Admin User</span>
            </Button>
            {/*This all menu labels should be functional and redirect user and logout as well*/}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-500">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

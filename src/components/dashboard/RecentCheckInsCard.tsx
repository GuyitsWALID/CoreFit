
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CheckIn {
  id: string;
  name: string;
  time: string;
  package: string;
  avatarUrl?: string;
}

interface RecentCheckInsCardProps {
  checkIns: CheckIn[];
}

export function RecentCheckInsCard({ checkIns }: RecentCheckInsCardProps) {
  return (
    <Card className="col-span-2 lg:col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Check-Ins</CardTitle>
        <Button variant="outline" size="sm">View All</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checkIns.length > 0 ? (
            checkIns.map((checkIn) => (
              <div key={checkIn.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border">
                <Avatar>
                  <AvatarImage src={checkIn.avatarUrl} />
                  <AvatarFallback className="bg-fitness-primary text-white">
                    {checkIn.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="font-medium">{checkIn.name}</h4>
                  <p className="text-sm text-gray-500">{checkIn.package}</p>
                </div>
                <p className="text-sm text-gray-500">{checkIn.time}</p>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No recent check-ins</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

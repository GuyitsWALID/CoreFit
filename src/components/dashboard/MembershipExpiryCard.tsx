
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Member {
  id: string;
  name: string;
  expiryDays: number;
  package: string;
}

interface MembershipExpiryCardProps {
  members: Member[];
}

export function MembershipExpiryCard({ members }: MembershipExpiryCardProps) {
  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Memberships Expiring Soon</CardTitle>
        <Button variant="outline" size="sm">View All</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {members.length > 0 ? (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                <div>
                  <h4 className="font-medium">{member.name}</h4>
                  <p className="text-sm text-gray-500">{member.package}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.expiryDays <= 3 ? "destructive" : "outline"}>
                    {member.expiryDays} days left
                  </Badge>
                  <Button size="sm">Notify</Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No memberships expiring soon</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

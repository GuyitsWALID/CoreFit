import React from "react";

interface StatsCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  iconColor?: string;
}

export function StatsCard({ title, value, description, icon, iconColor = "text-gray-500" }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border p-6 flex flex-col gap-2">
      <div className={`flex items-center gap-2 ${iconColor} text-sm`}>
        {title} {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-gray-400">{description}</div>
    </div>
  );
}

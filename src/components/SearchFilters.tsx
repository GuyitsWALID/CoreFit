import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SearchFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  packageFilter: string;
  setPackageFilter: (value: string) => void;
  packageTypes: string[];
  sortOrder: 'asc' | 'desc' | 'none';
  onSort: () => void;
}

export function SearchFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  packageFilter,
  setPackageFilter,
  packageTypes,
  sortOrder,
  onSort
}: SearchFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
      <Input
        type="search"
        placeholder="Search by name, email, or phone..."
        className="w-full md:w-96"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
          <SelectItem value="paused">Paused</SelectItem>
        </SelectContent>
      </Select>
      <Select value={packageFilter} onValueChange={setPackageFilter}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Packages" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Packages</SelectItem>
          {packageTypes.map((pkg) => (
            <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button 
        variant="outline" 
        onClick={onSort}
        className="flex items-center gap-2"
      >
        {sortOrder === 'none' && 'Sort A-Z'}
        {sortOrder === 'asc' && 'Sort Z-A'}
        {sortOrder === 'desc' && 'Clear Sort'}
        {sortOrder === 'asc' && <span className="text-xs">↑</span>}
        {sortOrder === 'desc' && <span className="text-xs">↓</span>}
      </Button>
    </div>
  );
}

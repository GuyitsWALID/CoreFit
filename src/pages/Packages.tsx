import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Archive, Grid3X3, List } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from "@/supabaseClient";

interface Package {
  id: string;
  name: string;
  price: number;
  duration_value: number;
  duration_unit: string;
  access_level: string;
  number_of_pauses: number;
  requires_trainer: boolean;
  description?: string;
  created_at: string;
  archived: boolean;
}

export default function Packages() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('card');
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    price: "",
    duration_value: "",
    duration_unit: "months",
    access_level: "off_peak_hours",
    number_of_pauses: "0",
    requires_trainer: false,
    description: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch packages from database
  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching packages:', error);
        toast({
          title: "Error loading packages",
          description: "Could not load packages from database",
          variant: "destructive"
        });
      } else {
        setPackages(data || []);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      price: "",
      duration_value: "",
      duration_unit: "months",
      access_level: "off_peak_hours",
      number_of_pauses: "0",
      requires_trainer: false,
      description: ""
    });
    setIsEditing(false);
  };

  const handleEdit = (pkg: Package) => {
    setFormData({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price.toString(),
      duration_value: pkg.duration_value.toString(),
      duration_unit: pkg.duration_unit,
      access_level: pkg.access_level,
      number_of_pauses: pkg.number_of_pauses.toString(),
      requires_trainer: pkg.requires_trainer,
      description: pkg.description || ""
    });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleArchive = async (id: string, isArchived: boolean) => {
    try {
      const { error } = await supabase
        .from('packages')
        .update({ archived: !isArchived })
        .eq('id', id);

      if (error) {
        toast({
          title: "Operation failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setPackages(packages.map(pkg => 
          pkg.id === id ? { ...pkg, archived: !isArchived } : pkg
        ));
        toast({
          title: isArchived ? "Package restored" : "Package archived",
          description: `The package has been ${isArchived ? 'restored' : 'archived'} successfully.`,
        });
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast({
        title: "Operation failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', id);

      if (error) {
        toast({
          title: "Delete failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setPackages(packages.filter(pkg => pkg.id !== id));
        toast({
          title: "Package deleted",
          description: "The package has been successfully deleted.",
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const packageData = {
      name: formData.name,
      price: parseFloat(formData.price),
      duration_value: parseInt(formData.duration_value),
      duration_unit: formData.duration_unit,
      access_level: formData.access_level,
      number_of_pauses: parseInt(formData.number_of_pauses),
      requires_trainer: formData.requires_trainer,
      description: formData.description || null
    };

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('packages')
          .update(packageData)
          .eq('id', formData.id);

        if (error) {
          toast({
            title: "Update failed",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Package updated",
          description: "The package details have been updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from('packages')
          .insert([packageData]);

        if (error) {
          toast({
            title: "Creation failed",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Package created",
          description: "New package has been added successfully.",
        });
      }

      resetForm();
      setDialogOpen(false);
      fetchPackages(); // Refresh the list
    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: "Operation failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const filteredPackages = packages.filter(pkg => 
    activeTab === 'active' ? !pkg.archived : pkg.archived
  );

  const renderPackageCard = (pkg: Package) => (
    <Card key={pkg.id} className="transition-all hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {pkg.name}
          {pkg.archived && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              Archived
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {pkg.duration_value} {pkg.duration_unit} • {pkg.access_level === 'peak_hours' ? 'Peak Hours' : 'Off-Peak Hours'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold mb-3">${pkg.price}</p>
        {pkg.description && (
          <p className="text-gray-600 mb-4">{pkg.description}</p>
        )}
        <ul className="space-y-1 text-sm">
          <li className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-fitness-primary mr-2"></span>
            {pkg.access_level === 'peak_hours' ? 'Peak Hours Access' : 'Off-Peak Hours Access'}
          </li>
          <li className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-fitness-primary mr-2"></span>
            {pkg.number_of_pauses} pause{pkg.number_of_pauses !== 1 ? 's' : ''} allowed
          </li>
          <li className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-fitness-primary mr-2"></span>
            Duration: {pkg.duration_value} {pkg.duration_unit}
          </li>
          {pkg.requires_trainer && (
            <li className="flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-fitness-primary mr-2"></span>
              Trainer Required
            </li>
          )}
        </ul>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => handleEdit(pkg)}>
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button 
          variant={pkg.archived ? "default" : "secondary"} 
          size="sm" 
          onClick={() => handleArchive(pkg.id, pkg.archived)}
        >
          <Archive className="mr-1 h-4 w-4" /> 
          {pkg.archived ? 'Restore' : 'Archive'}
        </Button>
      </CardFooter>
    </Card>
  );

  const renderPackageList = (pkg: Package) => (
    <div key={pkg.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">{pkg.name}</h3>
          {pkg.archived && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              Archived
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-fitness-primary mb-1">${pkg.price}</p>
        <p className="text-sm text-gray-600">
          {pkg.duration_value} {pkg.duration_unit} • {pkg.access_level === 'peak_hours' ? 'Peak Hours' : 'Off-Peak Hours'}
          {pkg.requires_trainer && ' • Trainer Required'}
        </p>
        {pkg.description && (
          <p className="text-sm text-gray-500 mt-2">{pkg.description}</p>
        )}
      </div>
      <div className="flex gap-2 ml-4">
        <Button variant="outline" size="sm" onClick={() => handleEdit(pkg)}>
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button 
          variant={pkg.archived ? "default" : "secondary"} 
          size="sm" 
          onClick={() => handleArchive(pkg.id, pkg.archived)}
        >
          <Archive className="mr-1 h-4 w-4" /> 
          {pkg.archived ? 'Restore' : 'Archive'}
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Membership Packages</h2>
        <div className="text-center py-8">Loading packages...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Membership Packages</h2>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-fitness-primary hover:bg-fitness-primary/90 text-white" onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Add New Package
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Package" : "Create New Package"}</DialogTitle>
              <DialogDescription>
                {isEditing ? "Make changes to the package details." : "Add a new membership package."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-3">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-sm">Package Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. Premium Membership"
                    className="h-9"
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="price" className="text-sm">Price ($)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    placeholder="29.99"
                    className="h-9"
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="duration_value" className="text-sm">Duration</Label>
                  <div className="flex gap-2">
                    <Input
                      id="duration_value"
                      name="duration_value"
                      type="number"
                      value={formData.duration_value}
                      onChange={handleInputChange}
                      className="flex-1 h-9"
                      required
                      placeholder="1"
                    />
                    <select
                      name="duration_unit"
                      value={formData.duration_unit}
                      onChange={handleInputChange}
                      className="flex-1 px-3 py-1 h-9 border border-gray-300 rounded-md bg-white text-sm"
                      required
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="access_level" className="text-sm">Access Level</Label>
                  <select
                    id="access_level"
                    name="access_level"
                    value={formData.access_level}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1 h-9 border border-gray-300 rounded-md bg-white text-sm"
                    required
                  >
                    <option value="off_peak_hours">Off-Peak Hours</option>
                    <option value="peak_hours">Peak Hours</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="number_of_pauses" className="text-sm">Pauses Allowed</Label>
                  <Input
                    id="number_of_pauses"
                    name="number_of_pauses"
                    type="number"
                    min="0"
                    value={formData.number_of_pauses}
                    onChange={handleInputChange}
                    required
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                
                <div className="flex items-center justify-between py-1">
                  <Label htmlFor="requires_trainer" className="text-sm font-normal">
                    Requires Trainer
                  </Label>
                  <div className="relative">
                    <input
                      id="requires_trainer"
                      name="requires_trainer"
                      type="checkbox"
                      checked={formData.requires_trainer}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                        formData.requires_trainer ? 'bg-fitness-primary' : 'bg-gray-300'
                      }`}
                      onClick={() => handleInputChange({
                        target: {
                          name: 'requires_trainer',
                          type: 'checkbox',
                          checked: !formData.requires_trainer
                        }
                      } as any)}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          formData.requires_trainer ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="description" className="text-sm">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Package description (optional)"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="pt-3">
                <Button variant="outline" type="button" size="sm" onClick={() => {
                  resetForm();
                  setDialogOpen(false);
                }}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-fitness-primary hover:bg-fitness-primary/90 text-white">
                  {isEditing ? "Update Package" : "Create Package"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button
              variant={displayMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('card')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={displayMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDisplayMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="active">
          {displayMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPackages.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No active packages found. Create your first package to get started.
                </div>
              ) : (
                filteredPackages.map(renderPackageCard)
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPackages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No active packages found. Create your first package to get started.
                </div>
              ) : (
                filteredPackages.map(renderPackageList)
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived">
          {displayMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPackages.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No archived packages found.
                </div>
              ) : (
                filteredPackages.map(renderPackageCard)
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPackages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No archived packages found.
                </div>
              ) : (
                filteredPackages.map(renderPackageList)
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

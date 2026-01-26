import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import {
  Button
} from '@/components/ui/button';
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
import { supabase } from "@/lib/supabaseClient";
import { useGym } from "@/contexts/GymContext";
import { DynamicHeader } from "@/components/layout/DynamicHeader";
import { Sidebar } from "@/components/layout/Sidebar";

interface Package {
  id: string;
  name: string;
  price: number;
  duration_value: number;
  duration_unit: string;
  access_level: string;
  number_of_passes: number;
  requires_trainer: boolean;
  description?: string;
  created_at: string;
  archived: boolean;
  gym_id?: string;
}

interface AccessLevelType {
  value: string;
  label: string;
}

export default function Packages() {
  const { toast } = useToast();
  const { gym, loading: gymLoading } = useGym();
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('card');
  const [nameError, setNameError] = useState('');
  const [accessLevelTypes, setAccessLevelTypes] = useState<AccessLevelType[]>([]);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    price: "",
    duration_value: "",
    duration_unit: "months",
    access_level: "", // Initialize as empty string
    number_of_passes: "0",
    requires_trainer: false,
    description: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dynamic styling based on gym configuration
  const dynamicStyles = useMemo(() => {
    if (!gym) return {
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#f59e0b',
    };
    
    const primaryColor = gym.brand_color || '#2563eb';
    return {
      primaryColor: primaryColor,
      secondaryColor: primaryColor,
      accentColor: primaryColor,
    };
  }, [gym]);

  // Fetch packages and access level types from database
  useEffect(() => {
    if (gym && gym.id !== 'default') {
      fetchPackages();
      fetchAccessLevelTypes();
    }
  }, [gym]);

  const fetchPackages = async () => {
    if (!gym || gym.id === 'default') return;
    
    try {
      let query = supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by gym_id if gym context is available
      if (gym && gym.id !== 'default') {
        query = query.eq('gym_id', gym.id);
      }

      const { data, error } = await query;

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

  const fetchAccessLevelTypes = async () => {
    try {
      // Use the correct enum values from your database
      const types = [
        { value: 'all_hours', label: 'All Hours' },
        { value: 'peak_hours', label: 'Peak Hours' },
        { value: 'off_peak_hours', label: 'Off Peak Hours' },
      ];
      
      setAccessLevelTypes(types);
      if (types.length > 0 && !formData.access_level) {
        setFormData(prev => ({ ...prev, access_level: types[0].value }));
      }
    } catch (error) {
      console.error('Unexpected error fetching access level types:', error);
    }
  };

  const checkDuplicateName = (name: string) => {
    if (!name.trim()) {
      setNameError('');
      return;
    }

    const trimmedName = name.trim().toLowerCase();
    const isDuplicate = packages.some(pkg => 
      pkg.name.toLowerCase() === trimmedName && 
      (!isEditing || pkg.id !== formData.id) 
    );

    if (isDuplicate) {
      setNameError('A package with this name already exists');
    } else {
      setNameError('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData({
      ...formData,
      [name]: newValue
    });

    if (name === 'name') {
      checkDuplicateName(value);
    }
  };

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      price: "",
      duration_value: "",
      duration_unit: "months",
      access_level: accessLevelTypes.length > 0 ? accessLevelTypes[0].value : "",
      number_of_passes: "0",
      requires_trainer: false,
      description: ""
    });
    setIsEditing(false);
    setNameError('');
  };

  const handleEdit = (pkg: Package) => {
    setFormData({
      id: pkg.id,
      name: pkg.name || "",
      price: (pkg.price || 0).toString(),
      duration_value: (pkg.duration_value || 0).toString(),
      duration_unit: pkg.duration_unit || "months",
      access_level: pkg.access_level || (accessLevelTypes.length > 0 ? accessLevelTypes[0].value : ""),
      number_of_passes: (pkg.number_of_passes || 0).toString(),
      requires_trainer: pkg.requires_trainer || false,
      description: pkg.description || ""
    });
    setIsEditing(true);
    setNameError('');
    setDialogOpen(true);
  };

  const handleArchive = async (id: string, isArchived: boolean) => {
    try {
      const { error } = await supabase
        .from('packages')
        .update({ archived: !isArchived })
        .eq('id', id)
        .eq('gym_id', gym?.id); // Ensure package belongs to this gym

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
        .eq('id', id)
        .eq('gym_id', gym?.id); // Ensure package belongs to this gym

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
    
    if (!gym || gym.id === 'default') {
      toast({
        title: "Gym context required",
        description: "Please ensure you're accessing this page from a specific gym context.",
        variant: "destructive"
      });
      return;
    }
    
    if (nameError) {
      toast({
        title: "Validation Error",
        description: "Please fix the name error before submitting.",
        variant: "destructive"
      });
      return;
    }

    const packageData = {
      name: formData.name.trim(),
      price: parseFloat(formData.price),
      duration_value: parseInt(formData.duration_value),
      duration_unit: formData.duration_unit,
      access_level: formData.access_level,
      number_of_passes: parseInt(formData.number_of_passes),
      requires_trainer: formData.requires_trainer,
      description: formData.description.trim() || null,
      gym_id: gym.id // Add gym_id to associate package with current gym
    };

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('packages')
          .update(packageData)
          .eq('id', formData.id)
          .eq('gym_id', gym.id); // Ensure package belongs to this gym

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
          description: `Package updated successfully for ${gym.name}.`,
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
          description: `New package has been added to ${gym.name} successfully.`,
        });
      }

      resetForm();
      setDialogOpen(false);
      fetchPackages(); 
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
    <Card key={pkg.id} className="transition-all hover:shadow-md" style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between" style={{ color: dynamicStyles.primaryColor }}>
          {pkg.name}
          {pkg.archived && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              Archived
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {pkg.duration_value} {pkg.duration_unit} • {accessLevelTypes.find(type => type.value === pkg.access_level)?.label || pkg.access_level}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold mb-3" style={{ color: dynamicStyles.primaryColor }}>{pkg.price} ETB</p>
        {pkg.description && (
          <p className="text-gray-600 mb-4">{pkg.description}</p>
        )}
        <ul className="space-y-1 text-sm">
          <li className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full mr-2" style={{ backgroundColor: dynamicStyles.primaryColor }}></span>
            {accessLevelTypes.find(type => type.value === pkg.access_level)?.label || pkg.access_level} Access
          </li>
          <li className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full mr-2" style={{ backgroundColor: dynamicStyles.primaryColor }}></span>
            {pkg.number_of_passes} pass{pkg.number_of_passes !== 1 ? 'es' : ''} allowed
          </li>
          <li className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full mr-2" style={{ backgroundColor: dynamicStyles.primaryColor }}></span>
            Duration: {pkg.duration_value} {pkg.duration_unit}
          </li>
          {pkg.requires_trainer && (
            <li className="flex items-center">
              <span className="h-1.5 w-1.5 rounded-full mr-2" style={{ backgroundColor: dynamicStyles.primaryColor }}></span>
              Trainer Required
            </li>
          )}
        </ul>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleEdit(pkg)}
          style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
        >
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button 
          variant={pkg.archived ? "default" : "secondary"} 
          size="sm" 
          onClick={() => handleArchive(pkg.id, pkg.archived)}
          style={pkg.archived ? { backgroundColor: dynamicStyles.primaryColor } : {}}
        >
          <Archive className="mr-1 h-4 w-4" /> 
          {pkg.archived ? 'Restore' : 'Archive'}
        </Button>
      </CardFooter>
    </Card>
  );

  const renderPackageList = (pkg: Package) => (
    <div key={pkg.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors" style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold" style={{ color: dynamicStyles.primaryColor }}>{pkg.name}</h3>
          {pkg.archived && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              Archived
            </span>
          )}
        </div>
        <p className="text-2xl font-bold mb-1" style={{ color: dynamicStyles.primaryColor }}>{pkg.price} ETB</p>
        <p className="text-sm text-gray-600">
          {pkg.duration_value} {pkg.duration_unit} • {accessLevelTypes.find(type => type.value === pkg.access_level)?.label || pkg.access_level}
          {pkg.requires_trainer && ' • Trainer Required'}
        </p>
        {pkg.description && (
          <p className="text-sm text-gray-500 mt-2">{pkg.description}</p>
        )}
      </div>
      <div className="flex gap-2 ml-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleEdit(pkg)}
          style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
        >
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button 
          variant={pkg.archived ? "default" : "secondary"} 
          size="sm" 
          onClick={() => handleArchive(pkg.id, pkg.archived)}
          style={pkg.archived ? { backgroundColor: dynamicStyles.primaryColor } : {}}
        >
          <Archive className="mr-1 h-4 w-4" /> 
          {pkg.archived ? 'Restore' : 'Archive'}
        </Button>
      </div>
    </div>
  );

  // Loading state
  if (gymLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gym || gym.id === 'default') {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <h2 className="text-xl font-semibold mb-2">Gym Context Required</h2>
                <p className="text-gray-600 mb-4">
                  This page requires a specific gym context. Please access it from a gym-specific URL.
                </p>
                <Button onClick={() => window.location.href = '/admin/dashboard'}>
                  Go to Admin Dashboard
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-center text-gray-500">
              Loading packages for {gym?.name || 'gym'}...
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="animate-fade-in p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 
                  className="text-3xl font-bold tracking-tight"
                  style={{ color: dynamicStyles.primaryColor }}
                >
                  Membership Packages
                </h2>
                <p className="text-gray-500 mt-1">
                  Manage membership packages for {gym?.name || 'your gym'}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="text-white" 
                      onClick={resetForm}
                      style={{ backgroundColor: dynamicStyles.primaryColor }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add New Package
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[525px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle style={{ color: dynamicStyles.primaryColor }}>
                        {isEditing ? "Edit Package" : "Create New Package"}
                      </DialogTitle>
                      <DialogDescription>
                        {isEditing ? "Make changes to the package details." : `Add a new membership package to ${gym.name}.`}
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
                            className={`h-9 ${nameError ? 'border-red-500 focus:border-red-500' : ''}`}
                          />
                          {nameError && (
                            <p className="text-sm text-red-500 mt-1">{nameError}</p>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="price" className="text-sm">Price (ETB)</Label>
                          <Input
                            id="price"
                            name="price"
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={handleInputChange}
                            required
                            placeholder="1500.00"
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
                            {accessLevelTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="number_of_passes" className="text-sm">Number of Passes</Label>
                          <Input
                            id="number_of_passes"
                            name="number_of_passes"
                            type="number"
                            value={formData.number_of_passes}
                            onChange={handleInputChange}
                            placeholder="0"
                            className="h-9"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="requires_trainer"
                            name="requires_trainer"
                            checked={formData.requires_trainer}
                            onChange={handleInputChange}
                            className="h-4 w-4 rounded"
                            style={{ accentColor: dynamicStyles.primaryColor }}
                          />
                          <Label htmlFor="requires_trainer" className="text-sm">Requires Trainer</Label>
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="description" className="text-sm">Description (optional)</Label>
                          <Textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Package description (optional)"
                            className="min-h-[80px]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          className="text-white" 
                          disabled={!!nameError}
                          style={{ backgroundColor: dynamicStyles.primaryColor }}
                        >
                          {isEditing ? "Save Changes" : "Create Package"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <div className="flex items-center gap-2">
                  <Button 
                    variant={displayMode === 'card' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setDisplayMode('card')}
                    style={displayMode === 'card' ? { backgroundColor: dynamicStyles.primaryColor } : {}}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={displayMode === 'list' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setDisplayMode('list')}
                    style={displayMode === 'list' ? { backgroundColor: dynamicStyles.primaryColor } : {}}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-fit grid-cols-2">
                <TabsTrigger 
                  value="active"
                  style={activeTab === 'active' ? { backgroundColor: dynamicStyles.primaryColor, color: 'white' } : {}}
                >
                  Active Packages
                </TabsTrigger>
                <TabsTrigger 
                  value="archived"
                  style={activeTab === 'archived' ? { backgroundColor: dynamicStyles.primaryColor, color: 'white' } : {}}
                >
                  Archived Packages
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                {filteredPackages.length === 0 && !isLoading ? (
                  <div className="text-center text-gray-500 py-8">
                    No active packages found for {gym.name}. Create your first package to get started!
                  </div>
                ) : (
                  <div className={`${displayMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}`}>
                    {filteredPackages.map(pkg => 
                      displayMode === 'card' ? renderPackageCard(pkg) : renderPackageList(pkg)
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="archived">
                {filteredPackages.length === 0 && !isLoading ? (
                  <div className="text-center text-gray-500 py-8">
                    No archived packages found for {gym.name}.
                  </div>
                ) : (
                  <div className={`${displayMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}`}>
                    {filteredPackages.map(pkg => 
                      displayMode === 'card' ? renderPackageCard(pkg) : renderPackageList(pkg)
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}


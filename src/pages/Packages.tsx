
import React, { useState } from 'react';
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
import { Plus, Edit, Trash2 } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  duration: string;
  price: string;
  description: string;
  features: string[];
}

// Mock data
const initialPackages: Package[] = [
  {
    id: "1",
    name: "Basic Membership",
    duration: "1 Month",
    price: "$30",
    description: "Access to gym facilities during regular hours.",
    features: ["Gym Access", "Locker Room"]
  },
  {
    id: "2",
    name: "Silver Membership",
    duration: "3 Months",
    price: "$75",
    description: "Access to gym facilities and group classes.",
    features: ["Gym Access", "Locker Room", "Group Classes"]
  },
  {
    id: "3",
    name: "Gold Membership",
    duration: "6 Months",
    price: "$140",
    description: "Full access to all gym facilities, classes, and one personal training session per month.",
    features: ["Gym Access", "Locker Room", "Group Classes", "1 PT Session/Month"]
  },
  {
    id: "4",
    name: "Premium Membership",
    duration: "12 Months",
    price: "$250",
    description: "Unlimited access to all gym services and amenities.",
    features: ["Gym Access", "Locker Room", "Group Classes", "2 PT Sessions/Month", "Nutrition Consultation"]
  }
];

export default function Packages() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>(initialPackages);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    duration: "",
    price: "",
    description: "",
    features: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      duration: "",
      price: "",
      description: "",
      features: ""
    });
    setIsEditing(false);
  };

  const handleEdit = (pkg: Package) => {
    setFormData({
      id: pkg.id,
      name: pkg.name,
      duration: pkg.duration,
      price: pkg.price,
      description: pkg.description,
      features: pkg.features.join(", ")
    });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setPackages(packages.filter(pkg => pkg.id !== id));
    toast({
      title: "Package deleted",
      description: "The package has been successfully deleted.",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPackage: Package = {
      id: isEditing ? formData.id : Date.now().toString(),
      name: formData.name,
      duration: formData.duration,
      price: formData.price,
      description: formData.description,
      features: formData.features.split(",").map(f => f.trim())
    };

    if (isEditing) {
      setPackages(packages.map(pkg => pkg.id === formData.id ? newPackage : pkg));
      toast({
        title: "Package updated",
        description: "The package details have been updated successfully.",
      });
    } else {
      setPackages([...packages, newPackage]);
      toast({
        title: "Package created",
        description: "New package has been added successfully.",
      });
    }

    resetForm();
    setDialogOpen(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Membership Packages</h2>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-fitness-primary hover:bg-fitness-primary/90 text-white">
              <Plus className="mr-2 h-4 w-4" /> Add New Package
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Package" : "Create New Package"}</DialogTitle>
              <DialogDescription>
                {isEditing ? "Make changes to the package details." : "Add a new membership package."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="duration" className="text-right">Duration</Label>
                  <Input
                    id="duration"
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                    placeholder="e.g. 1 Month, 3 Months"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="price" className="text-right">Price</Label>
                  <Input
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                    placeholder="e.g. $30, $75"
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="description" className="text-right pt-2">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="features" className="text-right pt-2">Features</Label>
                  <Textarea
                    id="features"
                    name="features"
                    value={formData.features}
                    onChange={handleInputChange}
                    className="col-span-3"
                    required
                    placeholder="Add features separated by commas"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => {
                  resetForm();
                  setDialogOpen(false);
                }}>Cancel</Button>
                <Button type="submit" className="bg-fitness-primary hover:bg-fitness-primary/90 text-white">
                  {isEditing ? "Update Package" : "Create Package"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <Card key={pkg.id} className="transition-all hover:shadow-md">
            <CardHeader>
              <CardTitle>{pkg.name}</CardTitle>
              <CardDescription>{pkg.duration}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-3">{pkg.price}</p>
              <p className="text-gray-600 mb-4">{pkg.description}</p>
              <ul className="space-y-1">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-fitness-primary mr-2"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => handleEdit(pkg)}>
                <Edit className="mr-1 h-4 w-4" /> Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(pkg.id)}>
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

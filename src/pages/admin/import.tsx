import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { 
  Upload, 
  FileText, 
  Database, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Download,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Menu
} from 'lucide-react';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { getParser, SUPPORTED_FORMATS, ParseResult } from '@/utils/importParsers';
import { 
  importData, 
  autoDetectMappings, 
  TARGET_FIELDS,
  ImportConfig,
  ImportResult,
  ImportDataType,
  DuplicateHandling,
  FieldMapping
} from '@/services/importService';

interface Gym {
  id: string;
  name: string;
}

type ImportStep = 'config' | 'upload' | 'mapping' | 'preview' | 'import' | 'result';

export default function ImportPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Step management
  const [currentStep, setCurrentStep] = useState<ImportStep>('config');
  
  // Configuration
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('csv');
  const [selectedDataType, setSelectedDataType] = useState<ImportDataType>('users');
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>('skip');
  
  // File handling
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Field mapping
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  
  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Loading
  const [loading, setLoading] = useState(true);

  // Fetch gyms on mount
  useEffect(() => {
    const fetchGyms = async () => {
      const { data, error } = await supabase
        .from('gyms')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      
      if (!error && data) {
        setGyms(data);
        if (data.length > 0) {
          setSelectedGymId(data[0].id);
        }
      }
      setLoading(false);
    };
    
    fetchGyms();
  }, []);

  // Handle file drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [selectedFormat]);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
      
      // Debug: log first 500 chars
      console.log('File content preview:', content.substring(0, 500));
      console.log('Selected format:', selectedFormat);
      
      // Parse the file
      const parser = getParser(selectedFormat);
      const result = parser(content);
      
      // Debug: log parse result
      console.log('Parse result:', result);
      console.log('Headers found:', result.headers);
      console.log('Data count:', result.data?.length);
      
      setParseResult(result);
      
      if (result.success) {
        // Auto-detect field mappings
        const mappings = autoDetectMappings(result.headers, selectedDataType);
        console.log('Field mappings:', mappings);
        setFieldMappings(mappings);
        
        toast({
          title: 'File parsed successfully',
          description: `Found ${result.data.length} records with ${result.headers.length} columns: ${result.headers.join(', ')}`,
        });
      } else {
        toast({
          title: 'Parse Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Update field mapping
  const updateMapping = (targetField: string, sourceField: string) => {
    setFieldMappings(prev => 
      prev.map(m => 
        m.targetField === targetField 
          ? { ...m, sourceField } 
          : m
      )
    );
  };

  // Run import
  const runImport = async () => {
    if (!parseResult || !selectedGymId) return;
    
    setImporting(true);
    setImportProgress(0);
    setCurrentStep('import');
    
    const config: ImportConfig = {
      gymId: selectedGymId,
      dataType: selectedDataType,
      duplicateHandling,
      fieldMappings,
    };
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      const result = await importData(parseResult.data, config);
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setCurrentStep('result');
      
      if (result.success) {
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${result.imported} records`,
        });
      } else {
        toast({
          title: 'Import Completed with Errors',
          description: `Imported ${result.imported}, Failed ${result.failed}`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  // Reset import
  const resetImport = () => {
    setCurrentStep('config');
    setFile(null);
    setFileContent('');
    setParseResult(null);
    setFieldMappings([]);
    setImportResult(null);
    setImportProgress(0);
  };

  // Download template
  const downloadTemplate = () => {
    const targetFields = TARGET_FIELDS[selectedDataType];
    const headers = targetFields.map(f => f.field).join(',');
    const exampleRow = targetFields.map(f => {
      if (f.field === 'first_name') return 'John';
      if (f.field === 'last_name') return 'Doe';
      if (f.field === 'email') return 'john@example.com';
      if (f.field === 'phone') return '+251911234567';
      if (f.field === 'status') return 'active';
      if (f.field === 'gender') return 'male';
      if (f.field === 'name') return 'Basic Package';
      if (f.field === 'price') return '1000';
      if (f.field === 'duration') return '1';
      if (f.field === 'duration_unit') return 'months';
      return '';
    }).join(',');
    
    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDataType}_import_template.csv`;
    a.click();
  };

  // Navigation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'config':
        return !!selectedGymId && !!selectedDataType;
      case 'upload':
        return parseResult?.success;
      case 'mapping':
        const requiredFields = TARGET_FIELDS[selectedDataType].filter(f => f.required);
        return requiredFields.every(f => 
          fieldMappings.find(m => m.targetField === f.field && m.sourceField)
        );
      case 'preview':
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedGymId, selectedDataType, parseResult, fieldMappings]);

  const nextStep = () => {
    const steps: ImportStep[] = ['config', 'upload', 'mapping', 'preview', 'import', 'result'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: ImportStep[] = ['config', 'upload', 'mapping', 'preview', 'import', 'result'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Mobile Header */}
        {isMobile && (
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </Button>
            <h1 className="font-semibold text-lg text-blue-600">Super Admin</h1>
          </div>
        )}
        
        <div className="p-4 md:p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-blue-600">
                Import Data
              </h1>
              <p className="text-gray-500 mt-1">
                Import client data from cPanel exports into your gym
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(['config', 'upload', 'mapping', 'preview', 'result'] as ImportStep[]).map((step, index) => {
              const stepLabels = {
                config: 'Configure',
                upload: 'Upload',
                mapping: 'Map Fields',
                preview: 'Preview',
                result: 'Result',
              };
              const isActive = currentStep === step;
              const isPast = ['config', 'upload', 'mapping', 'preview', 'import', 'result'].indexOf(currentStep) > index;
              
              return (
                <React.Fragment key={step}>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    isActive ? 'bg-blue-600 text-white' : 
                    isPast ? 'bg-green-100 text-green-700' : 
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {isPast && !isActive ? <CheckCircle2 className="h-4 w-4" /> : null}
                    <span>{stepLabels[step]}</span>
                  </div>
                  {index < 4 && <ArrowRight className="h-4 w-4 text-gray-300" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Step Content */}
          <Card className="max-w-4xl mx-auto w-full">
            <CardContent className="p-6">
              
              {/* Step 1: Configuration */}
              {currentStep === 'config' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Import Configuration</h2>
                    <p className="text-gray-500 mb-6">Select the target gym, data type, and file format</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Target Gym *</label>
                      <Select value={selectedGymId} onValueChange={setSelectedGymId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a gym" />
                        </SelectTrigger>
                        <SelectContent>
                          {gyms.map(gym => (
                            <SelectItem key={gym.id} value={gym.id}>{gym.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Data Type *</label>
                      <Select value={selectedDataType} onValueChange={(v) => setSelectedDataType(v as ImportDataType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="users">Users / Members</SelectItem>
                          <SelectItem value="staff">Staff / Team</SelectItem>
                          <SelectItem value="packages">Packages</SelectItem>
                          <SelectItem value="check_ins">Check-ins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">File Format *</label>
                      <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_FORMATS.map(format => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label} - {format.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Duplicate Handling</label>
                      <Select value={duplicateHandling} onValueChange={(v) => setDuplicateHandling(v as DuplicateHandling)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip duplicates</SelectItem>
                          <SelectItem value="update">Update existing</SelectItem>
                          <SelectItem value="create_new">Create new anyway</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Upload */}
              {currentStep === 'upload' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Upload File</h2>
                    <p className="text-gray-500 mb-6">
                      Upload your {SUPPORTED_FORMATS.find(f => f.value === selectedFormat)?.label} file
                    </p>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? 'border-blue-500 bg-blue-50' : 
                      file ? 'border-green-500 bg-green-50' : 
                      'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    {file ? (
                      <div className="space-y-2">
                        <FileText className="h-12 w-12 mx-auto text-green-600" />
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {parseResult?.success 
                            ? `${parseResult.data.length} records found`
                            : parseResult?.error
                          }
                        </p>
                        <Button variant="outline" onClick={() => {
                          setFile(null);
                          setParseResult(null);
                        }}>
                          Choose Different File
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="h-12 w-12 mx-auto text-gray-400" />
                        <div>
                          <p className="font-medium">Drag and drop your file here</p>
                          <p className="text-sm text-gray-500">or click to browse</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          id="file-upload"
                          accept={SUPPORTED_FORMATS.find(f => f.value === selectedFormat)?.extension}
                          onChange={handleFileInputChange}
                        />
                        <Button asChild variant="outline">
                          <label htmlFor="file-upload" className="cursor-pointer">
                            Select File
                          </label>
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {parseResult?.error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Parse Error</p>
                        <p className="text-sm text-red-600">{parseResult.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Field Mapping */}
              {currentStep === 'mapping' && parseResult && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Map Fields</h2>
                    <p className="text-gray-500 mb-6">
                      Match your file columns to the database fields. Required fields are marked with *
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {TARGET_FIELDS[selectedDataType].map(target => {
                      const mapping = fieldMappings.find(m => m.targetField === target.field);
                      
                      return (
                        <div key={target.field} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium">{target.label}</span>
                            {target.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <Select 
                            value={mapping?.sourceField || '__none__'} 
                            onValueChange={(v) => updateMapping(target.field, v === '__none__' ? '' : v)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">-- Not mapped --</SelectItem>
                              {parseResult.headers.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Preview */}
              {currentStep === 'preview' && parseResult && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Preview Data</h2>
                    <p className="text-gray-500 mb-6">
                      Review the data before importing. Showing first 10 records.
                    </p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          {fieldMappings.filter(m => m.sourceField).map(m => (
                            <TableHead key={m.targetField}>{m.targetField}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseResult.data.slice(0, 10).map((record, index) => (
                          <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            {fieldMappings.filter(m => m.sourceField).map(m => (
                              <TableCell key={m.targetField}>
                                {record[m.sourceField] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">Ready to import</p>
                      <p className="text-sm text-blue-600">
                        {parseResult.data.length} records will be imported to{' '}
                        {gyms.find(g => g.id === selectedGymId)?.name}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Importing */}
              {currentStep === 'import' && (
                <div className="space-y-6 text-center py-8">
                  <RefreshCw className="h-16 w-16 mx-auto text-blue-600 animate-spin" />
                  <div>
                    <h2 className="text-xl font-semibold">Importing Data...</h2>
                    <p className="text-gray-500 mt-2">Please wait while we import your data</p>
                  </div>
                  <Progress value={importProgress} className="max-w-md mx-auto" />
                  <p className="text-sm text-gray-500">{importProgress}% complete</p>
                </div>
              )}

              {/* Step 6: Result */}
              {currentStep === 'result' && importResult && (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    {importResult.success ? (
                      <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
                    ) : (
                      <AlertCircle className="h-16 w-16 mx-auto text-yellow-600" />
                    )}
                    <h2 className="text-xl font-semibold mt-4">
                      {importResult.success ? 'Import Successful' : 'Import Completed with Issues'}
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{importResult.totalRecords}</div>
                        <div className="text-sm text-gray-500">Total Records</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                        <div className="text-sm text-gray-500">Imported</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                        <div className="text-sm text-gray-500">Skipped</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                        <div className="text-sm text-gray-500">Failed</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {importResult.errors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h3 className="font-medium text-red-800 mb-2">Errors ({importResult.errors.length})</h3>
                      <ul className="text-sm text-red-600 space-y-1 max-h-40 overflow-y-auto">
                        {importResult.errors.slice(0, 20).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                        {importResult.errors.length > 20 && (
                          <li>... and {importResult.errors.length - 20} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex justify-center">
                    <Button onClick={resetImport}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Import More Data
                    </Button>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              {!['import', 'result'].includes(currentStep) && (
                <div className="flex justify-between mt-8 pt-6 border-t">
                  <Button 
                    variant="outline" 
                    onClick={prevStep}
                    disabled={currentStep === 'config'}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  
                  {currentStep === 'preview' ? (
                    <Button onClick={runImport} disabled={!canProceed}>
                      <Database className="h-4 w-4 mr-2" />
                      Start Import
                    </Button>
                  ) : (
                    <Button onClick={nextStep} disabled={!canProceed}>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

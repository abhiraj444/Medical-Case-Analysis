'use client';

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { aiDiagnosis, type AiDiagnosisOutput } from '@/ai/flows/ai-diagnosis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DiagnosisCard } from '@/components/DiagnosisCard';
import { Bot, FileText, Loader2, Mic, Upload } from 'lucide-react';

export default function DiagnosisPage() {
  const [patientData, setPatientData] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AiDiagnosisOutput | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patientData.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter patient history and clinical questions.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResults(null);

    try {
      const supportingDocuments = await Promise.all(files.map(fileToDataUri));
      const diagnosisResults = await aiDiagnosis({
        patientData,
        supportingDocuments,
      });
      setResults(diagnosisResults);
    } catch (error) {
      console.error('Diagnosis failed:', error);
      toast({
        title: 'An Error Occurred',
        description:
          'Failed to get diagnosis. Please check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="text-primary" />
              Patient Information
            </CardTitle>
            <CardDescription>
              Provide clinical questions and patient history. You can also
              upload supporting documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="patient-data">
                  Clinical Questions & Patient History
                </Label>
                <Textarea
                  id="patient-data"
                  placeholder="e.g., A 58-year-old male presents with a two-week history of persistent, dry cough..."
                  className="min-h-[200px]"
                  value={patientData}
                  onChange={(e) => setPatientData(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documents">Supporting Documents</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="documents"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    disabled={isLoading}
                  />
                  <Button variant="outline" size="icon" disabled>
                    <Mic className="h-4 w-4" />
                    <span className="sr-only">Use voice input</span>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload PDFs or JPGs.
                </p>
                {files.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="text-sm text-muted-foreground"
                      >
                        - {file.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Analyze and Diagnose
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="text-primary" />
                AI Diagnosis Results
              </CardTitle>
              <CardDescription>
                Provisional diagnoses based on the provided data.
              </CardDescription>
            </CardHeader>
          </Card>
          
          {isLoading && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
              <Card>
                 <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            </div>
          )}

          {!isLoading && results && (
            <div className="space-y-4">
              {results.length > 0 ? (
                results.map((diag, index) => (
                  <DiagnosisCard key={index} diagnosis={diag} />
                ))
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">
                      No diagnoses could be determined. Please provide more detailed information.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          {!isLoading && !results && (
             <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    Results will appear here after analysis.
                  </p>
                </CardContent>
              </Card>
          )}

        </div>
      </div>
    </div>
  );
}

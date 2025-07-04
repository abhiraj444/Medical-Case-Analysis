'use client';

import { useState, type ChangeEvent, type ClipboardEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { aiDiagnosis, type AiDiagnosisOutput } from '@/ai/flows/ai-diagnosis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DiagnosisCard } from '@/components/DiagnosisCard';
import { Bot, FileText, Loader2, Upload, PlusCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export default function DiagnosisPage() {
  const [patientData, setPatientData] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AiDiagnosisOutput | null>(null);
  
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const caseId = searchParams.get('caseId');
    if (caseId && user) {
      const loadCase = async () => {
        setIsLoading(true);
        try {
          const caseRef = doc(db, 'cases', caseId);
          const caseSnap = await getDoc(caseRef);
          if (caseSnap.exists() && caseSnap.data().userId === user.uid) {
            const caseData = caseSnap.data();
            setPatientData(caseData.inputData.patientData || '');
            setFilePreviews(caseData.inputData.supportingDocuments || []);
            setFiles([]); // Can't restore File objects, but previews are shown
            setResults(caseData.outputData);
            toast({ title: "Case Loaded", description: `Successfully loaded case: ${caseData.title}` });
          } else {
             toast({ title: "Error", description: "Could not find or access the specified case.", variant: 'destructive'});
             router.push('/');
          }
        } catch (error) {
            console.error("Failed to load case:", error);
            toast({ title: "Error", description: "Failed to load the case from history.", variant: 'destructive'});
            router.push('/');
        } finally {
            setIsLoading(false);
        }
      };
      loadCase();
    }
  }, [searchParams, user, router, toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setFilePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setFiles(prev => [...prev, file]);
          setFilePreviews(prev => [...prev, URL.createObjectURL(file)]);
          toast({
            title: "Image Pasted",
            description: `An image from the clipboard has been added to supporting documents.`,
          });
          break;
        }
      }
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
    if (!user) {
        toast({ title: "Not Authenticated", description: "You must be logged in.", variant: "destructive" });
        return;
    }
    if (!patientData.trim() && files.length === 0) {
      toast({
        title: 'Input Required',
        description: 'Please enter patient history or upload a supporting document.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResults(null);

    try {
      const supportingDocuments = await Promise.all(files.map(fileToDataUri));
      const diagnosisResults = await aiDiagnosis({
        patientData: patientData.trim() ? patientData : undefined,
        supportingDocuments: supportingDocuments.length > 0 ? supportingDocuments : undefined,
      });
      setResults(diagnosisResults);
      
      const title = diagnosisResults[0]?.diagnosis || 'New Diagnosis Case';

      await addDoc(collection(db, 'cases'), {
        userId: user.uid,
        type: 'diagnosis',
        title,
        createdAt: serverTimestamp(),
        inputData: {
          patientData: patientData.trim() || null,
          supportingDocuments: supportingDocuments,
        },
        outputData: diagnosisResults,
      });

      toast({ title: 'Case Saved', description: 'Your diagnosis case has been saved to your history.' });

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
  
  const handleNewCase = () => {
    setPatientData('');
    setFiles([]);
    setFilePreviews([]);
    setResults(null);
    router.push('/');
  };

  if (authLoading || (!user && !searchParams.get('caseId'))) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
              upload or paste supporting documents.
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
                  placeholder="e.g., A 58-year-old male presents with a two-week history of persistent, dry cough... You can also paste an image from your clipboard here."
                  className="min-h-[200px]"
                  value={patientData}
                  onChange={(e) => setPatientData(e.target.value)}
                  onPaste={handlePaste}
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
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload PDFs or images, or paste an image into the text area above.
                </p>
                {filePreviews.length > 0 && (
                   <div className="mt-4 space-y-3 rounded-md border p-4">
                     <p className="text-sm font-medium">Attached files:</p>
                    {filePreviews.map((preview, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-sm text-muted-foreground"
                      >
                         <img src={preview} alt={`preview ${i}`} className="h-16 w-16 object-cover rounded-md border" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || (!patientData.trim() && filePreviews.length === 0)}>
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
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="text-primary" />
                    AI Diagnosis Results
                  </CardTitle>
                  <CardDescription>
                    Provisional diagnoses based on the provided data.
                  </CardDescription>
                </div>
                {results && (
                  <Button variant="outline" onClick={handleNewCase} className="ml-4 flex-shrink-0">
                    <PlusCircle />
                    New Case
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
          
          {isLoading && !results && (
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

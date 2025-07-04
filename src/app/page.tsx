'use client';

import { useState, type ChangeEvent, type ClipboardEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { aiDiagnosis, type AiDiagnosisOutput } from '@/ai/flows/ai-diagnosis';
import { summarizeQuestion } from '@/ai/flows/summarize-question';
import { answerClinicalQuestion, type AnswerClinicalQuestionOutput } from '@/ai/flows/answer-clinical-question';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DiagnosisCard } from '@/components/DiagnosisCard';
import { Bot, FileText, Loader2, Upload, PlusCircle, BrainCircuit, Lightbulb, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { StructuredQuestion } from '@/types';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function DiagnosisPage() {
  const [patientData, setPatientData] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AiDiagnosisOutput | null>(null);
  const [clinicalAnswer, setClinicalAnswer] = useState<AnswerClinicalQuestionOutput | null>(null);
  const [structuredQuestion, setStructuredQuestion] = useState<StructuredQuestion | null>(null);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  
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
    if (caseId && user && caseId !== currentCaseId) {
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
            setStructuredQuestion(caseData.inputData.structuredQuestion || null);
            
            // Handle old and new data structures for backward compatibility
            if (Array.isArray(caseData.outputData)) {
              setResults(caseData.outputData);
              setClinicalAnswer(null);
            } else {
              setResults(caseData.outputData.diagnoses);
              setClinicalAnswer(caseData.outputData.clinicalAnswer || null);
            }

            setCurrentCaseId(caseId);
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
  }, [searchParams, user, router, toast, currentCaseId]);

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
    setClinicalAnswer(null);
    setStructuredQuestion(null);

    try {
      const supportingDocuments = await Promise.all(files.map(fileToDataUri));
      
      const [diagnosisResults, summaryResponse, answerResponse] = await Promise.all([
        aiDiagnosis({
          patientData: patientData.trim() ? patientData : undefined,
          supportingDocuments: supportingDocuments.length > 0 ? supportingDocuments : undefined,
        }),
        summarizeQuestion({
          question: patientData.trim() ? patientData : undefined,
          images: supportingDocuments.length > 0 ? supportingDocuments : undefined,
        }),
        answerClinicalQuestion({
          question: patientData.trim() ? patientData : undefined,
          images: supportingDocuments.length > 0 ? supportingDocuments : undefined,
        })
      ]);
      
      setResults(diagnosisResults);
      setClinicalAnswer(answerResponse);
      const newStructuredQuestion = { summary: summaryResponse.summary, images: supportingDocuments };
      setStructuredQuestion(newStructuredQuestion);
      
      const title = diagnosisResults[0]?.diagnosis || answerResponse?.topic || 'New Diagnosis Case';
      const caseData = {
        userId: user.uid,
        type: 'diagnosis' as const,
        title,
        createdAt: serverTimestamp(),
        inputData: {
          patientData: patientData.trim() || null,
          supportingDocuments: supportingDocuments,
          structuredQuestion: newStructuredQuestion,
        },
        outputData: {
            diagnoses: diagnosisResults,
            clinicalAnswer: answerResponse,
        },
      };

      if (currentCaseId) {
        const caseRef = doc(db, 'cases', currentCaseId);
        await updateDoc(caseRef, caseData);
        toast({ title: 'Case Updated', description: 'Your case has been updated in your history.' });
      } else {
        const docRef = await addDoc(collection(db, 'cases'), caseData);
        setCurrentCaseId(docRef.id);
        toast({ title: 'Case Saved', description: 'Your diagnosis case has been saved to your history.' });
      }

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
    setClinicalAnswer(null);
    setCurrentCaseId(null);
    setStructuredQuestion(null);
    router.push('/');
  };

  const handleCopy = (textToCopy: string, type: string) => {
    const plainText = textToCopy.replace(/\*\*/g, '');
    navigator.clipboard.writeText(plainText).then(
      () => {
        toast({ title: 'Copied to clipboard', description: `The ${type} has been copied.` });
      },
      (err) => {
        toast({ title: 'Error', description: 'Failed to copy text.', variant: 'destructive' });
        console.error('Could not copy text: ', err);
      }
    );
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
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
      <div className="space-y-8">
        {!results && !clinicalAnswer && !isLoading && (
          <Card className="shadow-lg max-w-2xl mx-auto">
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
                     <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                      {filePreviews.map((preview, i) => (
                        <div
                          key={i}
                          className="relative aspect-square"
                        >
                           <img src={preview} alt={`preview ${i}`} className="h-full w-full object-cover rounded-md border" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full sm:w-auto" disabled={isLoading || (!patientData.trim() && filePreviews.length === 0)}>
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
        )}

        {isLoading && !results && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>AI is thinking...</span>
                </div>
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
        
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            {structuredQuestion && (
              <QuestionDisplay summary={structuredQuestion.summary} images={structuredQuestion.images} />
            )}

            {clinicalAnswer && clinicalAnswer.answer && (
              <Card className="shadow-lg">
                  <CardHeader>
                      <div className="flex w-full items-start justify-between gap-4">
                          <div className="flex-grow">
                              <CardTitle className="flex items-center gap-2">
                                  <BrainCircuit className="text-primary"/>
                                  Direct Answer
                              </CardTitle>
                              <CardDescription>Topic: {clinicalAnswer.topic}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(clinicalAnswer.answer, 'answer')} aria-label="Copy answer">
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" onClick={handleNewCase} className="w-full shrink-0 sm:w-auto">
                                <PlusCircle />
                                New Case
                            </Button>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: formatText(clinicalAnswer.answer)}}></div>
                      {clinicalAnswer.reasoning && (
                          <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="item-1" className="border-b-0">
                                  <AccordionTrigger>
                                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
                                          <Lightbulb className="h-4 w-4" />
                                          Click here to see the detailed analysis
                                      </div>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                      <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
                                          <div className="flex items-start justify-between">
                                              <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex-grow">
                                                  Reasoning
                                              </h4>
                                              <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleCopy(clinicalAnswer.reasoning, 'reasoning')}
                                                  className="h-8 w-8 flex-shrink-0 -mr-2 -mt-2 text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-200 dark:hover:bg-amber-900 dark:hover:text-amber-100"
                                                  aria-label="Copy reasoning"
                                              >
                                                  <Copy className="h-4 w-4" />
                                              </Button>
                                          </div>
                                          <div className="prose prose-sm prose-invert max-w-none text-amber-700 dark:text-amber-300" dangerouslySetInnerHTML={{__html: formatText(clinicalAnswer.reasoning)}}></div>
                                      </div>
                                  </AccordionContent>
                              </AccordionItem>
                          </Accordion>
                      )}
                  </CardContent>
              </Card>
            )}
          </div>
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-grow">
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="text-primary" />
                      AI Diagnosis Results
                    </CardTitle>
                    <CardDescription>
                      Provisional diagnoses based on the provided data.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
            
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
                        No provisional diagnoses could be determined. Please provide more detailed information.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            
            {!isLoading && !results && structuredQuestion && !clinicalAnswer && (
               <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">
                      No results to display. Start a new case.
                    </p>
                  </CardContent>
                </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

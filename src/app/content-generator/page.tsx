'use client';

import { useState, type ChangeEvent, type ClipboardEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateSlideOutline } from '@/ai/flows/generate-slide-outline';
import { answerClinicalQuestion, type AnswerClinicalQuestionOutput } from '@/ai/flows/answer-clinical-question';
import { summarizeQuestion } from '@/ai/flows/summarize-question';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, FileText, Bot, BrainCircuit, PlusCircle, Copy, FileDown, RefreshCw } from 'lucide-react';
import { SlideEditor } from '@/components/SlideEditor';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { StructuredQuestion } from '@/types';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ContentGeneratorPage() {
  const [mode, setMode] = useState<'question' | 'topic'>('question');
  
  const [question, setQuestion] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  const [topic, setTopic] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [result, setResult] = useState<AnswerClinicalQuestionOutput | null>(null);
  const [structuredQuestion, setStructuredQuestion] = useState<StructuredQuestion | null>(null);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState('8-10');

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
            setMode(caseData.inputData.mode);
            setQuestion(caseData.inputData.question || '');
            setImageFiles([]);
            setImagePreviews(caseData.inputData.images || []);
            setTopic(caseData.inputData.topic || '');
            setStructuredQuestion(caseData.inputData.structuredQuestion || null);
            setResult(caseData.outputData.result);
            setSlides(caseData.outputData.slides || null);
            setCurrentCaseId(caseId);
            toast({ title: "Case Loaded", description: `Successfully loaded case: ${caseData.title}` });
          } else {
             toast({ title: "Error", description: "Could not find or access the specified case.", variant: 'destructive'});
             router.push('/content-generator');
          }
        } catch (error) {
            console.error("Failed to load case:", error);
            toast({ title: "Error", description: "Failed to load the case from history.", variant: 'destructive'});
            router.push('/content-generator');
        } finally {
            setIsLoading(false);
        }
      };
      loadCase();
    }
  }, [searchParams, user, router, toast, currentCaseId]);

  useEffect(() => {
    const afterPrint = () => {
        document.body.classList.remove('printing-answer');
        const printArea = document.getElementById('printable-answer-area');
        if(printArea) printArea.innerHTML = '';
    };
    window.addEventListener('afterprint', afterPrint);
    return () => {
        window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setImageFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                setImageFiles(prev => [...prev, file]);
                setImagePreviews(prev => [...prev, URL.createObjectURL(file)]);
                toast({
                    title: "Image Pasted",
                    description: `Pasted image from clipboard.`,
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

  const handleQuestionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResult(null);
    setSlides(null);
    setStructuredQuestion(null);

    try {
      // Data URIs for AI call
      const imagesDataUris = await Promise.all(imageFiles.map(fileToDataUri));

      // NEW: Upload files to Storage and get public URLs for saving
      const uploadFile = async (file: File): Promise<string> => {
        if (!storage || !user) return '';
        const filePath = `user_uploads/${user.uid}/${uuidv4()}-${file.name}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
      };
      const imagesStorageUrls = await Promise.all(imageFiles.map(uploadFile));
      
      const [response, summaryResponse] = await Promise.all([
        answerClinicalQuestion({
          question: question.trim() || undefined,
          images: imagesDataUris.length > 0 ? imagesDataUris : undefined,
        }),
        summarizeQuestion({
          question: question.trim() || undefined,
          images: imagesDataUris.length > 0 ? imagesDataUris : undefined,
        })
      ]);

      setResult(response);
      const newStructuredQuestion = { summary: summaryResponse.summary, images: images };
      setStructuredQuestion(newStructuredQuestion);

      const caseData = {
          userId: user.uid,
          type: 'content-generator' as const,
          title: response.topic,
          createdAt: serverTimestamp(),
          inputData: {
              mode: 'question' as const,
              question: question.trim() || null,
              images: images.length > 0 ? images : null,
              topic: null,
              structuredQuestion: newStructuredQuestion,
          },
          outputData: {
              result: response,
              slides: null,
          }
      };
      
      if (currentCaseId) {
        const caseRef = doc(db, 'cases', currentCaseId);
        await updateDoc(caseRef, caseData);
        toast({ title: 'Case Updated', description: 'Your case has been updated in your history.' });
      } else {
        const docRef = await addDoc(collection(db, 'cases'), caseData);
        setCurrentCaseId(docRef.id);
        toast({ title: 'Case Saved', description: 'Your content generation case has been saved to your history.' });
      }

    } catch (error) {
      console.error('Clinical question failed:', error);
      toast({
        title: 'An Error Occurred',
        description:
          error instanceof Error && error.message.includes('storage/unauthorized')
            ? 'Storage permission denied. Please check your Firebase Storage rules.'
            : 'Failed to get an answer. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTopicSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
     if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResult(null);
    setSlides(null);
    setStructuredQuestion(null);

    try {
      const summaryResult = {
          markdown: `## Topic Overview: ${topic}\n\nThis is a general overview for the topic: **${topic}**. You can now generate a presentation outline based on this.`,
          topic: topic,
      };
      setResult(summaryResult);

      const caseData = {
          userId: user.uid,
          type: 'content-generator' as const,
          title: topic,
          createdAt: serverTimestamp(),
          inputData: {
              mode: 'topic' as const,
              question: null,
              images: null,
              topic: topic.trim() || null,
              structuredQuestion: null,
          },
          outputData: {
              result: summaryResult,
              slides: null,
          }
      };
      
      if (currentCaseId) {
        const caseRef = doc(db, 'cases', currentCaseId);
        await updateDoc(caseRef, caseData);
        toast({ title: 'Case Updated', description: 'Your case has been updated in your history.' });
      } else {
        const docRef = await addDoc(collection(db, 'cases'), caseData);
        setCurrentCaseId(docRef.id);
        toast({ title: 'Case Saved', description: 'Your content generation case has been saved to your history.' });
      }

    } catch (error) {
       console.error('Topic submission failed:', error);
       toast({
        title: 'An Error Occurred',
        description: 'Failed to process topic. Please try again.',
        variant: 'destructive',
      });
    } finally {
        setIsLoading(false);
    }
  }

  const handleGeneratePresentation = async () => {
    if (!result?.topic || !user || !currentCaseId) {
      if (!currentCaseId) {
        toast({ title: "Error", description: "Cannot generate presentation without a saved case.", variant: "destructive" });
      }
      return;
    }

    setIsLoading(true);
    try {
      const { slides: generatedSlides } = await generateSlideOutline({ 
        topic: result.topic, 
        numberOfSlides: slideCount,
        question: structuredQuestion?.summary,
        answerAndReasoning: result.markdown
      });
      setSlides(generatedSlides);

      const caseRef = doc(db, 'cases', currentCaseId);
      await updateDoc(caseRef, {
        'outputData.slides': generatedSlides,
      });

      toast({ title: 'Presentation Generated', description: 'Your presentation has been added to the case.' });
    } catch (error) {
      console.error('Outline generation failed:', error);
      toast({
        title: 'An Error Occurred',
        description: 'Failed to generate outline. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegeneratePresentation = async () => {
    setIsRegenerating(true);
    await handleGeneratePresentation();
    setIsRegenerating(false);
  }

  const handleNewCase = () => {
    setMode('question');
    setQuestion('');
    setImageFiles([]);
    setImagePreviews([]);
    setTopic('');
    setResult(null);
    setSlides(null);
    setCurrentCaseId(null);
    setStructuredQuestion(null);
    router.push('/content-generator');
  };
  
  const isQuestionSubmitDisabled = !question.trim() && imageFiles.length === 0;
  const isTopicSubmitDisabled = !topic.trim();

  const handleCopy = (textToCopy: string, type: string) => {
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        toast({ title: 'Copied to clipboard', description: `The ${type} has been copied.` });
      },
      (err) => {
        toast({ title: 'Error', description: 'Failed to copy text.', variant: 'destructive' });
        console.error('Could not copy text: ', err);
      }
    );
  };
  
  const handlePrintAnswer = () => {
    if (!result?.markdown) return;
    const printArea = document.getElementById('printable-answer-area');
    if (printArea) {
        printArea.innerHTML = `
          <div class="prose prose-sm lg:prose-base">
            <h1>${result.topic}</h1>
            ${new (require('marked').Marked)().parse(result.markdown)}
          </div>
        `;
        document.body.classList.add('printing-answer');
        setTimeout(() => {
            window.print();
        }, 100);
    }
  };
  
  if (authLoading || (!user && !searchParams.get('caseId'))) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-8">
        {!result && !isLoading && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Content Generator</CardTitle>
                    <CardDescription>
                    Select a mode to either analyze a clinical question or generate content for a medical topic.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={mode} onValueChange={(value) => setMode(value as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
                        <TabsTrigger value="question">Specific Clinical Question</TabsTrigger>
                        <TabsTrigger value="topic">General Medical Topic</TabsTrigger>
                    </TabsList>
                    <TabsContent value="question" className="pt-4">
                        <form onSubmit={handleQuestionSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="question">Clinical Question (optional if image is provided)</Label>
                            <Textarea
                            id="question"
                            placeholder="e.g., 'What are the treatment options for this condition?' You can also paste an image from your clipboard here."
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onPaste={handlePaste}
                            disabled={isLoading}
                            className="min-h-[100px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="image">Supporting Image(s) (optional)</Label>
                            <Input
                                id="image"
                                type="file"
                                accept=".jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                onPaste={handlePaste}
                                disabled={isLoading}
                                multiple
                            />
                             {imagePreviews.length > 0 && (
                               <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                {imagePreviews.map((preview, i) => (
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
                        <Button type="submit" className="w-full sm:w-auto" disabled={isLoading || isQuestionSubmitDisabled}>
                            {isLoading ? <Loader2 className="animate-spin" /> : <Bot />}
                            Get Answer
                        </Button>
                        </form>
                    </TabsContent>
                    <TabsContent value="topic" className="pt-4">
                        <form onSubmit={handleTopicSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="topic">Medical Topic</Label>
                            <Input
                            id="topic"
                            placeholder="e.g., 'Pathophysiology of Myocardial Infarction'"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={isLoading}
                            />
                        </div>
                        <Button type="submit" className="w-full sm:w-auto" disabled={isLoading || isTopicSubmitDisabled}>
                            {isLoading ? <Loader2 className="animate-spin" /> : <FileText />}
                            Set Topic
                        </Button>
                        </form>
                    </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        )}

        {isLoading && !result && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </CardContent>
          </Card>
        )}
        
        {structuredQuestion && (
             <Card className="shadow-lg mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <FileText className="text-primary" />
                    Your Question
                    </CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {structuredQuestion.summary}
                    </ReactMarkdown>
                </CardContent>
            </Card>
        )}

        {result && (
          <Card className="shadow-lg">
             <CardHeader>
              <div className="flex w-full items-start justify-between gap-4">
                <div className="flex-grow">
                  <CardTitle className="flex items-center gap-2">
                      <BrainCircuit className="text-primary"/>
                      AI Response
                  </CardTitle>
                  <CardDescription>Topic: {result.topic}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(result.markdown, 'response')} aria-label="Copy response">
                      <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrintAnswer} disabled={!result} aria-label="Download Answer PDF">
                      <FileDown className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={handleNewCase} disabled={isLoading} className="w-full shrink-0 sm:w-auto">
                      <PlusCircle />
                      New Case
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="prose prose-sm max-w-none dark:prose-invert rounded-md border p-4 bg-muted/20">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
               </div>
                
                {!slides && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center gap-4 rounded-lg border p-4">
                      <div className="flex-grow space-y-2">
                          <Label htmlFor="slide-count">Presentation Length</Label>
                          <Select value={slideCount} onValueChange={setSlideCount}>
                              <SelectTrigger id="slide-count" className="w-full sm:w-[180px]">
                                  <SelectValue placeholder="Select number of slides" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="5-7">Short (5-7 Slides)</SelectItem>
                                  <SelectItem value="8-10">Medium (8-10 Slides)</SelectItem>
                                  <SelectItem value="11-15">Long (11-15 Slides)</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <Button onClick={handleGeneratePresentation} disabled={isLoading || isRegenerating} className="w-full sm:w-auto">
                          {isLoading || isRegenerating ? <Loader2 className="animate-spin"/> : <Wand2 />}
                          Generate Presentation
                      </Button>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

        {slides && result && (
            <SlideEditor
                key={currentCaseId || result.topic}
                initialSlides={slides}
                topic={result.topic}
                onSlidesUpdate={(updatedSlides) => {
                    setSlides(updatedSlides);
                    if (currentCaseId) {
                        const caseRef = doc(db, 'cases', currentCaseId);
                        updateDoc(caseRef, { 'outputData.slides': updatedSlides });
                    }
                }}
                onNewCase={handleNewCase}
                onRegenerate={handleRegeneratePresentation}
            />
        )}
      </div>
      <div id="printable-answer-area" className="hidden"></div>
    </div>
  );
}

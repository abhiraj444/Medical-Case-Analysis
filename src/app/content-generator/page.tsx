'use client';

import { useState, type ChangeEvent, type ClipboardEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateSlideOutline } from '@/ai/flows/generate-slide-outline';
import { answerClinicalQuestion, type AnswerClinicalQuestionOutput } from '@/ai/flows/answer-clinical-question';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Lightbulb, FileText, Bot, BrainCircuit } from 'lucide-react';
import { SlideEditor } from '@/components/SlideEditor';
import type { Slide } from '@/components/SlideEditor';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';


export default function ContentGeneratorPage() {
  const [mode, setMode] = useState<'question' | 'topic'>('question');
  
  const [question, setQuestion] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [topic, setTopic] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnswerClinicalQuestionOutput | null>(null);
  const [slides, setSlides] = useState<Slide[] | null>(null);
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
    if (caseId && user) {
      const loadCase = async () => {
        setIsLoading(true);
        try {
          const caseRef = doc(db, 'cases', caseId);
          const caseSnap = await getDoc(caseRef);
          if (caseSnap.exists() && caseSnap.data().userId === user.uid) {
            const caseData = caseSnap.data();
            setMode(caseData.inputData.mode);
            setQuestion(caseData.inputData.question || '');
            setImagePreview(caseData.inputData.image || null);
            setTopic(caseData.inputData.topic || '');
            setResult(caseData.outputData.result);
            setSlides(caseData.outputData.slides);
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
  }, [searchParams, user, router, toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                setImageFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                };
                reader.readAsDataURL(file);
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
    setIsLoading(true);
    setResult(null);
    setSlides(null);
    setCurrentCaseId(null);

    try {
      const image = imageFile ? await fileToDataUri(imageFile) : undefined;
      const response = await answerClinicalQuestion({
        question: question.trim() || undefined,
        image,
      });
      setResult(response);
    } catch (error) {
      console.error('Clinical question failed:', error);
      toast({
        title: 'An Error Occurred',
        description: 'Failed to get an answer. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTopicSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);
    setSlides(null);
    setCurrentCaseId(null);

    try {
      const summaryResult = {
          answer: `This is a general overview for the topic: **${topic}**. You can now generate a presentation outline based on this.`,
          reasoning: '',
          topic: topic,
      };
      setResult(summaryResult);

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
    if (!result?.topic || !user) return;

    setIsLoading(true);
    setSlides(null);

    try {
      const generatedSlides = await generateSlideOutline({ topic: result.topic });
      setSlides(generatedSlides);

      const image = imageFile ? await fileToDataUri(imageFile) : undefined;
      const caseData = {
          userId: user.uid,
          type: 'content-generator',
          title: result.topic,
          createdAt: serverTimestamp(),
          inputData: {
              mode,
              question: question.trim() || null,
              image: image || null,
              topic: topic.trim() || null,
          },
          outputData: {
              result: result,
              slides: generatedSlides,
          }
      };
      
      const docRef = await addDoc(collection(db, 'cases'), caseData);
      setCurrentCaseId(docRef.id);

      toast({ title: 'Case Saved', description: 'Your content generation case has been saved to your history.' });

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
  
  const isQuestionSubmitDisabled = !question.trim() && !imageFile;
  const isTopicSubmitDisabled = !topic.trim();

  const formatText = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
  };
  
  if (authLoading || (!user && !searchParams.get('caseId'))) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (slides && result) {
    return (
       <div className="container mx-auto max-w-4xl px-4 py-8">
            <SlideEditor
                key={result.topic}
                initialSlides={slides}
                topic={result.topic}
                caseId={currentCaseId}
                onRefresh={handleGeneratePresentation}
                onSlidesUpdate={setSlides}
            />
       </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Content Generator</CardTitle>
            <CardDescription>
              Select a mode to either analyze a clinical question or generate content for a medical topic.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(value) => setMode(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
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
                     <Label htmlFor="image">Supporting Image (optional)</Label>
                     <Input
                        id="image"
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        onPaste={handlePaste}
                        disabled={isLoading}
                      />
                      {imagePreview && (
                        <div className="mt-2">
                            <img src={imagePreview} alt="Selected preview" className="max-h-48 rounded-md border" />
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

        {(isLoading && !slides) && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {result && !slides && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="text-primary"/>
                AI Response
              </CardTitle>
              <CardDescription>Topic: {result.topic}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: formatText(result.answer)}}></div>

                {result.reasoning && (
                     <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
                        <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            Reasoning
                        </h4>
                        <div className="prose prose-sm prose-invert max-w-none text-amber-700 dark:text-amber-300" dangerouslySetInnerHTML={{__html: formatText(result.reasoning)}}></div>
                    </div>
                )}
                
                <Button onClick={handleGeneratePresentation} disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? <Loader2 className="animate-spin"/> : <Wand2 />}
                    Generate Presentation
                </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

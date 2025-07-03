'use client';

import { useState, type ChangeEvent, type ClipboardEvent } from 'react';
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

export default function ContentGeneratorPage() {
  const [mode, setMode] = useState<'question' | 'topic'>('question');
  
  // State for question mode
  const [question, setQuestion] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // State for topic mode
  const [topic, setTopic] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnswerClinicalQuestionOutput | null>(null);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const { toast } = useToast();

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
                break; // Stop after finding the first image
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

    try {
      // We'll use the result object to store the topic and a summary
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
    if (!result?.topic) return;

    setIsLoading(true);
    setSlides(null);

    try {
      const generatedSlides = await generateSlideOutline({ topic: result.topic });
      setSlides(generatedSlides);
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

  if (slides && result) {
    return (
       <div className="container mx-auto max-w-4xl px-4 py-8">
            <SlideEditor
                key={result.topic}
                initialSlides={slides}
                topic={result.topic}
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
               <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: result.answer.replace(/\n/g, '<br />')}}></div>

                {result.reasoning && (
                     <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
                        <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            Reasoning
                        </h4>
                        <div className="prose prose-sm prose-invert max-w-none text-amber-700 dark:text-amber-300" dangerouslySetInnerHTML={{__html: result.reasoning.replace(/\n/g, '<br />')}}></div>
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

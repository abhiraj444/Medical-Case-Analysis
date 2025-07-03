'use client';

import { useState } from 'react';
import { generateSlideOutline } from '@/ai/flows/generate-slide-outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2 } from 'lucide-react';
import { SlideEditor } from '@/components/SlideEditor';

export default function ContentGeneratorPage() {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [outline, setOutline] =useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!topic.trim()) {
      toast({
        title: 'Topic Required',
        description: 'Please enter a topic to generate an outline.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setOutline(null);

    try {
      const result = await generateSlideOutline({ topic });
      setOutline(result.outline);
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

  const handleRefresh = async (currentTopic: string) => {
    setTopic(currentTopic);
    setIsLoading(true);
    setOutline(null);
    try {
      const result = await generateSlideOutline({ topic: currentTopic });
      setOutline(result.outline);
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

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Presentation Content Generator</CardTitle>
            <CardDescription>
              Enter a general medical subject or a specific clinical question to generate a presentation outline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Educational Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., 'Management of Type 2 Diabetes' or 'Pathophysiology of Myocardial Infarction'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Generate Outline
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating your presentation outline...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {outline && (
          <SlideEditor 
            key={outline}
            outline={outline} 
            topic={topic}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </div>
  );
}

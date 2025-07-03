'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Trash2, Plus, RefreshCw, FileDown } from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  content: string;
}

interface SlideEditorProps {
  outline: string;
  topic: string;
  onRefresh: (topic: string) => void;
}

export function SlideEditor({ outline, topic: initialTopic, onRefresh }: SlideEditorProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [topic, setTopic] = useState(initialTopic);

  useEffect(() => {
    const parsedSlides: Slide[] = [];
    const sections = outline.split(/\n(?=##\s)/);

    sections.forEach((section, index) => {
      const lines = section.split('\n');
      const titleLine = lines.find(line => line.startsWith('## '));
      const title = titleLine ? titleLine.replace('## ', '').trim() : `Slide ${index + 1}`;
      const content = lines.filter(line => !line.startsWith('## ')).join('\n').trim();
      
      parsedSlides.push({
        id: Date.now() + index,
        title,
        content,
      });
    });

    setSlides(parsedSlides);
  }, [outline]);

  const handleContentChange = (id: number, newContent: string) => {
    setSlides(
      slides.map((slide) =>
        slide.id === id ? { ...slide, content: newContent } : slide
      )
    );
  };
  
  const handleTitleChange = (id: number, newTitle: string) => {
     setSlides(
      slides.map((slide) =>
        slide.id === id ? { ...slide, title: newTitle } : slide
      )
    );
  }

  const addSlide = () => {
    const newSlide: Slide = {
      id: Date.now(),
      title: 'New Slide',
      content: '',
    };
    setSlides([...slides, newSlide]);
  };

  const removeSlide = (id: number) => {
    setSlides(slides.filter((slide) => slide.id !== id));
  };
  
  const handleRefreshClick = () => {
    onRefresh(topic);
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Presentation Editor</CardTitle>
        <div className="flex flex-wrap items-end gap-2 pt-4">
            <div className="flex-grow">
                <label htmlFor="topic-refresh" className="text-sm font-medium text-muted-foreground">Presentation Topic</label>
                 <Input 
                    id="topic-refresh"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1"
                />
            </div>
            <Button variant="outline" onClick={handleRefreshClick}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
            <Button variant="outline" onClick={addSlide}><Plus className="mr-2 h-4 w-4"/>Add Slide</Button>
            <Button disabled><FileDown className="mr-2 h-4 w-4" />Export PPT</Button>
            <Button disabled><FileDown className="mr-2 h-4 w-4" />Export Word</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {slides.map((slide, index) => (
          <Card key={slide.id} className="bg-background">
            <CardHeader className="flex flex-row items-center justify-between p-4">
              <Input 
                value={slide.title}
                onChange={(e) => handleTitleChange(slide.id, e.target.value)}
                className="text-lg font-semibold border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring p-0"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSlide(slide.id)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Textarea
                value={slide.content}
                onChange={(e) => handleContentChange(slide.id, e.target.value)}
                className="min-h-[120px] w-full"
              />
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

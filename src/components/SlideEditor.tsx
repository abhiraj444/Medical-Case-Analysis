'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Trash2, Plus, RefreshCw, FileDown, Loader2, Wand2, Scaling } from 'lucide-react';
import pptxgen from 'pptxgenjs';
import { modifySlides } from '@/ai/flows/modify-slides';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';

export interface Slide {
  title: string;
  content: string;
}

interface SlideEditorProps {
  initialSlides: Slide[];
  topic: string;
  onRefresh: () => void;
  onSlidesUpdate: (slides: Slide[]) => void;
}

export function SlideEditor({ initialSlides, topic: initialTopic, onRefresh, onSlidesUpdate }: SlideEditorProps) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [topic, setTopic] = useState(initialTopic);
  const [isModifying, setIsModifying] = useState(false);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSlides(initialSlides);
    setSelectedIndices([]);
  }, [initialSlides]);

  const handleSelectionChange = (index: number) => {
    setSelectedIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedIndices(slides.map((_, i) => i));
    } else {
      setSelectedIndices([]);
    }
  }

  const handleContentChange = (index: number, newContent: string) => {
    const newSlides = slides.map((slide, i) =>
      i === index ? { ...slide, content: newContent } : slide
    );
    setSlides(newSlides);
  };
  
  const handleTitleChange = (index: number, newTitle: string) => {
    const newSlides = slides.map((slide, i) =>
      i === index ? { ...slide, title: newTitle } : slide
    );
    setSlides(newSlides);
  }

  const handleBlur = () => {
    onSlidesUpdate(slides);
  }

  const addSlide = () => {
    const newSlide: Slide = { title: 'New Slide', content: '- ' };
    const newSlides = [...slides, newSlide];
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
  };

  const removeSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
    setSelectedIndices(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const deleteSelectedSlides = () => {
    const newSlides = slides.filter((_, index) => !selectedIndices.includes(index));
    const deletedCount = selectedIndices.length;
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
    setSelectedIndices([]);
    toast({ title: "Slides Deleted", description: `${deletedCount} slides have been removed.` });
  }
  
  const handleRefreshClick = () => {
    onRefresh();
  }

  const handleModifySlides = async (action: 'expand_content' | 'replace_content' | 'expand_selected') => {
    setIsModifying(true);
    setIsRefreshModalOpen(false);
    try {
      const result = await modifySlides({ slides, selectedIndices, action });
      setSlides(result);
      onSlidesUpdate(result);
      setSelectedIndices([]);
      toast({ title: "Slides Updated", description: "The selected slides have been modified." });
    } catch(error) {
      console.error(`Slide modification failed for action: ${action}`, error);
      toast({
        title: 'An Error Occurred',
        description: 'Failed to modify slides. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsModifying(false);
    }
  }

  const handleExport = () => {
    const pptx = new pptxgenjs();
    pptx.layout = 'LAYOUT_16x9';
    const MAX_LINES_PER_SLIDE = 15;

    let slidesToProcess = [...slides];
    
    while(slidesToProcess.length > 0) {
        const currentSlideData = slidesToProcess.shift();
        if(!currentSlideData) continue;

        let { title, content } = currentSlideData;
        
        let lines = content.split('\n').filter(line => line.trim() !== '');

        if (lines.length > MAX_LINES_PER_SLIDE && !title.includes('(Continued)')) {
            const currentSlideLines = lines.slice(0, MAX_LINES_PER_SLIDE);
            const nextSlideLines = lines.slice(MAX_LINES_PER_SLIDE);

            lines = currentSlideLines;
            
            const nextSlide: Slide = {
                title: `${title} (Continued)`,
                content: nextSlideLines.join('\n')
            };
            slidesToProcess.unshift(nextSlide);
        }
        
        const pptxSlide = pptx.addSlide();
        
        pptxSlide.addText(title, { 
            x: 0.5, y: 0.25, w: '90%', h: 0.75, 
            fontSize: 32, bold: true, color: '3B5998', align: 'left'
        });
        
        let yPos = 1.25;

        // Helper to parse **bold** text, ensuring it never causes a runtime error.
        const parseBold = (text: string): { text: string; options: pptxgen.TextProps }[] => {
            const segments = text.split(/(\*\*.*?\*\*)/g).filter(p => p);
            if (segments.length === 0) return [{ text: '', options: {} }];
            return segments.map(segment => {
                if (segment.startsWith('**') && segment.endsWith('**')) {
                    return { text: segment.slice(2, -2), options: { bold: true } };
                }
                return { text: segment, options: {} }; // Always return an options object
            });
        };

        let currentBulletBlock: { text: string; options: pptxgen.TextProps }[] = [];
        let currentTableBlock: (pptxgen.TextProps[])[][] = [];

        const flushBulletBlock = () => {
            if (currentBulletBlock.length > 0) {
                const textObjects = currentBulletBlock.flatMap((item, index) => {
                    const parsed = parseBold(item.text);
                    // This is now safe as parseBold always returns an options object.
                    parsed[0].options = { ...parsed[0].options, ...item.options };
                    if (index > 0) {
                       parsed.unshift({ text: '\n', options: {} });
                    }
                    return parsed;
                });

                pptxSlide.addText(textObjects, { x: 0.5, y: yPos, w: '90%', fontSize: 18, paraSpaceAfter: 8 });
                // Correctly estimate height based on the number of bullet points, not total slide lines.
                yPos += (currentBulletBlock.length * 0.3) + 0.2;
                currentBulletBlock = [];
            }
        };

        const flushTableBlock = () => {
             if (currentTableBlock.length > 0) {
                pptxSlide.addTable(currentTableBlock, {
                    x: 0.5, y: yPos, w: 9.0,
                    border: { type: 'solid', pt: 1, color: 'D9D9D9' },
                    rowH: 0.4,
                    autoPage: false
                });
                yPos += (currentTableBlock.length * 0.4) + 0.2;
                currentTableBlock = [];
            }
        }
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('|')) {
                flushBulletBlock();
                const cells = trimmedLine.split('|').slice(1, -1).map(cell => ({ text: cell.trim() }));
                if (!trimmedLine.includes('--')) {
                    currentTableBlock.push(cells);
                }
            } else if (trimmedLine) {
                flushTableBlock();
                const indent = line.match(/^\s*/)?.[0].length ?? 0;
                const isNumbered = /^\d+\.\s/.test(trimmedLine);
                const bulletType = isNumbered ? 'number' : 'bullet';
                
                let contentText = trimmedLine;
                if (isNumbered) {
                    contentText = contentText.replace(/^\d+\.\s/, '');
                } else if (trimmedLine.startsWith('- ')) {
                    contentText = contentText.substring(2);
                }
                
                currentBulletBlock.push({
                    text: contentText,
                    options: { bullet: { type: bulletType, indent: 18 * (indent/2) } }
                });
            }
        }
        
        flushBulletBlock();
        flushTableBlock();
    }

    pptx.writeFile({ fileName: `${topic.replace(/\s+/g, '_') || 'presentation'}.pptx` });
  };


  const allSelected = selectedIndices.length > 0 && selectedIndices.length === slides.length;
  const someSelected = selectedIndices.length > 0 && selectedIndices.length < slides.length;
  const checkboxState = allSelected ? true : someSelected ? 'indeterminate' : false;

  return (
    <div className="relative">
    <Card className="shadow-lg">
        { isModifying &&
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Modifying your slides...</span>
                </div>
            </div>
        }
      <CardHeader>
        <CardTitle>Presentation Editor</CardTitle>
        <CardDescription>Review, edit, and modify your slides before exporting.</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
            <div className="flex-grow space-y-1">
                <Label htmlFor="topic-refresh" className="text-xs font-medium text-muted-foreground">Presentation Topic</Label>
                 <Input 
                    id="topic-refresh"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handleRefreshClick} disabled={isModifying}><RefreshCw />Refresh Topic</Button>
              <Button variant="outline" onClick={addSlide} disabled={isModifying}><Plus />Add Slide</Button>
              <Button onClick={handleExport} disabled={isModifying || slides.length === 0}><FileDown />Generate PowerPoint</Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox 
              id="select-all" 
              onCheckedChange={handleSelectAll} 
              checked={checkboxState}
              aria-label="Select all slides"
              />
            <Label htmlFor='select-all' className="text-sm font-medium">
                {selectedIndices.length > 0 ? `${selectedIndices.length} of ${slides.length} selected` : 'Select slides'}
            </Label>
        </div>

        {slides.map((slide, index) => (
          <Card key={index} className="bg-background/50 relative overflow-hidden transition-all duration-300 data-[selected=true]:bg-accent/20 data-[selected=true]:ring-2 data-[selected=true]:ring-accent" data-selected={selectedIndices.includes(index)}>
            <CardHeader className="flex flex-row items-center justify-between p-4">
               <div className="flex items-center gap-3">
                 <Checkbox
                    id={`select-${index}`}
                    checked={selectedIndices.includes(index)}
                    onCheckedChange={() => handleSelectionChange(index)}
                    aria-label={`Select slide ${index + 1}`}
                />
                <Input 
                  value={slide.title}
                  onChange={(e) => handleTitleChange(index, e.target.value)}
                  onBlur={handleBlur}
                  className="text-lg font-semibold border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring p-0 h-auto"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSlide(index)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0 pl-12">
              <Textarea
                value={slide.content}
                onChange={(e) => handleContentChange(index, e.target.value)}
                onBlur={handleBlur}
                className="min-h-[120px] w-full"
                placeholder="Use markdown for bullet points (e.g., - point 1)"
              />
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
      
      {selectedIndices.length > 0 && (
          <div className="sticky bottom-4 mx-auto w-fit z-10 bg-card/95 backdrop-blur-sm border p-2 flex justify-center gap-2 shadow-lg rounded-lg">
             <AlertDialog open={isRefreshModalOpen} onOpenChange={setIsRefreshModalOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isModifying}><Wand2 /> Refresh Selected</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Refresh Content</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose how to regenerate content for the selected slides.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                        <Button variant="outline" className="justify-start text-left h-auto" onClick={() => handleModifySlides('expand_content')}>
                           <div className="flex flex-col">
                                <span className="font-semibold">Expand Content</span>
                                <span className="text-sm text-muted-foreground">Generate more detailed content, possibly adding more slides.</span>
                           </div>
                        </Button>
                         <Button variant="outline" className="justify-start text-left h-auto" onClick={() => handleModifySlides('replace_content')}>
                           <div className="flex flex-col">
                                <span className="font-semibold">Replace Content</span>
                                <span className="text-muted-foreground">Generate alternative content for the same topics.</span>
                           </div>
                        </Button>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" disabled={isModifying} onClick={() => handleModifySlides('expand_selected')}><Scaling /> Expand Selected</Button>
            <Button variant="destructive" disabled={isModifying} onClick={deleteSelectedSlides}><Trash2 /> Delete Selected</Button>
          </div>
      )}
    </div>
  );
}

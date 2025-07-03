'use client';

import { useEffect, useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  Trash2,
  Plus,
  RefreshCw,
  FileDown,
  Loader2,
  Wand2,
  Scaling,
} from 'lucide-react';
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

export function SlideEditor({
  initialSlides,
  topic: initialTopic,
  onRefresh,
  onSlidesUpdate,
}: SlideEditorProps) {
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
    setSelectedIndices((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedIndices(slides.map((_, i) => i));
    } else {
      setSelectedIndices([]);
    }
  };

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
  };

  const handleBlur = () => {
    onSlidesUpdate(slides);
  };

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
    setSelectedIndices((prev) =>
      prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
    );
  };

  const deleteSelectedSlides = () => {
    const newSlides = slides.filter(
      (_, index) => !selectedIndices.includes(index)
    );
    const deletedCount = selectedIndices.length;
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
    setSelectedIndices([]);
    toast({
      title: 'Slides Deleted',
      description: `${deletedCount} slides have been removed.`,
    });
  };

  const handleRefreshClick = () => {
    onRefresh();
  };

  const handleModifySlides = async (
    action: 'expand_content' | 'replace_content' | 'expand_selected'
  ) => {
    setIsModifying(true);
    setIsRefreshModalOpen(false);
    try {
      const result = await modifySlides({ slides, selectedIndices, action });
      setSlides(result);
      onSlidesUpdate(result);
      setSelectedIndices([]);
      toast({
        title: 'Slides Updated',
        description: 'The selected slides have been modified.',
      });
    } catch (error) {
      console.error(`Slide modification failed for action: ${action}`, error);
      toast({
        title: 'An Error Occurred',
        description: 'Failed to modify slides. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsModifying(false);
    }
  };

  const handleExport = () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    const MAX_LINES_PER_SLIDE = 12; // Max content lines to avoid overflow

    const addSlideWithContent = (
      title: string,
      lines: string[],
      isContinued: boolean
    ) => {
      const slide = pptx.addSlide();

      // 1. Add Slide Title
      slide.addText(isContinued ? `${title} (Continued)` : title, {
        x: 0.5, y: 0.25, w: '90%', h: 0.75,
        fontSize: 32, bold: true, color: '3B5998', fontFace: 'Arial',
      });

      const parseBold = (text: string): PptxGenJS.TextProps[] =>
        text
          .split(/(\*\*.*?\*\*)/g)
          .filter((p) => p)
          .map((segment) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
              return { text: segment.slice(2, -2), options: { bold: true } };
            }
            return { text: segment, options: {} };
          });

      let yPos = 1.25; // Initial Y position for content

      // 2. Process content line by line to handle mixed-type blocks
      let currentBulletBlock: string[] = [];
      let currentTableBlock: PptxGenJS.TableRow[] = [];

      const flushBulletBlock = () => {
        if (currentBulletBlock.length === 0) return;
        
        currentBulletBlock.forEach(line => {
          if (yPos > 5.0) return; // Stop if we're running out of space

          const indent = line.match(/^\s*/)?.[0].length ?? 0;
          const level = Math.floor(indent / 2);
          const isNumbered = /^\d+\.\s/.test(line.trim());
          const isBulleted = line.trim().startsWith('-');
          
          let contentText = line.trim();
          if (isNumbered) contentText = contentText.replace(/^\d+\.\s/, '');
          else if (isBulleted) contentText = contentText.substring(2);

          const richText = parseBold(contentText);
          
          slide.addText(richText, {
            x: 0.5 + (level * 0.25),
            y: yPos,
            w: 9.0 - (level * 0.25),
            h: 0.3,
            fontSize: 18,
            fontFace: 'Arial',
            color: '363636',
            lineSpacingMultiple: 1.2,
            bullet: (isBulleted || isNumbered) ? { type: isNumbered ? 'number' : 'bullet' } : false
          });
          yPos += 0.35; // Increment Y position for the next line
        });
        currentBulletBlock = [];
      };

      const flushTableBlock = () => {
        if (currentTableBlock.length === 0) return;
        if (yPos > 5.0) return;
        
        slide.addTable(currentTableBlock, {
            x: 0.5, y: yPos, w: 9.0,
            border: { type: 'solid', pt: 1, color: 'D9D9D9' },
            fontSize: 14, fontFace: 'Arial',
            rowH: 0.4,
        });
        yPos += (currentTableBlock.length * 0.4) + 0.2;
        currentTableBlock = [];
      };

      for (const line of lines) {
        if (line.trim().startsWith('|')) {
          flushBulletBlock();
          if (!line.includes('--')) {
            const cells = line.split('|').slice(1, -1).map(cell => ({ text: cell.trim() }));
            currentTableBlock.push(cells);
          }
        } else {
          flushTableBlock();
          if (line.trim()) {
            currentBulletBlock.push(line);
          }
        }
      }
      flushBulletBlock();
      flushTableBlock();

      // 3. Add Continued Footer if necessary
      if (isContinued) {
        slide.addText('(Continued...)', {
          x: '85%', y: '92%', w: '15%', h: '8%',
          fontSize: 12, italic: true, color: '999999', align: 'right'
        });
      }
    };

    // Main logic: iterate through user's slides and split if necessary
    slides.forEach((slide) => {
      const allLines = slide.content.split('\n').filter((line) => line.trim() !== '');
      if (allLines.length === 0) {
        // Create slide with only a title if content is empty
        addSlideWithContent(slide.title, [], false);
        return;
      }

      let isFirstBatch = true;
      for (let i = 0; i < allLines.length; i += MAX_LINES_PER_SLIDE) {
        const batch = allLines.slice(i, i + MAX_LINES_PER_SLIDE);
        addSlideWithContent(slide.title, batch, !isFirstBatch);
        isFirstBatch = false;
      }
    });

    pptx.writeFile({
      fileName: `${topic.replace(/\s+/g, '_') || 'presentation'}.pptx`,
    });
  };

  const allSelected =
    selectedIndices.length > 0 && selectedIndices.length === slides.length;
  const someSelected =
    selectedIndices.length > 0 && selectedIndices.length < slides.length;
  const checkboxState = allSelected ? true : someSelected ? 'indeterminate' : false;

  return (
    <div className="relative">
      <Card className="shadow-lg">
        {isModifying && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/80">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Modifying your slides...</span>
            </div>
          </div>
        )}
        <CardHeader>
          <CardTitle>Presentation Editor</CardTitle>
          <CardDescription>
            Review, edit, and modify your slides before exporting.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <div className="flex-grow space-y-1">
              <Label
                htmlFor="topic-refresh"
                className="text-xs font-medium text-muted-foreground"
              >
                Presentation Topic
              </Label>
              <Input
                id="topic-refresh"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={handleRefreshClick}
                disabled={isModifying}
              >
                <RefreshCw />
                Refresh Topic
              </Button>
              <Button
                variant="outline"
                onClick={addSlide}
                disabled={isModifying}
              >
                <Plus />
                Add Slide
              </Button>
              <Button
                onClick={handleExport}
                disabled={isModifying || slides.length === 0}
              >
                <FileDown />
                Generate PowerPoint
              </Button>
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
            <Label htmlFor="select-all" className="text-sm font-medium">
              {selectedIndices.length > 0
                ? `${selectedIndices.length} of ${slides.length} selected`
                : 'Select slides'}
            </Label>
          </div>

          {slides.map((slide, index) => (
            <Card
              key={index}
              className="relative overflow-hidden bg-background/50 transition-all duration-300 data-[selected=true]:bg-accent/20 data-[selected=true]:ring-2 data-[selected=true]:ring-accent"
              data-selected={selectedIndices.includes(index)}
            >
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
                    className="h-auto border-0 p-0 text-lg font-semibold shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlide(index)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit justify-center gap-2 rounded-lg border bg-card/95 p-2 shadow-lg backdrop-blur-sm">
          <AlertDialog
            open={isRefreshModalOpen}
            onOpenChange={setIsRefreshModalOpen}
          >
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isModifying}>
                <Wand2 /> Refresh Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refresh Content</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose how to regenerate content for the selected slides.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-4 py-4">
                <Button
                  variant="outline"
                  className="h-auto justify-start text-left"
                  onClick={() => handleModifySlides('expand_content')}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">Expand Content</span>
                    <span className="text-sm text-muted-foreground">
                      Generate more detailed content, possibly adding more
                      slides.
                    </span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto justify-start text-left"
                  onClick={() => handleModifySlides('replace_content')}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">Replace Content</span>
                    <span className="text-muted-foreground">
                      Generate alternative content for the same topics.
                    </span>
                  </div>
                </Button>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            disabled={isModifying}
            onClick={() => handleModifySlides('expand_selected')}
          >
            <Scaling /> Expand Selected
          </Button>
          <Button
            variant="destructive"
            disabled={isModifying}
            onClick={deleteSelectedSlides}
          >
            <Trash2 /> Delete Selected
          </Button>
        </div>
      )}
    </div>
  );
}

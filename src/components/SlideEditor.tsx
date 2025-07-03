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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trash2,
  Plus,
  RefreshCw,
  FileDown,
  Loader2,
  Wand2,
  Scaling,
  ClipboardCopy,
  FileText,
  List,
  ListOrdered,
  Type,
} from 'lucide-react';
import { modifySlides } from '@/ai/flows/modify-slides';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';

// Data structures for the structured JSON content
interface Paragraph {
  type: 'paragraph';
  text: string;
  bold?: string[];
}
interface BulletList {
  type: 'bullet_list';
  items: string[];
}
interface NumberedList {
  type: 'numbered_list';
  items: string[];
}
interface Note {
  type: 'note';
  text: string;
}
interface TableContent {
  type: 'table';
  headers: string[];
  rows: string[][];
}
export type ContentItem = Paragraph | BulletList | NumberedList | Note | TableContent;
export interface Slide {
  title: string;
  content: ContentItem[];
}

interface SlideEditorProps {
  initialSlides: Slide[];
  topic: string;
  onRefresh: () => void;
  onSlidesUpdate: (slides: Slide[]) => void;
}

const renderContentItem = (item: ContentItem, index: number) => {
  const getIcon = () => {
    switch (item.type) {
      case 'paragraph': return <Type className="h-4 w-4" />;
      case 'bullet_list': return <List className="h-4 w-4" />;
      case 'numbered_list': return <ListOrdered className="h-4 w-4" />;
      case 'table': return <FileText className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  const BoldableText = ({ text, boldWords }: { text: string; boldWords?: string[] }) => {
    if (!boldWords || boldWords.length === 0) {
      return <>{text}</>;
    }
    const regex = new RegExp(`(${boldWords.join('|')})`, 'g');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          boldWords.includes(part) ? <strong key={i}>{part}</strong> : part
        )}
      </>
    );
  };

  return (
    <div key={index} className="mb-2 flex items-start gap-3 rounded-md border p-3">
       <span className="text-muted-foreground pt-1">{getIcon()}</span>
       <div className='w-full'>
            {item.type === 'paragraph' && (
                <p><BoldableText text={item.text} boldWords={item.bold} /></p>
            )}
            {item.type === 'bullet_list' && (
                <ul className="list-disc pl-5">
                {item.items.map((bullet, i) => <li key={i}>{bullet}</li>)}
                </ul>
            )}
            {item.type === 'numbered_list' && (
                <ol className="list-decimal pl-5">
                {item.items.map((bullet, i) => <li key={i}>{bullet}</li>)}
                </ol>
            )}
            {item.type === 'note' && (
                <p className="text-sm italic text-muted-foreground">Note: {item.text}</p>
            )}
            {item.type === 'table' && (
                <Table>
                <TableHeader>
                    <TableRow>
                    {item.headers.map((header, i) => <TableHead key={i}>{header}</TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {item.rows.map((row, i) => (
                    <TableRow key={i}>
                        {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            )}
        </div>
    </div>
  );
};


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

  const addSlide = () => {
    const newSlide: Slide = { title: 'New Slide', content: [{ type: 'paragraph', text: 'New content...' }] };
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
  
  const handleCopyRawContent = () => {
    const rawContent = JSON.stringify({slides}, null, 2);
    navigator.clipboard.writeText(rawContent).then(
      () => {
        toast({
          title: 'Content Copied',
          description:
            'The raw JSON slide content has been copied to your clipboard.',
        });
      },
      (err) => {
        console.error('Could not copy text: ', err);
        toast({
          title: 'Error',
          description: 'Failed to copy content to clipboard.',
          variant: 'destructive',
        });
      }
    );
  };

  const handleExport = () => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    const buildRichText = (text: string, boldWords: string[] = []): PptxGenJS.TextProps[] => {
        if (!boldWords?.length) {
            return [{ text }];
        }
    
        const textObjects: PptxGenJS.TextProps[] = [];
        // Create a regex that is case-insensitive and global
        const regex = new RegExp(`(${boldWords.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
        
        let lastIndex = 0;
        let match;
    
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                textObjects.push({ text: text.substring(lastIndex, match.index) });
            }
            if (match[0]) {
              textObjects.push({ text: match[0], options: { bold: true } });
            }
            lastIndex = regex.lastIndex;
        }
    
        if (lastIndex < text.length) {
            textObjects.push({ text: text.substring(lastIndex) });
        }
    
        return textObjects.length > 0 ? textObjects : [{ text }];
    };

    slides.forEach((slideData) => {
        const MAX_LINES_PER_SLIDE = 8;
        const MAX_WORDS_PER_SLIDE = 120;

        let y = 1.25;
        let lineCount = 0;
        let wordCount = 0;
        let isFirstContentOnSlide = true;
        let currentSlide = pptx.addSlide();

        const setupSlide = (title: string, isContinuation: boolean) => {
            currentSlide.addText(title + (isContinuation ? " (Continued)" : ""), {
                x: 0.5, y: 0.25, w: '90%', h: 0.75,
                fontSize: 24, bold: true, color: '3B5998', fontFace: 'Arial'
            });
            y = 1.25;
            lineCount = 0;
            wordCount = 0;
            isFirstContentOnSlide = true;
        };

        const checkAndCreateNewSlide = (neededLines: number, neededWords: number) => {
            if (!isFirstContentOnSlide && (lineCount + neededLines > MAX_LINES_PER_SLIDE || wordCount + neededWords > MAX_WORDS_PER_SLIDE)) {
                currentSlide.addText('(Continued...)', {
                    x: 8.5, y: 5.0, w: '10%', h: '5%',
                    fontSize: 10, italic: true, color: '666666', align: 'right'
                });

                currentSlide = pptx.addSlide();
                setupSlide(slideData.title, true);
            }
            isFirstContentOnSlide = false;
        };
        
        setupSlide(slideData.title, false);

        slideData.content.forEach((item) => {
            switch (item.type) {
                case 'paragraph': {
                    const neededLines = 1;
                    const neededWords = item.text.split(' ').length;
                    checkAndCreateNewSlide(neededLines, neededWords);

                    const textObjects = buildRichText(item.text, item.bold);
                    currentSlide.addText(textObjects, {
                        x: 0.7, y, w: '85%',
                        fontSize: 18, lineSpacing: 28, fontFace: 'Arial', bullet: true,
                    });
                    y += 0.4 + Math.floor(neededWords / 20) * 0.2;
                    lineCount += neededLines;
                    wordCount += neededWords;
                    break;
                }
                case 'bullet_list':
                case 'numbered_list': {
                    item.items.forEach(point => {
                        const neededLines = 1;
                        const neededWords = point.split(' ').length;
                        checkAndCreateNewSlide(neededLines, neededWords);
                        
                        currentSlide.addText(point, {
                            x: 0.7, y, w: '85%',
                            fontSize: 18, lineSpacing: 28, fontFace: 'Arial',
                            bullet: item.type === 'bullet_list' ? true : { type: 'number' }
                        });
                        y += 0.4 + Math.floor(neededWords / 20) * 0.2;
                        lineCount += neededLines;
                        wordCount += neededWords;
                    });
                    break;
                }
                case 'table': {
                    const neededLines = item.rows.length + 1;
                    const neededWords = JSON.stringify(item).split(' ').length;
                    checkAndCreateNewSlide(neededLines, neededWords);
                    
                    const headerRow = item.headers.map(h => ({ text: h, options: { bold: true } }));
                    const bodyRows = item.rows.map(row => row.map(cell => ({ text: cell || '' })));
                    const tableRows = [headerRow, ...bodyRows];

                    const tableHeight = (item.rows.length + 1) * 0.4;
                    currentSlide.addTable(tableRows, {
                        x: 0.5, y, w: 9.0, autoPage: true,
                        border: { type: 'solid', pt: 1, color: 'D9D9D9' },
                        fontSize: 14,
                        rowH: 0.4
                    });
                    y += tableHeight;
                    lineCount += neededLines;
                    wordCount += neededWords;
                    break;
                }
                case 'note': {
                    if (y > 4.8) { // Simple check to avoid note overlapping footer
                        checkAndCreateNewSlide(1, 10);
                    }
                    currentSlide.addText(`Note: ${item.text}`, {
                        x: 0.5, y, w: 9.0, h: 0.4,
                        fontSize: 14, fontFace: 'Arial', italic: true, color: '666666'
                    });
                    y += 0.4;
                    break;
                }
            }
        });
    });
    
    pptx.writeFile({ fileName: `${topic.replace(/\s+/g, '_') || 'presentation'}.pptx` });
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
                variant="outline"
                onClick={handleCopyRawContent}
                disabled={isModifying || slides.length === 0}
              >
                <ClipboardCopy />
                Copy Raw Content
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
                  <h3 className="text-lg font-semibold">{slide.title}</h3>
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
                {slide.content.map(renderContentItem)}
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

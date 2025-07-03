'use client';

import { useEffect, useState } from 'react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';
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
  Table as ShadcnTable,
  TableBody,
  TableCell as ShadcnTableCell,
  TableHead,
  TableHeader,
  TableRow as ShadcnTableRow,
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
interface ParagraphContent {
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
export type ContentItem = ParagraphContent | BulletList | NumberedList | Note | TableContent;
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
                <ShadcnTable>
                <TableHeader>
                    <ShadcnTableRow>
                    {item.headers.map((header, i) => <TableHead key={i}>{header}</TableHead>)}
                    </ShadcnTableRow>
                </TableHeader>
                <TableBody>
                    {item.rows.map((row, i) => (
                    <ShadcnTableRow key={i}>
                        {row.map((cell, j) => <ShadcnTableCell key={j}>{cell}</ShadcnTableCell>)}
                    </ShadcnTableRow>
                    ))}
                </TableBody>
                </ShadcnTable>
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

  const handleExport = async () => {
    setIsModifying(true);
    try {
      const docChildren: (Paragraph | Table)[] = [];

      slides.forEach((slide) => {
        docChildren.push(
          new Paragraph({
            text: slide.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          })
        );

        slide.content.forEach((item) => {
          switch (item.type) {
            case 'paragraph': {
              const textRuns: TextRun[] = [];
              if (item.bold && item.bold.length > 0) {
                 const boldWordsEscaped = item.bold.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                 const regex = new RegExp(`(${boldWordsEscaped.join('|')})`, 'g');
                 const parts = item.text.split(regex).filter(part => part);

                 parts.forEach(part => {
                     if (item.bold?.includes(part)) {
                         textRuns.push(new TextRun({ text: part, bold: true }));
                     } else {
                         textRuns.push(new TextRun(part));
                     }
                 });
              } else {
                textRuns.push(new TextRun(item.text));
              }
              docChildren.push(
                new Paragraph({
                  children: textRuns.length > 0 ? textRuns : [new TextRun('')],
                  spacing: { after: 100 },
                })
              );
              break;
            }
            case 'bullet_list':
              item.items.forEach((bulletText) => {
                docChildren.push(
                  new Paragraph({ text: bulletText, bullet: { level: 0 }, spacing: { after: 50 } })
                );
              });
              break;
            case 'numbered_list':
              item.items.forEach((numberedText) => {
                docChildren.push(
                  new Paragraph({ text: numberedText, numbering: { reference: 'default-numbering', level: 0 }, spacing: { after: 50 } })
                );
              });
              break;
            case 'table': {
              const headerRow = new TableRow({
                children: item.headers.map(
                  (header) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: header, bold: true })],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                      shading: {
                        fill: 'EBF2FA',
                      },
                    })
                ),
                tableHeader: true,
              });

              const bodyRows = item.rows.map(
                (row) =>
                  new TableRow({
                    children: row.map(
                      (cellText) => new TableCell({ children: [new Paragraph(cellText || '')] })
                    ),
                  })
              );

              const table = new Table({
                rows: [headerRow, ...bodyRows],
                width: {
                  size: 9000,
                  type: 'dxa',
                },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" },
                },
              });
              docChildren.push(table);
              docChildren.push(new Paragraph({ text: '', spacing: { after: 200 } })); // space after table
              break;
            }
            case 'note':
              docChildren.push(
                new Paragraph({
                  children: [new TextRun({ text: `Note: ${item.text}`, italic: true })],
                  spacing: { after: 100 },
                })
              );
              break;
          }
        });
      });

      const doc = new Document({
        numbering: {
          config: [
            {
              levels: [
                {
                  level: 0,
                  format: 'decimal',
                  text: '%1.',
                  alignment: AlignmentType.LEFT,
                },
              ],
              reference: 'default-numbering',
            },
          ],
        },
        sections: [
          {
            children: docChildren,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${topic.replace(/\s+/g, '_') || 'document'}.docx`);
      toast({
        title: 'Document Generated',
        description: 'Your Word document has been downloaded.',
      });
    } catch (error) {
      console.error('Error generating docx:', error);
      toast({
        title: 'An Error Occurred',
        description: 'Failed to generate Word document. Please check the console.',
        variant: 'destructive',
      });
    } finally {
      setIsModifying(false);
    }
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
              <span>Processing...</span>
            </div>
          </div>
        )}
        <CardHeader>
          <CardTitle>Content Editor</CardTitle>
          <CardDescription>
            Review, edit, and modify your content before exporting.
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
                Add Section
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
                Generate Word Document
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
                : 'Select sections'}
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
                  Choose how to regenerate content for the selected sections.
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
                      sections.
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

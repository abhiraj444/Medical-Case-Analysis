
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
  TableRow as DocxTableRow,
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
  PlusCircle,
  File,
} from 'lucide-react';
import { modifySlides } from '@/ai/flows/modify-slides';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import type { Slide, ContentItem, ParagraphContent } from '@/types';


const BoldRenderer = ({ text, bold }: { text: string; bold?: string[] }) => {
  if (!text) return null;
  if (!bold || bold.length === 0) {
    return <>{text}</>;
  }

  // Escape special characters for regex and join with '|'
  const boldEscaped = bold.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const regex = new RegExp(`(${boldEscaped.join('|')})`, 'g');
  const parts = text.split(regex).filter(Boolean);

  return (
    <>
      {parts.map((part, i) =>
        bold.includes(part) ? <strong key={i}>{part}</strong> : part
      )}
    </>
  );
};


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
  
  const isParagraph = (content: ContentItem): content is ParagraphContent => content.type === 'paragraph';

  return (
    <div key={index} className="mb-2 flex items-start gap-3 rounded-md border p-3">
       <span className="text-muted-foreground pt-1">{getIcon()}</span>
       <div className='w-full'>
            {isParagraph(item) && (
                <p><BoldRenderer text={item.text} bold={item.bold} /></p>
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
                        {row.cells.map((cell, j) => <ShadcnTableCell key={j}>{cell}</ShadcnTableCell>)}
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
  caseId,
  onRefresh,
  onSlidesUpdate,
  onNewCase,
}: {
  initialSlides: Slide[];
  topic: string;
  caseId: string | null;
  onRefresh: () => void;
  onSlidesUpdate: (slides: Slide[]) => void;
  onNewCase: () => void;
}) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [topic, setTopic] = useState(initialTopic);
  const [isModifying, setIsModifying] = useState(false);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSlides(initialSlides);
    setSelectedIndices([]);
  }, [initialSlides]);

  useEffect(() => {
    if (isPrinting) {
      document.body.classList.add('medigen-printing');
      // Delay printing slightly to ensure DOM is updated with the printable content
      setTimeout(() => {
        window.print();
        // The afterprint event listener will handle cleanup.
      }, 100);
    }
  }, [isPrinting]);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('medigen-printing');
      setIsPrinting(false);
    };

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

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
    if (selectedIndices.length === 0) {
      toast({ title: 'No Sections Selected', description: 'Please select sections to modify.', variant: 'destructive' });
      return;
    }
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

  const handleGeneratePdf = () => {
    setIsPrinting(true);
  };
  
  const handleExport = async () => {
    setIsModifying(true);
    
    const createTextRuns = (text: string, bold?: string[]): TextRun[] => {
      if (!text) return [new TextRun({ text: '' })];
      if (!bold || bold.length === 0) {
          return [new TextRun({ text })];
      }
      
      const boldEscaped = bold.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      const regex = new RegExp(`(${boldEscaped.join('|')})`, 'g');
      const parts = text.split(regex).filter(Boolean);

      return parts.map(part => {
          return new TextRun({ text: part, bold: bold.includes(part) });
      });
    };

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
              docChildren.push(
                new Paragraph({
                  children: createTextRuns(item.text, item.bold),
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
              const headerRow = new DocxTableRow({
                children: item.headers.map(
                  (header) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: createTextRuns(header),
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
                  new DocxTableRow({
                    children: row.cells.map(
                      (cellText) => new TableCell({ children: [new Paragraph({ children: createTextRuns(cellText) })] })
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
              const noteRuns: TextRun[] = [new TextRun({ text: 'Note: ', italic: true })];
              const contentRuns = createTextRuns(item.text);
              contentRuns.forEach(run => {
                if (!run.options) {
                  run.options = {};
                }
                run.options.italic = true;
              });
              noteRuns.push(...contentRuns);
              docChildren.push(
                new Paragraph({
                  children: noteRuns,
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
      const docName = `${topic.replace(/\s+/g, '_') || 'document'}.docx`;
      saveAs(blob, docName);
      toast({
        title: 'Document Downloaded',
        description: 'Your Word document has been downloaded locally.',
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
       {isPrinting && (
        <div id="printable-area">
          {slides.map((slide, slideIndex) => (
            <div key={`print-${slideIndex}`} className="printable-slide">
              <h1>{slide.title}</h1>
              {slide.content.map((item, itemIndex) => {
                const isParagraph = (content: ContentItem): content is ParagraphContent => content.type === 'paragraph';
                if (isParagraph(item)) {
                  return <p key={itemIndex}><BoldRenderer text={item.text} bold={item.bold} /></p>;
                }
                if (item.type === 'bullet_list') {
                  return (
                    <ul key={itemIndex}>
                      {item.items.map((bullet, i) => <li key={i}>{bullet}</li>)}
                    </ul>
                  );
                }
                if (item.type === 'numbered_list') {
                  return (
                    <ol key={itemIndex}>
                      {item.items.map((num_item, i) => <li key={i}>{num_item}</li>)}
                    </ol>
                  );
                }
                if (item.type === 'note') {
                  return <p key={itemIndex} className="note">Note: {item.text}</p>;
                }
                if (item.type === 'table') {
                  return (
                    <table key={itemIndex}>
                      <thead>
                        <tr>
                          {item.headers.map((header, i) => <th key={i}>{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {item.rows.map((row, i) => (
                          <tr key={i}>
                            {row.cells.map((cell, j) => <td key={j}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                }
                return null;
              })}
            </div>
          ))}
        </div>
      )}

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
           <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Content Editor</CardTitle>
                <CardDescription>
                  Review, edit, and modify your content before exporting.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={onNewCase} disabled={isModifying} className="w-full shrink-0 sm:w-auto">
                  <PlusCircle />
                  New Case
              </Button>
            </div>
          <div className="flex flex-col gap-4 pt-4 md:flex-row md:items-end">
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
            <div className="flex flex-wrap items-end gap-2">
              <Button
                variant="outline"
                onClick={handleRefreshClick}
                disabled={isModifying}
                className="w-full sm:w-auto"
              >
                <RefreshCw />
                Refresh Topic
              </Button>
              <Button
                variant="outline"
                onClick={addSlide}
                disabled={isModifying}
                className="w-full sm:w-auto"
              >
                <Plus />
                Add Section
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyRawContent}
                disabled={isModifying || slides.length === 0}
                className="w-full sm:w-auto"
              >
                <ClipboardCopy />
                Copy Raw Content
              </Button>
              <Button
                onClick={handleExport}
                disabled={isModifying || slides.length === 0}
                className="w-full sm:w-auto"
              >
                <File />
                Word Document
              </Button>
              <Button
                onClick={handleGeneratePdf}
                disabled={isModifying || slides.length === 0}
                className="w-full sm:w-auto"
              >
                <FileDown />
                PDF Document
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
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-lg border bg-card/95 p-2 shadow-lg backdrop-blur-sm">
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

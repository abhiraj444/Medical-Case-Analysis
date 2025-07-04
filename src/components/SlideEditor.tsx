'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import {
  File,
  FileDown,
  Loader2,
  PlusCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Slide } from '@/types';

declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

interface SlideEditorProps {
  initialSlides: Slide[];
  topic: string;
  onSlidesUpdate: (slides: Slide[]) => void;
  onNewCase: () => void;
  onRegenerate: () => void;
}

export function SlideEditor({
  initialSlides,
  topic,
  onSlidesUpdate,
  onNewCase,
  onRegenerate,
}: SlideEditorProps) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [currentTopic, setCurrentTopic] = useState(topic);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSlideChange = (
    index: number,
    field: keyof Slide,
    value: any
  ) => {
    const newSlides = [...slides];
    (newSlides[index] as any)[field] = value;
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
  };
  
  const handleContentChange = (slideIndex: number, contentIndex: number, value: string) => {
    const newSlides = [...slides];
    const contentItem = newSlides[slideIndex].content[contentIndex];
    if (contentItem.type === 'paragraph') {
        contentItem.content = value;
    }
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
  };

  const addSlide = () => {
    const newSlides = [
      ...slides,
      {
        title: 'New Slide',
        content: [{ type: 'paragraph', content: 'New content...' }],
        notes: '',
      },
    ];
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
  };

  const removeSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    onSlidesUpdate(newSlides);
  };

  const handleExportToWord = async () => {
    setIsProcessing(true);
    toast({
      title: 'Coming Soon!',
      description: 'Word export functionality is under development.',
    });
    // Placeholder for actual implementation
    setTimeout(() => setIsProcessing(false), 1000);
  };

  const handleExportToPdf = () => {
    setIsProcessing(true);
    try {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: 'letter',
        });
        
        const margin = 40;
        let pageWidth = doc.internal.pageSize.getWidth();
        let pageHeight = doc.internal.pageSize.getHeight();
        const usableWidth = pageWidth - 2 * margin;
        const usableHeight = pageHeight - 2 * margin;
        
        const currentTitle = currentTopic || "Presentation";

        const drawHeader = (title: string) => {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(title, margin, margin / 2);
        };

        const drawFooter = (pageNumber: number, totalPages: number) => {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(
                `Page ${pageNumber} of ${totalPages}`,
                pageWidth - margin,
                pageHeight - margin / 2,
                { align: 'right' }
            );
        };
        
        slides.forEach((slide, slideIndex) => {
            doc.addPage();
            drawHeader(currentTitle);

            let y = margin;

            // Slide Title
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            const titleLines = doc.splitTextToSize(slide.title, usableWidth);
            doc.text(titleLines, margin, y);
            y += titleLines.length * 24 * 0.7;
            y += 20;

            // Content
            doc.setFont('helvetica', 'normal');
            slide.content.forEach((item) => {
                if (y > usableHeight) {
                    drawFooter(doc.internal.getNumberOfPages() -1, slides.length);
                    doc.addPage();
                    pageWidth = doc.internal.pageSize.getWidth();
                    pageHeight = doc.internal.pageSize.getHeight();
                    drawHeader(currentTitle);
                    y = margin;
                }
                
                switch (item.type) {
                    case 'paragraph':
                        doc.setFontSize(12);
                        const paraLines = doc.splitTextToSize(item.content || '', usableWidth);
                        doc.text(paraLines, margin, y);
                        y += paraLines.length * 12 * 1.2;
                        y += 10;
                        break;
                    case 'list':
                        doc.setFontSize(12);
                        item.items?.forEach(listItem => {
                            const itemLines = doc.splitTextToSize(`• ${listItem}`, usableWidth - 15);
                            if (y + (itemLines.length * 12 * 1.2) > usableHeight) {
                                drawFooter(doc.internal.getNumberOfPages() -1, slides.length);
                                doc.addPage();
                                drawHeader(currentTitle);
                                y = margin;
                            }
                            doc.text(itemLines, margin + 10, y);
                            y += itemLines.length * 12 * 1.2;
                        });
                        y += 10;
                        break;
                    case 'table':
                        doc.setFontSize(12);
                        (doc as any).autoTable({
                            head: [item.headers],
                            body: item.rows,
                            startY: y,
                            theme: 'grid',
                            headStyles: { fillColor: [38, 166, 154] },
                            margin: { left: margin },
                            didDrawPage: (data: any) => {
                                drawHeader(currentTitle);
                            }
                        });
                        y = (doc as any).previousAutoTable.finalY + 20;
                        break;
                }
            });
            
             if (slide.notes && slide.notes.trim()) {
                if (y > usableHeight - 50) { // Check if notes fit
                    drawFooter(doc.internal.getNumberOfPages() -1, slides.length);
                    doc.addPage();
                    drawHeader(currentTitle);
                    y = margin;
                }
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text('Notes:', margin, y);
                y += 15;
                const notesLines = doc.splitTextToSize(slide.notes, usableWidth);
                doc.text(notesLines, margin, y);
                y += notesLines.length * 10 * 1.2;
             }

            drawFooter(doc.internal.getNumberOfPages() -1, slides.length);
        });

        // remove the first blank page
        doc.deletePage(1);

        const docName = `${currentTopic.replace(/\s+/g, '_') || 'presentation'}.pdf`;
        doc.save(docName);

        toast({
            title: 'PDF Exported',
            description: `Your presentation has been saved as ${docName}.`,
        });

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: 'PDF Export Failed', description: 'There was an error generating the PDF.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="relative">
      <Card className="shadow-lg">
        {isProcessing && (
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
                <CardTitle>Presentation Editor</CardTitle>
                <CardDescription>
                  Review and edit your presentation slides before exporting.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={onNewCase} disabled={isProcessing} className="w-full shrink-0 sm:w-auto">
                  <PlusCircle />
                  New Case
              </Button>
            </div>
          <div className="flex flex-col gap-4 pt-4 md:flex-row md:items-end">
            <div className="flex-grow space-y-1">
              <label
                htmlFor="topic-refresh"
                className="text-xs font-medium text-muted-foreground"
              >
                Presentation Topic
              </label>
              <Input
                id="topic-refresh"
                value={currentTopic}
                onChange={(e) => setCurrentTopic(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button
                onClick={onRegenerate}
                disabled={isProcessing}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <RefreshCw />
                Regenerate
              </Button>
              <Button
                onClick={handleExportToWord}
                disabled={isProcessing}
                className="w-full sm:w-auto"
              >
                <File />
                Word Document
              </Button>
              <Button
                onClick={handleExportToPdf}
                disabled={isProcessing}
                className="w-full sm:w-auto"
              >
                <FileDown />
                PDF Document
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={slides.map((_, i) => `item-${i}`)} className="w-full space-y-4">
            {slides.map((slide, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="rounded-lg border bg-muted/20 px-4">
                <div className="flex items-center">
                    <AccordionTrigger className="flex-grow text-lg font-semibold hover:no-underline">
                        Slide {index + 1}: {slide.title}
                    </AccordionTrigger>
                    <Button variant="ghost" size="icon" onClick={() => removeSlide(index)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <label className="font-medium">Title</label>
                        <Input
                            value={slide.title}
                            onChange={(e) => handleSlideChange(index, 'title', e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <label className="font-medium">Content</label>
                        {slide.content.map((item, contentIndex) => (
                           <div key={contentIndex} className="p-2 border rounded-md">
                               {item.type === 'paragraph' && (
                                   <Textarea value={item.content} onChange={e => handleContentChange(index, contentIndex, e.target.value)} />
                               )}
                               {item.type === 'list' && (
                                   <ul className="list-disc pl-5 space-y-1">
                                       {item.items?.map((li, li_idx) => <li key={li_idx}>{li}</li>)}
                                   </ul>
                               )}
                               {item.type === 'table' && (
                                <p className="text-sm text-muted-foreground">[Table content is not editable here]</p>
                               )}
                           </div>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium">Speaker Notes</label>
                        <Textarea
                            value={slide.notes}
                            onChange={(e) => handleSlideChange(index, 'notes', e.target.value)}
                            placeholder="Add speaker notes here..."
                        />
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Button onClick={addSlide} variant="outline" className="mt-4 w-full">
            <PlusCircle />
            Add Slide
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

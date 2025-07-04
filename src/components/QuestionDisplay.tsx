'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FileQuestion } from 'lucide-react';
import Image from 'next/image';

interface QuestionDisplayProps {
  summary: string;
  images: string[];
}

// A simple component to render markdown-like bolding.
const SimpleMarkdown = ({ text }: { text: string | null | undefined }) => {
    if (!text) return null;
    const createMarkup = (htmlString: string) => {
      return { __html: htmlString };
    };
  
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          // Replace \n with <br /> and render
          return <span key={i} dangerouslySetInnerHTML={createMarkup(part.replace(/\n/g, '<br />'))} />;
        })}
      </>
    );
};


export function QuestionDisplay({ summary, images }: QuestionDisplayProps) {
  if (!summary) {
    return null;
  }
  
  return (
    <Card className="shadow-lg mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileQuestion className="text-primary" />
          Your Question
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="prose prose-sm prose-invert max-w-none">
          <SimpleMarkdown text={summary} />
        </div>
        {images && images.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Submitted Images:</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {images.map((img, index) => (
                <Dialog key={index}>
                  <DialogTrigger asChild>
                    <div className="aspect-square relative cursor-pointer hover:opacity-80 transition-opacity rounded-md overflow-hidden">
                      <Image
                        src={img}
                        alt={`Submitted image ${index + 1}`}
                        fill
                        style={{ objectFit: 'cover' }}
                        className="border"
                      />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl h-auto p-2">
                    <img
                      src={img}
                      alt={`Submitted image ${index + 1}`}
                      className="max-h-[85vh] w-auto rounded-lg mx-auto"
                    />
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

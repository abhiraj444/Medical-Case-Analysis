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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FileQuestion } from 'lucide-react';
import Image from 'next/image';

interface QuestionDisplayProps {
  summary: string;
  images: string[];
}

// A simple component to render markdown-like bolding and newlines.
const SimpleRenderer = ({ text }: { text: string | null | undefined }) => {
  if (!text) return null;

  // Split the text by bold markers, keeping the markers
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  return (
    <p className="whitespace-pre-line">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
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
          <SimpleRenderer text={summary} />
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
                    <DialogHeader className="sr-only">
                      <DialogTitle>Submitted Image {index + 1}</DialogTitle>
                      <DialogDescription>
                        A full-size view of the image submitted by the user.
                      </DialogDescription>
                    </DialogHeader>
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

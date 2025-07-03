'use client';

import type { AiDiagnosisOutput } from '@/ai/flows/ai-diagnosis';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Lightbulb } from 'lucide-react';

interface DiagnosisCardProps {
  diagnosis: AiDiagnosisOutput[0];
}

export function DiagnosisCard({ diagnosis }: DiagnosisCardProps) {
  const confidencePercent = Math.round(diagnosis.confidenceLevel * 100);

  const getConfidenceColor = (level: number) => {
    if (level > 75) return 'bg-green-500';
    if (level > 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="overflow-hidden shadow-lg transition-all hover:shadow-xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle>{diagnosis.diagnosis}</CardTitle>
          <Badge variant="secondary" className="whitespace-nowrap">
            {confidencePercent}% Confidence
          </Badge>
        </div>
        <CardDescription>
          <Progress
            value={confidencePercent}
            className={`h-2 mt-2 [&>div]:${getConfidenceColor(confidencePercent)}`}
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-foreground mb-2">Reasoning</h4>
          <p className="text-sm text-muted-foreground">{diagnosis.reasoning}</p>
        </div>
        {diagnosis.missingInformation &&
          diagnosis.missingInformation.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950">
              <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Missing Information / Next Steps
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
                {diagnosis.missingInformation.map((info, i) => (
                  <li key={i}>{info}</li>
                ))}
              </ul>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

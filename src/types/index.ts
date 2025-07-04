import type { Timestamp } from 'firebase/firestore';
import type { AiDiagnosisOutput } from '@/ai/flows/ai-diagnosis';
import type { AnswerClinicalQuestionOutput } from '@/ai/flows/answer-clinical-question';
import type { Slide } from '@/components/SlideEditor';

interface BaseCase {
    id: string;
    userId: string;
    title: string;
    createdAt: Timestamp;
    generatedFileUrl?: string;
}

export interface DiagnosisCase extends BaseCase {
    type: 'diagnosis';
    inputData: {
        patientData?: string;
        supportingDocuments?: string[];
    };
    outputData: AiDiagnosisOutput;
}

export interface ContentCase extends BaseCase {
    type: 'content-generator';
    inputData: {
        mode: 'question' | 'topic';
        question?: string;
        image?: string;
        topic?: string;
    };
    outputData: {
        result: AnswerClinicalQuestionOutput;
        slides: Slide[];
    };
}

export type Case = DiagnosisCase | ContentCase;

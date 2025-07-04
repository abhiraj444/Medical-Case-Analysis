import type { Timestamp } from 'firebase/firestore';
import type { AiDiagnosisOutput } from '@/ai/flows/ai-diagnosis';
import type { AnswerClinicalQuestionOutput } from '@/ai/flows/answer-clinical-question';
import type { Slide } from '@/components/SlideEditor';

export interface StructuredQuestion {
    summary: string;
    images: string[];
}

interface BaseCase {
    id: string;
    userId: string;
    title: string;
    createdAt: Timestamp;
}

export interface DiagnosisCase extends BaseCase {
    type: 'diagnosis';
    inputData: {
        patientData?: string;
        supportingDocuments?: string[];
        structuredQuestion?: StructuredQuestion;
    };
    outputData: {
        diagnoses: AiDiagnosisOutput;
        clinicalAnswer: AnswerClinicalQuestionOutput | null;
    };
}

export interface ContentCase extends BaseCase {
    type: 'content-generator';
    inputData: {
        mode: 'question' | 'topic';
        question?: string;
        images?: string[];
        topic?: string;
        structuredQuestion?: StructuredQuestion;
    };
    outputData: {
        result: AnswerClinicalQuestionOutput;
        slides: Slide[] | null;
    };
}

export type Case = DiagnosisCase | ContentCase;

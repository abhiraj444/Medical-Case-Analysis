'use client';

import type { Timestamp } from 'firebase/firestore';
import type { AiDiagnosisOutput } from '@/ai/flows/ai-diagnosis';
import type { AnswerClinicalQuestionOutput as BaseAnswerOutput } from '@/ai/flows/answer-clinical-question';

export type AnswerClinicalQuestionOutput = BaseAnswerOutput;

export interface StructuredQuestion {
    summary: string;
    images: string[];
}

export interface Slide {
    title: string;
    content: {
      type: string;
      content?: string;
      items?: string[];
      headers?: string[];
      rows?: string[][];
    }[];
    notes?: string;
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

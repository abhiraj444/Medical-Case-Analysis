'use server';

/**
 * @fileOverview An AI-powered diagnosis tool that provides provisional diagnoses based on patient data.
 *
 * - aiDiagnosis - A function that handles the diagnosis process.
 * - AiDiagnosisInput - The input type for the aiDiagnosis function.
 * - AiDiagnosisOutput - The return type for the aiDiagnosis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiDiagnosisInputSchema = z.object({
  patientData: z.string().describe('The patient data, including symptoms, medical history, and other relevant information.'),
  supportingDocuments: z.array(z.string()).optional().describe('Optional supporting documents in PDF or JPG format, encoded as data URIs.'),
});
export type AiDiagnosisInput = z.infer<typeof AiDiagnosisInputSchema>;

const DiagnosisSchema = z.object({
  diagnosis: z.string().describe('The potential diagnosis.'),
  confidenceLevel: z.number().describe('The confidence level of the diagnosis (0-1).'),
  reasoning: z.string().describe('The reasoning behind the diagnosis, including details extracted from the patient data.'),
  missingInformation: z.array(z.string()).optional().describe('Missing information or tests needed for a more accurate diagnosis.'),
});

const AiDiagnosisOutputSchema = z.array(DiagnosisSchema);
export type AiDiagnosisOutput = z.infer<typeof AiDiagnosisOutputSchema>;

export async function aiDiagnosis(input: AiDiagnosisInput): Promise<AiDiagnosisOutput> {
  return aiDiagnosisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiDiagnosisPrompt',
  input: {schema: AiDiagnosisInputSchema},
  output: {schema: AiDiagnosisOutputSchema},
  prompt: `You are an AI-powered diagnostic tool that provides a list of potential diagnoses based on the provided patient data.

  Analyze the following patient data and provide a list of potential diagnoses, ranked by confidence level.
  For each diagnosis, explain the reasoning behind it, highlighting details extracted from the patient data.
  Also, identify any missing information or tests needed for a more accurate diagnosis.

  Patient Data: {{{patientData}}}

  {{#if supportingDocuments}}
  Supporting Documents:
  {{#each supportingDocuments}}
  {{media url=this}}
  {{/each}}
  {{/if}}

  Return the diagnoses as a JSON array of Diagnosis objects.  Each Diagnosis object should have fields for diagnosis, confidenceLevel, reasoning, and missingInformation.
`,
});

const aiDiagnosisFlow = ai.defineFlow(
  {
    name: 'aiDiagnosisFlow',
    inputSchema: AiDiagnosisInputSchema,
    outputSchema: AiDiagnosisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

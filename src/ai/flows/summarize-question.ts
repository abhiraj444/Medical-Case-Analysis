'use server';

/**
 * @fileOverview Summarizes and structures a clinical question from text and/or images.
 *
 * - summarizeQuestion - A function that provides a structured summary.
 * - SummarizeQuestionInput - The input type for the function.
 * - SummarizeQuestionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeQuestionInputSchema = z.object({
  question: z.string().optional().describe('The clinical question or patient data text.'),
  images: z.array(z.string()).optional().describe("A list of images related to the clinical question, as data URIs."),
}).superRefine((data, ctx) => {
    if (!data.question && (!data.images || data.images.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either a question or an image must be provided.",
        });
    }
});
export type SummarizeQuestionInput = z.infer<typeof SummarizeQuestionInputSchema>;

const SummarizeQuestionOutputSchema = z.object({
  summary: z.string().describe('A well-structured, eye-pleasing summary of the provided question and/or images. This should be formatted with markdown, including bold text for emphasis on key terms.'),
});
export type SummarizeQuestionOutput = z.infer<typeof SummarizeQuestionOutputSchema>;


export async function summarizeQuestion(input: SummarizeQuestionInput): Promise<SummarizeQuestionOutput> {
  return summarizeQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeQuestionPrompt',
  input: {schema: SummarizeQuestionInputSchema},
  output: {schema: SummarizeQuestionOutputSchema},
  prompt: `You are an AI assistant that structures user input for display. Your primary task is to take the user's raw text and present it while applying simple markdown formatting for better readability.

**Formatting Rules:**
1.  **Preserve Original Wording:** For most of the text, do NOT rephrase or change the user's original wording. Your job is primarily structural formatting.
2.  **Reformat Options:** If the text contains a multiple-choice question with options formatted like "O1:", "O2:", "A)", "B)", etc., you MUST reformat these options into a clean, numbered list. Start the list with a phrase like "The provided options are:". For example, if the input is "What is the diagnosis? O1: X O2: Y", the output should be "What is the diagnosis?\\n\\nThe provided options are:\\n1: X\\n2: Y".
3.  **Image Descriptions:** If images are provided along with text, present the formatted user text first, then add a section describing the key visual findings from the images. If ONLY images are provided, describe the key visual findings in text form.
4.  **No Analysis:** Do not add any analysis, interpretation, or extra content beyond what is asked.

**User Input:**
{{#if question}}
Text: {{{question}}}
{{/if}}
{{#if images}}
Images:
{{#each images}}
{{media url=this}}
{{/each}}
{{/if}}

Provide your response in the required JSON format.
`,
});

const summarizeQuestionFlow = ai.defineFlow(
  {
    name: 'summarizeQuestionFlow',
    inputSchema: SummarizeQuestionInputSchema,
    outputSchema: SummarizeQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

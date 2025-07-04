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
  prompt: `You are an AI assistant that structures user input for display. Your ONLY task is to take the user's raw text and present it verbatim, while applying simple markdown formatting like lists or bolding if it improves readability.

**CRITICAL RULES:**
1.  **DO NOT REPHRASE OR CHANGE THE USER'S ORIGINAL WORDING.** You must output the text exactly as provided.
2.  If images are provided along with text, present the verbatim user text first, then add a section describing the key visual findings from the images.
3.  If ONLY images are provided, describe the key visual findings in text form.
4.  Do not add any analysis, interpretation, or extra content beyond what is asked.

Your job is purely structural formatting of the original content.

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

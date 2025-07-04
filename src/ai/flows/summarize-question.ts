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
  prompt: `You are an expert at processing and summarizing medical information for presentation. Your task is to take the user's raw input (which could be text, images, or both) and create a single, clear, well-structured summary.

Follow these rules:
- **Present the user's text verbatim.** Do not rephrase or alter the content. You may apply markdown formatting like lists and bolding for readability, but the original wording must be preserved.
- If ONLY images are provided, analyze the images and describe the key visual findings in text form.
- If BOTH text and images are provided, present the verbatim user text first, followed by an analysis of the key findings from the images.
- Do NOT add any new medical interpretation or diagnosis. Your only job is to present the user's original query in a more structured and "eye-pleasing" way.

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

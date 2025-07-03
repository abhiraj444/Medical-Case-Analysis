'use server';

/**
 * @fileOverview Generates a slide outline from a given educational topic.
 *
 * - generateSlideOutline - A function that generates a slide outline.
 * - GenerateSlideOutlineInput - The input type for the generateSlideOutline function.
 * - GenerateSlideOutlineOutput - The return type for the generateSlideOutline function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSlideOutlineInputSchema = z.object({
  topic: z.string().describe('The educational topic to generate a slide outline for.'),
});
export type GenerateSlideOutlineInput = z.infer<typeof GenerateSlideOutlineInputSchema>;

const SlideSchema = z.object({
    title: z.string().describe('The title for a single slide.'),
    content: z.string().describe('The content for a single slide, formatted as markdown.'),
});

const GenerateSlideOutlineOutputSchema = z.array(SlideSchema);
export type GenerateSlideOutlineOutput = z.infer<typeof GenerateSlideOutlineOutputSchema>;

export async function generateSlideOutline(input: GenerateSlideOutlineInput): Promise<GenerateSlideOutlineOutput> {
  return generateSlideOutlineFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSlideOutlinePrompt',
  input: {schema: GenerateSlideOutlineInputSchema},
  output: {schema: GenerateSlideOutlineOutputSchema},
  prompt: `You are an expert in medical education. Your task is to generate a detailed slide outline for a presentation on the given topic.

Topic: {{{topic}}}

Follow these rules STRICTLY:
1.  The output must be a JSON array of slide objects. Each object must have a "title" and a "content" field.
2.  The "content" must be a string formatted with markdown.
3.  Use markdown bullet points, starting each with "- ". Use "\\n" for new lines.
4.  To make text bold, enclose it in double asterisks, like this: **Bold Text**.
5.  To create a table, use markdown pipe syntax. The header MUST be separated by a line of hyphens. Text inside tables should NOT be formatted with bold markdown. Example:
    | Header 1 | Header 2 |
    |----------|----------|
    | Data A   | Data B   |
    | Data C   | Data D   |
6.  Keep the content for each slide concise. Aim for a maximum of 5-6 bullet points or one small table per slide. DO NOT create slides with excessive content.

Example Output:
[
  {
    "title": "Introduction to **Type 2 Diabetes**",
    "content": "- Definition and prevalence\\n- Risk factors and pathophysiology\\n- **Key difference** from Type 1"
  },
  {
    "title": "Diagnosis and Screening",
    "content": "- Diagnostic criteria (A1C, FPG, OGTT)\\n- Recommendations for screening\\n- Table of diagnostic thresholds:\\n| Test | Normal | Prediabetes | Diabetes |\\n|------|--------|-------------|----------|\\n| A1C  | <5.7%  | 5.7-6.4%    | >=6.5%   |\\n| FPG  | <100   | 100-125     | >=126    |"
  }
]
`,
});

const generateSlideOutlineFlow = ai.defineFlow(
  {
    name: 'generateSlideOutlineFlow',
    inputSchema: GenerateSlideOutlineInputSchema,
    outputSchema: GenerateSlideOutlineOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

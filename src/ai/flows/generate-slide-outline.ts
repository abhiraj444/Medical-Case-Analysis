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
    content: z.string().describe('The content for a single slide, formatted as markdown bullet points (e.g., "- Point 1\\n- Point 2").'),
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
  prompt: `You are an expert in medical education. Your task is to generate a detailed slide outline for a presentation on the following topic.

Topic: {{{topic}}}

Consider whether the topic is a general medical subject or a specific clinical question. Tailor the outline accordingly.
The output should be a JSON array of slide objects. Each object must have a "title" and a "content" field.
The "content" should be a string with markdown-style bullet points, where each point starts with a "-".

Example:
[
  {
    "title": "Introduction to Type 2 Diabetes",
    "content": "- Definition and prevalence\\n- Risk factors and pathophysiology"
  },
  {
    "title": "Diagnosis and Screening",
    "content": "- Diagnostic criteria (A1C, FPG, OGTT)\\n- Recommendations for screening"
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

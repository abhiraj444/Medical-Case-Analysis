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

const GenerateSlideOutlineOutputSchema = z.object({
  outline: z.string().describe('The generated slide outline.'),
});
export type GenerateSlideOutlineOutput = z.infer<typeof GenerateSlideOutlineOutputSchema>;

export async function generateSlideOutline(input: GenerateSlideOutlineInput): Promise<GenerateSlideOutlineOutput> {
  return generateSlideOutlineFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSlideOutlinePrompt',
  input: {schema: GenerateSlideOutlineInputSchema},
  output: {schema: GenerateSlideOutlineOutputSchema},
  prompt: `You are an expert in medical education. Your task is to generate a detailed slide outline for a presentation on the following topic:

Topic: {{{topic}}}

Consider whether the topic is a general medical subject or a specific clinical question. Tailor the outline accordingly. The outline should be well-structured and comprehensive, suitable for creating an informative and engaging presentation. The outline should include suggested slide titles and a brief summary of the content for each slide.

Outline:`, // Modified prompt to include instructions for formatting.
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

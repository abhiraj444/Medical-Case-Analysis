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
  prompt: `You are an expert in medical education. Your task is to generate a detailed slide outline for a presentation on the given topic. The content should be technically rich, detailed, and suitable for a professional medical audience.

Topic: {{{topic}}}

Follow these rules STRICTLY for the "content" of each slide:
1.  **Format**: The output must be a JSON array of slide objects. Each object must have a "title" and a "content" field.
2.  **Content Detail**: Each bullet point should be a full, descriptive sentence or a detailed phrase. Avoid overly concise or short points. Incorporate technical terminology where appropriate.
3.  **Markdown Formatting**:
    - Use "\\n" for new lines.
    - For bullet points, start the line with "- ".
    - For **nested bullet points**, indent the line with two spaces (e.g., "  - Nested item").
    - For **numbered lists**, use the format "1. ", "2. ", etc.
    - To make text **bold**, enclose it in double asterisks, like this: **Bold Text**.
    - To create a **table**, use markdown pipe syntax. The header MUST be separated by a line of hyphens. Text inside tables should NOT be formatted with bold markdown. Example:
      | Header 1 | Header 2 |
      |----------|----------|
      | Data A   | Data B   |
      | Data C   | Data D   |
4.  **Structure**: Create a logical flow. Do not cram too much information onto one slide. If a topic is complex, break it into multiple slides.

Example of expected "content" format:
"- This is the first main bullet point providing a detailed explanation of a concept.\\n- This is another point, with **important terms** highlighted.\\n  - This is a nested bullet point, providing more detail on the point above.\\n  - Another nested point elaborating further.\\n- The presentation continues with a final point on this slide."
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

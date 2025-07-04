'use server';

/**
 * @fileOverview Generates a presentation outline from a given educational topic.
 *
 * - generateSlideOutline - A function that generates a slide outline.
 * - GenerateSlideOutlineInput - The input type for the generateSlideOutline function.
 * - GenerateSlideOutlineOutput - The return type for the generateSlideOutline function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSlideOutlineInputSchema = z.object({
  topic: z.string().describe('The main topic for the presentation.'),
  question: z.string().optional().describe("The original question or case details provided by the user."),
  answerAndReasoning: z.string().optional().describe("The AI's full answer and reasoning in Markdown format."),
  numberOfSlides: z.string().describe('The desired number of slides, e.g., "8-10".'),
});
export type GenerateSlideOutlineInput = z.infer<typeof GenerateSlideOutlineInputSchema>;

const ContentItemSchema = z.union([
    z.object({ type: z.literal('paragraph'), content: z.string() }),
    z.object({ type: z.literal('list'), items: z.array(z.string()) }),
    z.object({
        type: z.literal('table'),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
    }),
]);

const SlideSchema = z.object({
    title: z.string().describe('The title of the slide. MUST NOT contain slide numbers (e.g., "Slide 1: ...").'),
    content: z.array(ContentItemSchema).describe('An array of content items for the slide body.'),
    notes: z.string().optional().describe('Speaker notes for the presenter for this slide.'),
});

const GenerateSlideOutlineOutputSchema = z.object({
  slides: z.array(SlideSchema).describe('An array of slide objects representing the presentation outline.'),
});
export type GenerateSlideOutlineOutput = z.infer<typeof GenerateSlideOutlineOutputSchema>;

export async function generateSlideOutline(input: GenerateSlideOutlineInput): Promise<GenerateSlideOutlineOutput> {
  const result = await generateSlideOutlineFlow(input);
  return result;
}

const prompt = ai.definePrompt({
  name: 'generateSlideOutlinePrompt',
  input: {schema: GenerateSlideOutlineInputSchema},
  output: {schema: GenerateSlideOutlineOutputSchema},
  prompt: `You are an expert in medical education. Your task is to generate a detailed presentation outline in a structured JSON format. The content should be technically rich, detailed, and suitable for a professional medical audience.

**Source Information:**
- **Main Topic:** {{{topic}}}
- **User's Question/Case & AI's Answer:** {{#if answerAndReasoning}}{{{answerAndReasoning}}}{{else}}Not provided.{{/if}}
- **Desired Presentation Length:** {{{numberOfSlides}}} slides.

**Core Instructions:**

1.  **JSON Structure**: Format the entire output as a single JSON object containing a "slides" array. Each object in the array represents one slide and MUST have "title", "content", and optional "notes" fields.
2.  **Content Types**: The "content" field for each slide must be an array of objects. Each object can be one of three types:
    *   \`{ "type": "paragraph", "content": "..." }\`
    *   \`{ "type": "list", "items": ["item1", "item2", ...] }\`
    *   \`{ "type": "table", "headers": ["H1", "H2"], "rows": [["R1C1", "R1C2"], ["R2C1", "R2C2"]] }\`
3.  **First Slide (if a question is provided):** If "User's Question/Case & AI's Answer" is available, the VERY FIRST slide MUST be titled "Case Presentation". Its content should summarize the original question and the AI's answer. The rest of the presentation should then focus on the **Main Topic**, using the case as a practical example.
4.  **Speaker Notes**: For each slide, provide concise speaker notes in the "notes" field. These notes should offer additional context, talking points, or deeper explanations for the presenter.

**Content Guidelines by Length:**

*   **If Presentation Length is "5-7" or "8-10":**
    *   After the "Case Presentation" slide (if any), dive directly into the **Main Topic**.
    *   The content must be **highly technical and condensed**.
    *   Fill each slide with substantial information. Use tables frequently to compare/contrast concepts or summarize data for better understanding.
    *   Do **NOT** include a "Conclusion" or "Summary" slide. The presentation should end on a technical note.

*   **If Presentation Length is "11-15":**
    *   After the "Case Presentation" slide (if any), provide a comprehensive and descriptive exploration of the **Main Topic**.
    *   The content should still be **highly technical**, but with more detailed explanations.
    *   The presentation should be structured more traditionally.
    *   You **MUST** include dedicated slides for topics like "Management", "Prognosis", and a final "## Conclusion" slide that summarizes the key takeaways.

**Output Format:** Return your response as a JSON object adhering strictly to the \`GenerateSlideOutlineOutputSchema\`.
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

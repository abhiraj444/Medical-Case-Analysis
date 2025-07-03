'use server';

/**
 * @fileOverview Generates a slide outline from a given educational topic in a structured JSON format.
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

// Schemas for structured content
const ParagraphSchema = z.object({
  type: z.enum(['paragraph']),
  text: z.string().describe('A paragraph of text.'),
  bold: z.array(z.string()).optional().describe('An array of substrings from the text to be bolded.'),
});

const BulletListSchema = z.object({
  type: z.enum(['bullet_list']),
  items: z.array(z.string()).describe('An array of strings, where each string is a bullet point.'),
});

const NumberedListSchema = z.object({
  type: z.enum(['numbered_list']),
  items: z.array(z.string()).describe('An array of strings, where each string is a numbered list item.'),
});

const NoteSchema = z.object({
  type: z.enum(['note']),
  text: z.string().describe('A short note or annotation.'),
});

const TableSchema = z.object({
  type: z.enum(['table']),
  headers: z.array(z.string()).describe('An array of strings for the table headers.'),
  rows: z.array(z.array(z.string())).describe('An array of arrays, where each inner array represents a table row.'),
});

const ContentItemSchema = z.union([
  ParagraphSchema,
  BulletListSchema,
  NumberedListSchema,
  NoteSchema,
  TableSchema,
]);

const SlideSchema = z.object({
  title: z.string().describe('The title for a single slide.'),
  content: z.array(ContentItemSchema).describe('An array of content items for the slide body.'),
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

Format the entire output as a JSON array of slide objects. Each slide object must conform to the following rules:
1.  **Slide Object**: Each slide is an object with a "title" (string) and a "content" (array of content items).
2.  **Content Array**: The "content" array contains different types of content objects. Do NOT put too much content on a single slide; create more slides if a topic is complex. Each content item must be an object with a "type" field.

Supported "type" values for content items:
- **"paragraph"**: For a block of text.
  - "text": The full paragraph string.
  - "bold": (Optional) An array of substrings from "text" that should be formatted as bold.
- **"bullet_list"**: For an unordered list.
  - "items": An array of strings, where each string is a bullet point.
- **"numbered_list"**: For an ordered list.
  - "items": An array of strings, where each string is a list item.
- **"note"**: For a brief, supplementary note.
  - "text": The content of the note.
- **"table"**: For tabular data.
  - "headers": An array of strings for the table column headers.
  - "rows": An array of arrays, where each inner array contains the string values for a single row.

Example:
[
  {
    "title": "Introduction to Condition X",
    "content": [
      { "type": "paragraph", "text": "Condition X is a chronic inflammatory disease affecting the joints.", "bold": ["Condition X", "chronic inflammatory disease"] },
      { "type": "bullet_list", "items": ["Symptom A", "Symptom B"] }
    ]
  },
  {
    "title": "Diagnostic Criteria",
    "content": [
       { "type": "table", "headers": ["Criteria", "Description"], "rows": [["Criteria 1", "Details for 1"], ["Criteria 2", "Details for 2"]] }
    ]
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

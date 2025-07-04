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
import type { Slide } from '@/types';

const GenerateSlideOutlineInputSchema = z.object({
  topic: z.string().describe('The main topic for the presentation.'),
  question: z.string().optional().describe("The original question or case details provided by the user."),
  answer: z.string().optional().describe("The AI's direct answer to the question."),
  reasoning: z.string().optional().describe("The AI's detailed reasoning for the answer."),
  numberOfSlides: z.string().describe('The desired number of slides, e.g., "8-10".'),
});
export type GenerateSlideOutlineInput = z.infer<typeof GenerateSlideOutlineInputSchema>;

// Schemas for structured content
const ParagraphSchema = z.object({
  type: z.enum(['paragraph']),
  text: z.string().describe('A paragraph of text.'),
  bold: z.array(z.string()).optional().describe('An array of substrings from the text to be bolded.'),
});

const ListItemSchema = z.object({
  text: z.string().describe('The text for a single list item.'),
  bold: z.array(z.string()).optional().describe('An array of substrings from the text to be bolded.'),
});

const BulletListSchema = z.object({
  type: z.enum(['bullet_list']),
  items: z.array(ListItemSchema).describe('An array of bullet point objects.'),
});

const NumberedListSchema = z.object({
  type: z.enum(['numbered_list']),
  items: z.array(ListItemSchema).describe('An array of numbered list item objects.'),
});

const NoteSchema = z.object({
  type: z.enum(['note']),
  text: z.string().describe('A short note or annotation.'),
});

const TableRowSchema = z.object({
  cells: z.array(z.string()).describe('An array of strings representing the cells in this row.'),
});

const TableSchema = z.object({
  type: z.enum(['table']),
  headers: z.array(z.string()).describe('An array of strings for the table headers.'),
  rows: z.array(TableRowSchema).describe('An array of row objects, where each object contains the cells for a table row.'),
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
  const result = await generateSlideOutlineFlow(input) as Slide[];
  return result;
}

const prompt = ai.definePrompt({
  name: 'generateSlideOutlinePrompt',
  input: {schema: GenerateSlideOutlineInputSchema},
  output: {schema: GenerateSlideOutlineOutputSchema},
  prompt: `You are an expert in medical education. Your task is to generate a detailed slide outline for a presentation. The content should be technically rich, detailed, and suitable for a professional medical audience.

**Source Information:**
- **Main Topic:** {{{topic}}}
- **User's Question/Case:** {{#if question}}{{{question}}}{{else}}Not provided.{{/if}}
- **Direct Answer:** {{#if answer}}{{{answer}}}{{else}}Not provided.{{/if}}
- **Detailed Reasoning:** {{#if reasoning}}{{{reasoning}}}{{else}}Not provided.{{/if}}
- **Desired Presentation Length:** {{{numberOfSlides}}} slides.

**Core Instructions:**

1.  **Structure based on Presentation Length:** Adhere strictly to the guidelines for the specified presentation length.

2.  **First Slide (if a question is provided):** If a "User's Question/Case" is available, the VERY FIRST slide MUST be titled "Case Presentation". This slide must contain:
    *   The full text of the "User's Question/Case".
    *   The "Direct Answer".
    *   A concise, well-written summary of the "Detailed Reasoning".
    The rest of the presentation should then focus on the **Main Topic**, using the case as a practical example.

3.  **Content Guidelines by Length:**

    *   **If Presentation Length is "5-7" or "8-10":**
        *   After the "Case Presentation" slide (if any), dive directly into the **Main Topic**.
        *   The content must be **highly technical and condensed**.
        *   Fill each slide with substantial information. Use tables frequently to compare/contrast concepts or summarize data for better understanding.
        *   Do **NOT** include a "Conclusion" or "Summary" slide. The presentation should end on a technical note.

    *   **If Presentation Length is "11-15":**
        *   After the "Case Presentation" slide (if any), provide a comprehensive and descriptive exploration of the **Main Topic**.
        *   The content should still be **highly technical**, but with more detailed explanations.
        *   The presentation should be structured more traditionally.
        *   You **MUST** include dedicated slides for topics like "Management", "Prognosis", and a final "Conclusion" slide that summarizes the key takeaways.

**Formatting Rules:**
Format the entire output as a JSON array of slide objects. Each slide object must conform to the following rules:
1.  **Slide Object**: Each slide is an object with a "title" (string) and a "content" (array of content items).
2.  **Content Breakdown**: Deconstruct complex topics into multiple small, distinct points. Use \`bullet_list\` or \`numbered_list\` extensively. Each item in a list should be concise. Avoid long paragraphs; use lists to convey information concisely. For each slide, aim for a maximum of 6-8 distinct points (bullets, list items, or table rows) to ensure clarity and readability.
3.  **Content Array**: The "content" array contains different types of content objects. Do NOT put too much content on a single slide; create more slides if a topic is complex. Each content item must be an object with a "type" field.
4.  **Bolding**: For "paragraph" and list "items", use the \`bold\` array to specify substrings of the \`text\` that should be bolded. **Do NOT use markdown like \`**text**\` inside any text fields.**

Supported "type" values for content items:
- **"paragraph"**: For a block of text. This should be used sparingly.
  - "text": The full paragraph string.
  - "bold": (Optional) An array of substrings from "text" that should be formatted as bold.
- **"bullet_list"**: For an unordered list.
  - "items": An array of list item objects. Each object must have a "text" field and can have an optional "bold" array.
- **"numbered_list"**: For an ordered list.
  - "items": An array of list item objects. Each object must have a "text" field and can have an optional "bold" array.
- **"note"**: For a brief, supplementary note.
  - "text": The content of the note.
- **"table"**: For tabular data.
  - "headers": An array of strings for the table column headers.
  - "rows": An array of row objects. Each object has a "cells" property, which is an array of strings for that row.

Example:
[
  {
    "title": "Introduction to Condition X",
    "content": [
      { "type": "paragraph", "text": "Condition X is a chronic inflammatory disease affecting the joints.", "bold": ["Condition X", "chronic inflammatory disease"] },
      { "type": "bullet_list", "items": [ { "text": "Symptom A" }, { "text": "Symptom B is more complex.", "bold": ["Symptom B"] } ] }
    ]
  },
  {
    "title": "Diagnostic Criteria",
    "content": [
       { "type": "table", "headers": ["Criteria", "Description"], "rows": [{ "cells": ["Criteria 1", "Details for 1"] }, { "cells": ["Criteria 2", "Details for 2"] }] }
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

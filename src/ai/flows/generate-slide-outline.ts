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

Your primary goal is to create an educational presentation about the **Main Topic**. If a **User's Question/Case** is provided, you should use it as a case study to introduce and illustrate the concepts within the broader presentation.

The presentation should have approximately {{{numberOfSlides}}} slides.

**Source Information:**
- **Main Topic:** {{{topic}}} (This is the highest priority and the core subject of the presentation).
- **User's Question/Case:** {{#if question}}{{{question}}}{{else}}Not provided.{{/if}} (Use this as a starting point or case study).
- **Direct Answer:** {{#if answer}}{{{answer}}}{{else}}Not provided.{{/if}}
- **Detailed Reasoning:** {{#if reasoning}}{{{reasoning}}}{{else}}Not provided.{{/if}}

**Instructions:**
1.  **Title Slide:** Create a title slide based on the **Main Topic**.
2.  **Case Introduction:** If a user question is available, create one or two slides to present the case, the direct answer, and key points from the reasoning. This sets the stage.
3.  **Main Content:** The majority of the slides should be a deep dive into the **Main Topic**. Expand on the concepts mentioned in the reasoning and provide a comprehensive educational overview. The presentation should be a thorough exploration of the topic, not just an analysis of the single case.
4.  **Logical Flow:** Ensure the presentation flows logically from the case-specific introduction to the general topic.
5.  **Formatting:** Format the entire output as a JSON array of slide objects as specified below.

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

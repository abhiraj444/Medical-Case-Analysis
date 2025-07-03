'use server';
/**
 * @fileOverview Modifies an existing slide deck based on user actions.
 *
 * - modifySlides - A function that handles slide modification.
 * - ModifySlidesInput - The input type for the modifySlides function.
 * - ModifySlidesOutput - The return type for the modifySlides function.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SlideSchema = z.object({
  title: z.string().describe('The title for a single slide.'),
  content: z.string().describe('The content for a single slide, formatted as markdown bullet points.'),
});

const ModifySlidesInputSchema = z.object({
  slides: z.array(SlideSchema).describe('The current array of slide objects.'),
  selectedIndices: z.array(z.number()).describe('The indices of the slides to be modified.'),
  action: z.enum(['expand_content', 'replace_content', 'expand_selected']).describe('The modification action to perform.'),
});
export type ModifySlidesInput = z.infer<typeof ModifySlidesInputSchema>;

const ModifySlidesOutputSchema = z.array(SlideSchema);
export type ModifySlidesOutput = z.infer<typeof ModifySlidesOutputSchema>;


export async function modifySlides(input: ModifySlidesInput): Promise<ModifySlidesOutput> {
  return modifySlidesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'modifySlidesPrompt',
  input: {schema: ModifySlidesInputSchema},
  output: {schema: ModifySlidesOutputSchema},
  prompt: `You are an AI assistant for creating medical presentations. You will be given an array of presentation slides, the indices of selected slides, and an action to perform on them. Your task is to modify the slides and return the complete, updated array of all slides.

IMPORTANT: The 'content' of each slide is in markdown format. You MUST preserve this format in your output. Use **Bold Text** for emphasis and markdown pipe tables for data.

ACTION: {{{action}}}

CURRENT SLIDES:
{{{json slides}}}

SELECTED SLIDE INDICES:
{{{json selectedIndices}}}

INSTRUCTIONS:
- If the action is 'expand_content':
  - Take the topics from the selected slides.
  - Generate more detailed content for these topics.
  - This may result in creating MORE slides than were originally selected.
  - Replace the selected slides in the original array with the new, expanded slides you generate.
- If the action is 'replace_content':
  - Generate alternative content for the selected slides, keeping the same topics and titles.
  - The number of slides returned should be the same as the number of selected slides.
  - Replace the selected slides in the original array with the new ones.
- If the action is 'expand_selected':
  - Add more in-depth technical explanations and details to the 'content' of the selected slides.
  - Do NOT change the slide titles.
  - Do NOT add new slides. Just enrich the content of the existing selected slides.
  - Keep the content in markdown bullet point format.

Your final output MUST be the complete array of all slides (modified and unmodified) in the correct order, formatted as a JSON array of objects with "title" and "content" keys.
`,
});

const modifySlidesFlow = ai.defineFlow(
  {
    name: 'modifySlidesFlow',
    inputSchema: ModifySlidesInputSchema,
    outputSchema: ModifySlidesOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);

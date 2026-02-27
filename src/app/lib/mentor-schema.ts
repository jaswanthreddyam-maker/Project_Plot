/**
 * Mentor Output Schema
 *
 * Zod contract that physically constrains the LLM to return
 * structured JSON instead of free-form markdown.
 */

import { z } from "zod";

export const mentorOutputSchema = z.object({
    code: z.string().describe(
        "The full source code segment being explained. " +
        "Displayed in the Monaco Editor left column."
    ),
    explanationSteps: z.array(
        z.object({
            heading: z.string().describe(
                "A short, descriptive title for this explanation step. " +
                "Do NOT include any markdown symbols like #, *, or -."
            ),
            description: z.string().describe(
                "A clear paragraph explaining this step of the code logic. " +
                "Do NOT include any markdown symbols like #, *, or -. " +
                "The UI handles all formatting."
            ),
        })
    ).describe(
        "A structured list of explanation steps. Each step has a heading and description. " +
        "Do NOT use markdown bullet points, bolding (**), or headers (#) anywhere."
    ),
    diagramSyntax: z.string().describe(
        "Valid Mermaid.js flowchart or sequence diagram syntax. " +
        "Represents the logic flow of the provided code. " +
        "Start with 'graph TD' or 'sequenceDiagram'."
    ),
    expectedOutput: z.string().describe(
        "The expected console output or return value when this code runs. " +
        "Show realistic sample output. Use plain text only, no markdown."
    ),
});

export type MentorOutput = z.infer<typeof mentorOutputSchema>;

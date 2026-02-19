
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        const { action, payload } = await req.json();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let resultText = "";

        if (action === 'mirror') {
            const { image, mimeType } = payload;

            const prompt = `
        Analyze this worksheet and perform a precise structural and spatial parsing. 
        CRITICAL: I need to reconstruct this worksheet EXACTLY as it appears. 

        Identify every element on the page including:
        - Header Labels (e.g., "Name:", "Date:", "Score:")
        - Question numbers (e.g., "1.", "2)")
        - Pure Math Problems (type: 'problem'). content MUST be a standalone equation (e.g. "x^2 + 5 = 10"). Do NOT put instructions or sentences here.
        - Word Problems / Mixed Content (type: 'word_problem'). Use this for ANY content that contains words, sentences, or instructions.
             CRITICAL: If the text contains math, wrap the math parts in LaTeX delimiters.
             Use \\( ... \\) for inline math and \\\[ ... \\\] for block math.
             Example: "Solve for \\(x\\) in the equation \\(y = mx + b\\)." NOT "$x$" or "x"
        - Currency/Money: Use a plain $ sign (e.g., "$10.00"). DO NOT escape it with a backslash (no "\$").
        - Diagrams or Graphs (CRITICAL: Only identify charts, graphs, or geometric figures ESSENTIAL to solving a problem. Do NOT include logos, clipart, or page borders).
        - Section Headers (e.g., "Part A", "Geometry")
        - Response Areas (CRITICAL: Identify ALL underlines '_______', empty boxes, or writing spaces intended for student answers. Extract as type 'response_area').
        - Footer or instructions (type: 'instruction'). Treat same as 'word_problem' for mixed math/text.

        LAYOUT RULES:
        1. Bounding Boxes: Provide generous [ymin, xmin, ymax, xmax] boxes (normalized 0-1000). 
           - CRITICAL: Math problems and Word Problems NEED vertical breathing room. Give them 30% MORE vertical height (ymin, ymax).
           - CRITICAL: Question Numbers (e.g. "1.") MUST be kept separate from the Problem Text. Ensure their boxes do NOT overlap.
           - IGNORE logos, school branding, or decorative images at the top/corners of the page.
           - IGNORE copyright symbols (©), publisher names, website URLs, and page numbers at the bottom.
           - Ensure the width (xmax-xmin) is wide enough to contain full content without clipping.
           - If a problem has multiple lines, group them or ensure boxes are vertically aligned.
        2. Visual Hierarchy: Detect font size (in pts), font weight (bold/normal), horizontal alignment (left/center/right), and font family (serif/sans-serif).
        3. Mirroring:
           - For every problem (math or word), generate a "Mirrored" version using different numbers/variables/scenarios but maintaining the same logic and difficulty.
           - Return the mirrored problem in LaTeX for equations, or text for word problems.
           - For diagrams, if possible, describe a mirrored version or keep the original description.
           - For Response Areas, keep them as is (e.g. "__________" or "[Box]").
           - Keep labels like "Name:" or "Date:" as they are.

        GENERATE JSON:
        Return strict JSON in this format:
        {
          "title": "Clear Title of Worksheet",
          "elements": [
            {
              "id": "unique_id",
              "type": "header" | "problem" | "question_number" | "white_space" | "instruction" | "word_problem" | "diagram" | "section_header" | "response_area",
              "content": "Original text or LaTeX",
              "mirroredContent": "New problem LaTeX/text or original label",
              "boundingBox": [ymin, xmin, ymax, xmax],
              "style": {
                "fontSize": number,
                "fontWeight": "normal" | "bold",
                "alignment": "left" | "center" | "right",
                "fontFamily": "serif" | "sans-serif"
              }
            }
          ]
        }
      `;

            const result = await model.generateContent([
                prompt,
                { inlineData: { data: image, mimeType: mimeType } }
            ]);
            const response = await result.response;
            resultText = response.text();

        } else if (action === 'generate') {
            const { topic, gradeLevel, difficulty, questionCount, wordProblemPercent } = payload;

            const prompt = `
        Create a ${gradeLevel} math worksheet about "${topic}".
        Difficulty: ${difficulty}.
        
        Total Questions: ${questionCount}.
        Target Composition:
        - Word Problems: ${Math.round(questionCount * (wordProblemPercent / 100))}
        - Pure Equations: ${questionCount - Math.round(questionCount * (wordProblemPercent / 100))}

        Generate exactly ${questionCount} distinct problems.

        RETURN A RAW TEXT BLOCK using these exact delimiters. Do not use Markdown or JSON.

        ---TITLE---
        Creative Title Here
        ---PROBLEM---
        Type: problem
        Content: \\frac{1}{2} + \\frac{1}{3}
        Solution: \\( \\frac{5}{6} \\)
        ---PROBLEM---
        Type: word_problem
        Content: A train leaves a station...
        Solution: 120 miles. Logic: Distance = Speed * Time.
        ---PROBLEM---
        ...

        RULES:
        1. CONTENT for 'problem' types must be **PURE LATEX ONLY**. NO TEXT. NO "Calculate". NO "Solve".
        2. CONTENT for 'word_problem' types must use \\( ... \\) around ALL math expressions.
        3. Do NOT escape currency symbols like \\$10 anymore. Just use $10. The system uses LaTeX delimiters for math now.
        4. Maintain proper sentence structure and spacing in word problems.
        5. Do NOT use command words like 'Solve' in 'problem' content. Just the expression.
        6. **ABSOLUTELY CRITICAL**: You MUST provide a "Solution" for every problem. 
           - For numerical problems, provide the final number or expression.
           - For word problems, providing the final answer + a very brief 1-sentence explanation of the logic.
        7. **STRICT RATIO**: You MUST generate exactly ${Math.round(questionCount * (wordProblemPercent / 100))} Word Problems and ${questionCount - Math.round(questionCount * (wordProblemPercent / 100))} Equations. Do not vary from this.
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            resultText = response.text();
        } else {
            throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: resultText }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})

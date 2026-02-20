
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
        CRITICAL: I need to reconstruct this worksheet EXACTLY as it appears, but IGNORING any student work.

        Identified Elements:
        1. **Header Labels**: (e.g., "Name:", "Date:", "Score:")
        2. **Question Numbers**: (e.g., "1.", "2)") - Keep separate from problem text.
        3. **Math Problems** (type: 'problem'):
           - CRITICAL: Content MUST be wrapped in LaTeX delimiters: \\( ... \\) for inline, \\[ ... \\] for block.
           - Example: "\\( x^2 + 5 = 10 \\)" (Note the double backslashes for JSON).
           - Ignore student handwriting/answers. Only extract the printed equation.
        4. **Word Problems** (type: 'word_problem'):
           - Use for mixed text/math.
           - Wrap ALL math expressions in \\( ... \\).
        5. **Instructions** (type: 'instruction'): Section headers or directions.
        6. **Response Areas** (type: 'response_area'): Underscores '______' or empty boxes.

        LAYOUT RULES:
        - **Bounding Boxes**: [ymin, xmin, ymax, xmax] (0-1000). 
        - **Ignore Handwriting**: Do NOT transcribe pencil marks, scribbles, or handwritten answers. If a problem has an answer written next to it, ignore the answer.
        - **Ignore Distractions**: Ignore logos, page borders, and copyright text.
        - **Title Extraction**: Look for the main title at the top (e.g., "Algebra 1 Review"). If missing, generate a short, descriptive title based on the equations (e.g., "Quadratic Equations").

        OUTPUT FORMAT (BLOCKS):
        Do NOT return JSON. Return a RAW TEXT list of elements using these exact delimiters.

        ---TITLE---
        [The Worksheet Title]
        ---ELEMENT---
        Type: problem
        Box: [100, 50, 200, 450]
        Content: \( x^2 + 5 = 10 \)
        Mirrored: \( y^2 - 3 = 13 \)
        Solution: \( y = \pm 4 \)
        ---ELEMENT---
        Type: header
        Box: [10, 10, 50, 300]
        Content: Name: ________________
        Mirrored: Name: ________________
        Solution: N/A
        ---ELEMENT---
        Type: instruction
        Box: [300, 50, 350, 950]
        Content: Solve for x.
        Mirrored: Solve for variables.
        Solution: N/A
        ...

        RULES for CONTENT:
        1. **NO JSON ESCAPING**: Write LaTeX exactly as is. e.g. use \frac, not \\frac.
        2. **Math Delimiters**: ALWAYS wrap math in \( ... \) for inline or \[ ... \] for block.
        3. **Solutions**: You MUST provide a solution for the *Mirrored* problem.
        4. **Type**: Must be one of: header, problem, question_number, white_space, instruction, word_problem, diagram, section_header, response_area.
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
1. CONTENT for 'problem' types must be ** PURE LATEX ONLY **.NO TEXT.NO "Calculate".NO "Solve".
        2. CONTENT for 'word_problem' types must use \\(... \\) around ALL math expressions.
        3. Do NOT escape currency symbols like \\$10 anymore.Just use $10.The system uses LaTeX delimiters for math now.
        4. Maintain proper sentence structure and spacing in word problems.
        5. Do NOT use command words like 'Solve' in 'problem' content.Just the expression.
        6. ** ABSOLUTELY CRITICAL **: You MUST provide a "Solution" for every problem. 
           - For numerical problems, provide the final number or expression.
           - For word problems, providing the final answer + a very brief 1 - sentence explanation of the logic.
        7. ** STRICT RATIO **: You MUST generate exactly ${Math.round(questionCount * (wordProblemPercent / 100))} Word Problems and ${questionCount - Math.round(questionCount * (wordProblemPercent / 100))} Equations.Do not vary from this.
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            resultText = response.text();
        } else {
            throw new Error(`Unknown action: ${action} `);
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

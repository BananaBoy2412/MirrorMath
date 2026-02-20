
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
        Analyze this worksheet image. 
        GOAL: Extract the structure and content to create a mirrored version.
        
        CRITICAL INSTRUCTIONS:
        1. **STRUCTURE**: Transcribe the EXACT structure of the worksheet (same number of problems, same layout).
        2. **CONTENT (Original)**: In the 'Content' field, transcribe the problem EXACTLY as seen in the image (Raw LaTeX).
        3. **MIRRORED (New)**: In the 'Mirrored' field, you MUST generate a **NEW, DISTINCT** problem that tests the SAME skill but with DIFFERENT numbers/variables.
           - **DO NOT COPY** the original problem to the 'Mirrored' field.
           - The 'Mirrored' problem must be solvably equivalent (same difficulty).
        4. **STOP CONDITION**: Stop outputting after the last problem.
        5. **IGNORE HANDWRITING**: Ignore student answers/scribbles.

        Identified Elements:
        1. **Header Labels**: (Name, Date, Score) -> Type: 'header'
        2. **Math Problems**: Type: 'problem'. Content = Raw LaTeX. Mirrored = NEW Raw LaTeX.
        3. **Word Problems**: Type: 'word_problem'.
        4. **Instructions**: Type: 'instruction'.
        
        NEGATIVE CONSTRAINTS:
        - Do NOT copy the original problem into the 'Mirrored' field. They must be different.
        - Do NOT transcribe ghost marks/scribbles.
        
        OUTPUT FORMAT (Strict):
        ---TITLE---
        [Worksheet Title]
        ---ELEMENT---
        Type: header | problem | instruction | word_problem | section_header
        Box: [y1, x1, y2, x2]
        Content: [Original Problem Raw LaTeX]
        Mirrored: [NEW UNIQUE VARIANT Raw LaTeX]
        Solution: [Answer to MIRRORED problem]
        ---ELEMENT---
        ...
        (Stop after last element)
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

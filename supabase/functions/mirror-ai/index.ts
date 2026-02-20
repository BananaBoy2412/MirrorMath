
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
        1. **TRANSCRIBE ONLY**: Do NOT create new problems. Transcribe ONLY what is visible in the image.
        2. **STOP CONDITION**: Stop outputting immediately after the last problem on the page. Do not invent extra problems.
        3. **Math Formatting**: 
           - For 'problem' type: Return **RAW LATEX** (e.g., "x^2 + 5" or "\frac{1}{2}"). Do **NOT** wrap in \( \).
           - For 'word_problem' type: Wrap math in \( ... \) (mixed text).
        4. **IGNORE HANDWRITING**: This is a blank worksheet reconstruction. Ignore ALL pencil marks, scribbles, and student answers.
        
        NEGATIVE CONSTRAINTS (What NOT to include):
        - Do NOT transcribe handwritten numbers in margins or near problems.
        - Do NOT transcribe "Ghost" problems from scribbles or dirty scans.
        - Do NOT use the "Name" field as the Title. Look for a bold, centered header at the top (e.g. "Chapter 5").
        - If you are less than 90% sure a mark is a printed problem, SKIP IT.

        Identified Elements:
        1. **Header Labels**: (Name, Date, Score) -> Type: 'header'
        2. **Math Problems**: Type: 'problem'. Content is RAW LaTeX.
        3. **Word Problems**: Type: 'word_problem'. Content is text with \( math \).
        4. **Instructions**: Type: 'instruction'.
        
        LAYOUT & BOUNDING BOXES:
        - Provide [ymin, xmin, ymax, xmax] (0-1000) for every element.
        
        OUTPUT FORMAT (Strict):
        ---TITLE---
        [Worksheet Title]
        ---ELEMENT---
        Type: header | problem | instruction | word_problem | section_header
        Box: [y1, x1, y2, x2]
        Content: [Raw LaTeX for problems, Mixed Text for others]
        Mirrored: [Logically equivalent variant]
        Solution: [Answer to Mirrored]
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

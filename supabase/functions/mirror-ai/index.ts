import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3"

// Silence IDE errors for Deno global while maintaining runtime compatibility
declare const Deno: any;

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
        Analyze this worksheet image using a LAYOUT-FIRST architecture.
        
        STAGE 1: SPATIAL MAPPING (Analyze)
        - Map the document's geometry precisely.
        - Preserve whitespace, column structures, and the relative positions of elements.
        - Look for bold headers that define sections.
        
        STAGE 2: EXTRACTION & TRANSFORMATION (Extract & Transform)
        - Convert all mathematical text into sanitized, validated LaTeX strings.
        - IMPLEMENT 'MATHEMATICAL TWIN' LOGIC:
            - Create a "Mirrored" version of every problem.
            - DO NOT just change numbers randomly. Keep the "Mathematical DNA" identical.
            - CONSTRAINTS: If the original has an integer solution, the twin MUST have an integer solution. If the original uses specific constants (like sqrt(3) for 30-60-90 triangles), the twin MUST use appropriate similar constants.
            - DIFFICULTY: The cognitive load and steps required to solve the twin must be identical to the original.
        
        STAGE 3: GEOMETRIC RENDERING (Render)
        - If a diagram is present (e.g., triangle, circle, graph):
            - Transcribe its intent as 'diagram'.
            - Provide a clean, minimalist SVG string in the 'SVG' field that visually represents the problem.
            - For GEOMETRY: If it's a special right triangle, the SVG should be a correctly proportioned right triangle with appropriate labels.
        
        CRITICAL RULES:
        1. **Math Formatting**: 
           - 'problem' type: RAW LaTeX (e.g., "\\frac{x}{2} = 10"). No delimiters.
           - 'word_problem' type: Text with \\( math \\).
        2. **STOP CONDITION**: Stop after the last visible printed problem. Ignore student handwriting/marks.
        3. **Title Extraction**: Ignore "Name/Date" lines. Find the central thematic title of the worksheet.
        
        OUTPUT FORMAT (Strict):
        ---TITLE---
        [Worksheet Title]
        ---ELEMENT---
        Type: header | section_header | problem | word_problem | instruction | diagram | response_area
        Box: [ymin, xmin, ymax, xmax] (0-1000 scale)
        Content: [Original LaTeX/Text]
        Mirrored: [Mathematical Twin LaTeX/Text]
        Solution: [Answer to Mirrored]
        SVG: [Minimal SVG string if diagram, else "N/A"]
        ---ELEMENT---
        ...
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
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});


const SUPABASE_URL = 'https://ztzvlzicrpkjhbvkdlea.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0enZsemljcnBramhidmtkbGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzY2NzYsImV4cCI6MjA4NzExMjY3Nn0.eZb97dmOS4Fsz3gDrH2m4dKu9B3g9SPHP0j8EH1kFOQ';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/mirror-ai`;

async function testFunction() {
    console.log(`Testing Edge Function at: ${FUNCTION_URL}`);

    const payload = {
        action: 'generate',
        payload: {
            topic: 'Algebra',
            grade: '9th',
            difficulty: 'Medium',
            questionCount: 3
        }
    };

    try {
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status Code: ${response.status}`);
        const text = await response.text();
        console.log(`Response Body: ${text}`);

    } catch (error) {
        console.error('Network Error:', error);
    }
}

testFunction();

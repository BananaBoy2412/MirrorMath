
export interface LayoutElement {
    id: string;
    type: 'header' | 'question_number' | 'problem' | 'white_space' | 'footer' | 'instruction' | 'word_problem' | 'diagram' | 'section_header' | 'response_area';
    content: string;
    mirroredContent?: string;
    solution?: string;
    skill?: string;
    boundingBox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] (normalized 0-1000)
    style?: {
        fontSize: number;
        fontWeight: 'normal' | 'bold' | 'lighter';
        alignment: 'left' | 'center' | 'right';
        fontFamily?: 'serif' | 'sans-serif';
    };
}

export type ViewState = 'home' | 'mirror' | 'generator' | 'archive' | 'settings' | 'detail';

export interface Worksheet {
    id: string;
    title: string;
    type: 'Mirror' | 'Topic';
    date: string; // ISO string ideally, but keeping as string to match current usage
    elements?: LayoutElement[];
    originalImageUrl?: string; // This can be base64 or URL
    content?: {
        problems: Array<{
            original: string;
            mirrored: string;
            solution: string;
            skill: string;
        }>;
        solution?: string;
        showAnswers?: boolean;
    };
    isArchived?: boolean;

    // Supabase specific fields (optional as local version might not have them immediately)
    user_id?: string;
    created_at?: string;
    updated_at?: string;
    original_image_path?: string;
}

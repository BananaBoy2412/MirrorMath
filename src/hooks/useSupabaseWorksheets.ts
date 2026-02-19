
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Worksheet } from '../types';
import { useAuth } from '../context/AuthContext';

export const useSupabaseWorksheets = () => {
    const { session } = useAuth();
    const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWorksheets = useCallback(async () => {
        if (!session?.user) {
            setWorksheets([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('worksheets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map the database rows to our Worksheet type
            const mappedWorksheets: Worksheet[] = (data || []).map(row => ({
                id: row.id,
                title: row.title,
                type: row.type as 'Mirror' | 'Topic',
                date: row.date,
                isArchived: row.is_archived,
                originalImageUrl: row.original_image_path
                    ? supabase.storage.from('worksheet-images').getPublicUrl(row.original_image_path).data.publicUrl
                    : undefined,
                ...row.data // Spread the JSONB data (elements, content, etc.)
            }));

            setWorksheets(mappedWorksheets);
        } catch (err: any) {
            console.error('Error fetching worksheets:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [session]);

    // Cleanup subscription or re-fetch when session changes
    useEffect(() => {
        fetchWorksheets();
    }, [fetchWorksheets]);

    const createWorksheet = async (worksheet: Worksheet, imageBlob?: Blob) => {
        if (!session?.user) return null;

        try {
            let imagePath = null;
            if (imageBlob) {
                const fileName = `${session.user.id}/${Date.now()}_${worksheet.id}.png`;
                const { error: uploadError } = await supabase.storage
                    .from('worksheet-images')
                    .upload(fileName, imageBlob);

                if (uploadError) throw uploadError;
                imagePath = fileName;
            }

            // Prepare payload
            const payload = {
                user_id: session.user.id,
                title: worksheet.title,
                type: worksheet.type,
                date: worksheet.date,
                original_image_path: imagePath,
                is_archived: worksheet.isArchived || false,
                data: {
                    elements: worksheet.elements,
                    content: worksheet.content,
                    // Store strict relevant data in JSONB, exclude metadata stored in columns
                }
            };

            const { data, error } = await supabase
                .from('worksheets')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;

            // Optimistic update or refetch
            const newWorksheet: Worksheet = {
                ...worksheet,
                id: data.id, // Use DB generated ID (or keep local if we forced it? DB gen is safer)
                originalImageUrl: imagePath
                    ? supabase.storage.from('worksheet-images').getPublicUrl(imagePath).data.publicUrl
                    : undefined
            };

            setWorksheets(prev => [newWorksheet, ...prev]);
            return newWorksheet;

        } catch (err: any) {
            console.error('Error creating worksheet:', err);
            setError(err.message);
            throw err;
        }
    };

    const updateWorksheet = async (id: string, updates: Partial<Worksheet>) => {
        if (!session?.user) return;

        try {
            // If we are updating strictly metadata, just update columns. 
            // If updating content/elements, update JSONB data.

            const payload: any = {};
            if (updates.title) payload.title = updates.title;
            if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;

            // Check if we need to update the data JSONB
            if (updates.elements || updates.content) {
                // We need to fetch current data first? Or just merge in JS before sending?
                // For now, let's assume if 'elements' is passed, we overwrite the data block with new elements
                // This might be risky if we partial update inside data.
                // Safer: 
                const { data: current } = await supabase.from('worksheets').select('data').eq('id', id).single();
                const currentData = current?.data || {};
                payload.data = {
                    ...currentData,
                    ...(updates.elements && { elements: updates.elements }),
                    ...(updates.content && { content: updates.content })
                };
            }

            const { error } = await supabase
                .from('worksheets')
                .update(payload)
                .eq('id', id);

            if (error) throw error;

            setWorksheets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));

        } catch (err: any) {
            console.error('Error updating worksheet:', err);
            setError(err.message);
            throw err;
        }
    };

    const deleteWorksheet = async (id: string) => {
        if (!session?.user) return;

        try {
            // Get image path first to delete from storage
            const worksheet = worksheets.find(w => w.id === id);

            // Delete record
            const { error } = await supabase
                .from('worksheets')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Delete image if exists
            // Since we don't store the raw path locally in the Worksheet type (only URL), we might need to query it or parse the URL.
            // Simplified: let's rely on cascading deletes if we set it up, but storage isn't cascaded.
            // We'll skip storage delete for now to avoid complexity or handle it if we stored the path. 
            // Better behavior: We *should* store the path in our local type if we want to manage it.
            // I added `original_image_path` to the type definitions optionally. Check types.ts

            setWorksheets(prev => prev.filter(w => w.id !== id));

        } catch (err: any) {
            console.error('Error deleting worksheet:', err);
            setError(err.message);
            throw err;
        }
    };

    return {
        worksheets,
        loading,
        error,
        createWorksheet,
        updateWorksheet,
        deleteWorksheet,
        refresh: fetchWorksheets
    };
};

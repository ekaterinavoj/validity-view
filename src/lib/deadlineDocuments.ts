import { supabase } from "@/integrations/supabase/client";

export interface DeadlineDocument {
  id: string;
  deadline_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  document_type: "certificate" | "protocol" | "report" | "other";
  uploaded_at: string;
  uploaded_by: string | null;
  description: string | null;
}

export const DEADLINE_DOCUMENT_TYPE_LABELS = {
  certificate: "Certifikát",
  protocol: "Protokol",
  report: "Revizní zpráva",
  other: "Jiné",
};

/**
 * Upload file to Supabase Storage for deadline
 */
export async function uploadDeadlineDocument(
  deadlineId: string,
  file: File,
  documentType: string,
  description?: string
): Promise<{ data: DeadlineDocument | null; error: Error | null }> {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("User not authenticated") };
    }

    // Create unique file path
    const fileExt = file.name.split(".").pop();
    const fileName = `${deadlineId}/${user.id}/${Date.now()}.${fileExt}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("deadline-documents")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return { data: null, error: uploadError };
    }

    // Save metadata to database
    const { data: metadata, error: metadataError } = await supabase
      .from("deadline_documents")
      .insert({
        deadline_id: deadlineId,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
        document_type: documentType,
        uploaded_by: user.id,
        description: description || null,
      })
      .select()
      .single();

    if (metadataError) {
      // Cleanup uploaded file if metadata insert fails
      await supabase.storage.from("deadline-documents").remove([uploadData.path]);
      return { data: null, error: metadataError };
    }

    return { data: metadata as DeadlineDocument, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get all documents for a deadline
 */
export async function getDeadlineDocuments(
  deadlineId: string
): Promise<{ data: DeadlineDocument[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("deadline_documents")
      .select("*")
      .eq("deadline_id", deadlineId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data as DeadlineDocument[], error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Delete a document
 */
export async function deleteDeadlineDocument(
  documentId: string,
  filePath: string
): Promise<{ error: Error | null }> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("deadline-documents")
      .remove([filePath]);

    if (storageError) {
      return { error: storageError };
    }

    // Delete metadata
    const { error: dbError } = await supabase
      .from("deadline_documents")
      .delete()
      .eq("id", documentId);

    if (dbError) {
      return { error: dbError };
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Get download URL for a document
 */
export async function getDeadlineDocumentDownloadUrl(
  filePath: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from("deadline-documents")
      .createSignedUrl(filePath, 3600); // URL valid for 1 hour

    if (error) {
      return { url: null, error };
    }

    // Ensure we have full URL (in case SDK returns relative path)
    let signedUrl = data.signedUrl;
    if (signedUrl && !signedUrl.startsWith("http")) {
      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      signedUrl = `${supabaseUrl}${signedUrl.startsWith("/") ? "" : "/"}${signedUrl}`;
    }

    return { url: signedUrl, error: null };
  } catch (error) {
    return { url: null, error: error as Error };
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

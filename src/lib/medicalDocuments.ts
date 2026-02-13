import { supabase } from "@/integrations/supabase/client";

export async function uploadMedicalDocument(
  examinationId: string,
  file: File,
  documentType: string,
  description?: string
): Promise<{ data: any; error: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Uživatel není přihlášen");

    const fileExt = file.name.split('.').pop();
    const filePath = `${examinationId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("medical-documents")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data, error: dbError } = await supabase
      .from("medical_examination_documents")
      .insert({
        examination_id: examinationId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        document_type: documentType,
        description: description || null,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file if metadata insert fails
      await supabase.storage.from("medical-documents").remove([filePath]);
      throw dbError;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error uploading medical document:", error);
    return { data: null, error };
  }
}

export async function getMedicalDocuments(examinationId: string) {
  const { data, error } = await supabase
    .from("medical_examination_documents")
    .select("*")
    .eq("examination_id", examinationId)
    .order("uploaded_at", { ascending: false });

  return { data, error };
}

export async function deleteMedicalDocument(documentId: string, filePath: string) {
  const { error: storageError } = await supabase.storage
    .from("medical-documents")
    .remove([filePath]);

  if (storageError) {
    console.error("Error deleting file from storage:", storageError);
  }

  const { error } = await supabase
    .from("medical_examination_documents")
    .delete()
    .eq("id", documentId);

  return { error };
}

export async function getMedicalDocumentUrl(filePath: string) {
  const { data } = await supabase.storage
    .from("medical-documents")
    .createSignedUrl(filePath, 3600);

  return data?.signedUrl;
}

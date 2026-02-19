import { supabase } from "@/integrations/supabase/client";

export async function uploadGeneralDocument(
  file: File,
  name: string,
  groupName: string
): Promise<{ data: any; error: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Uživatel není přihlášen");

    const fileExt = file.name.split('.').pop();
    const filePath = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("general-documents")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data, error: dbError } = await supabase
      .from("general_documents")
      .insert({
        name,
        group_name: groupName,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from("general-documents").remove([filePath]);
      throw dbError;
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error uploading general document:", error);
    return { data: null, error };
  }
}

export async function getGeneralDocuments() {
  const { data, error } = await supabase
    .from("general_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  return { data, error };
}

export async function deleteGeneralDocument(documentId: string, filePath: string) {
  const { error: storageError } = await supabase.storage
    .from("general-documents")
    .remove([filePath]);

  if (storageError) {
    console.error("Error deleting file from storage:", storageError);
  }

  const { error } = await supabase
    .from("general_documents")
    .delete()
    .eq("id", documentId);

  return { error };
}

export async function getGeneralDocumentUrl(filePath: string) {
  const { data } = await supabase.storage
    .from("general-documents")
    .createSignedUrl(filePath, 3600);

  return data?.signedUrl;
}

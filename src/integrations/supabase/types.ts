export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      deadline_documents: {
        Row: {
          deadline_id: string
          description: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          deadline_id: string
          description?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          deadline_id?: string
          description?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deadline_documents_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_reminder_logs: {
        Row: {
          created_at: string
          days_before: number | null
          deadline_id: string | null
          delivery_mode: string | null
          email_body: string
          email_subject: string
          equipment_id: string | null
          error_message: string | null
          id: string
          is_test: boolean
          recipient_emails: string[]
          sent_at: string
          status: string
          template_id: string | null
          template_name: string
          week_start: string | null
        }
        Insert: {
          created_at?: string
          days_before?: number | null
          deadline_id?: string | null
          delivery_mode?: string | null
          email_body: string
          email_subject: string
          equipment_id?: string | null
          error_message?: string | null
          id?: string
          is_test?: boolean
          recipient_emails: string[]
          sent_at?: string
          status?: string
          template_id?: string | null
          template_name: string
          week_start?: string | null
        }
        Update: {
          created_at?: string
          days_before?: number | null
          deadline_id?: string | null
          delivery_mode?: string | null
          email_body?: string
          email_subject?: string
          equipment_id?: string | null
          error_message?: string | null
          id?: string
          is_test?: boolean
          recipient_emails?: string[]
          sent_at?: string
          status?: string
          template_id?: string | null
          template_name?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deadline_reminder_logs_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_reminder_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_reminder_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "deadline_reminder_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_reminder_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          email_body: string
          email_subject: string
          id: string
          is_active: boolean
          name: string
          remind_days_before: number
          repeat_interval_days: number | null
          target_user_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body: string
          email_subject: string
          id?: string
          is_active?: boolean
          name: string
          remind_days_before?: number
          repeat_interval_days?: number | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body?: string
          email_subject?: string
          id?: string
          is_active?: boolean
          name?: string
          remind_days_before?: number
          repeat_interval_days?: number | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      deadline_responsibles: {
        Row: {
          created_at: string
          created_by: string | null
          deadline_id: string
          group_id: string | null
          id: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadline_id: string
          group_id?: string | null
          id?: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadline_id?: string
          group_id?: string | null
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deadline_responsibles_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_responsibles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "responsibility_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadline_responsibles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_types: {
        Row: {
          created_at: string
          description: string | null
          facility: string
          id: string
          name: string
          period_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          facility: string
          id?: string
          name: string
          period_days: number
        }
        Update: {
          created_at?: string
          description?: string | null
          facility?: string
          id?: string
          name?: string
          period_days?: number
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          deadline_type_id: string
          deleted_at: string | null
          equipment_id: string
          facility: string
          id: string
          is_active: boolean
          last_check_date: string
          next_check_date: string
          note: string | null
          performer: string | null
          remind_days_before: number | null
          reminder_template_id: string | null
          repeat_days_after: number | null
          requester: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          deadline_type_id: string
          deleted_at?: string | null
          equipment_id: string
          facility: string
          id?: string
          is_active?: boolean
          last_check_date: string
          next_check_date: string
          note?: string | null
          performer?: string | null
          remind_days_before?: number | null
          reminder_template_id?: string | null
          repeat_days_after?: number | null
          requester?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          deadline_type_id?: string
          deleted_at?: string | null
          equipment_id?: string
          facility?: string
          id?: string
          is_active?: boolean
          last_check_date?: string
          next_check_date?: string
          note?: string | null
          performer?: string | null
          remind_days_before?: number | null
          reminder_template_id?: string | null
          repeat_days_after?: number | null
          requester?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_deadline_type_id_fkey"
            columns: ["deadline_type_id"]
            isOneToOne: false
            referencedRelation: "deadline_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          employee_number: string
          first_name: string
          id: string
          last_name: string
          manager_email: string | null
          manager_employee_id: string | null
          manager_first_name: string | null
          manager_last_name: string | null
          notes: string | null
          position: string
          status: string
          status_start_date: string | null
          termination_date: string | null
          updated_at: string
          work_category: number | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          employee_number: string
          first_name: string
          id?: string
          last_name: string
          manager_email?: string | null
          manager_employee_id?: string | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          notes?: string | null
          position: string
          status: string
          status_start_date?: string | null
          termination_date?: string | null
          updated_at?: string
          work_category?: number | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          employee_number?: string
          first_name?: string
          id?: string
          last_name?: string
          manager_email?: string | null
          manager_employee_id?: string | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          notes?: string | null
          position?: string
          status?: string
          status_start_date?: string | null
          termination_date?: string | null
          updated_at?: string
          work_category?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          equipment_type: string
          facility: string
          id: string
          inventory_number: string
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          responsible_person: string | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          equipment_type: string
          facility: string
          id?: string
          inventory_number: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          responsible_person?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          equipment_type?: string
          facility?: string
          id?: string
          inventory_number?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          responsible_person?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_responsibles: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_responsibles_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_responsibles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      medical_examination_documents: {
        Row: {
          description: string | null
          document_type: string
          examination_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          description?: string | null
          document_type: string
          examination_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          description?: string | null
          document_type?: string
          examination_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_examination_documents_examination_id_fkey"
            columns: ["examination_id"]
            isOneToOne: false
            referencedRelation: "medical_examinations"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_examination_types: {
        Row: {
          created_at: string
          description: string | null
          facility: string
          id: string
          name: string
          period_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          facility: string
          id?: string
          name: string
          period_days: number
        }
        Update: {
          created_at?: string
          description?: string | null
          facility?: string
          id?: string
          name?: string
          period_days?: number
        }
        Relationships: []
      }
      medical_examinations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          doctor: string | null
          employee_id: string
          examination_type_id: string
          facility: string
          id: string
          is_active: boolean
          last_examination_date: string
          medical_facility: string | null
          next_examination_date: string
          note: string | null
          remind_days_before: number | null
          reminder_template_id: string | null
          repeat_days_after: number | null
          requester: string | null
          result: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          doctor?: string | null
          employee_id: string
          examination_type_id: string
          facility: string
          id?: string
          is_active?: boolean
          last_examination_date: string
          medical_facility?: string | null
          next_examination_date: string
          note?: string | null
          remind_days_before?: number | null
          reminder_template_id?: string | null
          repeat_days_after?: number | null
          requester?: string | null
          result?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          doctor?: string | null
          employee_id?: string
          examination_type_id?: string
          facility?: string
          id?: string
          is_active?: boolean
          last_examination_date?: string
          medical_facility?: string | null
          next_examination_date?: string
          note?: string | null
          remind_days_before?: number | null
          reminder_template_id?: string | null
          repeat_days_after?: number | null
          requester?: string | null
          result?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_examinations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_examinations_examination_type_id_fkey"
            columns: ["examination_type_id"]
            isOneToOne: false
            referencedRelation: "medical_examination_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_examinations_reminder_template_id_fkey"
            columns: ["reminder_template_id"]
            isOneToOne: false
            referencedRelation: "medical_reminder_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_reminder_logs: {
        Row: {
          created_at: string
          days_before: number | null
          delivery_mode: string | null
          email_body: string
          email_subject: string
          employee_id: string | null
          error_message: string | null
          examination_id: string | null
          id: string
          is_test: boolean
          recipient_emails: string[]
          sent_at: string
          status: string
          template_id: string | null
          template_name: string
          week_start: string | null
        }
        Insert: {
          created_at?: string
          days_before?: number | null
          delivery_mode?: string | null
          email_body: string
          email_subject: string
          employee_id?: string | null
          error_message?: string | null
          examination_id?: string | null
          id?: string
          is_test?: boolean
          recipient_emails: string[]
          sent_at?: string
          status?: string
          template_id?: string | null
          template_name: string
          week_start?: string | null
        }
        Update: {
          created_at?: string
          days_before?: number | null
          delivery_mode?: string | null
          email_body?: string
          email_subject?: string
          employee_id?: string | null
          error_message?: string | null
          examination_id?: string | null
          id?: string
          is_test?: boolean
          recipient_emails?: string[]
          sent_at?: string
          status?: string
          template_id?: string | null
          template_name?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_reminder_logs_examination_id_fkey"
            columns: ["examination_id"]
            isOneToOne: false
            referencedRelation: "medical_examinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_reminder_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "medical_reminder_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_reminder_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          email_body: string
          email_subject: string
          id: string
          is_active: boolean
          name: string
          remind_days_before: number
          repeat_interval_days: number | null
          target_user_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body: string
          email_subject: string
          id?: string
          is_active?: boolean
          name: string
          remind_days_before?: number
          repeat_interval_days?: number | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body?: string
          email_subject?: string
          id?: string
          is_active?: boolean
          name?: string
          remind_days_before?: number
          repeat_interval_days?: number | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department_id: string | null
          email: string
          employee_id: string | null
          first_name: string
          id: string
          last_name: string
          must_change_password: boolean
          position: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          employee_id?: string | null
          first_name: string
          id: string
          last_name: string
          must_change_password?: boolean
          position?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          employee_id?: string | null
          first_name?: string
          id?: string
          last_name?: string
          must_change_password?: boolean
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          attempt_errors: Json | null
          attempt_number: number
          created_at: string
          days_before: number | null
          delivery_mode: string | null
          email_body: string
          email_subject: string
          employee_id: string | null
          error_message: string | null
          final_status: string | null
          id: string
          is_test: boolean
          max_attempts: number
          provider_used: string | null
          recipient_emails: string[]
          resent_from_log_id: string | null
          run_id: string | null
          sent_at: string
          status: string
          template_id: string | null
          template_name: string
          training_id: string | null
          week_start: string | null
        }
        Insert: {
          attempt_errors?: Json | null
          attempt_number?: number
          created_at?: string
          days_before?: number | null
          delivery_mode?: string | null
          email_body: string
          email_subject: string
          employee_id?: string | null
          error_message?: string | null
          final_status?: string | null
          id?: string
          is_test?: boolean
          max_attempts?: number
          provider_used?: string | null
          recipient_emails: string[]
          resent_from_log_id?: string | null
          run_id?: string | null
          sent_at?: string
          status?: string
          template_id?: string | null
          template_name: string
          training_id?: string | null
          week_start?: string | null
        }
        Update: {
          attempt_errors?: Json | null
          attempt_number?: number
          created_at?: string
          days_before?: number | null
          delivery_mode?: string | null
          email_body?: string
          email_subject?: string
          employee_id?: string | null
          error_message?: string | null
          final_status?: string | null
          id?: string
          is_test?: boolean
          max_attempts?: number
          provider_used?: string | null
          recipient_emails?: string[]
          resent_from_log_id?: string | null
          run_id?: string | null
          sent_at?: string
          status?: string
          template_id?: string | null
          template_name?: string
          training_id?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_resent_from_log_id_fkey"
            columns: ["resent_from_log_id"]
            isOneToOne: false
            referencedRelation: "reminder_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reminder_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_runs: {
        Row: {
          created_at: string
          emails_failed: number | null
          emails_sent: number | null
          ended_at: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string
          week_start: string
        }
        Insert: {
          created_at?: string
          emails_failed?: number | null
          emails_sent?: number | null
          ended_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
          week_start: string
        }
        Update: {
          created_at?: string
          emails_failed?: number | null
          emails_sent?: number | null
          ended_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
          week_start?: string
        }
        Relationships: []
      }
      reminder_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          email_body: string
          email_subject: string
          id: string
          is_active: boolean
          name: string
          remind_days_before: number
          repeat_interval_days: number | null
          target_user_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body: string
          email_subject: string
          id?: string
          is_active?: boolean
          name: string
          remind_days_before?: number
          repeat_interval_days?: number | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_body?: string
          email_subject?: string
          id?: string
          is_active?: boolean
          name?: string
          remind_days_before?: number
          repeat_interval_days?: number | null
          target_user_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      responsibility_group_members: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "responsibility_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_group_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      training_documents: {
        Row: {
          description: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          training_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          description?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          training_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          description?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          training_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      training_types: {
        Row: {
          created_at: string
          description: string | null
          duration_hours: number | null
          facility: string
          id: string
          name: string
          period_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          facility: string
          id?: string
          name: string
          period_days: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          facility?: string
          id?: string
          name?: string
          period_days?: number
        }
        Relationships: []
      }
      trainings: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          facility: string
          id: string
          is_active: boolean
          last_training_date: string
          next_training_date: string
          note: string | null
          remind_days_before: number | null
          reminder_template: string | null
          reminder_template_id: string | null
          repeat_days_after: number | null
          requester: string | null
          status: string
          trainer: string | null
          training_type_id: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          facility: string
          id?: string
          is_active?: boolean
          last_training_date: string
          next_training_date: string
          note?: string | null
          remind_days_before?: number | null
          reminder_template?: string | null
          reminder_template_id?: string | null
          repeat_days_after?: number | null
          requester?: string | null
          status?: string
          trainer?: string | null
          training_type_id: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          facility?: string
          id?: string
          is_active?: boolean
          last_training_date?: string
          next_training_date?: string
          note?: string | null
          remind_days_before?: number | null
          reminder_template?: string | null
          reminder_template_id?: string | null
          repeat_days_after?: number | null
          requester?: string | null
          status?: string
          trainer?: string | null
          training_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_reminder_template_id_fkey"
            columns: ["reminder_template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_training_type_id_fkey"
            columns: ["training_type_id"]
            isOneToOne: false
            referencedRelation: "training_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      user_module_access: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          module: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          module: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          module?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_deadline_status: {
        Args: { next_date: string }
        Returns: string
      }
      calculate_examination_status: {
        Args: { next_date: string }
        Returns: string
      }
      calculate_training_status: {
        Args: { next_date: string }
        Returns: string
      }
      get_registration_mode: { Args: never; Returns: string }
      get_subordinate_employee_ids: {
        Args: { root_employee_id: string }
        Returns: {
          employee_id: string
        }[]
      }
      get_user_employee_id: { Args: { _user_id: string }; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_module_access: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_deadline_responsible: {
        Args: { _deadline_id: string; _user_id: string }
        Returns: boolean
      }
      is_email_allowed: { Args: { _email: string }; Returns: boolean }
      is_manager_of: {
        Args: { _target_employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      resolve_manager_from_email: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "user", "viewer"],
    },
  },
} as const

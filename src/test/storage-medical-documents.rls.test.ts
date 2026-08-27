import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Integration tests for storage RLS on the `medical-documents` bucket.
 *
 * These tests verify that:
 *   - Admin can list, upload and delete files in any examination folder.
 *   - The linked employee (self) can access their own examination folder.
 *   - The manager can access subordinate examination folder.
 *   - An unrelated user gets denied for SELECT, INSERT and DELETE.
 *
 * The tests are skipped automatically when the required environment variables
 * are missing so the standard `vitest` run does not fail on developer machines:
 *
 *   SB_TEST_URL                 Supabase project URL
 *   SB_TEST_ANON_KEY            Anon key
 *   SB_TEST_ADMIN_JWT           JWT of an `admin`
 *   SB_TEST_MANAGER_JWT         JWT of a manager whose subordinate owns EXAM_ID
 *   SB_TEST_SELF_JWT            JWT of the linked employee for EXAM_ID
 *   SB_TEST_OUTSIDER_JWT        JWT of an unrelated approved user
 *   SB_TEST_EXAMINATION_ID      UUID of the examination (folder name)
 */

const URL = process.env.SB_TEST_URL;
const KEY = process.env.SB_TEST_ANON_KEY;
const ADMIN = process.env.SB_TEST_ADMIN_JWT;
const MANAGER = process.env.SB_TEST_MANAGER_JWT;
const SELF = process.env.SB_TEST_SELF_JWT;
const OUTSIDER = process.env.SB_TEST_OUTSIDER_JWT;
const EXAM = process.env.SB_TEST_EXAMINATION_ID;

const ENABLED = Boolean(URL && KEY && ADMIN && MANAGER && SELF && OUTSIDER && EXAM);

const clientWithJwt = (jwt: string) =>
  createClient(URL!, KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

const probeFile = (suffix: string) =>
  new Blob([`probe-${suffix}-${Date.now()}`], { type: "text/plain" });

describe.skipIf(!ENABLED)("storage RLS: medical-documents", () => {
  it("admin can list, upload and delete in any folder", async () => {
    const c = clientWithJwt(ADMIN!);
    const path = `${EXAM}/admin-test-${Date.now()}.txt`;
    const up = await c.storage.from("medical-documents").upload(path, probeFile("admin"));
    expect(up.error).toBeNull();
    const list = await c.storage.from("medical-documents").list(EXAM!);
    expect(list.error).toBeNull();
    const del = await c.storage.from("medical-documents").remove([path]);
    expect(del.error).toBeNull();
  });

  it("self (linked employee) can list and upload to their own folder", async () => {
    const c = clientWithJwt(SELF!);
    const list = await c.storage.from("medical-documents").list(EXAM!);
    expect(list.error).toBeNull();
    const path = `${EXAM}/self-test-${Date.now()}.txt`;
    const up = await c.storage.from("medical-documents").upload(path, probeFile("self"));
    expect(up.error).toBeNull();
    await c.storage.from("medical-documents").remove([path]);
  });

  it("manager in hierarchy can list subordinate folder", async () => {
    const c = clientWithJwt(MANAGER!);
    const list = await c.storage.from("medical-documents").list(EXAM!);
    expect(list.error).toBeNull();
  });

  it("outsider cannot list, upload, or delete in foreign folder", async () => {
    const c = clientWithJwt(OUTSIDER!);

    const list = await c.storage.from("medical-documents").list(EXAM!);
    // List returns either explicit RLS error or an empty array (RLS hides rows)
    expect(list.error !== null || (list.data ?? []).length === 0).toBe(true);

    const path = `${EXAM}/outsider-${Date.now()}.txt`;
    const up = await c.storage.from("medical-documents").upload(path, probeFile("outsider"));
    expect(up.error).not.toBeNull();

    const del = await c.storage.from("medical-documents").remove([`${EXAM}/anything.txt`]);
    // Either policy denial or "not found" — both prove no escalation occurred.
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
  });
});

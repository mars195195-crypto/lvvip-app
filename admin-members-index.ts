import { withSupabase } from "npm:@supabase/server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanName(value: unknown) {
  return String(value ?? "").trim().slice(0, 80);
}

function validPassword(value: string) {
  return value.length >= 8 && value.length <= 72;
}

const memberColumns =
  "id,email,ref_code,display_name,active,created_at";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const adminId = ctx.userClaims?.id;

      if (!adminId) {
        return json(
          {
            ok: false,
            error: "找不到登入者身分，請重新登入",
          },
          401,
        );
      }

      // 只允許 lvvip_admins 中啟用的管理員使用本 Function
      const { data: adminRow, error: adminError } =
        await ctx.supabaseAdmin
          .from("lvvip_admins")
          .select("user_id,email,active")
          .eq("user_id", adminId)
          .eq("active", true)
          .maybeSingle();

      if (adminError) {
        return json(
          {
            ok: false,
            error: adminError.message,
          },
          500,
        );
      }

      if (!adminRow) {
        return json(
          {
            ok: false,
            error: "你沒有 L-VVIP 管理員權限",
          },
          403,
        );
      }

      const body = await req.json().catch(() => ({}));
      const action = String(body?.action ?? "");

      // =====================================================
      // LIST
      // =====================================================
      if (action === "list") {
        const { data: members, error: memberError } =
          await ctx.supabaseAdmin
            .from("lvvip_members")
            .select(memberColumns)
            .order("created_at", { ascending: false });

        if (memberError) {
          return json(
            {
              ok: false,
              error: memberError.message,
            },
            500,
          );
        }

        const { data: publicRows, error: publicError } =
          await ctx.supabaseAdmin
            .from("lvvip_member_public")
            .select("member_id,line_url,active");

        if (publicError) {
          return json(
            {
              ok: false,
              error: publicError.message,
            },
            500,
          );
        }

        const lineMap = new Map(
          (publicRows ?? []).map((row) => [
            row.member_id,
            row,
          ]),
        );

        const result = (members ?? []).map((member) => {
          const publicRow = lineMap.get(member.id);

          return {
            ...member,
            line_url: publicRow?.line_url ?? null,
            line_ready: Boolean(publicRow?.line_url),
          };
        });

        return json({
          ok: true,
          admin_email: adminRow.email,
          members: result,
        });
      }

      // =====================================================
      // CREATE
      // 修正版：
      // Auth 使用者建立後，先檢查 lvvip_members 是否已被
      // 資料庫 Trigger 自動建立。
      // 若已存在就 UPDATE，不再 INSERT 同一個 Primary Key。
      // =====================================================
      if (action === "create") {
        const email = cleanEmail(body?.email);
        const password = String(body?.password ?? "");
        const displayName = cleanName(body?.display_name);

        if (!email || !email.includes("@")) {
          return json(
            {
              ok: false,
              error: "Email 格式不正確",
            },
            400,
          );
        }

        if (!validPassword(password)) {
          return json(
            {
              ok: false,
              error: "密碼請設定 8～72 個字元",
            },
            400,
          );
        }

        if (!displayName) {
          return json(
            {
              ok: false,
              error: "請輸入會員名稱",
            },
            400,
          );
        }

        // 1. 建立 Supabase Auth 使用者
        const { data: created, error: createError } =
          await ctx.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              display_name: displayName,
            },
          });

        if (createError || !created.user) {
          return json(
            {
              ok: false,
              error:
                createError?.message ??
                "建立 Auth 使用者失敗",
            },
            400,
          );
        }

        const newUser = created.user;

        // 2. 先確認資料庫 Trigger 是否已自動建立會員資料
        const { data: autoMember, error: autoMemberError } =
          await ctx.supabaseAdmin
            .from("lvvip_members")
            .select(memberColumns)
            .eq("id", newUser.id)
            .maybeSingle();

        if (autoMemberError) {
          await ctx.supabaseAdmin.auth.admin.deleteUser(
            newUser.id,
          );

          return json(
            {
              ok: false,
              error:
                "檢查自動會員資料失敗：" +
                autoMemberError.message,
            },
            500,
          );
        }

        // 3A. 已經被 Trigger 建立：直接更新，不再 INSERT
        if (autoMember) {
          const { data: updatedMember, error: updateAutoError } =
            await ctx.supabaseAdmin
              .from("lvvip_members")
              .update({
                email,
                display_name: displayName,
                active: true,
              })
              .eq("id", newUser.id)
              .select(memberColumns)
              .single();

          if (updateAutoError || !updatedMember) {
            await ctx.supabaseAdmin.auth.admin.deleteUser(
              newUser.id,
            );

            return json(
              {
                ok: false,
                error:
                  updateAutoError?.message ??
                  "更新自動建立的會員資料失敗",
              },
              500,
            );
          }

          return json({
            ok: true,
            member: updatedMember,
            created_by: "database_trigger",
          });
        }

        // 3B. 沒有 Trigger 自動建立：才產生推薦碼並 INSERT
        const { data: refCode, error: refError } =
          await ctx.supabaseAdmin.rpc(
            "next_lvvip_ref_code",
          );

        if (refError || !refCode) {
          await ctx.supabaseAdmin.auth.admin.deleteUser(
            newUser.id,
          );

          return json(
            {
              ok: false,
              error:
                refError?.message ??
                "產生推薦碼失敗",
            },
            500,
          );
        }

        const { data: member, error: insertError } =
          await ctx.supabaseAdmin
            .from("lvvip_members")
            .insert({
              id: newUser.id,
              email,
              ref_code: refCode,
              display_name: displayName,
              active: true,
            })
            .select(memberColumns)
            .single();

        if (insertError || !member) {
          await ctx.supabaseAdmin.auth.admin.deleteUser(
            newUser.id,
          );

          return json(
            {
              ok: false,
              error:
                insertError?.message ??
                "建立會員資料失敗",
            },
            500,
          );
        }

        return json({
          ok: true,
          member,
          created_by: "edge_function",
        });
      }

      // =====================================================
      // UPDATE
      // =====================================================
      if (action === "update") {
        const memberId = String(body?.member_id ?? "");

        if (!memberId) {
          return json(
            {
              ok: false,
              error: "缺少 member_id",
            },
            400,
          );
        }

        const updateData: Record<string, unknown> = {};

        if (body?.display_name !== undefined) {
          const displayName = cleanName(
            body?.display_name,
          );

          if (!displayName) {
            return json(
              {
                ok: false,
                error: "會員名稱不能空白",
              },
              400,
            );
          }

          updateData.display_name = displayName;
        }

        if (body?.active !== undefined) {
          updateData.active = Boolean(body.active);
        }

        if (Object.keys(updateData).length === 0) {
          return json(
            {
              ok: false,
              error: "沒有可更新的資料",
            },
            400,
          );
        }

        const { data: updated, error: updateError } =
          await ctx.supabaseAdmin
            .from("lvvip_members")
            .update(updateData)
            .eq("id", memberId)
            .select(memberColumns)
            .single();

        if (updateError || !updated) {
          return json(
            {
              ok: false,
              error:
                updateError?.message ??
                "更新會員失敗",
            },
            500,
          );
        }

        if (typeof updateData.display_name === "string") {
          await ctx.supabaseAdmin.auth.admin.updateUserById(
            memberId,
            {
              user_metadata: {
                display_name:
                  updateData.display_name,
              },
            },
          );
        }

        return json({
          ok: true,
          member: updated,
        });
      }

      // =====================================================
      // RESET PASSWORD
      // =====================================================
      if (action === "reset_password") {
        const memberId = String(body?.member_id ?? "");
        const newPassword = String(
          body?.new_password ?? "",
        );

        if (!memberId) {
          return json(
            {
              ok: false,
              error: "缺少 member_id",
            },
            400,
          );
        }

        if (!validPassword(newPassword)) {
          return json(
            {
              ok: false,
              error: "新密碼請設定 8～72 個字元",
            },
            400,
          );
        }

        const { error: passwordError } =
          await ctx.supabaseAdmin.auth.admin.updateUserById(
            memberId,
            {
              password: newPassword,
            },
          );

        if (passwordError) {
          return json(
            {
              ok: false,
              error: passwordError.message,
            },
            500,
          );
        }

        return json({
          ok: true,
        });
      }

      return json(
        {
          ok: false,
          error: "不支援的 action",
        },
        400,
      );
    } catch (error) {
      console.error(error);

      return json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "系統發生未知錯誤",
        },
        500,
      );
    }
  }),
};

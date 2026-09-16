/* L-VVIP 每日分享自訂 V2｜完整文案修正版
   直接覆蓋原本 share-edit-local.js 即可
   不需要改 Supabase、不需要新增資料表
*/
(() => {
  "use strict";

  let original = null;
  let originalKey = "";
  let ready = false;

  const baseRender = typeof renderShare === "function" ? renderShare : () => {};
  const $ = id => document.getElementById(id);
  const clone = x => x ? {
    title: x.title || "",
    hook: x.hook || "",
    body: x.body || "",
    cta: x.cta || ""
  } : null;

  function day() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function who() {
    if (typeof member === "undefined" || !member) return "guest";
    return member.id || member.ref_code || "guest";
  }

  function key() {
    return `lvvip_share_custom_v2:${who()}:${day()}`;
  }

  function templateKey() {
    const id = typeof todayContent !== "undefined" && todayContent && todayContent.id
      ? todayContent.id
      : "no-id";
    return `${day()}:${id}`;
  }

  function saveLocal(data) {
    localStorage.setItem(key(), JSON.stringify(data));
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(key());
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("讀取自訂分享失敗", error);
      return null;
    }
  }

  function clearLocal() {
    localStorage.removeItem(key());
  }

  function captureOriginal() {
    if (typeof todayContent === "undefined" || !todayContent) return;
    const k = templateKey();
    if (!original || originalKey !== k) {
      original = clone(todayContent);
      originalKey = k;
    }
  }

  function apply(data) {
    if (typeof todayContent === "undefined" || !todayContent || !data) return;
    todayContent.title = data.title || "";
    todayContent.hook = data.hook || "";
    todayContent.body = data.body || "";
    todayContent.cta = data.cta || "";
  }

  function values() {
    return {
      title: ($("lvvipTitle")?.value || "").trim(),
      hook: ($("lvvipHook")?.value || "").trim(),
      body: ($("lvvipBody")?.value || "").trim(),
      cta: ($("lvvipCta")?.value || "").trim()
    };
  }

  function fill(data) {
    if (!data) return;
    if ($("lvvipTitle")) $("lvvipTitle").value = data.title || "";
    if ($("lvvipHook")) $("lvvipHook").value = data.hook || "";
    if ($("lvvipBody")) $("lvvipBody").value = data.body || "";
    if ($("lvvipCta")) $("lvvipCta").value = data.cta || "";
  }

  function status(text, ok = false) {
    const el = $("lvvipStatus");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#70e19e" : "#9eacb8";
  }

  function makeEditor() {
    if ($("lvvipEditor")) return;
    const sharePage = $("page-share");
    if (!sharePage) return;
    const hero = sharePage.querySelector(".hero-card");
    if (!hero) return;

    const box = document.createElement("div");
    box.id = "lvvipEditor";
    box.className = "card";
    box.innerHTML = `
      <div class="card-title">✏️ 修改今日分享</div>
      <div style="color:#9eacb8;font-size:13px;line-height:1.7;margin-bottom:12px;">
        在下面修改後按儲存。專屬推薦網址由系統自動保留。
      </div>

      <label style="display:block;color:#aebbc5;margin:10px 0 6px;">標題</label>
      <input id="lvvipTitle" type="text" style="width:100%;padding:12px;border:1px solid #31495d;border-radius:10px;background:#071724;color:#fff;outline:none;">

      <label style="display:block;color:#aebbc5;margin:10px 0 6px;">開場重點</label>
      <textarea id="lvvipHook" style="width:100%;min-height:90px;padding:12px;border:1px solid #31495d;border-radius:10px;background:#071724;color:#fff;line-height:1.7;outline:none;resize:vertical;"></textarea>

      <label style="display:block;color:#aebbc5;margin:10px 0 6px;">分享正文</label>
      <textarea id="lvvipBody" style="width:100%;min-height:220px;padding:12px;border:1px solid #31495d;border-radius:10px;background:#071724;color:#fff;line-height:1.7;outline:none;resize:vertical;"></textarea>

      <label style="display:block;color:#aebbc5;margin:10px 0 6px;">行動邀請</label>
      <textarea id="lvvipCta" style="width:100%;min-height:90px;padding:12px;border:1px solid #31495d;border-radius:10px;background:#071724;color:#fff;line-height:1.7;outline:none;resize:vertical;"></textarea>

      <button id="lvvipSave" class="share-button main" type="button" style="width:100%;margin-top:14px;">💾 儲存我的完整文案</button>
      <button id="lvvipReset" class="share-button" type="button" style="width:100%;margin-top:9px;">↩ 恢復完整系統範本</button>
      <div id="lvvipStatus" style="margin-top:10px;color:#9eacb8;font-size:12px;line-height:1.6;"></div>
    `;

    hero.insertAdjacentElement("afterend", box);

    $("lvvipSave").addEventListener("click", () => {
      const data = values();
      if (!data.title && !data.hook && !data.body && !data.cta) {
        alert("請先輸入分享內容。");
        return;
      }
      saveLocal(data);
      apply(data);
      baseRender();
      fill(data);
      status("✓ 已完整儲存今天的文案。", true);
    });

    $("lvvipReset").addEventListener("click", () => {
      if (!original) {
        alert("系統範本尚未載入完成。");
        return;
      }
      if (!confirm("確定恢復今天完整的系統範本？")) return;
      clearLocal();
      apply(original);
      baseRender();
      fill(original);
      status("✓ 已完整恢復系統範本。", true);
    });
  }

  function fullShareText() {
    if (typeof todayContent === "undefined" || !todayContent) return "";
    return [todayContent.hook, todayContent.body, todayContent.cta]
      .map(v => String(v || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function fixOneClickShare() {
    const oldBtn = $("nativeShare");
    if (!oldBtn || oldBtn.dataset.fixedFull === "1") return;

    const btn = oldBtn.cloneNode(true);
    btn.dataset.fixedFull = "1";
    oldBtn.replaceWith(btn);

    btn.addEventListener("click", async () => {
      if (typeof todayContent === "undefined" || !todayContent) return;

      const text = fullShareText();
      const url = typeof createShareUrl === "function" ? createShareUrl("share") : "";

      if (navigator.share) {
        try {
          await navigator.share({
            title: todayContent.title || "L-VVIP",
            text,
            url
          });
          if (typeof logShare === "function") await logShare("native");
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }

      const allText = [text, url].filter(Boolean).join("\n\n");

      if (typeof copyText === "function") {
        await copyText(allText);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(allText);
      }

      if (typeof logShare === "function") await logShare("copy");
      alert("完整分享文案已複製。");
    });
  }

  if (typeof renderShare === "function") {
    renderShare = function() {
      captureOriginal();
      const saved = readLocal();
      if (saved) apply(saved);
      baseRender();
      if ($("lvvipEditor")) fill(saved || clone(todayContent));
    };
  }

  function init() {
    if (ready) return;
    if (
      typeof member === "undefined" ||
      !member ||
      typeof todayContent === "undefined" ||
      !todayContent
    ) {
      return;
    }

    captureOriginal();
    const saved = readLocal();
    if (saved) apply(saved);
    baseRender();
    makeEditor();
    fill(saved || clone(todayContent));
    fixOneClickShare();

    if (saved) {
      status("✓ 已載入今天儲存的完整自訂文案。", true);
    } else {
      status("目前使用完整系統範本。");
    }

    ready = true;
  }

  const timer = setInterval(() => {
    init();
    if (ready) clearInterval(timer);
  }, 250);

  setTimeout(() => clearInterval(timer), 30000);
})();

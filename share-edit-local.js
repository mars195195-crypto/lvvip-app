/*
L-VVIP｜最簡單版「每日分享可自行修改」
不需要 Supabase SQL，不新增資料表。
自訂內容只保存在目前手機／瀏覽器 localStorage。
*/

(() => {
  "use strict";

  const EDITOR_ID = "lvvipSimpleShareEditor";
  let systemContent = null;
  let initialized = false;

  function todayKey() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function storageKey() {
    const who =
      (typeof member !== "undefined" &&
        member &&
        (member.id || member.ref_code)) ||
      "guest";

    return `lvvip_share_custom_v1:${who}:${todayKey()}`;
  }

  function cloneContent(source) {
    if (!source) return null;

    return {
      title: source.title || "",
      hook: source.hook || "",
      body: source.body || "",
      cta: source.cta || ""
    };
  }

  function readSaved() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeSaved(data) {
    localStorage.setItem(
      storageKey(),
      JSON.stringify(data)
    );
  }

  function clearSaved() {
    localStorage.removeItem(storageKey());
  }

  function captureSystemContent() {
    if (
      typeof todayContent === "undefined" ||
      !todayContent
    ) {
      return;
    }

    if (!systemContent) {
      systemContent = cloneContent(todayContent);
    }
  }

  function applySavedToState() {
    if (
      typeof todayContent === "undefined" ||
      !todayContent
    ) {
      return;
    }

    captureSystemContent();

    const saved = readSaved();

    if (!saved) return;

    todayContent.title = saved.title || "";
    todayContent.hook = saved.hook || "";
    todayContent.body = saved.body || "";
    todayContent.cta = saved.cta || "";
  }

  function setEditable(on) {
    [
      "shareTitle",
      "shareHook",
      "shareBody",
      "shareCta"
    ].forEach(id => {
      const el = document.getElementById(id);

      if (!el) return;

      el.contentEditable = on ? "true" : "false";

      el.style.outline =
        on
          ? "2px dashed #f1cf72"
          : "";

      el.style.outlineOffset =
        on
          ? "6px"
          : "";

      el.style.borderRadius =
        on
          ? "8px"
          : "";

      el.style.cursor =
        on
          ? "text"
          : "";
    });
  }

  function getScreenContent() {
    return {
      title:
        (
          document
            .getElementById("shareTitle")
            ?.textContent || ""
        ).trim(),

      hook:
        (
          document
            .getElementById("shareHook")
            ?.textContent || ""
        ).trim(),

      body:
        (
          document
            .getElementById("shareBody")
            ?.textContent || ""
        ).trim(),

      cta:
        (
          document
            .getElementById("shareCta")
            ?.textContent || ""
        ).trim()
    };
  }

  function setStatus(text, ok = false) {
    const el =
      document.getElementById(
        "lvvipShareEditStatus"
      );

    if (!el) return;

    el.textContent = text;

    el.style.color =
      ok
        ? "#70e19e"
        : "#9eacb8";
  }

  function saveCurrent() {
    if (
      typeof todayContent === "undefined" ||
      !todayContent
    ) {
      alert("今日分享內容尚未載入完成。");
      return;
    }

    const data = getScreenContent();

    if (
      !data.title &&
      !data.hook &&
      !data.body &&
      !data.cta
    ) {
      alert("請先輸入分享內容。");
      return;
    }

    writeSaved(data);

    todayContent.title = data.title;
    todayContent.hook = data.hook;
    todayContent.body = data.body;
    todayContent.cta = data.cta;

    setEditable(false);

    setStatus(
      "✓ 已儲存在這支手機／這個瀏覽器。",
      true
    );

    if (
      typeof originalRenderShare === "function"
    ) {
      originalRenderShare();
    }
  }

  function resetCurrent() {
    if (!systemContent) {
      alert("系統範本尚未載入完成。");
      return;
    }

    if (
      !confirm(
        "確定恢復今天的系統範本？"
      )
    ) {
      return;
    }

    clearSaved();

    todayContent.title =
      systemContent.title;

    todayContent.hook =
      systemContent.hook;

    todayContent.body =
      systemContent.body;

    todayContent.cta =
      systemContent.cta;

    setEditable(false);

    setStatus(
      "已恢復今天的系統範本。"
    );

    originalRenderShare();
  }

  function injectEditor() {
    if (
      document.getElementById(
        EDITOR_ID
      )
    ) {
      return;
    }

    const sharePage =
      document.getElementById(
        "page-share"
      );

    if (!sharePage) return;

    const hero =
      sharePage.querySelector(
        ".hero-card"
      );

    if (!hero) return;

    const box =
      document.createElement("div");

    box.id = EDITOR_ID;
    box.className = "card";

    box.innerHTML = `
      <div class="card-title">
        ✏️ 自己修改今日分享
      </div>

      <div style="
        color:#9eacb8;
        font-size:13px;
        line-height:1.7;
        margin-bottom:12px;
      ">
        按「開始修改」後，
        直接點上面的標題或文字修改。
        專屬推薦網址不用改，
        系統會自動保留。
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
      ">

        <button
          id="lvvipStartEditShare"
          class="share-button"
          type="button"
        >
          ✏️ 開始修改
        </button>

        <button
          id="lvvipSaveEditShare"
          class="share-button main"
          type="button"
        >
          💾 儲存我的文案
        </button>

      </div>

      <button
        id="lvvipResetEditShare"
        class="share-button"
        type="button"
        style="
          width:100%;
          margin-top:9px;
        "
      >
        ↩ 恢復系統範本
      </button>

      <div
        id="lvvipShareEditStatus"
        style="
          margin-top:10px;
          color:#9eacb8;
          font-size:12px;
          line-height:1.6;
        "
      >
        自訂內容只保存在目前手機／瀏覽器。
      </div>
    `;

    hero.insertAdjacentElement(
      "afterend",
      box
    );

    document
      .getElementById(
        "lvvipStartEditShare"
      )
      .addEventListener(
        "click",
        () => {
          setEditable(true);

          setStatus(
            "現在可以直接點上面的文字修改。"
          );

          document
            .getElementById(
              "shareTitle"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
        }
      );

    document
      .getElementById(
        "lvvipSaveEditShare"
      )
      .addEventListener(
        "click",
        saveCurrent
      );

    document
      .getElementById(
        "lvvipResetEditShare"
      )
      .addEventListener(
        "click",
        resetCurrent
      );
  }

  const originalRenderShare =
    typeof renderShare === "function"
      ? renderShare
      : () => {};

  if (
    typeof renderShare === "function"
  ) {
    renderShare = function() {
      captureSystemContent();

      applySavedToState();

      originalRenderShare();
    };
  }

  function init() {
    if (initialized) return;

    if (
      typeof member === "undefined" ||
      !member ||
      typeof todayContent === "undefined"
    ) {
      return;
    }

    injectEditor();

    if (todayContent) {
      captureSystemContent();

      applySavedToState();

      originalRenderShare();

      if (readSaved()) {
        setStatus(
          "已載入你今天在這支手機儲存的自訂文案。",
          true
        );
      }
    }

    initialized = true;
  }

  const timer =
    setInterval(
      () => {
        init();

        if (initialized) {
          clearInterval(timer);
        }
      },
      300
    );

  setTimeout(
    () => clearInterval(timer),
    30000
  );

})();

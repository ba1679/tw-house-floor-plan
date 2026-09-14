import type { Page } from "@playwright/test";

/**
 * 讓這一頁的瀏覽器封鎖 localStorage：一碰就丟例外，與無痕視窗、關掉網站資料的隱私設定一樣。
 * 在頁面載入前掛上，app 第一次讀就讀不到。
 *
 * 首次引導（M2 票 05）與學習進度（M4 票 04、05）都要在這種瀏覽器上照樣能用（spec user story 42），
 * 三份測試原本各抄一份——封鎖的寫法改了（例如改成只擋寫入）卻漏改一份，那一份就測到另一種瀏覽器。
 */
export const blockLocalStorage = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });

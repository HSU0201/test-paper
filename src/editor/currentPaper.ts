/** 目前編輯中的試卷對應到「我的考卷」哪一份；重新整理後仍記得 */
const CURRENT_KEY = 'testpaper-current-paper'

export function readCurrentId(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}

export function writeCurrentId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id)
    else window.localStorage.removeItem(CURRENT_KEY)
  } catch {
    // 無痕模式等情況存不進去，下次存檔會多一份，不影響內容
  }
}

/** 清空或開啟別的檔案時呼叫：之後存的是另一份考卷，不要蓋掉原本那份 */
export function forgetCurrentPaper() {
  writeCurrentId(null)
}

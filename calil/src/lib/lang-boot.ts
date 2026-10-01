/** Runs before React so the first paint already has the right language direction. Keep the key in sync with i18n.ts. */
export const LANG_BOOT_SCRIPT = `try{if(localStorage.getItem("calil:lang")==="he"){var d=document.documentElement;d.lang="he";d.dir="rtl"}}catch(e){}`;

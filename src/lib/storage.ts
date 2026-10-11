/** localStorage sicuro: in navigazione privata può non esserci. Solo preferenze personali. */
export const local = {
  get(k: string): string | null {
    try { return localStorage.getItem("nq_" + k); } catch { return null; }
  },
  set(k: string, v: string | null) {
    try { v === null ? localStorage.removeItem("nq_" + k) : localStorage.setItem("nq_" + k, v); } catch { /* ignora */ }
  },
};

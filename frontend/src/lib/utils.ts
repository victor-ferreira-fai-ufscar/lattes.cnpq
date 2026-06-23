import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Copia um texto para a área de transferência com fallback para contextos
 * não seguros.
 *
 * `navigator.clipboard` só está disponível em secure contexts (HTTPS ou
 * localhost). Em acessos por IP via HTTP a API não existe, então caímos num
 * fallback com `<textarea>` + `document.execCommand("copy")`.
 *
 * @returns `true` se a cópia foi bem-sucedida, `false` caso contrário.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // Caminho nativo: disponível apenas em secure contexts.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permissão negada, foco perdido etc.: tenta o fallback abaixo.
    }
  }

  // Fallback para HTTP/IP: textarea invisível + execCommand("copy").
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  // `readonly` evita abrir o teclado virtual no iOS ao focar.
  textarea.setAttribute("readonly", "");
  // Mantém o elemento fora de vista e sem causar scroll/zoom ao focar.
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0";

  // Preserva a seleção atual do usuário para restaurá-la depois.
  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  // `select()` não basta no iOS; setSelectionRange garante a seleção total.
  textarea.setSelectionRange(0, text.length);

  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }

  document.body.removeChild(textarea);

  // Restaura a seleção original, se havia.
  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }

  return succeeded;
}

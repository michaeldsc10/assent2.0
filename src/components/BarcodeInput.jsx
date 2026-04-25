/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — BarcodeInput.jsx
   Componente reutilizável para leitura de código de barras
   via leitor USB (funciona como teclado) ou digitação manual.
   ═══════════════════════════════════════════════════ */

import { useRef, useEffect, useCallback } from "react";

/**
 * BarcodeInput
 * @param {function} onScan      - Chamado com o código lido (string) ao pressionar Enter
 * @param {boolean}  autoFocus   - Se deve focar automaticamente (padrão: true)
 * @param {boolean}  visible     - Se o input deve ser visível (padrão: true)
 * @param {string}   placeholder - Placeholder do input (padrão: "Código de barras ou busca...")
 * @param {string}   className   - Classe CSS adicional
 * @param {boolean}  disabled    - Desabilita o input
 */
export default function BarcodeInput({
  onScan,
  autoFocus = true,
  visible = true,
  placeholder = "Código de barras ou busca...",
  className = "",
  disabled = false,
}) {
  const inputRef = useRef(null);

  /* Auto-foco ao montar e ao clicar na página (reposiciona foco no leitor) */
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  /* Reposiciona foco se usuário clicar em área não-interativa */
  useEffect(() => {
    if (!autoFocus) return;

    const handleClick = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const nonFocusTags = ["input", "textarea", "button", "select", "a", "label"];
      if (!nonFocusTags.includes(tag) && !e.target?.isContentEditable) {
        inputRef.current?.focus();
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [autoFocus]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const valor = e.target.value.trim();
        if (valor) {
          onScan(valor);
          e.target.value = ""; // limpa após leitura
        }
      }
    },
    [onScan]
  );

  if (!visible) {
    /* Input invisível — apenas captura o leitor em background */
    return (
      <input
        ref={inputRef}
        type="text"
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-hidden="true"
        style={{
          position: "fixed",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
          top: -9999,
          left: -9999,
        }}
        readOnly={false}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`barcode-input ${className}`}
      autoComplete="off"
      spellCheck="false"
    />
  );
}

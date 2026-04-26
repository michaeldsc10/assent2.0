// Usuarios.jsx — ASSENT v2.0
// Módulo de gerenciamento de usuários — exclusivo para Admin
//
// O que este arquivo implementa:
//   ✓ Listagem de usuários com badge de cargo e status ativo/inativo
//   ✓ Convite de novo usuário via Firebase Auth (secondary app) + Firestore
//   ✓ Criação de /userIndex/{uid} → { tenantUid } para o AuthContext funcionar
//   ✓ Edição de cargo e vínculo de vendedor
//   ✓ Toggle ativo/inativo com confirmação
//   ✓ Limite de 10 usuários adicionais (11 total com o Admin)
//   ✓ Tela de acesso negado para cargos não-Admin
//
// Dependência: firebase.js deve exportar `firebaseConfig` além de `db` e `auth`
// Exemplo: export const firebaseConfig = { apiKey: "...", ... };
//
// Estrutura Firestore gerada:
//   users/{tenantUid}/usuarios/{newUid}  → perfil do usuário
//   userIndex/{newUid}                   → { tenantUid } (índice reverso)

import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../lib/firebase";
import AuthContext from "../contexts/AuthContext";

/* ─────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────── */
const MAX_USUARIOS = 10; // máximo de usuários adicionais (exceto o Admin)

const CARGOS = [
  { value: "financeiro",  label: "Financeiro",          cor: "#5b8ef0", bg: "rgba(91,142,240,0.12)"  },
  { value: "comercial",   label: "Comercial",           cor: "#3ecf8e", bg: "rgba(62,207,142,0.12)"  },
  { value: "compras",     label: "Compras",             cor: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  { value: "operacional", label: "Operacional",         cor: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { value: "vendedor",    label: "Vendedor",            cor: "#c8a55e", bg: "rgba(200,165,94,0.12)"  },
  { value: "suporte",     label: "Suporte / Atendimento", cor: "#6b7280", bg: "rgba(107,114,128,0.12)" },
];

const CARGO_MAP = Object.fromEntries(CARGOS.map((c) => [c.value, c]));

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .usr-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Topbar ── */
  .usr-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--s1);
    flex-shrink: 0;
  }
  .usr-topbar-title h2 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .usr-topbar-title p {
    font-size: 11px;
    color: var(--text-3);
    margin: 2px 0 0;
  }
  .usr-topbar-spacer { flex: 1; }
  .usr-counter {
    font-size: 12px;
    color: var(--text-3);
    background: var(--s2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 10px;
  }
  .usr-counter span { color: var(--gold); font-weight: 600; }

  /* ── Botão Convidar ── */
  .usr-btn-convidar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #c8a55e, #dfc07c);
    color: #0a0808;
    font-weight: 700;
    font-size: 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity .15s;
    white-space: nowrap;
  }
  .usr-btn-convidar:hover { opacity: 0.88; }
  .usr-btn-convidar:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Tabela ── */
  .usr-table-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  .usr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .usr-table thead tr {
    border-bottom: 1px solid var(--border);
  }
  .usr-table th {
    padding: 9px 12px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .usr-table tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background .12s;
  }
  .usr-table tbody tr:hover { background: rgba(255,255,255,0.02); }
  .usr-table td {
    padding: 11px 12px;
    vertical-align: middle;
  }

  /* ── Avatar + nome ── */
  .usr-user-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .usr-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #b8952e, #e0c060);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: #0a0808;
    flex-shrink: 0;
  }
  .usr-avatar.inativo {
    background: var(--s3);
    color: var(--text-3);
  }
  .usr-user-name {
    font-weight: 500;
    color: var(--text);
  }
  .usr-user-name.inativo { color: var(--text-3); text-decoration: line-through; }
  .usr-user-email {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 1px;
  }

  /* ── Badge cargo ── */
  .usr-badge-cargo {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .usr-badge-admin {
    background: rgba(200,165,94,0.15);
    color: var(--gold);
    border: 1px solid rgba(200,165,94,0.25);
  }

  /* ── Badge status ── */
  .usr-badge-ativo {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
  }
  .usr-badge-ativo.ativo {
    background: rgba(62,207,142,0.1);
    color: var(--green);
  }
  .usr-badge-ativo.inativo {
    background: rgba(255,255,255,0.04);
    color: var(--text-3);
  }
  .usr-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .usr-dot.ativo  { background: var(--green); }
  .usr-dot.inativo { background: var(--text-3); }

  /* ── Ações ── */
  .usr-acoes {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .usr-btn-acao {
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background .12s, border-color .12s;
  }
  .usr-btn-acao.editar {
    background: rgba(91,142,240,0.1);
    color: var(--blue);
    border-color: rgba(91,142,240,0.2);
  }
  .usr-btn-acao.editar:hover { background: rgba(91,142,240,0.18); }
  .usr-btn-acao.ativar {
    background: rgba(62,207,142,0.08);
    color: var(--green);
    border-color: rgba(62,207,142,0.2);
  }
  .usr-btn-acao.ativar:hover { background: rgba(62,207,142,0.16); }
  .usr-btn-acao.desativar {
    background: rgba(224,82,82,0.08);
    color: var(--red);
    border-color: rgba(224,82,82,0.18);
  }
  .usr-btn-acao.desativar:hover { background: rgba(224,82,82,0.15); }
  .usr-btn-acao.excluir {
    background: rgba(224,82,82,0.08);
    color: var(--red);
    border-color: rgba(224,82,82,0.18);
  }
  .usr-btn-acao.excluir:hover { background: rgba(224,82,82,0.18); }
  .usr-btn-acao.detalhes {
    background: rgba(200,165,94,0.08);
    color: var(--gold);
    border-color: rgba(200,165,94,0.18);
  }
  .usr-btn-acao.detalhes:hover { background: rgba(200,165,94,0.15); }

  /* ── Modal Detalhes ── */
  .usr-detalhe-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    margin-bottom: 16px;
  }
  .usr-detalhe-item { display: flex; flex-direction: column; gap: 3px; }
  .usr-detalhe-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3);
  }
  .usr-detalhe-val { font-size: 13px; color: var(--text); }
  .usr-detalhe-sep {
    border: none; border-top: 1px solid var(--border); margin: 4px 0 16px;
  }
  .usr-reset-box {
    background: rgba(200,165,94,0.06); border: 1px solid rgba(200,165,94,0.18);
    border-radius: 10px; padding: 14px 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .usr-reset-info { font-size: 12px; color: var(--text-2); line-height: 1.5; }
  .usr-reset-info strong { color: var(--text); display: block; margin-bottom: 2px; }
  .usr-btn-reset {
    padding: 7px 14px; border-radius: 8px; white-space: nowrap; flex-shrink: 0;
    background: linear-gradient(135deg, #c8a55e, #dfc07c);
    color: #0a0808; border: none; cursor: pointer;
    font-size: 12px; font-weight: 700; transition: opacity .15s;
  }
  .usr-btn-reset:hover { opacity: .88; }
  .usr-btn-reset:disabled { opacity: .5; cursor: not-allowed; }

  /* ── Linha Admin (destacada) ── */
  .usr-row-admin td:first-child { border-left: 2px solid var(--gold); }

  /* ── Empty state ── */
  .usr-empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-3);
  }
  .usr-empty-icon { font-size: 36px; margin-bottom: 12px; }
  .usr-empty h3 { font-size: 14px; color: var(--text-2); margin-bottom: 6px; }
  .usr-empty p { font-size: 12px; }

  /* ── Acesso negado ── */
  .usr-acesso-negado {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--text-3);
    text-align: center;
    padding: 40px;
  }
  .usr-acesso-negado-icon { font-size: 40px; }
  .usr-acesso-negado h3 { font-size: 15px; color: var(--text-2); margin: 0; }
  .usr-acesso-negado p  { font-size: 12px; max-width: 320px; line-height: 1.6; }

  /* ─────────────────────────────────
     MODAL
  ───────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }
  .modal-box {
    background: var(--s1);
    border: 1px solid var(--border-h);
    border-radius: 14px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--border);
  }
  .modal-header h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .modal-header p {
    font-size: 11px;
    color: var(--text-3);
    margin: 3px 0 0;
  }
  .modal-close {
    background: transparent;
    border: none;
    color: var(--text-3);
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    transition: color .12s;
  }
  .modal-close:hover { color: var(--text); }
  .modal-body {
    padding: 18px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
  }

  /* ── Campos do modal ── */
  .usr-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .usr-field label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .usr-field input,
  .usr-field select {
    background: var(--s2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 13px;
    color: var(--text);
    outline: none;
    transition: border-color .15s;
    width: 100%;
    font-family: 'DM Sans', sans-serif;
  }
  .usr-field input:focus,
  .usr-field select:focus { border-color: var(--gold); }
  .usr-field input::placeholder { color: var(--text-3); }
  .usr-field input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .usr-field-hint {
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.5;
  }
  .usr-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* ── Aviso de cargo ── */
  .usr-cargo-info {
    background: rgba(200,165,94,0.07);
    border: 1px solid rgba(200,165,94,0.18);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    color: var(--text-2);
    line-height: 1.6;
  }

  /* ── Erro ── */
  .usr-erro {
    background: var(--red-d);
    border: 1px solid rgba(224,82,82,0.25);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--red);
  }

  /* ── Botões modal ── */
  .usr-btn-cancelar {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border-h);
    border-radius: 8px;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background .12s;
  }
  .usr-btn-cancelar:hover { background: rgba(255,255,255,0.04); }
  .usr-btn-salvar {
    padding: 8px 20px;
    background: linear-gradient(135deg, #c8a55e, #dfc07c);
    border: none;
    border-radius: 8px;
    color: #0a0808;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity .15s;
  }
  .usr-btn-salvar:hover  { opacity: 0.88; }
  .usr-btn-salvar:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Loading spinner ── */
  .usr-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-3);
    font-size: 13px;
    gap: 10px;
  }

  /* ── Divisor ── */
  .usr-divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2px 0;
  }

  /* ── Toast feedback ── */
  .usr-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--s2);
    border: 1px solid var(--border-h);
    border-radius: 10px;
    padding: 11px 16px;
    font-size: 13px;
    color: var(--text);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 300;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: usr-toast-in 0.2s ease;
  }
  .usr-toast.sucesso { border-color: rgba(62,207,142,0.3); }
  .usr-toast.erro    { border-color: rgba(224,82,82,0.3); }
  @keyframes usr-toast-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 640px) {
    .usr-table-wrap { padding: 12px; }
    .usr-topbar { flex-wrap: wrap; gap: 8px; }
    .usr-field-row { grid-template-columns: 1fr; }
    .usr-table th:nth-child(3),
    .usr-table td:nth-child(3) { display: none; }
  }

  /* ── Foto do usuário ── */
  .usr-foto-wrap {
    display: flex; align-items: center; gap: 14px; margin-bottom: 4px;
  }
  .usr-foto-preview {
    width: 64px; height: 64px; border-radius: 50%;
    background: linear-gradient(135deg, #b8952e, #e0c060);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700; color: #0a0808;
    flex-shrink: 0; cursor: pointer; overflow: hidden;
    border: 2px solid var(--border-h);
    transition: border-color .15s, transform .15s;
    position: relative;
  }
  .usr-foto-preview:hover { border-color: var(--gold); transform: scale(1.04); }
  .usr-foto-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .usr-foto-preview .usr-foto-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .15s; border-radius: 50%;
    font-size: 18px;
  }
  .usr-foto-preview:hover .usr-foto-overlay { opacity: 1; }
  .usr-foto-actions { display: flex; flex-direction: column; gap: 6px; }
  .usr-foto-btn {
    padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid transparent; transition: background .12s, border-color .12s;
  }
  .usr-foto-btn.escolher {
    background: rgba(200,165,94,0.1); color: var(--gold);
    border-color: rgba(200,165,94,0.25);
  }
  .usr-foto-btn.escolher:hover { background: rgba(200,165,94,0.18); }
  .usr-foto-btn.remover {
    background: rgba(224,82,82,0.07); color: var(--red);
    border-color: rgba(224,82,82,0.2);
  }
  .usr-foto-btn.remover:hover { background: rgba(224,82,82,0.15); }

  /* ── Crop modal ── */
  .usr-crop-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.82);
    display: flex; align-items: center; justify-content: center;
    z-index: 400; padding: 20px;
  }
  .usr-crop-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 420px;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .usr-crop-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid var(--border);
  }
  .usr-crop-header h4 { font-size: 13px; font-weight: 600; color: var(--text); margin: 0; }
  .usr-crop-canvas-wrap {
    position: relative; width: 100%; aspect-ratio: 1;
    background: #000; overflow: hidden; cursor: move;
  }
  .usr-crop-canvas { display: block; width: 100%; height: 100%; }
  .usr-crop-circle-mask {
    position: absolute; inset: 0; pointer-events: none;
    box-shadow: 0 0 0 2000px rgba(0,0,0,0.55);
    border-radius: 0;
  }
  .usr-crop-circle {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    width: 72%; aspect-ratio: 1; border-radius: 50%;
    box-shadow: 0 0 0 2000px rgba(0,0,0,0.55);
    border: 2px solid rgba(200,165,94,0.7);
  }
  .usr-crop-controls {
    padding: 14px 18px; display: flex; flex-direction: column; gap: 10px;
    border-top: 1px solid var(--border);
  }
  .usr-crop-zoom-row {
    display: flex; align-items: center; gap: 10px;
  }
  .usr-crop-zoom-label { font-size: 11px; color: var(--text-3); white-space: nowrap; }
  .usr-crop-zoom-range {
    flex: 1; accent-color: var(--gold);
  }
  .usr-crop-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 18px; border-top: 1px solid var(--border);
  }

  /* ── Viewer de imagem ── */
  .usr-viewer-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.9);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    z-index: 500; gap: 20px;
  }
  .usr-viewer-img {
    width: 200px; height: 200px; border-radius: 50%;
    object-fit: cover; border: 3px solid rgba(200,165,94,0.5);
    box-shadow: 0 0 60px rgba(0,0,0,0.8);
  }
  .usr-viewer-actions { display: flex; gap: 10px; }
`;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function inicialNome(nome) {
  if (!nome) return "?";
  const partes = nome.trim().split(" ");
  return partes.length >= 2
    ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
    : partes[0][0].toUpperCase();
}

function BadgeCargo({ cargo }) {
  if (cargo === "admin") {
    return <span className="usr-badge-cargo usr-badge-admin">Admin</span>;
  }
  const c = CARGO_MAP[cargo];
  if (!c) return <span className="usr-badge-cargo" style={{ color: "var(--text-3)" }}>{cargo}</span>;
  return (
    <span
      className="usr-badge-cargo"
      style={{ background: c.bg, color: c.cor, border: `1px solid ${c.cor}33` }}
    >
      {c.label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE: Crop de imagem circular
───────────────────────────────────────────── */
function CropModal({ imageSrc, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom]     = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef             = useRef(null);
  const imgRef              = useRef(new window.Image());

  useEffect(() => {
    const img = imgRef.current;
    img.onload = () => draw();
    img.src = imageSrc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  useEffect(() => { draw(); }, [zoom, offset]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext("2d");
    const size   = canvas.width;
    const img    = imgRef.current;
    if (!img.complete || !img.naturalWidth) return;

    ctx.clearRect(0, 0, size, size);

    const scale  = Math.min(size / img.naturalWidth, size / img.naturalHeight) * zoom;
    const iw     = img.naturalWidth  * scale;
    const ih     = img.naturalHeight * scale;
    const cx     = size / 2 + offset.x - iw / 2;
    const cy     = size / 2 + offset.y - ih / 2;

    ctx.drawImage(img, cx, cy, iw, ih);
  }

  function getCropped() {
    const canvas = canvasRef.current;
    const size   = canvas.width;
    const r      = size * 0.36; // raio do círculo (72% do canvas / 2)
    const out    = document.createElement("canvas");
    out.width    = out.height = Math.round(r * 2);
    const ctx    = out.getContext("2d");
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(canvas, size / 2 - r, size / 2 - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    return out.toDataURL("image/jpeg", 0.85);
  }

  function onMouseDown(e) {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    dragRef.current = start;
    const onMove = (ev) => {
      setOffset({ x: start.ox + ev.clientX - start.x, y: start.oy + ev.clientY - start.y });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const start = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y };
    const onMove = (ev) => {
      const tt = ev.touches[0];
      setOffset({ x: start.ox + tt.clientX - start.x, y: start.oy + tt.clientY - start.y });
    };
    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  }

  return (
    <div className="usr-crop-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="usr-crop-box">
        <div className="usr-crop-header">
          <h4>📷 Ajustar foto</h4>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div
          className="usr-crop-canvas-wrap"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <canvas ref={canvasRef} width={400} height={400} className="usr-crop-canvas" />
          {/* Máscara circular */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `radial-gradient(circle 36% at 50% 50%, transparent 99%, rgba(0,0,0,0.6) 100%)`,
          }} />
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            width: "72%", aspectRatio: "1",
            borderRadius: "50%",
            border: "2px solid rgba(200,165,94,0.8)",
            pointerEvents: "none",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }} />
        </div>

        <div className="usr-crop-controls">
          <div className="usr-crop-zoom-row">
            <span className="usr-crop-zoom-label">🔍 Zoom</span>
            <input
              type="range" className="usr-crop-zoom-range"
              min="0.5" max="3" step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <span className="usr-crop-zoom-label">{(zoom * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div className="usr-crop-footer">
          <button className="usr-btn-cancelar" onClick={onCancel}>Cancelar</button>
          <button
            className="usr-btn-salvar"
            onClick={() => onConfirm(getCropped())}
          >
            Confirmar foto
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE: Viewer de foto (clique na foto)
───────────────────────────────────────────── */
function ImageViewer({ src, nome, onClose, onRemove, onTrocar }) {
  return (
    <div className="usr-viewer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <img src={src} alt={nome} className="usr-viewer-img" />
      <div className="usr-viewer-actions">
        <button className="usr-btn-acao editar" onClick={onTrocar}>
          🔄 Trocar imagem
        </button>
        <button className="usr-btn-acao desativar" onClick={onRemove}>
          🗑 Remover imagem
        </button>
        <button className="usr-btn-cancelar" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}


function ModalUsuario({ usuario, vendedores, onSalvar, onFechar, salvando }) {
  const isEdicao = Boolean(usuario?.uid);

  const [nome,       setNome]       = useState(usuario?.nome  || "");
  const [email,      setEmail]      = useState(usuario?.email || "");
  const [senha,      setSenha]      = useState("");
  const [cargo,      setCargo]      = useState(usuario?.cargo || "operacional");
  const [vendedorId, setVendedorId] = useState(usuario?.vendedorId || "");
  const [erro,       setErro]       = useState("");

  // Foto
  const [fotoBase64,   setFotoBase64]   = useState(usuario?.fotoBase64 || null);
  const [cropSrc,      setCropSrc]      = useState(null);
  const [showViewer,   setShowViewer]   = useState(false);
  const fileInputRef = useRef(null);

  // Quando muda de cargo e não é mais "vendedor", limpa o vínculo
  useEffect(() => {
    if (cargo !== "vendedor") setVendedorId("");
  }, [cargo]);

  function abrirSeletorFoto() { fileInputRef.current?.click(); }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const cargoInfo = {
    financeiro:  "Acesso completo ao módulo financeiro. Visão estratégica dos números.",
    comercial:   "Gestão de vendas, clientes e orçamentos. Sem acesso a dados financeiros sensíveis.",
    compras:     "Gestão de fornecedores, compras e entrada de estoque.",
    operacional: "Dia a dia: estoque, caixa, cadastros. Sem visão financeira estratégica.",
    vendedor:    "Foco no funil de vendas. Enxerga apenas as próprias vendas e agenda.",
    suporte:     "Visualiza clientes e agenda. Sem acesso a dados financeiros.",
  };

  function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (!nome.trim())  { setErro("Nome é obrigatório."); return; }
    if (!isEdicao) {
      if (!email.trim()) { setErro("E-mail é obrigatório."); return; }
      if (senha.length < 6) { setErro("A senha deve ter no mínimo 6 caracteres."); return; }
    }
    if (cargo === "vendedor" && !vendedorId) {
      setErro("Selecione o cadastro de vendedor vinculado a este usuário."); return;
    }

    onSalvar({ nome: nome.trim(), email: email.trim(), senha, cargo, vendedorId, fotoBase64 }, setErro);
  }

  const inicial = inicialNome(nome || "?");

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onConfirm={(b64) => { setFotoBase64(b64); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {showViewer && fotoBase64 && (
        <ImageViewer
          src={fotoBase64}
          nome={nome}
          onClose={() => setShowViewer(false)}
          onRemove={() => { setFotoBase64(null); setShowViewer(false); }}
          onTrocar={() => { setShowViewer(false); abrirSeletorFoto(); }}
        />
      )}

    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <h3>{isEdicao ? "Editar usuário" : "Convidar novo usuário"}</h3>
            <p>
              {isEdicao
                ? "Altere cargo, foto ou vínculo de vendedor"
                : "Cria uma conta e define o cargo de acesso"}
            </p>
          </div>
          <button className="modal-close" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* ── Foto ── */}
            <div className="usr-field">
              <label>Foto do colaborador</label>
              <div className="usr-foto-wrap">
                <div
                  className="usr-foto-preview"
                  onClick={() => fotoBase64 ? setShowViewer(true) : abrirSeletorFoto()}
                  title={fotoBase64 ? "Clique para visualizar / alterar" : "Clique para adicionar foto"}
                >
                  {fotoBase64
                    ? <img src={fotoBase64} alt={nome} />
                    : inicial}
                  <div className="usr-foto-overlay">
                    {fotoBase64 ? "🔍" : "📷"}
                  </div>
                </div>
                <div className="usr-foto-actions">
                  <button type="button" className="usr-foto-btn escolher" onClick={abrirSeletorFoto}>
                    {fotoBase64 ? "Trocar foto" : "Escolher foto"}
                  </button>
                  {fotoBase64 && (
                    <button type="button" className="usr-foto-btn remover" onClick={() => setFotoBase64(null)}>
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
              <span className="usr-field-hint">A foto aparece no header para este colaborador.</span>
            </div>

            {/* Nome */}
            <div className="usr-field">
              <label>Nome completo</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Maria Silva"
                required
              />
            </div>

            {/* E-mail e Senha — só no convite */}
            {!isEdicao && (
              <div className="usr-field-row">
                <div className="usr-field">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@email.com"
                    required
                  />
                </div>
                <div className="usr-field">
                  <label>Senha inicial</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mín. 6 caracteres"
                    required
                    minLength={6}
                  />
                  <span className="usr-field-hint">O usuário pode alterar depois.</span>
                </div>
              </div>
            )}

            {/* E-mail só leitura na edição */}
            {isEdicao && (
              <div className="usr-field">
                <label>E-mail</label>
                <input value={usuario.email} disabled />
                <span className="usr-field-hint">O e-mail não pode ser alterado após a criação.</span>
              </div>
            )}

            <hr className="usr-divider" />

            {/* Cargo */}
            <div className="usr-field">
              <label>Cargo</label>
              <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
                {CARGOS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Info do cargo */}
            {cargoInfo[cargo] && (
              <div className="usr-cargo-info">
                💡 <strong>{CARGO_MAP[cargo]?.label}:</strong> {cargoInfo[cargo]}
              </div>
            )}

            {/* Vínculo de vendedor — só aparece quando cargo = "vendedor" */}
            {cargo === "vendedor" && (
              <div className="usr-field">
                <label>Cadastro de vendedor vinculado</label>
                {vendedores.length === 0 ? (
                  <p className="usr-field-hint" style={{ color: "var(--amber)" }}>
                    ⚠️ Nenhum vendedor cadastrado ainda. Acesse o módulo Vendedores e crie o cadastro primeiro.
                  </p>
                ) : (
                  <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                    <option value="">— Selecione o vendedor —</option>
                    {vendedores
                      .filter((v) => v.ativo !== false)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome}{v.comissao ? ` (${v.comissao}% comissão)` : ""}
                        </option>
                      ))}
                  </select>
                )}
                <span className="usr-field-hint">
                  Este é o cadastro que filtra as vendas e a agenda deste usuário.
                </span>
              </div>
            )}

            {/* Erro */}
            {erro && <div className="usr-erro">⚠️ {erro}</div>}

          </div>

          <div className="modal-footer">
            <button type="button" className="usr-btn-cancelar" onClick={onFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="usr-btn-salvar" disabled={salvando}>
              {salvando
                ? "Aguarde…"
                : isEdicao
                ? "Salvar alterações"
                : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   MODAL: Detalhes do colaborador
───────────────────────────────────────────── */
function ModalDetalhes({ usr, vendedores, onFechar, onResetSenha, resetando }) {
  const cargo    = CARGO_MAP[usr.cargo];
  const vendedor = vendedores.find(v => v.id === usr.vendedorId);
  const criado   = usr.criadoEm?.toDate?.()?.toLocaleDateString("pt-BR") ?? "—";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h3>{usr.nome}</h3>
            <p>{usr.email}</p>
          </div>
          <button className="modal-close" onClick={onFechar}>✕</button>
        </div>

        <div className="modal-body">
          <div className="usr-detalhe-grid">
            <div className="usr-detalhe-item">
              <span className="usr-detalhe-label">Cargo</span>
              <BadgeCargo cargo={usr.cargo} />
            </div>
            <div className="usr-detalhe-item">
              <span className="usr-detalhe-label">Status</span>
              <span className={`usr-badge-ativo ${usr.ativo !== false ? "ativo" : "inativo"}`}>
                <span className={`usr-dot ${usr.ativo !== false ? "ativo" : "inativo"}`} />
                {usr.ativo !== false ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="usr-detalhe-item">
              <span className="usr-detalhe-label">Convidado em</span>
              <span className="usr-detalhe-val">{criado}</span>
            </div>
            <div className="usr-detalhe-item">
              <span className="usr-detalhe-label">Vendedor vinculado</span>
              <span className="usr-detalhe-val">{vendedor?.nome ?? "—"}</span>
            </div>
            <div className="usr-detalhe-item" style={{ gridColumn: "1 / -1" }}>
              <span className="usr-detalhe-label">UID</span>
              <span className="usr-detalhe-val" style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "monospace" }}>
                {usr.uid}
              </span>
            </div>
          </div>

          <hr className="usr-detalhe-sep" />

          {/* Redefinir senha */}
          <div className="usr-reset-box">
            <div className="usr-reset-info">
              <strong>Redefinir senha de acesso</strong>
              Um e-mail de redefinição será enviado para <strong>{usr.email}</strong>.
              O usuário poderá definir uma nova senha pelo link recebido.
            </div>
            <button
              className="usr-btn-reset"
              onClick={onResetSenha}
              disabled={resetando}
            >
              {resetando ? "Enviando…" : "Enviar link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */
export default function Usuarios() {
  const { user, cargo, tenantUid, isAdmin } = useContext(AuthContext);

  const [usuarios,   setUsuarios]   = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [salvando,   setSalvando]   = useState(false);
  const [toast,      setToast]      = useState(null); // { msg, tipo }
  const [detalhe,    setDetalhe]    = useState(null); // usr sendo visualizado
  const [resetando,  setResetando]  = useState(false);

  // tenantUid = uid do Admin dono da conta (raiz do Firestore)
  const raiz = tenantUid || user?.uid;

  /* ── Firestore: ouvir usuários ── */
  useEffect(() => {
    if (!raiz) return;
    const colRef = collection(db, "users", raiz, "usuarios");
    const unsub = onSnapshot(colRef, (snap) => {
      const lista = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      // Ordena: ativos primeiro, depois pelo nome
      lista.sort((a, b) => {
        if (a.ativo === b.ativo) return (a.nome || "").localeCompare(b.nome || "");
        return a.ativo === false ? 1 : -1;
      });
      setUsuarios(lista);
      setLoading(false);
    });
    return () => unsub();
  }, [raiz]);

  /* ── Firestore: ouvir vendedores (para o select no modal) ── */
  useEffect(() => {
    if (!raiz) return;
    const colRef = collection(db, "users", raiz, "vendedores");
    const unsub = onSnapshot(colRef, (snap) => {
      setVendedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [raiz]);

  /* ── Notificação toast ── */
  function mostrarToast(msg, tipo = "sucesso") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── Abrir modal de edição ── */
  function abrirEditar(usr) {
    setUsuarioEditando(usr);
    setModalAberto(true);
  }

  /* ── Fechar modal ── */
  function fecharModal() {
    setModalAberto(false);
    setUsuarioEditando(null);
  }

  /* ── Contar usuários não-admin ativos ── */
  const totalAtivos = usuarios.filter((u) => u.ativo !== false).length;

  /* ── Criar usuário via Cloud Function (validação no servidor) ── */
  async function criarUsuario({ nome, email, senha, cargo: novoCargo, vendedorId, fotoBase64 }, setErro) {
    setSalvando(true);
    try {
      const fn = httpsCallable(getFunctions(), "criarUsuario");
      const { data } = await fn({ nome, email, senha, cargo: novoCargo, vendedorId });
      // Se tiver foto, salva no documento criado pela CF
      if (fotoBase64 && data?.uid) {
        try {
          await updateDoc(doc(db, "users", raiz, "usuarios", data.uid), { fotoBase64 });
        } catch (_) { /* não bloqueia se a foto falhar */ }
      }
      fecharModal();
      mostrarToast(`Usuário "${data.nome}" criado com sucesso.`);
    } catch (err) {
      console.error("[Usuarios] Erro ao criar usuário:", err);
      const msg = err?.message || "";
      if (msg.includes("já está em uso"))       setErro("Este e-mail já está em uso em outra conta.");
      else if (msg.includes("E-mail inválido")) setErro("E-mail inválido.");
      else if (msg.includes("6 caracteres"))    setErro("Senha muito fraca. Use pelo menos 6 caracteres.");
      else if (msg.includes("Limite"))          setErro("Limite de 10 usuários atingido.");
      else                                      setErro("Erro ao criar usuário. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  /* ── Editar usuário via Cloud Function (validação no servidor) ── */
  async function editarUsuario({ nome, cargo: novoCargo, vendedorId, fotoBase64 }, setErro) {
    setSalvando(true);
    try {
      const fn = httpsCallable(getFunctions(), "editarUsuario");
      await fn({ uid: usuarioEditando.uid, nome, cargo: novoCargo, vendedorId });
      // Salva foto diretamente no documento do usuário (não passa pela CF)
      await updateDoc(doc(db, "users", raiz, "usuarios", usuarioEditando.uid), {
        fotoBase64: fotoBase64 || null,
      });
      fecharModal();
      mostrarToast(`Usuário "${nome}" atualizado.`);
    } catch (err) {
      console.error("[Usuarios] Erro ao editar:", err);
      setErro("Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  }

  /* ── Roteador: criar ou editar ── */
  function handleSalvar(dados, setErro) {
    if (usuarioEditando) {
      editarUsuario(dados, setErro);
    } else {
      criarUsuario(dados, setErro);
    }
  }

  /* ── Toggle ativo/inativo ── */
  async function toggleAtivo(usr) {
    const novoStatus = !usr.ativo;
    const acao = novoStatus ? "ativar" : "desativar";
    if (!window.confirm(
      `Deseja ${acao} o acesso de "${usr.nome}"?\n` +
      (novoStatus
        ? "O usuário voltará a conseguir logar no sistema."
        : "O usuário perderá o acesso, mas seus dados históricos serão preservados.")
    )) return;

    try {
      await updateDoc(doc(db, "users", raiz, "usuarios", usr.uid), {
        ativo: novoStatus,
        atualizadoEm: serverTimestamp(),
      });
      mostrarToast(
        novoStatus ? `"${usr.nome}" reativado.` : `"${usr.nome}" desativado.`
      );
    } catch (err) {
      console.error("[Usuarios] Erro ao alterar status:", err);
      mostrarToast("Erro ao alterar status.", "erro");
    }
  }

  /* ── Redefinir senha do colaborador ── */
  async function resetarSenha(usr) {
    setResetando(true);
    try {
      const { getAuth } = await import("firebase/auth");
      await sendPasswordResetEmail(getAuth(), usr.email);
      mostrarToast(`Link de redefinição enviado para "${usr.email}".`);
    } catch (err) {
      console.error("[Usuarios] Erro ao redefinir senha:", err);
      mostrarToast("Erro ao enviar e-mail de redefinição.", "erro");
    } finally {
      setResetando(false);
    }
  }

  /* ── Excluir usuário via Cloud Function (validação no servidor) ── */
  async function excluirUsuario(usr) {
    if (!window.confirm(
      `Excluir permanentemente "${usr.nome}"?\n\n` +
      `Esta ação remove o acesso e todos os dados de perfil. ` +
      `Registros históricos (vendas, pedidos, etc.) são preservados.\n\n` +
      `Esta ação não pode ser desfeita.`
    )) return;
    try {
      const fn = httpsCallable(getFunctions(), "excluirUsuario");
      await fn({ uid: usr.uid });
      mostrarToast(`"${usr.nome}" removido permanentemente.`);
    } catch (err) {
      console.error("[Usuarios] Erro ao excluir:", err);
      mostrarToast("Erro ao excluir usuário.", "erro");
    }
  }

  /* ─────────────────────────────────────────
     RENDER: acesso negado
  ───────────────────────────────────────── */
  if (!isAdmin) {
    return (
      <>
        <style>{CSS}</style>
        <div className="usr-root">
          <div className="usr-acesso-negado">
            <div className="usr-acesso-negado-icon">🔒</div>
            <h3>Acesso restrito</h3>
            <p>
              O módulo de Usuários é exclusivo para o <strong>Administrador</strong> da conta.
              Entre em contato com o responsável caso precise de alterações.
            </p>
          </div>
        </div>
      </>
    );
  }

  /* ─────────────────────────────────────────
     RENDER: loading
  ───────────────────────────────────────── */
  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="usr-root">
          <div className="usr-loading">Carregando usuários…</div>
        </div>
      </>
    );
  }

  /* ─────────────────────────────────────────
     RENDER PRINCIPAL
  ───────────────────────────────────────── */
  const limiteAtingido = totalAtivos >= MAX_USUARIOS;

  return (
    <>
      <style>{CSS}</style>

      <div className="usr-root">

        {/* ── Topbar ── */}
        <div className="usr-topbar">
          <div className="usr-topbar-title">
            <h2>Usuários</h2>
            <p>Gerencie os acessos da sua equipe</p>
          </div>

          <div className="usr-topbar-spacer" />

          <div className="usr-counter">
            <span>{totalAtivos}</span>/{MAX_USUARIOS} usuários ativos
          </div>

          <button
            className="usr-btn-convidar"
            onClick={() => { setUsuarioEditando(null); setModalAberto(true); }}
            disabled={limiteAtingido}
            title={limiteAtingido ? `Limite de ${MAX_USUARIOS} usuários atingido` : "Convidar novo usuário"}
          >
            + Convidar usuário
          </button>
        </div>

        {/* ── Aviso de limite ── */}
        {limiteAtingido && (
          <div style={{
            padding: "10px 20px",
            background: "rgba(245,158,11,0.08)",
            borderBottom: "1px solid rgba(245,158,11,0.2)",
            fontSize: 12,
            color: "var(--amber)",
          }}>
            ⚠️ Limite de {MAX_USUARIOS} usuários adicionais atingido. Desative um usuário para liberar uma vaga.
          </div>
        )}

        {/* ── Tabela ── */}
        <div className="usr-table-wrap">
          {usuarios.length === 0 ? (
            <div className="usr-empty">
              <div className="usr-empty-icon">👥</div>
              <h3>Nenhum usuário adicionado ainda</h3>
              <p>Clique em "Convidar usuário" para dar acesso à sua equipe.</p>
            </div>
          ) : (
            <table className="usr-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Cargo</th>
                  <th>Vendedor vinculado</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* ── Linha do Admin (sempre no topo) ── */}
                <tr className="usr-row-admin">
                  <td>
                    <div className="usr-user-cell">
                      <div className="usr-avatar">
                        {inicialNome(user.displayName || user.email)}
                      </div>
                      <div>
                        <div className="usr-user-name">
                          {user.displayName || "Administrador"}
                        </div>
                        <div className="usr-user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><BadgeCargo cargo="admin" /></td>
                  <td><span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span></td>
                  <td>
                    <span className="usr-badge-ativo ativo">
                      <span className="usr-dot ativo" />Ativo
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Proprietário da conta</span>
                  </td>
                </tr>

                {/* ── Usuários adicionais ── */}
                {usuarios.map((usr) => {
                  const isAtivo = usr.ativo !== false;
                  const vendedorNome = usr.vendedorId
                    ? vendedores.find((v) => v.id === usr.vendedorId)?.nome
                    : null;

                  return (
                    <tr key={usr.uid}>
                      <td>
                        <div className="usr-user-cell">
                          <div className={`usr-avatar${isAtivo ? "" : " inativo"}`} style={usr.fotoBase64 ? { background: "none", padding: 0, overflow: "hidden" } : {}}>
                            {usr.fotoBase64
                              ? <img src={usr.fotoBase64} alt={usr.nome} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                              : inicialNome(usr.nome)}
                          </div>
                          <div>
                            <div className={`usr-user-name${isAtivo ? "" : " inativo"}`}>
                              {usr.nome}
                            </div>
                            <div className="usr-user-email">{usr.email}</div>
                          </div>
                        </div>
                      </td>

                      <td><BadgeCargo cargo={usr.cargo} /></td>

                      <td>
                        {vendedorNome ? (
                          <span style={{
                            fontSize: 12,
                            background: "rgba(62,207,142,0.1)",
                            color: "var(--green)",
                            padding: "2px 8px",
                            borderRadius: 12,
                          }}>
                            ✓ {vendedorNome}
                          </span>
                        ) : usr.cargo === "vendedor" ? (
                          <span style={{
                            fontSize: 12,
                            background: "rgba(224,82,82,0.08)",
                            color: "var(--red)",
                            padding: "2px 8px",
                            borderRadius: 12,
                          }}>
                            ⚠ Sem vínculo
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      <td>
                        <span className={`usr-badge-ativo ${isAtivo ? "ativo" : "inativo"}`}>
                          <span className={`usr-dot ${isAtivo ? "ativo" : "inativo"}`} />
                          {isAtivo ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td>
                        <div className="usr-acoes">
                          <button
                            className="usr-btn-acao detalhes"
                            onClick={() => setDetalhe(usr)}
                          >
                            Detalhes
                          </button>
                          <button
                            className="usr-btn-acao editar"
                            onClick={() => abrirEditar(usr)}
                          >
                            Editar
                          </button>
                          <button
                            className={`usr-btn-acao ${isAtivo ? "desativar" : "ativar"}`}
                            onClick={() => toggleAtivo(usr)}
                          >
                            {isAtivo ? "Desativar" : "Reativar"}
                          </button>
                          <button
                            className="usr-btn-acao excluir"
                            onClick={() => excluirUsuario(usr)}
                            title="Remover permanentemente"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Modal ── */}
        {modalAberto && (
          <ModalUsuario
            usuario={usuarioEditando}
            vendedores={vendedores}
            onSalvar={handleSalvar}
            onFechar={fecharModal}
            salvando={salvando}
          />
        )}

        {/* ── Modal Detalhes ── */}
        {detalhe && (
          <ModalDetalhes
            usr={detalhe}
            vendedores={vendedores}
            onFechar={() => setDetalhe(null)}
            onResetSenha={() => resetarSenha(detalhe)}
            resetando={resetando}
          />
        )}

        {/* ── Toast ── */}
        {toast && (
          <div className={`usr-toast ${toast.tipo}`}>
            {toast.tipo === "sucesso" ? "✓" : "⚠️"} {toast.msg}
          </div>
        )}

      </div>
    </>
  );
}

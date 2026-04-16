/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Configuracoes.jsx
   Estrutura: users/{uid}/config (doc único)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import {
  Building2, Lock, CreditCard, LayoutDashboard, Package,
  Upload, Eye, EyeOff, Check, AlertCircle, X, Save,
  ChevronRight, Camera, Shield, Sliders,
} from "lucide-react";

import { db, auth, onAuthStateChanged } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";



/* ── Validadores CPF / CNPJ ── */
const validarCPF = (cpf) => {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let resto = soma % 11;
  const digito1 = resto < 2 ? 0 : 11 - resto;
  if (digito1 !== parseInt(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  resto = soma % 11;
  const digito2 = resto < 2 ? 0 : 11 - resto;
  return digito2 === parseInt(cpf[10]);
};

const validarCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho++;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return resultado === parseInt(digitos.charAt(1));
};


/* ── CSS ── */
const CSS = `
  /* Shared */
  @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  @keyframes spin { to { transform: rotate(360deg) } }

  /* Layout */
  .cfg-root {
    display: flex; flex-direction: column;
    height: 100%; overflow: hidden;
  }

  .cfg-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  }
  .cfg-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .cfg-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .cfg-body {
    display: flex; flex: 1; overflow: hidden;
  }

  /* Sidebar nav */
  .cfg-nav {
    width: 220px; flex-shrink: 0;
    background: var(--s1); border-right: 1px solid var(--border);
    padding: 16px 10px; display: flex; flex-direction: column; gap: 2px;
    overflow-y: auto;
  }
  .cfg-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 9px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: var(--text-2); border: 1px solid transparent;
    transition: all .13s; background: transparent;
    text-align: left; width: 100%;
  }
  .cfg-nav-item:hover { background: var(--s2); color: var(--text); }
  .cfg-nav-item.active {
    background: var(--s2); color: var(--text);
    border-color: var(--border-h);
  }
  .cfg-nav-item.active .cfg-nav-icon { color: var(--gold); }
  .cfg-nav-label { flex: 1; }
  .cfg-nav-icon  { flex-shrink: 0; }
  .cfg-nav-divider {
    height: 1px; background: var(--border);
    margin: 10px 4px;
  }
  .cfg-nav-group-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3);
    padding: 0 12px; margin-bottom: 4px; margin-top: 8px;
  }

  /* Content panel */
  .cfg-panel {
    flex: 1; overflow-y: auto; padding: 24px;
    display: flex; flex-direction: column; gap: 20px;
    animation: fadeIn .18s ease;
  }
  .cfg-panel::-webkit-scrollbar { width: 3px; }
  .cfg-panel::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  /* Cards */
  .cfg-card {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 14px; overflow: hidden;
    animation: slideUp .18s ease;
  }
  .cfg-card-header {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }
  .cfg-card-header-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--s3); border: 1px solid var(--border-h);
    display: flex; align-items: center; justify-content: center;
    color: var(--gold);
  }
  .cfg-card-title {
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600;
    color: var(--text);
  }
  .cfg-card-sub { font-size: 11px; color: var(--text-2); margin-top: 1px; }
  .cfg-card-body { padding: 20px; }
  .cfg-card-footer {
    padding: 13px 20px; border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px;
    background: var(--s2);
  }

  /* Form */
  .form-group  { margin-bottom: 16px; }
  .form-group:last-child { margin-bottom: 0; }
  .form-label {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 7px;
  }
  .form-label-req { color: var(--gold); margin-left: 2px; }
  .form-input {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s, box-shadow .15s;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  .input-pass-wrap {
    position: relative;
  }
  .input-pass-wrap .form-input { padding-right: 40px; }
  .input-pass-toggle {
    position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    color: var(--text-3); padding: 0; line-height: 1;
    display: flex; align-items: center;
    transition: color .13s;
  }
  .input-pass-toggle:hover { color: var(--text-2); }

  /* Buttons */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    display: flex; align-items: center; gap: 6px;
    transition: opacity .13s, transform .1s;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  /* Toast */
  .cfg-toast {
    position: fixed; bottom: 24px; right: 24px;
    padding: 11px 16px; border-radius: 10px;
    display: flex; align-items: center; gap: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    z-index: 9999; animation: slideUp .18s ease;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .cfg-toast.success {
    background: rgba(72,187,120,0.12);
    border: 1px solid rgba(72,187,120,0.3);
    color: #48bb78;
  }
  .cfg-toast.error {
    background: rgba(224,82,82,0.12);
    border: 1px solid rgba(224,82,82,0.3);
    color: var(--red);
  }

  /* Logo upload */
  .logo-upload-area {
    border: 1.5px dashed var(--border-h);
    border-radius: 12px; padding: 24px 16px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 10px; cursor: pointer;
    transition: border-color .15s, background .15s;
    background: var(--s2);
  }
  .logo-upload-area:hover {
    border-color: var(--gold);
    background: rgba(200,165,94,0.04);
  }
  .logo-upload-area.has-logo { padding: 12px; }
  .logo-preview {
    max-height: 80px; max-width: 200px;
    object-fit: contain; border-radius: 6px;
  }
  .logo-upload-hint {
    font-size: 11px; color: var(--text-3); text-align: center; line-height: 1.5;
  }
  .logo-upload-btn-row {
    display: flex; gap: 8px; margin-top: 6px;
  }
  .btn-logo-remove {
    padding: 5px 12px; border-radius: 7px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-size: 11px; font-family: 'DM Sans', sans-serif;
    transition: background .13s;
  }
  .btn-logo-remove:hover { background: rgba(224,82,82,.18); }

  /* Taxa de cartão */
  .taxa-table {
    width: 100%; border-collapse: collapse;
  }
  .taxa-table thead tr {
    background: var(--s2);
  }
  .taxa-table th {
    font-size: 10px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
    padding: 10px 14px; text-align: left;
    border-bottom: 1px solid var(--border);
  }
  .taxa-table td {
    padding: 10px 14px; border-bottom: 1px solid var(--border);
    font-size: 13px; color: var(--text-2);
    vertical-align: middle;
  }
  .taxa-table tr:last-child td { border-bottom: none; }
  .taxa-table tr:hover td { background: rgba(255,255,255,0.01); }
  .taxa-bandeira {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    color: var(--text);
  }
  .taxa-tipo-badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 20px;
    font-size: 10px; font-weight: 600;
    background: var(--s3); color: var(--text-3);
    border: 1px solid var(--border);
  }
  .taxa-input {
    width: 90px; background: var(--s2);
    border: 1px solid var(--border); border-radius: 7px;
    padding: 6px 10px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif; outline: none;
    transition: border-color .15s, box-shadow .15s;
    text-align: right;
  }
  .taxa-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .taxa-pct { font-size: 12px; color: var(--text-3); margin-left: 5px; }

  /* Toggle switches */
  .menu-toggle-list {
    display: flex; flex-direction: column; gap: 2px;
  }
  .menu-toggle-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--s2); margin-bottom: 6px;
    transition: border-color .13s;
  }
  .menu-toggle-item:hover { border-color: var(--border-h); }
  .menu-toggle-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--s3); border: 1px solid var(--border-h);
    display: flex; align-items: center; justify-content: center;
    color: var(--text-2); flex-shrink: 0;
  }
  .menu-toggle-label {
    flex: 1; font-size: 13px; color: var(--text);
    font-family: 'DM Sans', sans-serif;
  }
  .menu-toggle-sub {
    font-size: 11px; color: var(--text-3); margin-top: 1px;
  }
  .menu-toggle-locked {
    font-size: 10px; color: var(--text-3);
    background: var(--s3); border: 1px solid var(--border);
    border-radius: 20px; padding: 2px 8px;
  }

  /* Toggle switch UI */
  .toggle-switch {
    position: relative; width: 38px; height: 22px;
    flex-shrink: 0;
  }
  .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .toggle-track {
    position: absolute; inset: 0; border-radius: 22px;
    background: var(--s3); border: 1px solid var(--border);
    cursor: pointer; transition: background .2s, border-color .2s;
  }
  .toggle-switch input:checked + .toggle-track {
    background: rgba(200,165,94,0.25); border-color: var(--gold);
  }
  .toggle-track::after {
    content: ''; position: absolute;
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--text-3); top: 2px; left: 2px;
    transition: transform .2s, background .2s;
  }
  .toggle-switch input:checked + .toggle-track::after {
    transform: translateX(16px); background: var(--gold);
  }

  /* Estoque mínimo */
  .estoque-hint {
    font-size: 12px; color: var(--text-3);
    background: var(--s3); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 14px; margin-top: 12px;
    line-height: 1.6;
  }
  .estoque-hint strong { color: var(--text-2); }

  /* Spinner */
  .cfg-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.15);
    border-top-color: #0a0808;
    animation: spin .6s linear infinite; flex-shrink: 0;
  }

  /* Alert box */
  .cfg-alert {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px; border-radius: 9px;
    font-size: 12px; line-height: 1.6;
    margin-bottom: 16px;
  }
  .cfg-alert.warn {
    background: rgba(200,165,94,0.08);
    border: 1px solid rgba(200,165,94,0.25);
    color: var(--gold);
  }
  .cfg-alert.info {
    background: rgba(91,142,240,0.08);
    border: 1px solid rgba(91,142,240,0.2);
    color: var(--blue);
  }

  /* Loading */
  .cfg-loading {
    padding: 56px 20px; text-align: center;
    color: var(--text-3); font-size: 13px;
  }
`;

/* ── Seções do menu lateral do sistema ── */
const MENU_SECTIONS = [
  { key: "dashboard",  label: "Dashboard",     sub: "Visão geral e KPIs",     icon: "📊", locked: true  },
  { key: "clientes",   label: "Clientes",      sub: "Cadastro e histórico",   icon: "👥", locked: false },
  { key: "vendas",     label: "Vendas",        sub: "PDV e registro de vendas",icon: "🛒", locked: false },
  { key: "estoque",    label: "Estoque",       sub: "Controle de produtos",   icon: "📦", locked: false },
  { key: "crm",        label: "CRM Retenção",  sub: "Relacionamento com clientes", icon: "🎯", locked: false },
  { key: "relatorios", label: "Relatórios",    sub: "Análises e exportações", icon: "📈", locked: false },
  { key: "agenda",     label: "Agenda",        sub: "Compromissos e tarefas", icon: "📅", locked: false },
  { key: "catalogo",   label: "Catálogo",      sub: "Produtos e preços",      icon: "🏷️", locked: false },
  { key: "config",     label: "Configurações", sub: "Esta tela",              icon: "⚙️", locked: true  },
];

/* ── Taxas de cartão default ── */
const TAXAS_DEFAULT = {
  debito:      "1.99",
  credito_1x:  "2.99",
  credito_2_6: "3.49",
  credito_7_12:"3.99",
  pix:         "0.00",
};

const TAXAS_LABELS = [
  { key: "debito",       label: "Débito",            tipo: "Débito" },
  { key: "credito_1x",   label: "Crédito à Vista",   tipo: "Crédito 1x" },
  { key: "credito_2_6",  label: "Crédito 2–6x",      tipo: "Parcelado" },
  { key: "credito_7_12", label: "Crédito 7–12x",     tipo: "Parcelado" },
  { key: "pix",          label: "PIX",               tipo: "PIX" },
];

/* ── Nav items ── */
const NAV = [
  { id: "empresa",    label: "Empresa",          icon: Building2 },
  { id: "seguranca",  label: "Segurança",         icon: Shield    },
  { id: "financeiro", label: "Financeiro",        icon: CreditCard },
  { id: "menu",       label: "Menu do Sistema",  icon: LayoutDashboard },
  { id: "estoque",    label: "Estoque",           icon: Package   },
];

/* ── Toast ── */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`cfg-toast ${type}`}>
      {type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
      {msg}
    </div>
  );
}

/* ── Toggle switch ── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="toggle-switch" onClick={e => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" />
    </label>
  );
}

/* ── Password input ── */
function PassInput({ value, onChange, placeholder, className }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-pass-wrap">
      <input
        type={show ? "text" : "password"}
        className={`form-input ${className || ""}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button className="input-pass-toggle" onClick={() => setShow(s => !s)} type="button">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO: Empresa
   ══════════════════════════════════════════════════════ */
function SecaoEmpresa({ config, onSave }) {
  const [form, setForm] = useState({
    nomeEmpresa: config?.empresa?.nomeEmpresa || config?.nomeEmpresa || "",
    cnpj:        config?.empresa?.cnpj        || config?.cnpj        || "",
    telefone:    config?.empresa?.telefone    || config?.telefone    || "",
    endereco:    config?.empresa?.endereco    || config?.endereco    || "",
    logo:        config?.empresa?.logo        || config?.logo        || "",
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (erros[k]) setErros(e => ({ ...e, [k]: "" }));
  };

  const validarEmpresa = () => {
    const e = {};
    if (form.cnpj?.trim()) {
      const clean = form.cnpj.replace(/\D/g, "");
      if (clean.length === 11) {
        if (!validarCPF(clean)) e.cnpj = "CPF inválido. Verifique os dígitos.";
      } else if (clean.length === 14) {
        if (!validarCNPJ(clean)) e.cnpj = "CNPJ inválido. Verifique os dígitos.";
      } else {
        e.cnpj = "CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.";
      }
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) {
      alert("Imagem muito grande. Use uma logo com menos de 300KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => set("logo", ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSalvar = async () => {
    if (!validarEmpresa()) return;

    setSalvando(true);
    await onSave(form);           // ← AGORA SALVA FLAT (correto)
    setSalvando(false);
  };


  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Building2 size={15} /></div>
        <div>
          <div className="cfg-card-title">Dados da Empresa</div>
          <div className="cfg-card-sub">Informações exibidas em documentos e recibos</div>
        </div>
      </div>

      <div className="cfg-card-body">

        {/* Logo */}
        <div className="form-group">
          <label className="form-label">Logo da Empresa</label>
          <div
            className={`logo-upload-area ${form.logo ? "has-logo" : ""}`}
            onClick={() => !form.logo && fileRef.current?.click()}
          >
            {form.logo ? (
              <>
                <img src={form.logo} alt="Logo" className="logo-preview" />
                <div className="logo-upload-btn-row">
                  <button className="btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                    Trocar
                  </button>
                  <button className="btn-logo-remove"
                    onClick={e => { e.stopPropagation(); set("logo", ""); }}>
                    Remover
                  </button>
                </div>
              </>
            ) : (
              <>
                <Camera size={22} color="var(--text-3)" />
                <span className="logo-upload-hint">
                  Clique para enviar a logo<br />
                  PNG ou JPEG · Máx. 300KB
                </span>
              </>
            )}
          </div>
          <input
            ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }} onChange={handleLogo}
          />
        </div>

        {/* Nome + CNPJ */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nome da Empresa</label>
            <input className="form-input" value={form.nomeEmpresa}
              onChange={e => set("nomeEmpresa", e.target.value)}
              placeholder="Nome ou razão social" />
          </div>
          <div className="form-group">
            <label className="form-label">CNPJ / CPF</label>
            <input className="form-input" value={form.cnpj}
              onChange={e => set("cnpj", e.target.value)}
              placeholder="00.000.000/0001-00" />
          </div>
        </div>

        {/* Telefone + Endereço */}
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Telefone</label>
            <input className="form-input" value={form.telefone}
              onChange={e => set("telefone", e.target.value)}
              placeholder="(62) 99999-9999" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Endereço</label>
            <input className="form-input" value={form.endereco}
              onChange={e => set("endereco", e.target.value)}
              placeholder="Rua, número, bairro, cidade" />
          </div>
        </div>

      </div>

      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Empresa</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO: Segurança
   ══════════════════════════════════════════════════════ */
function SecaoSeguranca() {
  const [form, setForm] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando]  = useState(false);
  const [sucesso, setSucesso]    = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (erros[k]) setErros(e => ({ ...e, [k]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.senhaAtual)       e.senhaAtual = "Informe a senha atual.";
    if (form.novaSenha.length < 6) e.novaSenha = "Mínimo 6 caracteres.";
    if (form.novaSenha !== form.confirmar) e.confirmar = "As senhas não conferem.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    setSucesso(false);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, form.senhaAtual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, form.novaSenha);
      setForm({ senhaAtual: "", novaSenha: "", confirmar: "" });
      setSucesso(true);
      setTimeout(() => setSucesso(false), 4000);
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErros({ senhaAtual: "Senha atual incorreta." });
      } else {
        setErros({ senhaAtual: `Erro: ${err.message}` });
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Lock size={15} /></div>
        <div>
          <div className="cfg-card-title">Trocar Senha</div>
          <div className="cfg-card-sub">Autenticação via Firebase — confirme a senha atual</div>
        </div>
      </div>

      <div className="cfg-card-body">

        {sucesso && (
          <div className="cfg-alert info" style={{ background: "rgba(72,187,120,0.08)", borderColor: "rgba(72,187,120,0.3)", color: "#48bb78" }}>
            <Check size={14} style={{ flexShrink: 0 }} />
            Senha alterada com sucesso!
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Senha Atual <span className="form-label-req">*</span></label>
          <PassInput
            value={form.senhaAtual}
            onChange={e => set("senhaAtual", e.target.value)}
            placeholder="Digite sua senha atual"
            className={erros.senhaAtual ? "err" : ""}
          />
          {erros.senhaAtual && <div className="form-error">{erros.senhaAtual}</div>}
        </div>

        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nova Senha <span className="form-label-req">*</span></label>
            <PassInput
              value={form.novaSenha}
              onChange={e => set("novaSenha", e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={erros.novaSenha ? "err" : ""}
            />
            {erros.novaSenha && <div className="form-error">{erros.novaSenha}</div>}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Confirmar Nova Senha <span className="form-label-req">*</span></label>
            <PassInput
              value={form.confirmar}
              onChange={e => set("confirmar", e.target.value)}
              placeholder="Repita a nova senha"
              className={erros.confirmar ? "err" : ""}
            />
            {erros.confirmar && <div className="form-error">{erros.confirmar}</div>}
          </div>
        </div>

      </div>

      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Alterando...</> : <><Lock size={13} />Alterar Senha</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO: Financeiro — Taxa de Cartão
   ══════════════════════════════════════════════════════ */
function SecaoFinanceiro({ config, onSave }) {
  const [taxas, setTaxas] = useState({ ...TAXAS_DEFAULT, ...(config?.taxas || {}) });
  const [salvando, setSalvando] = useState(false);

  const setTaxa = (k, v) => {
    const numeric = v.replace(/[^0-9.,]/g, "").replace(",", ".");
    setTaxas(t => ({ ...t, [k]: numeric }));
  };

  const handleSalvar = async () => {
    setSalvando(true);
    await onSave({ taxas });
    setSalvando(false);
  };

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><CreditCard size={15} /></div>
        <div>
          <div className="cfg-card-title">Taxa de Máquina de Cartão</div>
          <div className="cfg-card-sub">Usada para calcular lucro líquido nas vendas</div>
        </div>
      </div>

      <div className="cfg-card-body" style={{ padding: 0 }}>
        <table className="taxa-table">
          <thead>
            <tr>
              <th>Modalidade</th>
              <th>Tipo</th>
              <th style={{ textAlign: "right" }}>Taxa (%)</th>
            </tr>
          </thead>
          <tbody>
            {TAXAS_LABELS.map(({ key, label, tipo }) => (
              <tr key={key}>
                <td><span className="taxa-bandeira">{label}</span></td>
                <td><span className="taxa-tipo-badge">{tipo}</span></td>
                <td style={{ textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    <input
                      className="taxa-input"
                      value={taxas[key]}
                      onChange={e => setTaxa(key, e.target.value)}
                      inputMode="decimal"
                    />
                    <span className="taxa-pct">%</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Taxas</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO: Visibilidade do Menu
   ══════════════════════════════════════════════════════ */
function SecaoMenu({ config, onSave }) {
  const initVisible = () => {
    const base = {};
    MENU_SECTIONS.forEach(s => {
      base[s.key] = config?.menuVisivel?.[s.key] !== undefined
        ? config.menuVisivel[s.key]
        : true;
    });
    return base;
  };

  const [visivel, setVisivel]   = useState(initVisible);
  const [salvando, setSalvando] = useState(false);

  const toggle = (key, val) => setVisivel(v => ({ ...v, [key]: val }));

  const handleSalvar = async () => {
    setSalvando(true);
    await onSave({ menuVisivel: visivel });
    setSalvando(false);
  };

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><LayoutDashboard size={15} /></div>
        <div>
          <div className="cfg-card-title">Visibilidade do Menu</div>
          <div className="cfg-card-sub">Oculte seções que não utiliza para manter o foco</div>
        </div>
      </div>

      <div className="cfg-card-body">
        <div className="menu-toggle-list">
          {MENU_SECTIONS.map(s => (
            <div key={s.key} className="menu-toggle-item">
              <div className="menu-toggle-icon">{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="menu-toggle-label">{s.label}</div>
                <div className="menu-toggle-sub">{s.sub}</div>
              </div>
              {s.locked ? (
                <span className="menu-toggle-locked">Sempre visível</span>
              ) : (
                <Toggle
                  checked={!!visivel[s.key]}
                  onChange={val => toggle(s.key, val)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Menu</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEÇÃO: Estoque Mínimo
   ══════════════════════════════════════════════════════ */
function SecaoEstoque({ config, onSave }) {
  const [minimo, setMinimo]     = useState(config?.estoqueMinimo ?? 5);
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    await onSave({ estoqueMinimo: Number(minimo) });
    setSalvando(false);
  };

  return (
    <div className="cfg-card">
      <div className="cfg-card-header">
        <div className="cfg-card-header-icon"><Package size={15} /></div>
        <div>
          <div className="cfg-card-title">Estoque Mínimo Padrão</div>
          <div className="cfg-card-sub">Alertas quando o produto atingir este limite</div>
        </div>
      </div>

      <div className="cfg-card-body">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            Quantidade mínima padrão
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number" min="0" max="9999"
              className="form-input"
              style={{ maxWidth: 160 }}
              value={minimo}
              onChange={e => setMinimo(e.target.value)}
            />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>unidades</span>
          </div>
        </div>

        <div className="estoque-hint">
          <strong>Como funciona:</strong> Quando um produto atingir ou ficar abaixo de{" "}
          <strong>{minimo || 0} unidade{Number(minimo) !== 1 ? "s" : ""}</strong>, ele será
          marcado como crítico no módulo de Estoque. Você pode sobrescrever esse valor
          individualmente em cada produto.
        </div>
      </div>

      <div className="cfg-card-footer">
        <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? <><span className="cfg-spinner" />Salvando...</> : <><Save size={13} />Salvar Estoque</>}
        </button>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function Configuracoes() {
  const [uid, setUid]           = useState(null);
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [secao, setSecao]       = useState("empresa");
  const [toast, setToast]       = useState(null);  // { msg, type }

  /* Auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUid(user?.uid || null));
    return unsub;
  }, []);

  /* Carregar config */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const ref = doc(db, "users", uid, "config", "geral");
    getDoc(ref).then(snap => {
      setConfig(snap.exists() ? snap.data() : {});
      setLoading(false);
    }).catch(() => {
      setConfig({});
      setLoading(false);
    });
  }, [uid]);

  /* Salvar partial config */
  const handleSave = async (partial) => {
    if (!uid) return;
    try {
      const ref = doc(db, "users", uid, "config", "geral");
      await setDoc(ref, partial, { merge: true });
      setConfig(prev => ({ ...prev, ...partial }));
      showToast("Configurações salvas com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar. Tente novamente.", "error");
    }
  };

  const showToast = (msg, type) => {
    setToast({ msg, type });
  };

  const renderSecao = () => {
    if (loading) return <div className="cfg-loading">Carregando configurações...</div>;
    switch (secao) {
      case "empresa":    return <SecaoEmpresa    config={config} onSave={handleSave} />;
      case "seguranca":  return <SecaoSeguranca />;
      case "financeiro": return <SecaoFinanceiro config={config} onSave={handleSave} />;
      case "menu":       return <SecaoMenu       config={config} onSave={handleSave} />;
      case "estoque":    return <SecaoEstoque    config={config} onSave={handleSave} />;
      default:           return null;
    }
  };

  return (
    <>
      <style>{CSS}</style>

      <div className="cfg-root">

        {/* Topbar */}
        <header className="cfg-topbar">
          <div className="cfg-topbar-title">
            <h1>Configurações</h1>
            <p>Personalize o comportamento e os dados do sistema</p>
          </div>
        </header>

        <div className="cfg-body">

          {/* Nav lateral */}
          <nav className="cfg-nav">
            <span className="cfg-nav-group-label">Configurações</span>
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`cfg-nav-item ${secao === id ? "active" : ""}`}
                onClick={() => setSecao(id)}
              >
                <Icon size={15} className="cfg-nav-icon" />
                <span className="cfg-nav-label">{label}</span>
                {secao === id && <ChevronRight size={13} color="var(--text-3)" />}
              </button>
            ))}
          </nav>

          {/* Painel de conteúdo */}
          <main className="cfg-panel" key={secao}>
            {renderSecao()}
          </main>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════
   HOOK EXPORTÁVEL: useConfiguracoes
   Uso: const { config, loading } = useConfiguracoes(uid)
   Para outros módulos acessarem taxas, estoque mínimo etc.
   ══════════════════════════════════════════════════════ */
export function useConfiguracoes(uid) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const ref = doc(db, "users", uid, "config", "geral");
    getDoc(ref).then(snap => {
      setConfig(snap.exists() ? snap.data() : {});
      setLoading(false);
    }).catch(() => {
      setConfig({});
      setLoading(false);
    });
  }, [uid]);

  return {
    config,
    loading,
    taxas:          config?.taxas         || TAXAS_DEFAULT,
    estoqueMinimo:  config?.estoqueMinimo ?? 5,
    menuVisivel:    config?.menuVisivel   || {},
    empresa: config?.empresa || {                     // ← compatibilidade com dados antigos/novos
      nomeEmpresa: config?.nomeEmpresa || "",
      cnpj:        config?.cnpj        || "",
      telefone:    config?.telefone    || "",
      endereco:    config?.endereco    || "",
      logo:        config?.logo        || "",
    },
  };
}

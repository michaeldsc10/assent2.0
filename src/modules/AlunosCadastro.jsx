/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — AlunosCadastro.jsx
   Módulo "Alunos" — cadastro pessoal, separado de Clientes.
   Estrutura: users/{uid}/clientes/{docId}  (perfis: ["aluno"])
   Matrícula (mensalidade/turma) é feita em Alunos.jsx (menu "Matrículas"),
   que consome os alunos cadastrados aqui.
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, UserPlus, Edit2, Trash2, X, Users, Camera,
  User, AtSign, CheckCircle,
} from "lucide-react";

import { db } from "../lib/firebase";
import { fsError, fsSnapshotError } from "../utils/firestoreError";
import { logAction, LOG_ACAO, LOG_MODULO, montarDescricao } from "../lib/logAction";
import { useAuth } from "../contexts/AuthContext";
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDoc,
} from "firebase/firestore";

/* ══════════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════════ */
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

const fmtTelefone = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const fmtCPF = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9)  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

/* Gerador de docId único para alunos na coleção /clientes (compartilhada com Matrículas) */
const gerarDocIdAluno = () =>
  `aluno_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/* Próximo idSeq visual — puramente display, mesma numeração usada em Matrículas */
const proximoIdSeq = (alunos) => {
  const max = alunos.reduce((m, a) => Math.max(m, Number(a.idSeq || 0)), 0);
  return max + 1;
};
const fmtIdSeq = (n) => `A${String(n).padStart(4, "0")}`;

/* Idade calculada a partir da data de nascimento (YYYY-MM-DD) */
const calcularIdade = (dataNasc) => {
  if (!dataNasc) return null;
  const nasc = new Date(dataNasc + "T00:00:00");
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? idade : null;
};

const fmtDataHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/* Um aluno tem matrícula ativa quando gerado pelo módulo Matrículas */
const isMatriculado = (a) => a?.matriculaAtiva === true || Number(a?.valorMensalidade || 0) > 0;

/* ══════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════ */
const CSS = `
.modal-overlay { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.78);
  backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center;
  padding:20px; animation:fadeIn .15s ease; }
.modal-overlay-top { z-index:1100; }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.modal-box { background:var(--s1); border:1px solid var(--border-h); border-radius:16px;
  width:100%; max-width:520px; max-height:92vh; overflow-y:auto;
  box-shadow:0 28px 72px rgba(0,0,0,.65); animation:slideUp .18s ease; }
.modal-box-lg { max-width:680px; }
.modal-box-md { max-width:420px; }
.modal-box::-webkit-scrollbar { width:3px; }
.modal-box::-webkit-scrollbar-thumb { background:var(--text-3); border-radius:2px; }
.modal-header { padding:20px 22px 16px; border-bottom:1px solid var(--border);
  display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
  position:sticky; top:0; background:var(--s1); z-index:2; }
.modal-title { font-family:'Sora',sans-serif; font-size:16px; font-weight:600; color:var(--text); }
.modal-sub { font-size:12px; color:var(--text-2); margin-top:3px; }
.modal-close { width:30px; height:30px; border-radius:8px; flex-shrink:0;
  background:var(--s3); border:1px solid var(--border);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  margin-top:2px; transition:background .13s; }
.modal-close:hover { background:var(--s2); border-color:var(--border-h); }
.modal-body { padding:20px 22px; }
.modal-footer { padding:14px 22px; border-top:1px solid var(--border);
  display:flex; justify-content:flex-end; gap:10px;
  position:sticky; bottom:0; background:var(--s1); z-index:2; }

.btn-primary { padding:9px 20px; border-radius:9px; background:var(--gold); color:#0a0808;
  border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
  transition:opacity .13s, transform .1s; display:flex; align-items:center; gap:6px; }
.btn-primary:hover { opacity:.88; }
.btn-primary:active { transform:scale(.97); }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-secondary { padding:9px 20px; border-radius:9px; background:var(--s3); color:var(--text-2);
  border:1px solid var(--border); cursor:pointer; font-family:'DM Sans',sans-serif; font-size:13px;
  transition:background .13s, color .13s; display:flex; align-items:center; gap:6px; }
.btn-secondary:hover { background:var(--s2); color:var(--text); }
.btn-danger { padding:9px 20px; border-radius:9px; background:var(--red-d); color:var(--red);
  border:1px solid rgba(224,82,82,.25); cursor:pointer;
  font-family:'DM Sans',sans-serif; font-size:13px; transition:background .13s;
  display:flex; align-items:center; gap:6px; }
.btn-danger:hover { background:rgba(224,82,82,.18); }
.btn-icon { width:30px; height:30px; border-radius:7px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; border:1px solid transparent;
  background:transparent; transition:all .13s; }
.btn-icon-edit { color:var(--blue); }
.btn-icon-edit:hover { background:var(--blue-d); border-color:rgba(91,142,240,.2); }
.btn-icon-del { color:var(--red); }
.btn-icon-del:hover { background:var(--red-d); border-color:rgba(224,82,82,.2); }
.btn-icon-view { color:var(--text-2); }
.btn-icon-view:hover { background:var(--s3); border-color:var(--border-h); }

.form-group { margin-bottom:16px; }
.form-label { display:block; font-size:10px; font-weight:600;
  letter-spacing:.07em; text-transform:uppercase;
  color:var(--text-2); margin-bottom:7px; }
.form-label-req { color:var(--gold); margin-left:2px; }
.form-input, .form-textarea { width:100%; background:var(--s2);
  border:1px solid var(--border); border-radius:9px;
  padding:10px 13px; color:var(--text); font-size:13px;
  font-family:'DM Sans',sans-serif; outline:none;
  transition:border-color .15s, box-shadow .15s; box-sizing:border-box; }
.form-input:focus, .form-textarea:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(200,165,94,.1); }
.form-input.err { border-color:var(--red); }
.form-error { font-size:11px; color:var(--red); margin-top:5px; }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }

.al-section-title { font-family:'Sora',sans-serif; font-size:13px; font-weight:600;
  color:var(--text); margin:4px 0 12px; display:flex; align-items:center; gap:7px; }

.foto-picker-wrap { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.foto-picker-circle { width:80px; height:80px; border-radius:50%; position:relative;
  cursor:pointer; flex-shrink:0; overflow:hidden;
  border:2px dashed var(--border); background:var(--s2);
  display:flex; align-items:center; justify-content:center;
  transition:border-color .15s; }
.foto-picker-circle:hover { border-color:var(--gold); }
.foto-picker-circle img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.foto-picker-overlay { position:absolute; inset:0; border-radius:50%;
  background:rgba(0,0,0,.55); display:flex; align-items:center;
  justify-content:center; opacity:0; transition:opacity .15s; }
.foto-picker-circle:hover .foto-picker-overlay { opacity:1; }
.foto-picker-info { font-size:12px; color:var(--text-2); line-height:1.6; }
.foto-picker-info strong { color:var(--text); display:block; margin-bottom:2px; }

.foto-lightbox { position:fixed; inset:0; z-index:1300; background:rgba(0,0,0,.92);
  backdrop-filter:blur(8px); display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:20px; animation:fadeIn .15s ease; }
.foto-lightbox-img { max-width:min(480px,90vw); max-height:60vh; border-radius:50%;
  object-fit:cover; border:3px solid var(--gold);
  box-shadow:0 0 80px rgba(212,175,55,.25); }
.foto-lightbox-actions { display:flex; gap:10px; }

.al-root { display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden; flex:1 1 auto; }
.al-topbar { padding:14px 22px; background:var(--s1); border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; gap:14px; flex-shrink:0; flex-wrap:wrap; }
.al-topbar h1 { font-family:'Sora',sans-serif; font-size:17px; font-weight:600; color:var(--text); }
.al-topbar p { font-size:11px; color:var(--text-2); margin-top:2px; }
.al-search { display:flex; align-items:center; gap:8px; background:var(--s2);
  border:1px solid var(--border); border-radius:9px; padding:8px 13px; min-width:260px; flex:1; max-width:380px; }
.al-search input { border:none; background:transparent; outline:none; color:var(--text);
  font-size:13px; font-family:'DM Sans',sans-serif; width:100%; }

.al-content { flex:1; min-height:0; overflow-y:auto; padding:18px 22px; }
.al-table-wrap { background:var(--s1); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
.al-table-header { padding:14px 18px; border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between; }
.al-table-title { display:flex; align-items:center; gap:8px; font-family:'Sora',sans-serif;
  font-size:14px; font-weight:600; color:var(--text); }
.al-count-badge { font-size:10px; background:var(--s3); color:var(--text-3);
  padding:2px 8px; border-radius:20px; font-weight:600; }
.al-row, .al-row-head { display:grid; grid-template-columns: 72px 1.4fr 130px 150px 110px 100px;
  gap:10px; padding:12px 18px; border-bottom:1px solid var(--border); align-items:center; }
.al-row-head { font-size:10px; font-weight:600; letter-spacing:.07em;
  text-transform:uppercase; color:var(--text-3); background:var(--s2); }
.al-row { font-size:13px; transition:background .13s; }
.al-row:hover { background:var(--s2); }
.al-row:last-child { border-bottom:none; }
.al-id { font-family:'JetBrains Mono','Courier New',monospace; color:var(--text-3); font-size:12px; }
.al-nome { color:var(--text); font-weight:500; }
.al-actions { display:flex; justify-content:flex-end; gap:4px; }
.al-empty { padding:42px 18px; text-align:center; color:var(--text-3); font-size:13px; }
.al-loading { padding:42px 18px; text-align:center; color:var(--text-3); font-size:13px; }

.al-avatar { width:34px; height:34px; border-radius:50%; object-fit:cover;
  border:1.5px solid var(--border-h); flex-shrink:0; }
.al-avatar-placeholder { width:34px; height:34px; border-radius:50%;
  background:var(--s3); border:1.5px solid var(--border);
  display:flex; align-items:center; justify-content:center;
  font-family:'Sora',sans-serif; font-size:12px; font-weight:600;
  color:var(--text-2); flex-shrink:0; }

.al-pill { display:inline-flex; align-items:center; gap:5px;
  padding:3px 9px; border-radius:20px; font-size:11px; font-weight:600; white-space:nowrap; }
.al-pill.ok { background:rgba(74,222,128,.12); color:var(--green); border:1px solid rgba(74,222,128,.2); }
.al-pill.neutral { background:var(--s3); color:var(--text-3); border:1px solid var(--border); }

@media (max-width: 900px) {
  .form-row { grid-template-columns: 1fr; }
  .al-row, .al-row-head { grid-template-columns: 60px 1fr 100px; }
  .al-row > span:nth-child(4), .al-row > span:nth-child(5),
  .al-row-head > span:nth-child(4), .al-row-head > span:nth-child(5) { display:none; }
}
`;

/* ══════════════════════════════════════════════════
   LIGHTBOX: Visualizador de foto
   ══════════════════════════════════════════════════ */
function FotoLightbox({ src, onAlterar, onRemover, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="foto-lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <img src={src} alt="Foto do aluno" className="foto-lightbox-img" />
      <div className="foto-lightbox-actions">
        <button className="btn-secondary" onClick={onClose}><X size={14} /> Fechar</button>
        <button className="btn-secondary" onClick={onAlterar}><Camera size={14} /> Alterar foto</button>
        <button className="btn-danger" onClick={onRemover}><Trash2 size={14} /> Remover</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Cadastro / edição de aluno (dados pessoais)
   ══════════════════════════════════════════════════ */
function ModalAlunoCadastro({ aluno, alunosExistentes, tenantUid, onSave, onClose }) {
  const isEdit = !!aluno;

  const [form, setForm] = useState({
    nome:                  aluno?.nome                  || "",
    documento:             aluno?.documento             || "",
    rg:                    aluno?.rg                    || "",
    telefone:              aluno?.telefone              || "",
    email:                 aluno?.email                 || "",
    instagram:             aluno?.instagram             || "",
    dataNascimento:        aluno?.dataNascimento        || "",
    turma:                 aluno?.turma                 || "",
    endereco:              aluno?.endereco              || "",
    responsavel:           aluno?.responsavel           || "",
    telefoneResponsavel:   aluno?.telefoneResponsavel   || "",
    cpfResponsavel:        aluno?.cpfResponsavel        || "",
    rgResponsavel:         aluno?.rgResponsavel         || "",
    emailResponsavel:      aluno?.emailResponsavel      || "",
    enderecoResponsavel:   aluno?.enderecoResponsavel   || "",
  });
  const [erros, setErros] = useState({});

  const idade = useMemo(() => calcularIdade(form.dataNascimento), [form.dataNascimento]);

  const [turmasDisponiveis, setTurmasDisponiveis] = useState([]);
  useEffect(() => {
    if (!tenantUid) return;
    getDoc(doc(db, "users", tenantUid, "config", "matriculas"))
      .then(s => setTurmasDisponiveis(Array.isArray(s.data()?.turmas) ? s.data().turmas : []))
      .catch(() => {});
  }, [tenantUid]);

  const [fotoBase64, setFotoBase64] = useState(aluno?.foto || null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Selecione uma imagem válida."); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Imagem muito grande. Máximo 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setFotoBase64(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (erros[k]) setErros(er => ({ ...er, [k]: null }));
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim() || form.nome.trim().length < 3)
      e.nome = "Nome completo é obrigatório (mínimo 3 caracteres).";
    const docDigits = onlyDigits(form.documento);
    if (!docDigits || docDigits.length < 5)
      e.documento = "Documento (CPF/RG) é obrigatório.";
    const telDigits = onlyDigits(form.telefone);
    if (!telDigits || telDigits.length < 10)
      e.telefone = "Telefone válido é obrigatório (com DDD).";

    const duplicado = alunosExistentes.find(a =>
      a.docId !== aluno?.docId && onlyDigits(a.documento) === docDigits
    );
    if (duplicado) e.documento = `Documento já cadastrado para ${duplicado.nome}.`;

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validar()) return;
    onSave({
      nome:                  form.nome.trim(),
      documento:             form.documento.trim(),
      rg:                    form.rg.trim(),
      telefone:              form.telefone.trim(),
      email:                 form.email.trim(),
      instagram:             form.instagram.trim().replace(/^@/, ""),
      dataNascimento:        form.dataNascimento,
      idade:                 idade,
      turma:                 form.turma,
      endereco:              form.endereco.trim(),
      responsavel:           form.responsavel.trim(),
      telefoneResponsavel:   form.telefoneResponsavel.trim(),
      cpfResponsavel:        form.cpfResponsavel.trim(),
      rgResponsavel:         form.rgResponsavel.trim(),
      emailResponsavel:      form.emailResponsavel.trim(),
      enderecoResponsavel:   form.enderecoResponsavel.trim(),
      foto:                  fotoBase64,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar aluno" : "Novo aluno"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando ${aluno.nome}` : "Cadastre os dados pessoais do aluno"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="foto-picker-wrap">
            <div className="foto-picker-circle"
              onClick={() => fotoBase64 ? setViewerOpen(true) : fileInputRef.current?.click()}
              title={fotoBase64 ? "Ver foto" : "Adicionar foto"}>
              {fotoBase64
                ? <img src={fotoBase64} alt="Foto do aluno" />
                : <Camera size={24} color="var(--text-3)" />}
              <div className="foto-picker-overlay">
                {fotoBase64 ? <Search size={16} color="#fff" /> : <Camera size={18} color="#fff" />}
              </div>
            </div>
            <div className="foto-picker-info">
              <strong>Foto do aluno</strong>
              {fotoBase64
                ? <>Clique na foto para visualizar.<br />Altere ou remova pelo visualizador.</>
                : <>Clique para selecionar uma imagem. Máx. 10 MB.</>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*"
              style={{ display: "none" }} onChange={handleFotoChange} />
          </div>

          {viewerOpen && fotoBase64 && (
            <FotoLightbox src={fotoBase64}
              onAlterar={() => { setViewerOpen(false); fileInputRef.current?.click(); }}
              onRemover={() => { setFotoBase64(null); setViewerOpen(false); }}
              onClose={() => setViewerOpen(false)} />
          )}

          <div className="al-section-title"><User size={14} /> Dados pessoais</div>

          <div className="form-group">
            <label className="form-label">Nome completo<span className="form-label-req">*</span></label>
            <input type="text" className={`form-input ${erros.nome ? "err" : ""}`}
              value={form.nome} onChange={(e) => set("nome", e.target.value)}
              placeholder="Nome completo do aluno" autoFocus />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Documento (CPF)<span className="form-label-req">*</span></label>
              <input type="text" className={`form-input ${erros.documento ? "err" : ""}`}
                value={form.documento}
                onChange={(e) => set("documento", fmtCPF(e.target.value))}
                placeholder="000.000.000-00" maxLength={14} />
              {erros.documento && <div className="form-error">{erros.documento}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">RG</label>
              <input type="text" className="form-input"
                value={form.rg} onChange={(e) => set("rg", e.target.value)}
                placeholder="Opcional" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data de nascimento</label>
              <input type="date" className="form-input"
                value={form.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Idade</label>
              <input type="text" className="form-input" disabled
                value={idade !== null ? `${idade} anos` : "—"} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Telefone<span className="form-label-req">*</span></label>
              <input type="text" className={`form-input ${erros.telefone ? "err" : ""}`}
                value={form.telefone}
                onChange={(e) => set("telefone", fmtTelefone(e.target.value))}
                placeholder="(62) 99999-9999" maxLength={15} />
              {erros.telefone && <div className="form-error">{erros.telefone}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input"
                value={form.email} onChange={(e) => set("email", e.target.value)}
                placeholder="email@exemplo.com" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label"><AtSign size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Instagram</label>
              <input type="text" className="form-input"
                value={form.instagram} onChange={(e) => set("instagram", e.target.value)}
                placeholder="@usuario (opcional)" />
            </div>
            <div className="form-group">
              <label className="form-label">Turma</label>
              <select className="form-input" value={form.turma}
                onChange={(e) => set("turma", e.target.value)}>
                <option value="">— Sem turma —</option>
                {turmasDisponiveis.map((t, i) => (
                  <option key={i} value={t.nome}>{t.nome}</option>
                ))}
                {form.turma && !turmasDisponiveis.some(t => t.nome === form.turma) && (
                  <option value={form.turma}>{form.turma}</option>
                )}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Endereço</label>
            <input type="text" className="form-input"
              value={form.endereco} onChange={(e) => set("endereco", e.target.value)}
              placeholder="Rua, número, bairro, cidade" />
          </div>

          {isEdit && (
            <div className="form-group">
              <label className="form-label">Data de cadastro</label>
              <input type="text" className="form-input" disabled value={fmtDataHora(aluno?.criadoEm)} />
            </div>
          )}

          <div className="al-section-title" style={{ marginTop: 8 }}>
            <User size={14} /> Responsável (opcional, caso menor de idade)
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome do responsável</label>
              <input type="text" className="form-input"
                value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone do responsável</label>
              <input type="text" className="form-input"
                value={form.telefoneResponsavel}
                onChange={(e) => set("telefoneResponsavel", fmtTelefone(e.target.value))}
                placeholder="(62) 99999-9999" maxLength={15} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">CPF do responsável</label>
              <input type="text" className="form-input"
                value={form.cpfResponsavel}
                onChange={(e) => set("cpfResponsavel", fmtCPF(e.target.value))}
                placeholder="000.000.000-00" maxLength={14} />
            </div>
            <div className="form-group">
              <label className="form-label">RG do responsável</label>
              <input type="text" className="form-input"
                value={form.rgResponsavel} onChange={(e) => set("rgResponsavel", e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email do responsável</label>
              <input type="email" className="form-input"
                value={form.emailResponsavel}
                onChange={(e) => set("emailResponsavel", e.target.value)}
                placeholder="email@exemplo.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Endereço do responsável</label>
              <input type="text" className="form-input"
                value={form.enderecoResponsavel}
                onChange={(e) => set("enderecoResponsavel", e.target.value)}
                placeholder="Rua, número, bairro, cidade" />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit}>
            <CheckCircle size={14} /> {isEdit ? "Salvar alterações" : "Cadastrar aluno"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Excluir aluno (só permitido sem matrícula ativa)
   ══════════════════════════════════════════════════ */
function ModalExcluirAluno({ aluno, onConfirm, onClose }) {
  const [digitado, setDigitado] = useState("");
  return (
    <div className="modal-overlay modal-overlay-top" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">Excluir aluno</div>
            <div className="modal-sub">Esta ação é permanente e não pode ser desfeita.</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
            Ao excluir <strong>{aluno.nome}</strong>, todos os dados pessoais cadastrados serão removidos.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>
            Digite <strong>EXCLUIR</strong> para confirmar:
          </p>
          <input type="text" className="form-input"
            value={digitado} onChange={(e) => setDigitado(e.target.value.toUpperCase())} />
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" disabled={digitado !== "EXCLUIR"} onClick={onConfirm}>
            <Trash2 size={14} /> Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════════════ */
export default function AlunosCadastro() {
  /* Permissão compartilhada com o módulo Clientes — ver observação no chat */
  const { tenantUid, nomeUsuario, cargo, podeCriar, podeEditar, podeExcluir } = useAuth();
  const podeCriarV   = podeCriar("clientes");
  const podeEditarV  = podeEditar("clientes");
  const podeExcluirV = podeExcluir("clientes");

  const [alunos, setAlunos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando]   = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [fotoVisualizando, setFotoVisualizando] = useState(null);

  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }
    const q = query(collection(db, "users", tenantUid, "clientes"), where("perfis", "array-contains", "aluno"));
    const unsub = onSnapshot(q, (snap) => {
      setAlunos(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
      setLoading(false);
    }, fsSnapshotError("AlunosCadastro:alunos"));
    return () => unsub();
  }, [tenantUid]);

  const handleAdd = async (dados) => {
    if (!tenantUid) return;
    try {
      const docId = gerarDocIdAluno();
      const idSeq = proximoIdSeq(alunos);
      const agora = new Date().toISOString();
      await setDoc(doc(db, "users", tenantUid, "clientes", docId), {
        docId, idSeq,
        idSeqFmt: fmtIdSeq(idSeq),
        perfis: ["aluno"],
        ...dados,
        criadoEm: agora,
        atualizadoEm: agora,
      });
      await logAction({
        tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.CLIENTES,
        descricao: montarDescricao("criar", "Aluno", dados.nome, docId),
      });
      setModalNovo(false);
    } catch (err) {
      fsError(err, "AlunosCadastro:criar");
      alert("Erro ao cadastrar aluno. Tente novamente.");
    }
  };

  const handleEdit = async (dados) => {
    if (!tenantUid || !editando) return;
    try {
      /* Não toca no campo "perfis" nem nos campos de matrícula — apenas dados pessoais */
      await updateDoc(doc(db, "users", tenantUid, "clientes", editando.docId), {
        ...dados,
        atualizadoEm: new Date().toISOString(),
      });
      await logAction({
        tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.CLIENTES,
        descricao: montarDescricao("editar", "Aluno", dados.nome, editando.docId),
      });
      setEditando(null);
    } catch (err) {
      fsError(err, "AlunosCadastro:editar");
      alert("Erro ao salvar alterações.");
    }
  };

  const handleDelete = async () => {
    if (!tenantUid || !excluindo) return;
    if (isMatriculado(excluindo)) {
      alert("Este aluno tem uma matrícula ativa. Cancele a matrícula no módulo Matrículas antes de excluir o cadastro.");
      setExcluindo(null);
      return;
    }
    try {
      await deleteDoc(doc(db, "users", tenantUid, "clientes", excluindo.docId));
      await logAction({
        tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.CLIENTES,
        descricao: montarDescricao("excluir", "Aluno", excluindo.nome, excluindo.docId),
      });
      setExcluindo(null);
    } catch (err) {
      fsError(err, "AlunosCadastro:excluir");
      alert("Erro ao excluir aluno.");
    }
  };

  const alunosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alunos.filter(a => {
      if (!q) return true;
      return (
        a.nome?.toLowerCase().includes(q) ||
        onlyDigits(a.documento).includes(onlyDigits(q)) ||
        fmtIdSeq(a.idSeq).toLowerCase().includes(q)
      );
    }).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" }));
  }, [alunos, search]);

  return (
    <>
      <style>{CSS}</style>
      <div className="al-root">
        <header className="al-topbar">
          <div>
            <h1>Alunos</h1>
            <p>Cadastro pessoal dos alunos — separado de Clientes</p>
          </div>
          <div className="al-search">
            <Search size={13} color="var(--text-3)" />
            <input placeholder="Buscar por nome, documento ou ID…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {podeCriarV && (
            <button className="btn-primary" onClick={() => setModalNovo(true)}>
              <UserPlus size={14} /> Novo aluno
            </button>
          )}
        </header>

        <div className="al-content">
          <div className="al-table-wrap">
            <div className="al-table-header">
              <span className="al-table-title"><Users size={15} /> Cadastros</span>
              <span className="al-count-badge">{alunosFiltrados.length}</span>
            </div>

            <div className="al-row-head">
              <span>ID</span>
              <span>ALUNO</span>
              <span>DOCUMENTO</span>
              <span>TELEFONE</span>
              <span>MATRÍCULA</span>
              <span style={{ textAlign: "right" }}>AÇÕES</span>
            </div>

            {loading ? (
              <div className="al-loading">Carregando alunos…</div>
            ) : alunosFiltrados.length === 0 ? (
              <div className="al-empty">
                <p>{search ? "Nenhum resultado para a busca." : "Nenhum aluno cadastrado ainda."}</p>
              </div>
            ) : alunosFiltrados.map(a => (
              <div key={a.docId} className="al-row">
                <span className="al-id">{fmtIdSeq(a.idSeq)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {a.foto
                    ? <img src={a.foto} alt={a.nome} className="al-avatar" style={{ cursor: "zoom-in" }}
                        onClick={() => setFotoVisualizando(a.foto)} title="Ver foto" />
                    : <div className="al-avatar-placeholder">{(a.nome || "?")[0].toUpperCase()}</div>}
                  <span className="al-nome">{a.nome}</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{a.documento || "—"}</span>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{a.telefone || "—"}</span>
                <span>
                  {isMatriculado(a)
                    ? <span className="al-pill ok">Matriculado</span>
                    : <span className="al-pill neutral">Sem matrícula</span>}
                </span>
                <div className="al-actions">
                  {podeEditarV && (
                    <button className="btn-icon btn-icon-edit" onClick={() => setEditando(a)} title="Editar">
                      <Edit2 size={13} />
                    </button>
                  )}
                  {podeExcluirV && (
                    <button className="btn-icon btn-icon-del" onClick={() => setExcluindo(a)} title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modalNovo && podeCriarV && (
        <ModalAlunoCadastro tenantUid={tenantUid} alunosExistentes={alunos} onSave={handleAdd} onClose={() => setModalNovo(false)} />
      )}
      {editando && podeEditarV && (
        <ModalAlunoCadastro tenantUid={tenantUid} aluno={editando} alunosExistentes={alunos} onSave={handleEdit} onClose={() => setEditando(null)} />
      )}
      {excluindo && podeExcluirV && (
        <ModalExcluirAluno aluno={excluindo} onConfirm={handleDelete} onClose={() => setExcluindo(null)} />
      )}
      {fotoVisualizando && (
        <div className="foto-lightbox" onClick={(e) => e.target === e.currentTarget && setFotoVisualizando(null)}>
          <img src={fotoVisualizando} alt="Foto do aluno" className="foto-lightbox-img" />
          <div className="foto-lightbox-actions">
            <button className="btn-secondary" onClick={() => setFotoVisualizando(null)}><X size={14} /> Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}

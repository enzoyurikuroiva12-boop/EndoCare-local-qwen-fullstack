import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarDays, ClipboardList, HeartPulse, LayoutDashboard, PencilLine, Plus, Trash2, X } from "lucide-react";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import "./SymptomDiary.css";

type MedicationKind = "none" | "analgesic" | "antiInflammatory" | "combinedHormonal" | "progestogen" | "gnrhModulator" | "other";
export type DiaryView = "summary" | "history" | "chart";
export type SymptomRecord = { id: string; date: string; createdAt?: number; pain: number; mood: string; bleeding: string; medication: string; notes: string };

const medicationKinds: MedicationKind[] = ["none", "analgesic", "antiInflammatory", "combinedHormonal", "progestogen", "gnrhModulator", "other"];
const STORAGE_KEY = "endoacolhe-symptom-diary-v1";
const emptyForm = { date: new Date().toISOString().slice(0, 10), pain: 5, mood: "Neutro", bleeding: "Não", medication: "none" as MedicationKind, medicationOther: "", notes: "" };

function orderByMostRecent(first: SymptomRecord, second: SymptomRecord) {
  const byDate = second.date.localeCompare(first.date);
  return byDate || (second.createdAt ?? 0) - (first.createdAt ?? 0);
}

export function buildPainChartData(records: SymptomRecord[]) {
  return [...records].sort((first, second) => first.date.localeCompare(second.date) || (first.createdAt ?? 0) - (second.createdAt ?? 0)).slice(-10).map((record, index) => ({ ...record, chartPoint: index + 1 }));
}

export function calculateDiarySummary(records: SymptomRecord[]) {
  const sorted = [...records].sort(orderByMostRecent);
  const latest = sorted[0];
  const averagePain = records.length ? records.reduce((total, record) => total + record.pain, 0) / records.length : null;
  return { total: records.length, averagePain, latest, trackedDays: new Set(records.map((record) => record.date)).size };
}

function medicationFromRecord(medication: string): { kind: MedicationKind; other: string } {
  if (medicationKinds.includes(medication as MedicationKind)) return { kind: medication as MedicationKind, other: "" };
  if (medication.startsWith("other:")) return { kind: "other", other: medication.slice(6).trim() };
  return medication.trim() ? { kind: "other", other: medication } : { kind: "none", other: "" };
}

export function SymptomDiary() {
  const [records, setRecords] = useState<SymptomRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DiaryView>("summary");
  const { language, locale } = useSiteLanguage();
  const t = language === "en" ? { eyebrow: "Symptom diary", title: "Your body has a story. Record it with care.", intro: "Records stay only in this browser. They can help organize conversations with your healthcare team, but they are not a diagnosis.", privacy: "Local privacy", privacyText: "Nothing is sent to the server.", date: "Record date", mood: "Mood", pain: "Pelvic pain", bleeding: "Bleeding", medication: "Medication recorded", medicationHint: "Only register medication already prescribed or recommended for you. This is not treatment guidance.", noMedication: "None", analgesic: "Prescribed pain reliever", antiInflammatory: "Prescribed anti-inflammatory", combinedHormonal: "Combined hormonal contraceptive", progestogen: "Progestogen", gnrhModulator: "GnRH modulator", other: "Other", otherMedication: "Which medication?", otherPlaceholder: "Enter the name as written in your prescription or guidance", notes: "Notes", notesPlaceholder: "What would you like to remember?", save: "Save record", update: "Save changes", cancelEdit: "Cancel editing", edit: "Open record", evolution: "Pain trend", lastTen: "last 10 records", first: "Your first record will appear here.", recent: "Recent records", total: "total", datePrefix: "Date", createdAt: "Created at", painShort: "pain", delete: "Delete record", empty: "No records yet. Start with the form beside it.", neutral: "Neutral", well: "Well", sensitive: "Sensitive", anxious: "Anxious", tired: "Tired", no: "No", mild: "Mild", moderate: "Moderate", intense: "Intense", summary: "Summary", history: "History", charts: "Charts", summaryIntro: "A calm reading of your latest notes, without turning your experience into a diagnosis.", recordsTracked: "records tracked", daysTracked: "days with notes", averagePain: "average pain", latestRecord: "Latest record", noLatest: "Your first record will appear here.", latestPain: "Pain", latestBleeding: "Bleeding", latestMedication: "Medication", viewHistory: "See history", noData: "No data yet", noValue: "—", chooseView: "Diary view" } : language === "es" ? { eyebrow: "Diario de síntomas", title: "Tu cuerpo tiene una historia. Regístrala con cuidado.", intro: "Los registros permanecen solo en este navegador. Pueden ayudarte a organizar conversaciones con tu equipo de salud, pero no constituyen un diagnóstico.", privacy: "Privacidad local", privacyText: "Nada se envía al servidor.", date: "Fecha del registro", mood: "Estado de ánimo", pain: "Dolor pélvico", bleeding: "Sangrado", medication: "Medicación registrada", medicationHint: "Registra únicamente una medicación ya prescrita u orientada para ti. No es una indicación de tratamiento.", noMedication: "Ninguna", analgesic: "Analgésico prescrito", antiInflammatory: "Antiinflamatorio prescrito", combinedHormonal: "Anticonceptivo hormonal combinado", progestogen: "Progestágeno", gnrhModulator: "Modulador de GnRH", other: "Otra", otherMedication: "¿Cuál medicación?", otherPlaceholder: "Escribe el nombre tal como aparece en tu receta u orientación", notes: "Notas", notesPlaceholder: "¿Qué te gustaría recordar?", save: "Guardar registro", update: "Guardar cambios", cancelEdit: "Cancelar edición", edit: "Abrir registro", evolution: "Evolución del dolor", lastTen: "últimos 10 registros", first: "Tu primer registro aparecerá aquí.", recent: "Registros recientes", total: "en total", datePrefix: "Fecha", createdAt: "Creado a las", painShort: "dolor", delete: "Eliminar registro", empty: "Aún no hay registros. Comienza con el formulario de al lado.", neutral: "Neutral", well: "Bien", sensitive: "Sensible", anxious: "Ansiosa", tired: "Cansada", no: "No", mild: "Leve", moderate: "Moderado", intense: "Intenso", summary: "Resumen", history: "Historial", charts: "Gráficos", summaryIntro: "Una lectura tranquila de tus notas recientes, sin convertir tu experiencia en un diagnóstico.", recordsTracked: "registros", daysTracked: "días con notas", averagePain: "dolor promedio", latestRecord: "Último registro", noLatest: "Tu primer registro aparecerá aquí.", latestPain: "Dolor", latestBleeding: "Sangrado", latestMedication: "Medicación", viewHistory: "Ver historial", noData: "Aún no hay datos", noValue: "—", chooseView: "Vista del diario" } : { eyebrow: "Diário de sintomas", title: "Seu corpo tem uma história. Registre-a com gentileza.", intro: "Os registros ficam somente neste navegador. Eles podem ajudar você a organizar conversas com sua equipe de saúde, mas não constituem diagnóstico.", privacy: "Privacidade local", privacyText: "Nada é enviado para o servidor.", date: "Data do registro", mood: "Humor", pain: "Dor pélvica", bleeding: "Sangramento", medication: "Medicação registrada", medicationHint: "Registre apenas algo já prescrito ou orientado para você. Este campo não recomenda tratamento.", noMedication: "Nenhuma", analgesic: "Analgésico prescrito", antiInflammatory: "Anti-inflamatório prescrito", combinedHormonal: "Contraceptivo hormonal combinado", progestogen: "Progestagênio", gnrhModulator: "Modulador de GnRH", other: "Outros", otherMedication: "Qual medicação?", otherPlaceholder: "Digite o nome como está na sua receita ou orientação", notes: "Notas", notesPlaceholder: "O que você gostaria de lembrar?", save: "Salvar registro", update: "Salvar alterações", cancelEdit: "Cancelar edição", edit: "Reabrir registro", evolution: "Evolução da dor", lastTen: "últimos 10 registros", first: "Seu primeiro registro aparecerá aqui.", recent: "Registros recentes", total: "no total", datePrefix: "Data", createdAt: "Criado às", painShort: "dor", delete: "Excluir registro", empty: "Sem registros ainda. Comece no formulário ao lado.", neutral: "Neutro", well: "Bem", sensitive: "Sensível", anxious: "Ansioso", tired: "Cansado", no: "Não", mild: "Leve", moderate: "Moderado", intense: "Intenso", summary: "Resumo", history: "Histórico", charts: "Gráficos", summaryIntro: "Uma leitura tranquila das suas anotações recentes, sem transformar sua experiência em diagnóstico.", recordsTracked: "registros feitos", daysTracked: "dias anotados", averagePain: "dor média", latestRecord: "Último registro", noLatest: "Seu primeiro registro aparecerá aqui.", latestPain: "Dor", latestBleeding: "Sangramento", latestMedication: "Medicação", viewHistory: "Ver histórico", noData: "Ainda não há dados", noValue: "—", chooseView: "Visualização do diário" };

  const medicationLabel = (value: string) => {
    const parsed = medicationFromRecord(value);
    if (parsed.kind === "other") return parsed.other || t.other;
    if (parsed.kind === "none") return t.noMedication;
    if (parsed.kind === "analgesic") return t.analgesic;
    if (parsed.kind === "antiInflammatory") return t.antiInflammatory;
    if (parsed.kind === "combinedHormonal") return t.combinedHormonal;
    if (parsed.kind === "progestogen") return t.progestogen;
    return t.gnrhModulator;
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SymptomRecord[];
        const now = Date.now();
        setRecords(parsed.map((record, index) => ({ ...record, createdAt: record.createdAt ?? now - (parsed.length - index) * 1_000 })));
      }
    } catch { setRecords([]); }
  }, []);

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }, [records]);
  const chartData = useMemo(() => buildPainChartData(records), [records]);
  const summary = useMemo(() => calculateDiarySummary(records), [records]);

  function addRecord(event: React.FormEvent) {
    event.preventDefault();
    const previousRecord = records.find((entry) => entry.id === editingRecordId);
    const medication = form.medication === "other" ? `other:${form.medicationOther.trim()}` : form.medication;
    const record: SymptomRecord = { id: editingRecordId || crypto.randomUUID(), date: form.date, pain: Number(form.pain), mood: form.mood, bleeding: form.bleeding, medication, notes: form.notes, createdAt: previousRecord?.createdAt ?? Date.now() };
    setRecords((current) => [...(editingRecordId ? current.filter((entry) => entry.id !== editingRecordId) : current), record].sort(orderByMostRecent));
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setEditingRecordId(null);
    setActiveView("summary");
  }

  function removeRecord(id: string) {
    setRecords((current) => current.filter((record) => record.id !== id));
    if (editingRecordId === id) { setEditingRecordId(null); setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) }); }
  }

  function reopenRecord(record: SymptomRecord) {
    const parsedMedication = medicationFromRecord(record.medication);
    setForm({ date: record.date, pain: record.pain, mood: record.mood, bleeding: record.bleeding, medication: parsedMedication.kind, medicationOther: parsedMedication.other, notes: record.notes });
    setEditingRecordId(record.id);
    setActiveView("history");
  }

  const formatDate = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, options);
  const formatTime = (createdAt?: number) => new Date(createdAt ?? 0).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const changeView = (view: DiaryView) => setActiveView(view);

  return <section id="diario" className="section-shell diary-section">
    <div className="section-heading split-heading"><div><span className="eyebrow"><HeartPulse size={14} /> {t.eyebrow}</span><h2>{t.title}</h2><p>{t.intro}</p></div><div className="privacy-note"><CalendarDays size={18} /><span><strong>{t.privacy}</strong><br />{t.privacyText}</span></div></div>
    <div className="diary-layout">
      <form className="diary-form glass-panel" onSubmit={addRecord}>
        <div className="diary-form-heading"><div><span className="diary-form-kicker">{editingRecordId ? t.update : t.save}</span><h3>{editingRecordId ? t.update : t.save}</h3></div><span className="diary-form-mark"><HeartPulse size={17} /></span></div>
        <div className="form-grid form-grid--top"><label className="diary-field"><span>{t.date}</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required aria-label={t.date} /></label><label className="diary-field"><span>{t.mood}</span><select value={form.mood} onChange={(event) => setForm({ ...form, mood: event.target.value })}><option value="Neutro">{t.neutral}</option><option value="Bem">{t.well}</option><option value="Sensível">{t.sensitive}</option><option value="Ansioso">{t.anxious}</option><option value="Cansado">{t.tired}</option></select></label></div>
        <label className="pain-control diary-field"><span>{t.pain} <strong>{form.pain}/10</strong></span><input type="range" min="1" max="10" value={form.pain} onChange={(event) => setForm({ ...form, pain: Number(event.target.value) })} /></label>
        <div className="form-grid form-grid--balanced"><label className="diary-field"><span>{t.bleeding}</span><select value={form.bleeding} onChange={(event) => setForm({ ...form, bleeding: event.target.value })}><option value="Não">{t.no}</option><option value="Leve">{t.mild}</option><option value="Moderado">{t.moderate}</option><option value="Intenso">{t.intense}</option></select></label><label className="diary-field diary-field--medication"><span>{t.medication}</span><select value={form.medication} onChange={(event) => setForm({ ...form, medication: event.target.value as MedicationKind, medicationOther: event.target.value === "other" ? form.medicationOther : "" })}>{medicationKinds.map((kind) => <option key={kind} value={kind}>{kind === "none" ? t.noMedication : t[kind]}</option>)}</select><small className="medication-hint">{t.medicationHint}</small></label></div>
        {form.medication === "other" ? <label className="medication-other-field diary-field"><span>{t.otherMedication}</span><input value={form.medicationOther} onChange={(event) => setForm({ ...form, medicationOther: event.target.value })} placeholder={t.otherPlaceholder} maxLength={120} required /></label> : null}
        <label className="diary-field diary-notes-field"><span>{t.notes}</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={t.notesPlaceholder} /></label>
        <button className="primary-button" type="submit">{editingRecordId ? <PencilLine size={17} /> : <Plus size={17} />} {editingRecordId ? t.update : t.save}</button>
        {editingRecordId ? <button className="diary-cancel-edit" type="button" onClick={() => { setEditingRecordId(null); setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) }); }}><X size={15} /> {t.cancelEdit}</button> : null}
      </form>
      <div className="diary-insights">
        <nav className="diary-view-nav" aria-label={t.chooseView} role="tablist"><button className={activeView === "summary" ? "is-active" : ""} type="button" role="tab" aria-selected={activeView === "summary"} onClick={() => changeView("summary")}><LayoutDashboard size={16} /> {t.summary}</button><button className={activeView === "history" ? "is-active" : ""} type="button" role="tab" aria-selected={activeView === "history"} onClick={() => changeView("history")}><ClipboardList size={16} /> {t.history}</button><button className={activeView === "chart" ? "is-active" : ""} type="button" role="tab" aria-selected={activeView === "chart"} onClick={() => changeView("chart")}><BarChart3 size={16} /> {t.charts}</button></nav>
        {activeView === "summary" ? <section className="diary-panel diary-summary-panel" role="tabpanel"><div className="diary-panel-heading"><div><span className="diary-panel-kicker">{t.summary}</span><h3>{t.summaryIntro}</h3></div><span className="diary-panel-icon"><HeartPulse size={18} /></span></div><div className="summary-stats"><article className="summary-stat"><strong>{summary.total || t.noValue}</strong><span>{t.recordsTracked}</span></article><article className="summary-stat"><strong>{summary.trackedDays || t.noValue}</strong><span>{t.daysTracked}</span></article><article className="summary-stat summary-stat--accent"><strong>{summary.averagePain ? `${summary.averagePain.toFixed(1)}/10` : t.noValue}</strong><span>{t.averagePain}</span></article></div><div className="latest-record-block"><div className="latest-record-heading"><span>{t.latestRecord}</span>{summary.latest ? <small>{formatDate(summary.latest.date, { day: "2-digit", month: "short", year: "numeric" })}</small> : null}</div>{summary.latest ? <><div className="latest-record-metrics"><span><b>{summary.latest.pain}/10</b>{t.latestPain}</span><span><b>{summary.latest.mood}</b>{t.mood}</span><span><b>{summary.latest.bleeding}</b>{t.latestBleeding}</span></div><p>{summary.latest.notes || t.noData}</p><div className="latest-record-footer"><small>{t.latestMedication}: {medicationLabel(summary.latest.medication)}</small><button type="button" className="text-button" onClick={() => changeView("history")}>{t.viewHistory} <span aria-hidden="true">→</span></button></div></> : <p className="diary-empty-state">{t.noLatest}</p>}</div></section> : null}
        {activeView === "history" ? <section className="diary-panel records-card" role="tabpanel"><div className="records-title"><div><span className="diary-panel-kicker">{t.history}</span><h3>{t.recent}</h3></div><small>{records.length} {t.total}</small></div>{records.length ? records.map((record) => <article className="record-row" key={record.id}><div className="record-row__content"><strong>{t.datePrefix}: {formatDate(record.date, { day: "2-digit", month: "long", year: "numeric" })} · {t.createdAt} {formatTime(record.createdAt)}</strong><span>{record.mood} · {t.painShort} {record.pain}/10 · {record.bleeding} · {medicationLabel(record.medication)}</span>{record.notes ? <p>{record.notes}</p> : null}</div><div className="record-row__actions"><button type="button" className="record-reopen" aria-label={t.edit} title={t.edit} onClick={() => reopenRecord(record)}><PencilLine size={15} /><span>{t.edit}</span></button><button type="button" className="record-delete" aria-label={t.delete} title={t.delete} onClick={() => removeRecord(record.id)}><Trash2 size={15} /></button></div></article>) : <p className="empty-records">{t.empty}</p>}</section> : null}
        {activeView === "chart" ? <section className="diary-panel chart-card" role="tabpanel"><div className="chart-title"><div><span className="diary-panel-kicker">{t.charts}</span><h3>{t.evolution}</h3></div><small>{t.lastTen}</small></div>{chartData.length ? <div className="pain-chart-wrap" role="img" aria-label={`${t.evolution}. ${t.lastTen}.`}><div className="pain-chart-direction"><span>{language === "en" ? "Earlier" : language === "es" ? "Más antiguo" : "Mais antigo"}</span><i aria-hidden="true" /><span>{language === "en" ? "Most recent" : language === "es" ? "Más reciente" : "Mais recente"}</span></div><ResponsiveContainer width="100%" height={250}><AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 2 }} accessibilityLayer><defs><linearGradient id="painGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a76a7f" stopOpacity={0.34} /><stop offset="100%" stopColor="#a76a7f" stopOpacity={0.015} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eadde7" strokeDasharray="3 5" /><XAxis dataKey="chartPoint" tickFormatter={(point) => { const record = chartData[Number(point) - 1]; return record ? `${formatDate(record.date, { day: "2-digit", month: "short" })} ${formatTime(record.createdAt)}` : ""; }} tick={{ fontSize: 10, fill: "#7b6378" }} axisLine={false} tickLine={false} minTickGap={58} /><YAxis domain={[0, 10]} ticks={[0, 5, 10]} width={28} tick={{ fontSize: 10, fill: "#7b6378" }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(point) => { const record = chartData[Number(point) - 1]; return record ? `${t.datePrefix}: ${formatDate(record.date, { day: "2-digit", month: "long", year: "numeric" })} · ${t.createdAt} ${formatTime(record.createdAt)}` : ""; }} formatter={(value) => [`${value}/10`, t.pain]} cursor={{ stroke: "#c69ab5", strokeWidth: 1 }} contentStyle={{ borderRadius: 12, border: "1px solid #e4d3df", boxShadow: "0 12px 28px rgba(78, 49, 76, .14)", padding: "10px 12px" }} /><Area type="linear" dataKey="pain" stroke="#9c4e82" strokeWidth={2.6} fill="url(#painGradient)" dot={{ r: 3.5, fill: "#fffafd", stroke: "#9c4e82", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#9c4e82", stroke: "#fffafd", strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div> : <div className="empty-chart">{t.first}</div>}</section> : null}
      </div>
    </div>
  </section>;
}

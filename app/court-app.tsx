"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gavel,
  Plus,
  Scale,
  Play,
  FolderOpen,
  ArrowLeft,
  Pause,
  Check,
  Clock3,
  RotateCcw,
  Pencil,
  Volume2,
  VolumeX,
  Info,
  FileCheck2,
  CircleHelp,
  RefreshCw,
  Printer,
  CalendarDays,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toaster, toast } from "sonner";
import {
  createCase,
  mutateCase,
  practiceCases,
  profile,
  reasons,
  elapsed,
  validateTitle,
  type CaseFile,
  type CaseInput,
  type Reason,
  type Repeat,
  type Action,
} from "@/lib/court";

type Props = {
  userName: string | null;
  signedIn: boolean;
  signInPath: string;
  initialNow: number;
};
type Stage = "plea" | "verdict" | "focus" | "certificate" | "progress";
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function humanDate(value: string | null) {
  if (!value) return "No deadline";
  return new Date(value + "T12:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}
function prettyDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
function minuteClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function stageFor(c: CaseFile): Stage {
  return c.status === "closed"
    ? "certificate"
    : c.session
      ? "focus"
      : c.plan
        ? "verdict"
        : "plea";
}

export default function CourtApp({
  userName,
  signedIn,
  signInPath,
  initialNow,
}: Props) {
  const [cases, setCases] = useState<CaseFile[]>(() =>
    signedIn ? [] : practiceCases(initialNow),
  );
  const [today, setToday] = useState(() =>
    new Date(initialNow).toISOString().slice(0, 10),
  );
  const [demo, setDemo] = useState(!signedIn);
  const [loading, setLoading] = useState(signedIn);
  const [loadError, setLoadError] = useState("");
  const [archiveCursor, setArchiveCursor] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [totals, setTotals] = useState({ totalSeconds: 0, closed: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("plea");
  const [tab, setTab] = useState("open");
  const [filing, setFiling] = useState(false);
  const [editing, setEditing] = useState<CaseFile | null>(null);
  const [info, setInfo] = useState(false);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("once");
  const [formError, setFormError] = useState("");
  const filingId = useRef<string | null>(null);
  const [reason, setReason] = useState<Reason>("tomorrow");
  const [defense, setDefense] = useState("");
  const [appealing, setAppealing] = useState(false);
  const [step, setStep] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(initialNow);
  const selected = cases.find((c) => c.id === selectedId) ?? null;
  const active = cases.find((c) => c.session) ?? null;
  const counts = useMemo(
    () => ({
      open: cases.filter((c) => c.status === "open").length,
      awaiting: cases.filter((c) => c.status === "awaiting").length,
      closed: demo
        ? cases.filter((c) => c.status === "closed").length
        : totals.closed,
    }),
    [cases, demo, totals.closed],
  );
  const totalSeconds = demo
    ? cases.reduce((sum, c) => sum + c.totalSeconds, 0)
    : totals.totalSeconds;

  const loadDocket = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/cases", { cache: "no-store" });
      const data = (await res.json()) as {
        error?: string;
        cases: CaseFile[];
        archiveCursor: string | null;
        stats: { totalSeconds: number; closed: number };
      };
      if (!res.ok) throw new Error(data.error);
      setCases(data.cases);
      setArchiveCursor(data.archiveCursor);
      setTotals(data.stats);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The archive could not be opened. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  async function loadOlderCases() {
    setArchiveLoading(true);
    try {
      const res = await fetch(
        "/api/cases?archiveCursor=" + encodeURIComponent(archiveCursor ?? ""),
      );
      const data = (await res.json()) as {
        error?: string;
        cases: CaseFile[];
        archiveCursor: string | null;
        stats: { totalSeconds: number; closed: number };
      };
      if (!res.ok) throw new Error(data.error);
      setCases((prev) => [
        ...prev,
        ...data.cases.filter(
          (c) => !prev.some((existing) => existing.id === c.id),
        ),
      ]);
      setArchiveCursor(data.archiveCursor);
      setTotals(data.stats);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Older records could not be opened.",
      );
    } finally {
      setArchiveLoading(false);
    }
  }
  useEffect(() => {
    if (signedIn && !demo) void loadDocket();
  }, [signedIn, demo, loadDocket]);
  useEffect(() => {
    setToday(localToday());
  }, []);
  useEffect(() => {
    if (!selected?.session) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [selected?.session]);
  useEffect(() => {
    if (selected?.plan) {
      setStep(selected.plan.step);
      setMinutes(selected.plan.minutes);
    }
  }, [selected?.plan]);

  function speak(line: string) {
    if (
      !sound ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    )
      return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 0.93;
    utterance.pitch = 0.75;
    window.speechSynthesis.speak(utterance);
  }
  function gavel() {
    if (!sound) return;
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(160, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        45,
        ctx.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.16);
      oscillator.onended = () => void ctx.close();
    } catch {}
  }
  function openCase(c: CaseFile, forceStage?: Stage) {
    setSelectedId(c.id);
    setStage(forceStage ?? stageFor(c));
    setDefense("");
    setReason("tomorrow");
    setAppealing(false);
    setNote("");
    setNow(Date.now());
  }
  function returnToDocket() {
    setSelectedId(null);
    setNote("");
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  const fileCase = useCallback(
    async (input: CaseInput, id?: string) => {
      validateTitle(input.title);
      let c: CaseFile;
      if (demo) c = createCase(input, Date.now(), id ?? crypto.randomUUID());
      else {
        const res = await fetch("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, id: id ?? crypto.randomUUID() }),
        });
        const data = (await res.json()) as {
          error?: string;
          caseFile: CaseFile;
        };
        if (!res.ok) throw new Error(data.error);
        c = data.caseFile;
      }
      setCases((prev) => [c, ...prev.filter((item) => item.id !== c.id)]);
      setSelectedId(c.id);
      setStage("plea");
      setDefense("");
      setReason("tomorrow");
      setFiling(false);
      setEditing(null);
      return c;
    },
    [demo],
  );

  const act = useCallback(
    async (c: CaseFile, action: Action) => {
      if (busyRef.current)
        throw new Error("The clerk is still recording the last action.");
      busyRef.current = true;
      setBusy(true);
      try {
        let result: { caseFile: CaseFile; nextCase?: CaseFile };
        if (demo) {
          if (
            action.action === "start" &&
            cases.some((other) => other.id !== c.id && other.session)
          )
            throw new Error(
              "Record your other active session before starting this one.",
            );
          result = mutateCase(c, action, Date.now(), localToday());
        } else {
          const res = await fetch(`/api/cases/${encodeURIComponent(c.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...action,
              version: c.version,
              today: localToday(),
            }),
          });
          const data = (await res.json()) as {
            error?: string;
            caseFile: CaseFile;
            nextCase?: CaseFile;
          };
          if (!res.ok) {
            if (res.status === 409) void loadDocket();
            throw new Error(data.error);
          }
          result = data;
        }
        if (!demo)
          setTotals((prev) => ({
            totalSeconds:
              prev.totalSeconds + result.caseFile.totalSeconds - c.totalSeconds,
            closed:
              prev.closed +
              Number(result.caseFile.status === "closed") -
              Number(c.status === "closed"),
          }));
        setCases((prev) => [
          ...prev.map((item) => (item.id === c.id ? result.caseFile : item)),
          ...(result.nextCase ? [result.nextCase] : []),
        ]);
        setNow(Date.now());
        return result.caseFile;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [demo, cases, loadDocket],
  );

  async function perform(action: Action, nextStage?: Stage) {
    if (!selected) return;
    try {
      const updated = await act(selected, action);
      if (nextStage) setStage(nextStage);
      if (action.action === "plead" || action.action === "appeal") {
        setAppealing(false);
        gavel();
        speak(updated.plan?.line ?? "");
      }
      if (action.action === "resolve") {
        gavel();
        speak("Charges dropped. A disturbing outbreak of competence.");
      }
      if (action.action === "progress")
        toast.success("Progress entered into evidence.");
      return updated;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The court could not record that action.",
      );
    }
  }
  function startDemo(index = 0) {
    const samples = practiceCases();
    setDemo(true);
    setCases(samples);
    setLoading(false);
    setLoadError("");
    openCase(samples[index]);
    toast("Demo court opened. Your personal docket is untouched.");
  }
  function exitDemo() {
    setSelectedId(null);
    setCases([]);
    setDemo(false);
    setTab("open");
  }
  function openFiling(c?: CaseFile) {
    setTitle(c?.title ?? "");
    setNotes(c?.notes ?? "");
    setDueDate(c?.dueDate ?? "");
    setRepeat(c?.repeat ?? "once");
    setEditing(c ?? null);
    setFormError("");
    filingId.current = crypto.randomUUID();
    setFiling(true);
  }
  async function submitCase(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    setFormError("");
    try {
      if (editing) {
        const updated = await act(editing, {
          action: "edit",
          title,
          notes,
          dueDate: dueDate || null,
          repeat,
        });
        setEditing(null);
        setFiling(false);
        if (selectedId === updated.id) setStage(stageFor(updated));
        toast.success("Case file updated.");
      } else {
        busyRef.current = true;
        setBusy(true);
        await fileCase(
          { title, notes, dueDate: dueDate || null, repeat },
          filingId.current ?? undefined,
        );
        toast.success(demo ? "Practice case filed." : "Case filed and saved.");
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The case could not be saved.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const webState = useRef({ cases, demo, fileCase, openCase });
  webState.current = { cases, demo, fileCase, openCase };
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const definitions = [
      {
        name: "read_task_docket",
        description:
          "Read the current Due Process docket. Returns user-authored task titles, status, dates, and current steps.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async () => ({
          demo: webState.current.demo,
          cases: webState.current.cases.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status,
            dueDate: c.dueDate,
            step: c.plan?.step ?? null,
          })),
        }),
      },
      {
        name: "file_task_case",
        description:
          "Create and save a task case in the visible docket. In demo court it creates a temporary practice case. Opens its hearing.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 160 },
          },
          required: ["title"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const title = validateTitle((input as { title?: unknown })?.title);
          const c = await webState.current.fileCase({ title });
          return {
            id: c.id,
            title: c.title,
            status: c.status,
            demo: webState.current.demo,
          };
        },
      },
      {
        name: "open_task_hearing",
        description:
          "Open an existing task’s hearing without changing the case or spending AI credits.",
        inputSchema: {
          type: "object",
          properties: { caseId: { type: "string" } },
          required: ["caseId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const c = webState.current.cases.find(
            (c) => c.id === (input as { caseId?: unknown })?.caseId,
          );
          if (!c) throw new Error("That case is not in this docket.");
          webState.current.openCase(c);
          return { id: c.id, title: c.title, stage: stageFor(c) };
        },
      },
    ];
    for (const tool of definitions) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, []);

  const sentenceSeconds = selected?.session
    ? demo
      ? 15
      : selected.session.minutes * 60
    : 0;
  const elapsedSeconds = elapsed(selected?.session ?? null, now);
  const remaining = Math.max(0, sentenceSeconds - elapsedSeconds);
  const timerDone = !!selected?.session && remaining === 0;
  const judgeLine =
    selected?.status === "closed"
      ? "Charges dropped. A disturbing outbreak of competence."
      : stage === "progress"
        ? "A little progress is admissible. The case can wait."
        : stage === "focus"
          ? timerDone
            ? "Time served. What shall we enter into evidence?"
            : "The court authorizes you to do this badly."
          : (selected?.plan?.line ??
            "All rise. Unless you’re tired. The court accepts sitting.");

  function renderCaseRow(c: CaseFile) {
    const overdue = !!c.dueDate && c.dueDate < today && c.status !== "closed";
    return (
      <div className={`case-row ${c.session ? "case-running" : ""}`} key={c.id}>
        <button className="case-main" onClick={() => openCase(c)}>
          <span className="case-symbol">{profile(c.title).icon}</span>
          <span className="case-text">
            <strong>{c.title}</strong>
            <small>
              {c.session
                ? "Session in progress"
                : c.status === "awaiting"
                  ? "Awaiting evidence"
                  : c.status === "closed"
                    ? "Charges dropped"
                    : profile(c.title).charge}
            </small>
            <span className="case-meta">
              <span className={overdue ? "overdue" : ""}>
                <CalendarDays size={12} />
                {overdue ? "Overdue · " : ""}
                {humanDate(c.dueDate)}
              </span>
              {c.repeat !== "once" && (
                <span>
                  <RotateCcw size={12} />
                  {c.repeat === "daily" ? "Daily" : "Weekly"}
                </span>
              )}
              {c.sessionCount > 0 && (
                <span>
                  {c.sessionCount} session{c.sessionCount === 1 ? "" : "s"}
                </span>
              )}
            </span>
          </span>
          <span className="case-action">
            {c.session
              ? "Resume"
              : c.status === "closed"
                ? "View"
                : c.status === "awaiting"
                  ? "Review"
                  : "Hear case"}
            <Gavel size={15} />
          </span>
        </button>
        {!c.session && (
          <button
            className="icon-button edit-case"
            aria-label={`Edit ${c.title}`}
            onClick={() => openFiling(c)}
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`app-shell ${selected && stage === "certificate" ? "printing-certificate" : ""}`}
    >
      <Toaster position="bottom-right" richColors />
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            returnToDocket();
          }}
        >
          <span className="brand-mark">
            <Scale size={23} />
          </span>
          <span>
            due process<span className="brand-period">.</span>
          </span>
        </a>
        <div className="header-note">A little justice. A little progress.</div>
        <div className="header-actions">
          <button
            className="icon-button"
            onClick={() => {
              if (sound && "speechSynthesis" in window)
                window.speechSynthesis.cancel();
              setSound(!sound);
            }}
            aria-label={sound ? "Turn court sound off" : "Turn court sound on"}
            aria-pressed={sound}
          >
            {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button
            className="icon-button"
            onClick={() => setInfo(true)}
            aria-label="About the court"
          >
            <Info size={19} />
          </button>
          <span className="avatar">{userName?.[0]?.toUpperCase() ?? "Y"}</span>
          <span>{demo ? "Demo chambers" : "Your chambers"}</span>
        </div>
      </header>
      <main className="workspace">
        {demo && (
          <div className="demo-banner">
            <span>
              <Play size={14} /> Demo docket. Practice cases are temporary.
            </span>
            {signedIn ? (
              <button onClick={exitDemo}>
                Return to my docket <X size={14} />
              </button>
            ) : (
              <a href={signInPath} target="_top">
                Sign in to save your cases
              </a>
            )}
          </div>
        )}
        {!selected ? (
          <>
            <div className="page-heading">
              <div>
                <p className="date-line">The Court of Extremely Small Claims</p>
                <h1>
                  Your tasks have
                  <br />
                  retained counsel.
                </h1>
                <p className="heading-copy">
                  They’ve waited long enough. Let’s hear their side.
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => openFiling()}
                disabled={loading || (!demo && !!loadError)}
              >
                <Plus size={18} /> File a case
              </button>
            </div>
            <div className="docket-layout">
              <section className="docket-panel">
                <div className="section-heading">
                  <h2>Today’s docket</h2>
                  <span className="count-pill">
                    {demo
                      ? "Practice docket"
                      : loading
                        ? "Opening archive…"
                        : `${counts.open} open case${counts.open === 1 ? "" : "s"}`}
                  </span>
                </div>
                {loadError ? (
                  <div className="archive-error" role="alert">
                    <CircleHelp size={28} />
                    <h3>The clerk hit a snag.</h3>
                    <p>{loadError}</p>
                    <button
                      className="button secondary"
                      onClick={() => void loadDocket()}
                    >
                      <RefreshCw size={15} /> Try again
                    </button>
                    <button className="text-button" onClick={() => startDemo()}>
                      Use demo court meanwhile
                    </button>
                  </div>
                ) : loading ? (
                  <div
                    className="docket-loading"
                    aria-label="Loading your saved docket"
                  >
                    {[1, 2, 3].map((i) => (
                      <Skeleton className="case-skeleton" key={i} />
                    ))}
                  </div>
                ) : (
                  <Tabs value={tab} onValueChange={setTab}>
                    <TabsList variant="line" className="docket-tabs">
                      <TabsTrigger value="open">
                        Open <span>{counts.open}</span>
                      </TabsTrigger>
                      <TabsTrigger value="awaiting">
                        Awaiting <span>{counts.awaiting}</span>
                      </TabsTrigger>
                      <TabsTrigger value="closed">
                        Closed <span>{counts.closed}</span>
                      </TabsTrigger>
                    </TabsList>
                    {(["open", "awaiting", "closed"] as const).map((status) => (
                      <TabsContent value={status} key={status}>
                        {cases
                          .filter((c) => c.status === status)
                          .sort((a, b) => {
                            if (status === "closed")
                              return (b.closedAt ?? 0) - (a.closedAt ?? 0);
                            if (a.session && !b.session) return -1;
                            if (b.session && !a.session) return 1;
                            return (a.dueDate ?? "9999").localeCompare(
                              b.dueDate ?? "9999",
                            );
                          })
                          .map(renderCaseRow)}
                        {!cases.some((c) => c.status === status) && (
                          <div className="empty-docket">
                            {status === "closed" ? (
                              <FileCheck2 size={42} strokeWidth={1.4} />
                            ) : (
                              <FolderOpen size={42} strokeWidth={1.4} />
                            )}
                            <h3>
                              {status === "open"
                                ? "An unusually innocent morning."
                                : status === "awaiting"
                                  ? "No missing witnesses."
                                  : "No charges dropped. Yet."}
                            </h3>
                            <p>
                              {status === "open"
                                ? "File something you’ve been putting off. The court accepts chores, emails, and vague dread."
                                : status === "awaiting"
                                  ? "Blocked cases can wait here until you have what you need."
                                  : "Close a case and its certificate will be filed here."}
                            </p>
                            {status === "open" && (
                              <button
                                className="button secondary"
                                onClick={() => openFiling()}
                              >
                                Bring a task to court
                              </button>
                            )}
                          </div>
                        )}
                        {status === "closed" && !demo && archiveCursor && (
                          <button
                            className="button secondary archive-more"
                            disabled={archiveLoading}
                            onClick={() => void loadOlderCases()}
                          >
                            {archiveLoading
                              ? "Opening older records…"
                              : "Load older closed cases"}
                          </button>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
                <div className="docket-bottom">
                  <span>
                    <Clock3 size={15} />
                    {Math.floor(totalSeconds / 60)} minutes entered into
                    evidence
                  </span>
                  <span>
                    {counts.closed} case{counts.closed === 1 ? "" : "s"} closed
                  </span>
                </div>
                {!demo && !loading && !loadError && cases.length === 0 && (
                  <div className="practice-area">
                    <div className="section-heading">
                      <h3>Try a practice hearing</h3>
                      <span>About one minute</span>
                    </div>
                    {practiceCases().map((c, i) => (
                      <button
                        key={c.id}
                        className="practice-row"
                        onClick={() => startDemo(i)}
                      >
                        <span className="case-symbol">
                          {profile(c.title).icon}
                        </span>
                        <span>
                          <strong>{c.title}</strong>
                          <small>{profile(c.title).charge}</small>
                        </span>
                        <Play size={16} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
              <aside className="judge-card">
                <div className="judge-top">
                  <span className="session-badge">
                    <Gavel size={14} /> Court is in session
                  </span>
                  <span className="court-number">Courtroom 001</span>
                </div>
                <img
                  className="judge-image"
                  src="/judge-pigeon.png"
                  alt="Judge P. Geon, a pigeon in a white judicial wig, presiding over a purple courtroom"
                />
                <div className="judge-description">
                  <p className="judge-name">The Hon. Judge P. Geon</p>
                  <h2>
                    “Tomorrow” has declined
                    <br />
                    to testify.
                  </h2>
                  <p>
                    One task. One absurd hearing.
                    <br />
                    One very achievable sentence.
                  </p>
                  <button className="button yellow" onClick={() => startDemo()}>
                    <Play size={16} fill="currentColor" /> Enter demo court
                  </button>
                  <span className="demo-note">
                    A 60-second hearing. No real consequences.
                  </span>
                </div>
              </aside>
            </div>
          </>
        ) : (
          <>
            <div className="hearing-nav">
              <button className="text-button" onClick={returnToDocket}>
                <ArrowLeft size={16} /> Back to docket
              </button>
              <span>
                {demo ? "Practice hearing" : `Case #${selected.id.slice(0, 6)}`}
              </span>
            </div>
            <div className="hearing-layout">
              <section className="hearing-main">
                <div className="case-title">
                  <span className="case-symbol large">
                    {profile(selected.title).icon}
                  </span>
                  <div>
                    <p>
                      {selected.status === "closed"
                        ? "The matter of"
                        : "The People v."}
                    </p>
                    <h1>{selected.title}</h1>
                  </div>
                </div>
                {stage === "plea" && (
                  <div className="hearing-paper">
                    <div className="paper-heading">
                      <span className="paper-seal">
                        <Scale size={22} />
                      </span>
                      <div>
                        <h2>The plaintiff’s complaint</h2>
                        <p>{profile(selected.title).charge}</p>
                      </div>
                    </div>
                    <div className="complaint">
                      <p>
                        “I have been described as ‘something I’ll get around
                        to’.
                      </p>
                      <p>I would prefer to be something that happened.”</p>
                      <span>— The task, appearing on its own behalf</span>
                    </div>
                    {selected.notes && (
                      <p className="case-notes">Case notes: {selected.notes}</p>
                    )}
                    <div className="plea-form">
                      <h3>How do you plead?</h3>
                      <p>The court accepts honest excuses.</p>
                      <RadioGroup
                        className="reason-grid"
                        value={reason}
                        onValueChange={(v) => setReason(v as Reason)}
                        aria-label="Your defense"
                      >
                        {reasons.map((r) => (
                          <label
                            className={`reason-button ${reason === r.value ? "chosen" : ""}`}
                            key={r.value}
                            htmlFor={`reason-${r.value}`}
                          >
                            <span>{r.icon}</span>
                            {r.label}
                            <RadioGroupItem
                              value={r.value}
                              id={`reason-${r.value}`}
                              className="defense-radio"
                            />
                          </label>
                        ))}
                      </RadioGroup>
                      <label className="field-label" htmlFor="defense">
                        Anything to add? <span>Optional</span>
                      </label>
                      <textarea
                        id="defense"
                        placeholder="Your statement for the record…"
                        value={defense}
                        onChange={(e) => setDefense(e.target.value)}
                        maxLength={500}
                        rows={2}
                      />
                      <button
                        className="button primary full"
                        onClick={() =>
                          void perform(
                            { action: "plead", reason, defense },
                            "verdict",
                          )
                        }
                        disabled={busy}
                      >
                        <Gavel size={18} />
                        {busy
                          ? "The judge is deliberating…"
                          : "Hear the verdict"}
                      </button>
                      <span className="privacy-note">
                        {demo
                          ? "Practice judge uses crafted verdicts. No AI credits spent."
                          : "Haiku 5.5 reads your task title and statement. Case notes stay here."}
                      </span>
                    </div>
                  </div>
                )}
                {stage === "verdict" && selected.plan && (
                  <div className="hearing-paper verdict-paper">
                    <div className="verdict-heading">
                      <span className="stamp small-stamp">
                        {selected.status === "awaiting"
                          ? "Adjourned"
                          : selected.plan.blocked
                            ? "Evidence needed"
                            : "A fair sentence"}
                      </span>
                      <h2>
                        {selected.status === "awaiting"
                          ? "This case can wait."
                          : "One small start."}
                      </h2>
                      <p>
                        {selected.status === "awaiting"
                          ? "You’re waiting for something outside your control. That counts."
                          : selected.plan.blocked
                            ? "Get the missing information before trying to do the whole task."
                            : "The court does not require you to finish everything today."}
                      </p>
                    </div>
                    <label className="field-label" htmlFor="first-step">
                      Your first step <Pencil size={13} />
                    </label>
                    <textarea
                      id="first-step"
                      className="step-input"
                      rows={3}
                      maxLength={300}
                      value={step}
                      onChange={(e) => setStep(e.target.value)}
                    />
                    <div className="sentence-length">
                      <span>
                        <Clock3 size={17} /> Sentence length
                      </span>
                      <Select
                        value={String(minutes)}
                        onValueChange={(v) => setMinutes(Number(v))}
                      >
                        <SelectTrigger aria-label="Sentence length">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 5, 10, 15, 25].map((m) => (
                            <SelectItem value={String(m)} key={m}>
                              {m} minutes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {demo && (
                      <p className="demo-timer-note">
                        The demo timer runs for 15 seconds so you can show the
                        full story.
                      </p>
                    )}
                    {selected.status === "awaiting" ? (
                      <button
                        className="button primary full"
                        disabled={busy}
                        onClick={() =>
                          void perform({ action: "unblock" }, "verdict")
                        }
                      >
                        <Check size={17} /> The evidence arrived
                      </button>
                    ) : (
                      <button
                        className="button primary full"
                        disabled={
                          busy ||
                          (!demo &&
                            active !== null &&
                            active.id !== selected.id)
                        }
                        onClick={async () => {
                          try {
                            let c = selected;
                            if (
                              step !== c.plan?.step ||
                              minutes !== c.plan?.minutes
                            )
                              c = await act(c, {
                                action: "plan",
                                step,
                                minutes,
                              });
                            const updated = await act(c, { action: "start" });
                            setStage("focus");
                            setNow(Date.now());
                            speak("The court authorizes you to do this badly.");
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "The sentence could not start.",
                            );
                          }
                        }}
                      >
                        <Play size={17} fill="currentColor" />
                        {selected.plan.blocked
                          ? "I can ask the question now"
                          : demo
                            ? "Start 15-second demo sentence"
                            : `Start ${minutes}-minute sentence`}
                      </button>
                    )}
                    {!demo && active && active.id !== selected.id && (
                      <p className="inline-error">
                        Another focus session is open. Record it before starting
                        this one.
                      </p>
                    )}
                    <div className="verdict-actions">
                      {selected.status !== "awaiting" && (
                        <button
                          className="text-button"
                          onClick={() => setAppealing(!appealing)}
                        >
                          <Gavel size={16} /> Object!
                        </button>
                      )}
                      {selected.status !== "awaiting" && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void perform({ action: "wait" }, "verdict")
                          }
                        >
                          Adjourn for missing evidence
                        </button>
                      )}
                    </div>
                    {appealing && (
                      <div className="appeal-box">
                        <h3>On what grounds?</h3>
                        <p>
                          An objection changes the sentence. Pigeon’s honor.
                        </p>
                        {reasons
                          .filter((r) =>
                            ["big", "energy", "blocked"].includes(r.value),
                          )
                          .map((r) => (
                            <button
                              className="reason-button"
                              key={r.value}
                              disabled={busy}
                              onClick={() =>
                                void perform(
                                  { action: "appeal", reason: r.value },
                                  "verdict",
                                )
                              }
                            >
                              <span>{r.icon}</span>
                              {r.label}
                            </button>
                          ))}
                      </div>
                    )}
                    <button
                      className="text-button resolve-link"
                      disabled={busy}
                      onClick={() =>
                        void perform({ action: "resolve" }, "certificate")
                      }
                    >
                      <Check size={15} /> Already finished the whole task?
                      Resolve it.
                    </button>
                  </div>
                )}
                {stage === "focus" && selected.session && (
                  <div className="hearing-paper focus-paper">
                    <span className="session-badge">
                      {timerDone
                        ? "Time served"
                        : selected.session.state === "paused"
                          ? "Court in recess"
                          : "Sentence in progress"}
                    </span>
                    <h2>{selected.session.step}</h2>
                    <div
                      className={`timer ${timerDone ? "time-served" : ""}`}
                      role="timer"
                      aria-label={`${Math.floor(remaining / 60)} minutes and ${remaining % 60} seconds remaining`}
                    >
                      {minuteClock(remaining)}
                    </div>
                    <p className="timer-caption">
                      {timerDone
                        ? "You may stop. The court will not move the goalposts."
                        : selected.session.state === "paused"
                          ? "Paused time does not count. Take your recess."
                          : "One task. No side quests. You can stop when time is up."}
                    </p>
                    <div className="timer-controls">
                      {!timerDone && (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              {
                                action:
                                  selected.session?.state === "paused"
                                    ? "resume"
                                    : "pause",
                              },
                              "focus",
                            )
                          }
                        >
                          {selected.session.state === "paused" ? (
                            <Play size={16} />
                          ) : (
                            <Pause size={16} />
                          )}{" "}
                          {selected.session.state === "paused"
                            ? "Resume sentence"
                            : "Take a recess"}
                        </button>
                      )}
                    </div>
                    <div className="evidence-form">
                      <label className="field-label" htmlFor="evidence">
                        What happened? <span>Optional evidence</span>
                      </label>
                      <textarea
                        id="evidence"
                        rows={2}
                        placeholder="e.g. Folded three shirts. The chair is visible again."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                      />
                      <div className="outcome-actions">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              { action: "progress", note },
                              "progress",
                            )
                          }
                        >
                          I made progress
                        </button>
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              { action: "resolve", note },
                              "certificate",
                            )
                          }
                        >
                          <Check size={17} /> Task resolved
                        </button>
                      </div>
                      <p className="outcome-note">
                        Progress keeps the case open. Resolved means the whole
                        task is done.
                      </p>
                    </div>
                  </div>
                )}
                {stage === "progress" && (
                  <div className="hearing-paper progress-paper">
                    <span className="stamp">
                      Progress entered
                      <br />
                      into evidence
                    </span>
                    <h2>A real start. On the record.</h2>
                    <p>
                      {selected.status === "awaiting"
                        ? "The case is waiting for evidence. Come back when you have what you need."
                        : "The case is still open, and it is smaller than it was before."}
                    </p>
                    <div className="progress-evidence">
                      <Check size={19} />
                      <span>
                        {
                          selected.history
                            .filter((e) => e.type === "progress")
                            .at(-1)?.text
                        }
                      </span>
                    </div>
                    <div className="outcome-actions">
                      <button
                        className="button secondary"
                        onClick={returnToDocket}
                      >
                        Back to docket
                      </button>
                      {selected.status !== "awaiting" && (
                        <button
                          className="button primary"
                          onClick={() => setStage("verdict")}
                        >
                          Another small start
                        </button>
                      )}
                    </div>
                    <button
                      className="text-button resolve-link"
                      disabled={busy}
                      onClick={() =>
                        void perform({ action: "resolve" }, "certificate")
                      }
                    >
                      Actually, the whole task is done
                    </button>
                  </div>
                )}
                {stage === "certificate" && (
                  <div className="certificate">
                    <div className="certificate-border">
                      <Scale size={42} strokeWidth={1.2} />
                      <p className="certificate-court">
                        The Court of Extremely Small Claims
                      </p>
                      <h2>
                        Certificate of
                        <br />
                        getting it done.
                      </h2>
                      <p className="certificate-intro">
                        Let the record show that
                      </p>
                      <h3>{selected.title}</h3>
                      <p>
                        has been completed, and all charges
                        <br />
                        are hereby dropped.
                      </p>
                      <span className="stamp">Case closed</span>
                      <div className="certificate-signature">
                        <span>Judge P. Geon</span>
                        <small>Presiding pigeon</small>
                      </div>
                      <div className="certificate-meta">
                        <span>
                          {new Date(
                            selected.closedAt ?? now,
                          ).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <span>Case #{selected.id.slice(0, 6)}</span>
                      </div>
                      <p className="certificate-footnote">
                        No legal value. Considerable emotional value.
                      </p>
                    </div>
                  </div>
                )}
                {stage === "certificate" && (
                  <div className="certificate-actions">
                    <button
                      className="button secondary"
                      onClick={() => window.print()}
                    >
                      <Printer size={16} /> Print certificate
                    </button>
                    <button className="button primary" onClick={returnToDocket}>
                      Back to docket
                    </button>
                    {selected.nextCaseId && (
                      <p>
                        <RotateCcw size={14} /> Next occurrence filed for{" "}
                        {humanDate(
                          cases.find((c) => c.id === selected.nextCaseId)
                            ?.dueDate ?? null,
                        )}
                        .
                      </p>
                    )}
                    {!selected.nextCaseId && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void perform({ action: "reopen" }, "verdict")
                        }
                      >
                        Reopen case
                      </button>
                    )}
                  </div>
                )}
                {selected.history.length > 1 && (
                  <details className="case-history">
                    <summary>
                      Court record{" "}
                      <span>{selected.history.length} entries</span>
                    </summary>
                    <ol>
                      {[...selected.history].reverse().map((e) => (
                        <li key={e.id}>
                          <span className="history-icon">
                            {e.type === "resolved" ? (
                              <Check size={14} />
                            ) : (
                              <Gavel size={14} />
                            )}
                          </span>
                          <div>
                            <strong>
                              {e.type === "filed"
                                ? "Case filed"
                                : e.type === "verdict"
                                  ? "Verdict issued"
                                  : e.type === "appeal"
                                    ? "Objection sustained"
                                    : e.type === "progress"
                                      ? "Progress recorded"
                                      : e.type === "resolved"
                                        ? "Charges dropped"
                                        : e.type === "waiting"
                                          ? "Case adjourned"
                                          : "Hearing resumed"}
                            </strong>
                            <p>{e.text}</p>
                            <small>
                              {new Date(e.at).toLocaleString("en-AU")}
                              {e.seconds != null
                                ? ` · ${prettyDuration(e.seconds)} of focus`
                                : ""}
                            </small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </section>
              <aside className="judge-card hearing-judge">
                <div className="judge-top">
                  <span className="session-badge">
                    <Gavel size={14} />{" "}
                    {selected.status === "closed"
                      ? "Court adjourned"
                      : "Your presiding pigeon"}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Read the judge’s ruling aloud"
                    onClick={() => {
                      if (!sound) setSound(true);
                      if ("speechSynthesis" in window) {
                        const u = new SpeechSynthesisUtterance(judgeLine);
                        u.rate = 0.93;
                        u.pitch = 0.75;
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                      }
                    }}
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
                <img
                  className="judge-image"
                  src="/judge-pigeon.png"
                  alt="The Honorable Judge P. Geon, looking unimpressed"
                />
                <div className="judge-description">
                  <p className="judge-name">The Hon. Judge P. Geon</p>
                  <blockquote key={judgeLine}>{judgeLine}</blockquote>
                  <div className="judge-divider" />
                  <p className="judge-footnote">
                    My jurisdiction is questionable.
                    <br />
                    My tiny wig is not.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
        <footer className="workspace-footer">
          <span>
            <Scale size={15} /> Due process for overdue things.
          </span>
          <span>Not a real court. Still a real start.</span>
        </footer>
      </main>
      <Dialog
        open={filing}
        onOpenChange={(open) => {
          if (!busy) setFiling(open);
        }}
      >
        <DialogContent className="filing-dialog">
          <DialogTitle>
            {editing ? "Amend the case file" : "What’s taking you to court?"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "The clerk will update your record."
              : "One thing you’ve been avoiding. That’s enough."}
          </DialogDescription>
          <form className="filing-form" onSubmit={submitCase}>
            <label className="field-label" htmlFor="task-title">
              Task
            </label>
            <input
              id="task-title"
              placeholder="e.g. Fold the laundry"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              required
            />
            <label className="field-label" htmlFor="task-notes">
              Case notes <span>Optional, private to your docket</span>
            </label>
            <textarea
              id="task-notes"
              rows={2}
              placeholder="Anything that will help future you."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
            <div className="form-columns">
              <div>
                <label className="field-label" htmlFor="task-date">
                  Due date <span>Optional</span>
                </label>
                <input
                  id="task-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="task-repeat">
                  Repeat
                </label>
                <Select
                  value={repeat}
                  onValueChange={(v) => setRepeat(v as Repeat)}
                >
                  <SelectTrigger id="task-repeat" className="repeat-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Just this once</SelectItem>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekly">Every week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {repeat !== "once" && (
              <p className="form-note">
                Resolving this case files its next occurrence. Recording
                progress does not.
              </p>
            )}
            {formError && (
              <p className="inline-error" role="alert">
                {formError}
              </p>
            )}
            <button
              className="button primary full"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "The clerk is filing…"
                : editing
                  ? "Save amendments"
                  : demo
                    ? "File practice case"
                    : "File this case"}
              <Gavel size={17} />
            </button>
            <span className="form-note">
              {demo
                ? "Demo case. Temporary, and impressively low stakes."
                : "Your cases are saved to your account."}
            </span>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="filing-dialog about-dialog">
          <DialogTitle>Welcome to Due Process.</DialogTitle>
          <DialogDescription>
            Your to-do list has retained counsel.
          </DialogDescription>
          <p>
            File a neglected task, let a pigeon hear your excuse, and serve a
            tiny focus sentence. The goal is a useful start.
          </p>
          <p>
            <strong>Objections are welcome.</strong> Too big? The step shrinks.
            Low energy? Two minutes will do. Missing information? The court can
            adjourn.
          </p>
          <p>
            <strong>Progress and completion are different.</strong> A small
            start is recorded as evidence. Only finishing the whole task drops
            the charges.
          </p>
          <p>
            <strong>Your docket is yours.</strong> Saved cases belong to your
            signed-in account. Demo court uses temporary practice cases. Haiku
            5.5 on low effort can tailor judge lines and first steps from task
            titles and defenses; notes are never sent to the judge. Crafted
            verdicts cover outages and demo court.
          </p>
          <p className="form-note">
            Made for Terrible Ideas. Please do not submit this certificate to an
            actual court.
          </p>
          <button className="button primary" onClick={() => setInfo(false)}>
            Understood, Your Feather
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

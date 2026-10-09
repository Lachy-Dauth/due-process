export type Reason = "tomorrow" | "big" | "energy" | "blocked" | "perfect";
export type Repeat = "once" | "daily" | "weekly";
export type Plan = {
  step: string;
  minutes: number;
  line: string;
  reason: Reason;
  blocked: boolean;
};
export type FocusSession = {
  id: string;
  state: "running" | "paused";
  runningSince: number | null;
  bankedSeconds: number;
  minutes: number;
  step: string;
};
export type Evidence = {
  id: string;
  at: number;
  type:
    | "filed"
    | "verdict"
    | "appeal"
    | "progress"
    | "resolved"
    | "waiting"
    | "reopened";
  text: string;
  seconds?: number;
};
export type CaseFile = {
  id: string;
  version: number;
  title: string;
  notes: string;
  dueDate: string | null;
  repeat: Repeat;
  createdAt: number;
  closedAt: number | null;
  status: "open" | "awaiting" | "closed";
  plan: Plan | null;
  session: FocusSession | null;
  history: Evidence[];
  totalSeconds: number;
  sessionCount: number;
  nextCaseId: string | null;
};
export type CaseInput = {
  title: string;
  notes?: string;
  dueDate?: string | null;
  repeat?: Repeat;
};
export type Action =
  | { action: "plead"; reason: Reason; defense?: string }
  | { action: "appeal"; reason: Reason }
  | { action: "plan"; step: string; minutes: number }
  | {
      action: "edit";
      title: string;
      notes?: string;
      dueDate?: string | null;
      repeat?: Repeat;
    }
  | { action: "start" | "pause" | "resume" | "wait" | "unblock" | "reopen" }
  | { action: "progress" | "resolve"; note?: string };

export class CourtError extends Error {}
const profileList = [
  {
    match:
      /fold.*(?:laundry|shirt|cloth|sock|towel|sweater)|laundry|washing clothes|washing machine|clothes/i,
    icon: "🧺",
    charge: "Aggravated chair occupancy",
    first: "Fold three items. Put them where they belong.",
    tiny: "Fold one item. Yes, one counts.",
    line: "The chair would like to return to its original profession.",
  },
  {
    match: /email|reply|message|inbox|respond/i,
    icon: "✉️",
    charge: "Wilful neglect of the reply button",
    first: "Open the message and write one rough sentence in a draft.",
    tiny: "Open the message. Type the greeting.",
    line: "The draft folder is a legally recognized place to be imperfect.",
  },
  {
    match: /dish|plate|kitchen|wash up/i,
    icon: "🍽️",
    charge: "Creating an unauthorized ceramic ecosystem",
    first: "Wash one plate and one cup. The rest can wait.",
    tiny: "Wash one plate. Stop there if you need to.",
    line: "The sink has requested independent representation.",
  },
  {
    match: /clean|tidy|room|declutter|organis|organiz/i,
    icon: "🧹",
    charge: "Obstruction of the visible floor",
    first: "Put away five visible things. Do not reorganize your life.",
    tiny: "Put away one thing within arm’s reach.",
    line: "The floor is a plaintiff, not a storage solution.",
  },
  {
    match: /project|report|essay|write|proposal|presentation|build|design/i,
    icon: "📝",
    charge: "Conspiracy to open one more tab",
    first: "Open the working file and write three ugly bullet points.",
    tiny: "Open the file. Add one very rough bullet point.",
    line: "Perfectionism is removed as counsel. Conflict of interest.",
  },
  {
    match: /bill|invoice|tax|admin|form|renew|pay/i,
    icon: "📂",
    charge: "Unlicensed accumulation of life admin",
    first: "Find the relevant document. Write down its next required action.",
    tiny: "Find and open the relevant document.",
    line: "The paperwork has developed paperwork of its own.",
  },
  {
    match: /apply|application|resume|cv|job/i,
    icon: "💼",
    charge: "Excessive refreshing of the opportunities page",
    first: "Open the listing. Copy one requirement into your notes.",
    tiny: "Open the listing and read the first requirement.",
    line: "A first draft is admissible. A perfect first draft is mythical.",
  },
  {
    match: /walk|run|gym|exercise|workout|stretch/i,
    icon: "👟",
    charge: "Failure to appear in footwear",
    first: "Put on your shoes. Decide on a short route or one gentle movement.",
    tiny: "Put your shoes next to the door.",
    line: "The court recognizes a walk around the block as a walk.",
  },
  {
    match: /study|read|learn|course|revise/i,
    icon: "📚",
    charge: "Possession of unopened knowledge",
    first: "Open the material. Read the first paragraph and note one idea.",
    tiny: "Open the material and read one sentence.",
    line: "The bookmark has become a permanent resident.",
  },
  {
    match: /plan|research|travel|book|decide|choose/i,
    icon: "🔎",
    charge: "Indefinite detention in the research phase",
    first: "Write one specific question this decision needs to answer.",
    tiny: "Write the question. No tabs required yet.",
    line: "Research has requested an extension to research the extension.",
  },
  {
    match: /call|phone|appointment|dentist/i,
    icon: "☎️",
    charge: "Repeated failure to press the green button",
    first:
      "Find the contact details and write the first sentence you will say.",
    tiny: "Find the contact details. Save them in one place.",
    line: "The phone has agreed not to make this a personality test.",
  },
];
const fallback = {
  icon: "🫠",
  charge: "Intent to do it eventually",
  first:
    "Open the place this task lives. Write one visible action you can do next.",
  tiny: "Write the very first physical action this task needs.",
  line: "Motivation is not a required witness.",
};
export function profile(title: string) {
  const appointment = profileList.find(
    (p) => p.icon === "☎️" && /appointment|dentist|phone|call/i.test(title),
  );
  const p =
    appointment ?? profileList.find((p) => p.match.test(title)) ?? fallback;
  if (/laundry|washing|clothes/i.test(title) && !/fold/i.test(title))
    return {
      ...p,
      first:
        "Put one load of clothes in the machine. Check the care labels first.",
      tiny: "Put the laundry basket next to the machine.",
    };
  return p;
}
export const reasons: { value: Reason; label: string; icon: string }[] = [
  { value: "tomorrow", label: "I’ll do it tomorrow", icon: "🗓️" },
  { value: "big", label: "It’s too big", icon: "🏔️" },
  { value: "energy", label: "I have no energy", icon: "🪫" },
  { value: "blocked", label: "I’m missing something", icon: "🧩" },
  { value: "perfect", label: "It needs to be perfect", icon: "✨" },
];
export function validateTitle(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160)
    throw new CourtError("Give the case a title between 1 and 160 characters.");
  return value.trim();
}
function validateNotes(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > 2000)
    throw new CourtError("Keep the case notes under 2,000 characters.");
  return value.trim();
}
export function validateDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T12:00:00Z")) ||
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new CourtError("Choose a valid calendar date.");
  return value;
}
function validateRepeat(value: unknown): Repeat {
  if (value == null) return "once";
  if (!["once", "daily", "weekly"].includes(value as string))
    throw new CourtError("Choose once, daily, or weekly.");
  return value as Repeat;
}
function validateReason(value: unknown): Reason {
  if (!reasons.some((r) => r.value === value))
    throw new CourtError("Choose a defense the court can hear.");
  return value as Reason;
}
function id() {
  return crypto.randomUUID();
}
function entry(
  type: Evidence["type"],
  text: string,
  now: number,
  seconds?: number,
): Evidence {
  return {
    id: id(),
    type,
    text,
    at: now,
    ...(seconds == null ? {} : { seconds }),
  };
}
function record(c: CaseFile, e: Evidence) {
  c.history = [...c.history, e].slice(-60);
}
export function createCase(
  input: CaseInput,
  now = Date.now(),
  caseId = id(),
): CaseFile {
  const title = validateTitle(input.title);
  return {
    id: caseId,
    version: 0,
    title,
    notes: validateNotes(input.notes),
    dueDate: validateDate(input.dueDate),
    repeat: validateRepeat(input.repeat),
    createdAt: now,
    closedAt: null,
    status: "open",
    plan: null,
    session: null,
    history: [
      entry(
        "filed",
        `${profile(title).charge}. The plaintiff has requested a hearing.`,
        now,
      ),
    ],
    totalSeconds: 0,
    sessionCount: 0,
    nextCaseId: null,
  };
}
export function verdict(title: string, reason: Reason): Plan {
  const p = profile(title);
  const plans: Record<Reason, Plan> = {
    tomorrow: {
      step: p.first,
      minutes: 5,
      line: "“Tomorrow” has declined to testify. The court orders one tiny start today.",
      reason,
      blocked: false,
    },
    big: {
      step: p.tiny,
      minutes: 2,
      line: "This task is three tasks in a trench coat. Sentence reduced.",
      reason,
      blocked: false,
    },
    energy: {
      step: p.tiny,
      minutes: 2,
      line: "Low battery accepted. This court also runs on crumbs. Two minutes, then a recess.",
      reason,
      blocked: false,
    },
    blocked: {
      step: "Write the one thing you need to know and who could answer it. Ask them when you can.",
      minutes: 2,
      line: "Missing evidence accepted. Ask one question. No detective board required.",
      reason,
      blocked: true,
    },
    perfect: {
      step: p.first,
      minutes: 5,
      line: "Perfectionism is removed as counsel. The court authorizes an extremely rough first draft.",
      reason,
      blocked: false,
    },
  };
  return plans[reason];
}
export function elapsed(
  session: FocusSession | null,
  now = Date.now(),
): number {
  if (!session) return 0;
  const live =
    session.state === "running" && session.runningSince != null
      ? Math.max(0, Math.floor((now - session.runningSince) / 1000))
      : 0;
  return Math.min(
    session.minutes * 60,
    Math.max(0, session.bankedSeconds + live),
  );
}
export function nextDueDate(
  dueDate: string | null,
  repeat: Repeat,
  today: string,
): string | null {
  if (repeat === "once") return null;
  const anchor = new Date((dueDate ?? today) + "T12:00:00Z");
  const end = new Date(today + "T12:00:00Z");
  const interval = repeat === "daily" ? 1 : 7;
  const daysLate = Math.floor((end.getTime() - anchor.getTime()) / 86400000);
  anchor.setUTCDate(
    anchor.getUTCDate() +
      Math.max(1, Math.floor(daysLate / interval) + 1) * interval,
  );
  return anchor.toISOString().slice(0, 10);
}
export function mutateCase(
  original: CaseFile,
  action: Action,
  now = Date.now(),
  today = new Date(now).toISOString().slice(0, 10),
): { caseFile: CaseFile; nextCase?: CaseFile } {
  const c = structuredClone(original);
  if (!action || typeof action.action !== "string")
    throw new CourtError("Choose a valid court action.");
  if (c.status === "closed" && !["reopen", "edit"].includes(action.action))
    throw new CourtError(
      "This case is closed. Reopen it to hold another hearing.",
    );
  switch (action.action) {
    case "edit": {
      if (c.session)
        throw new CourtError(
          "Finish or pause for recess, then record your session before editing this case.",
        );
      const title = validateTitle(action.title);
      if (title !== c.title) c.plan = null;
      c.title = title;
      c.notes = validateNotes(action.notes);
      c.dueDate = validateDate(action.dueDate);
      c.repeat = validateRepeat(action.repeat);
      break;
    }
    case "plead":
    case "appeal": {
      if (c.session)
        throw new CourtError(
          "Record your current session before changing the sentence.",
        );
      const reason = validateReason(action.reason);
      if (
        action.action === "plead" &&
        action.defense != null &&
        (typeof action.defense !== "string" || action.defense.length > 500)
      )
        throw new CourtError("Keep your statement under 500 characters.");
      c.plan = verdict(c.title, reason);
      c.status = "open";
      const defense =
        action.action === "plead" && action.defense?.trim()
          ? ` Statement: “${action.defense.trim()}”.`
          : "";
      record(
        c,
        entry(
          action.action === "appeal" ? "appeal" : "verdict",
          `${c.plan.line}${defense}`,
          now,
        ),
      );
      break;
    }
    case "plan": {
      if (c.session)
        throw new CourtError(
          "Record your current session before changing the sentence.",
        );
      if (
        typeof action.step !== "string" ||
        !action.step.trim() ||
        action.step.trim().length > 300
      )
        throw new CourtError(
          "Write a first step between 1 and 300 characters.",
        );
      if (![2, 5, 10, 15, 25].includes(action.minutes))
        throw new CourtError("Choose a 2, 5, 10, 15, or 25 minute sentence.");
      c.plan = {
        ...(c.plan ?? verdict(c.title, "tomorrow")),
        step: action.step.trim(),
        minutes: action.minutes,
      };
      break;
    }
    case "start": {
      if (c.session)
        throw new CourtError("This case already has an active session.");
      c.plan ??= verdict(c.title, "tomorrow");
      c.status = "open";
      c.session = {
        id: id(),
        state: "running",
        runningSince: now,
        bankedSeconds: 0,
        minutes: c.plan.minutes,
        step: c.plan.step,
      };
      break;
    }
    case "pause": {
      if (!c.session || c.session.state !== "running")
        throw new CourtError("There is no running session to pause.");
      c.session.bankedSeconds = elapsed(c.session, now);
      c.session.runningSince = null;
      c.session.state = "paused";
      break;
    }
    case "resume": {
      if (!c.session || c.session.state !== "paused")
        throw new CourtError("There is no paused session to resume.");
      c.session.runningSince = now;
      c.session.state = "running";
      break;
    }
    case "wait": {
      if (c.session)
        throw new CourtError("Record your session before adjourning.");
      c.status = "awaiting";
      record(
        c,
        entry(
          "waiting",
          "Adjourned while evidence arrives. No guilt permitted during the recess.",
          now,
        ),
      );
      break;
    }
    case "unblock": {
      c.status = "open";
      c.plan = verdict(c.title, "tomorrow");
      record(
        c,
        entry(
          "reopened",
          "Evidence received. The court is ready for one small start.",
          now,
        ),
      );
      break;
    }
    case "reopen": {
      if (c.nextCaseId)
        throw new CourtError(
          "This recurring case already has a next occurrence. Open that case instead.",
        );
      c.status = "open";
      c.closedAt = null;
      record(
        c,
        entry("reopened", "Case reopened at the defendant’s request.", now),
      );
      break;
    }
    case "progress":
    case "resolve": {
      if (
        action.note != null &&
        (typeof action.note !== "string" || action.note.length > 500)
      )
        throw new CourtError("Keep your evidence note under 500 characters.");
      if (action.action === "progress" && !c.session)
        throw new CourtError(
          "Start a session before recording focus progress.",
        );
      const seconds = elapsed(c.session, now);
      if (c.session) {
        c.totalSeconds += seconds;
        c.sessionCount++;
      }
      c.session = null;
      const note = action.note?.trim();
      if (action.action === "progress") {
        c.status = c.plan?.blocked ? "awaiting" : "open";
        record(
          c,
          entry(
            "progress",
            note || "One small start entered into evidence. Case remains open.",
            now,
            seconds,
          ),
        );
      } else {
        c.status = "closed";
        c.closedAt = now;
        record(
          c,
          entry(
            "resolved",
            note || "Charges dropped. A disturbing outbreak of competence.",
            now,
            seconds,
          ),
        );
        if (c.repeat !== "once") {
          const nextCase = createCase(
            {
              title: c.title,
              notes: c.notes,
              dueDate: nextDueDate(c.dueDate, c.repeat, today),
              repeat: c.repeat,
            },
            now,
          );
          c.nextCaseId = nextCase.id;
          c.version++;
          return { caseFile: c, nextCase };
        }
      }
      break;
    }
    default:
      throw new CourtError(
        "That action is outside this pigeon’s jurisdiction.",
      );
  }
  c.version++;
  return { caseFile: c };
}
export function practiceCases(now = Date.now()): CaseFile[] {
  const today = new Date(now).toISOString().slice(0, 10);
  return [
    createCase(
      { title: "Fold the laundry", dueDate: today, repeat: "weekly" },
      now - 3 * 86400000,
      "demo-laundry",
    ),
    createCase(
      { title: "Reply to that email", dueDate: today },
      now - 5 * 86400000,
      "demo-email",
    ),
    createCase(
      { title: "Finally start the project" },
      now - 8 * 86400000,
      "demo-project",
    ),
  ];
}

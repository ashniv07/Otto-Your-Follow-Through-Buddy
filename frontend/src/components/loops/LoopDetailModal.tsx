import { useState, useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CalendarClock, Check, FileText, Loader2, MailX, Search, Sparkles, X } from "../../lib/icons";
import type { OpenLoop } from "../../types";
import { loopTypeMeta, stakesMeta, statusMeta } from "./loopMeta";
import { formatDate, formatDateTime, cn } from "../../lib/utils";
import { ApproveDeclineRow } from "./ApproveDeclineRow";
import { useOtto } from "../../hooks/useOttoStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface LoopDetailModalProps {
  loop: OpenLoop | null;
  onClose: () => void;
}

export function LoopDetailModal({ loop, onClose }: LoopDetailModalProps) {
  return (
    <AnimatePresence>
      {loop && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10 sm:py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="fixed inset-0 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            layoutId={`loop-card-${loop.id}`}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-base-700 bg-base-900 shadow-2xl shadow-black/50"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <ModalBody loop={loop} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModalBody({ loop, onClose }: { loop: OpenLoop; onClose: () => void }) {
  const type = loopTypeMeta[loop.loopType];
  const status = statusMeta[loop.status];
  const Icon = type.icon;
  const schema = loop.context.actionSchema;
  const { approveLoop, declineLoop, googleConnection } = useOtto();

  const [to, setTo] = useState(schema?.to ?? "");
  const [cc, setCc] = useState(schema?.cc ?? "");
  const [subject, setSubject] = useState(schema?.subject ?? "");
  const [body, setBody] = useState(schema?.body ?? "");
  const [replyText, setReplyText] = useState(schema?.replyText ?? "");
  const [resourceAnswer, setResourceAnswer] = useState(schema?.resourceAnswer ?? "");
  const [saving, setSaving] = useState(false);

  // Reset fields when a different loop is opened.
  useEffect(() => {
    setTo(schema?.to ?? "");
    setCc(schema?.cc ?? "");
    setSubject(schema?.subject ?? "");
    setBody(schema?.body ?? "");
    setReplyText(schema?.replyText ?? "");
    setResourceAnswer(schema?.resourceAnswer ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.id]);

  async function handlePatchApprove(edits: Record<string, string>) {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/loops/${loop.id}/action-schema`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      });
      await approveLoop(loop.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const handleComposeApprove = () => handlePatchApprove({ to, cc, subject, body });
  const handleDocReplyApprove = () => handlePatchApprove({ replyText });
  const handleNeedsResourceApprove = () => handlePatchApprove({ resourceAnswer });
  const handleFileShareApprove = () => handlePatchApprove({ to, subject, body });

  return (
    <div>
      <div className="relative border-b border-base-800 p-5">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-base-400 transition-colors hover:bg-base-800 hover:text-base-100"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 pr-8 text-[11px] font-medium uppercase tracking-wide text-base-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-base-800 text-base-300">
            <Icon size={13} />
          </span>
          {type.label}
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              status.text,
              status.border,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          <span className="ml-auto rounded-md bg-base-800 px-1.5 py-0.5 text-[11px] font-medium text-base-400">
            {stakesMeta[loop.stakes].label}
          </span>
        </div>

        <h2 className="mt-2.5 pr-8 text-base font-semibold text-base-50">{loop.title}</h2>
        <p className="mt-1 text-[13px] text-base-300">{loop.currentState}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-3.5 text-[11px] text-base-500">
          <span className="flex items-center gap-1.5">
            <CalendarClock size={12} /> Expected: {formatDate(loop.expectedBy)}
          </span>
          <span>Created {formatDate(loop.createdAt)}</span>
          {loop.resolvedAt && <span>Resolved {formatDateTime(loop.resolvedAt)}</span>}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <Section icon={FileText} label="Source summary">
          <p className="text-[13px] leading-relaxed text-base-300">{loop.context.rawSummary}</p>
        </Section>

        {loop.context.investigationNotes && (
          <Section icon={Search} label="Investigation notes">
            <p className="text-[13px] leading-relaxed text-base-300">
              {loop.context.investigationNotes}
            </p>
          </Section>
        )}

        {/* Info alert (subscription price change, billing notice, etc.) */}
        {schema?.type === "info" && (
          <Section icon={AlertCircle} label="Alert" accent>
            <p className="text-[14px] font-semibold text-base-50">{schema.headline}</p>
            {schema.detail && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-base-200">{schema.detail}</p>
            )}
            {loop.status === "needs_approval" && (
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => { approveLoop(loop.id); onClose(); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-emerald/15 px-3 py-1.5 text-[13px] font-medium text-accent-emerald transition-colors hover:bg-accent-emerald/25"
                >
                  <Check size={13} /> Mark as Resolved
                </button>
                <button
                  onClick={() => { declineLoop(loop.id); onClose(); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-base-800 px-3 py-1.5 text-[13px] font-medium text-base-300 transition-colors hover:bg-base-700"
                >
                  Dismiss
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Compose action — editable draft with To / CC / Subject / Body */}
        {schema?.type === "compose" && (
          <Section icon={Sparkles} label="Proposed draft" accent>
            <SendingAsNote googleConnection={googleConnection} />
            <div className="space-y-2.5">
              <Field label="To">
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
              <Field label="CC">
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="optional"
                  className="w-full rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
              <Field label="Subject">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
              <Field label="Body">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="w-full resize-y rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] leading-relaxed text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
            </div>
            {loop.status === "needs_approval" && (
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={handleComposeApprove}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-emerald/15 px-3 py-1.5 text-[13px] font-medium text-accent-emerald transition-colors hover:bg-accent-emerald/25 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? "Sending…" : "Send"}
                </button>
                <button
                  onClick={() => { declineLoop(loop.id); onClose(); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-base-800 px-3 py-1.5 text-[13px] font-medium text-base-300 transition-colors hover:bg-base-700"
                >
                  Decline
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Doc comment reply — editable draft, approving posts + resolves the comment */}
        {schema?.type === "doc_reply" && (
          <Section icon={FileText} label="Proposed reply" accent>
            <Field label="Reply">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] leading-relaxed text-base-100 placeholder-base-600 outline-none focus:border-base-500"
              />
            </Field>
            {loop.status === "needs_approval" && (
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={handleDocReplyApprove}
                  disabled={saving || !replyText.trim()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-emerald/15 px-3 py-1.5 text-[13px] font-medium text-accent-emerald transition-colors hover:bg-accent-emerald/25 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? "Posting…" : "Post reply"}
                </button>
                <button
                  onClick={() => { declineLoop(loop.id); onClose(); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-base-800 px-3 py-1.5 text-[13px] font-medium text-base-300 transition-colors hover:bg-base-700"
                >
                  Decline
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Otto couldn't resolve the comment itself — asks the user for what's missing */}
        {schema?.type === "needs_resource" && (
          <Section icon={Search} label="Otto needs your input" accent>
            <p className="text-[13px] leading-relaxed text-base-100">{schema.question}</p>
            <div className="mt-2.5">
              <Field label="Your answer">
                <textarea
                  value={resourceAnswer}
                  onChange={(e) => setResourceAnswer(e.target.value)}
                  rows={3}
                  placeholder="Type what Otto should reply with…"
                  className="w-full resize-y rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] leading-relaxed text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
            </div>
            {loop.status === "needs_approval" && (
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={handleNeedsResourceApprove}
                  disabled={saving || !resourceAnswer.trim()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-emerald/15 px-3 py-1.5 text-[13px] font-medium text-accent-emerald transition-colors hover:bg-accent-emerald/25 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? "Posting…" : "Post reply"}
                </button>
                <button
                  onClick={() => { declineLoop(loop.id); onClose(); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-base-800 px-3 py-1.5 text-[13px] font-medium text-base-300 transition-colors hover:bg-base-700"
                >
                  Decline
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Unsubscribe — read-only summary, no fields to edit */}
        {schema?.type === "unsubscribe" && (
          <Section icon={MailX} label="Unsubscribe plan" accent>
            <p className="text-[13px] leading-relaxed text-base-100">
              {schema.matchCount === 0
                ? `No emails found from ${schema.targetCompany}.`
                : schema.method === "not_found"
                  ? `${schema.matchCount} email${schema.matchCount === 1 ? "" : "s"} found from ${schema.targetCompany}, but no unsubscribe link was found on them. Approving will still move them to Trash and block future emails from this sender.`
                  : `${schema.matchCount} email${schema.matchCount === 1 ? "" : "s"} from ${schema.targetCompany} will be unsubscribed (${schema.method?.replace("_", " ")}), moved to Trash, and future emails from this sender will be blocked automatically.`}
            </p>
            {loop.status === "needs_approval" && (
              <ApproveDeclineRow loopId={loop.id} className="mt-3.5" approveLabel="Clear inbox" />
            )}
          </Section>
        )}

        {/* File request — matched Drive file, editable reply before attaching + sending */}
        {schema?.type === "file_share" && (
          <Section icon={FileText} label="Matched file" accent>
            <p className="text-[13px] text-base-200">
              Found <span className="font-medium text-base-50">{schema.fileName}</span> in Drive —
              will be attached to the reply below.
            </p>
            <SendingAsNote googleConnection={googleConnection} />
            <div className="mt-2.5 space-y-2.5">
              <Field label="To">
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
              <Field label="Subject">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
              <Field label="Body">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-md border border-base-700 bg-base-900 px-2.5 py-1.5 text-[13px] leading-relaxed text-base-100 placeholder-base-600 outline-none focus:border-base-500"
                />
              </Field>
            </div>
            {loop.status === "needs_approval" && (
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={handleFileShareApprove}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-emerald/15 px-3 py-1.5 text-[13px] font-medium text-accent-emerald transition-colors hover:bg-accent-emerald/25 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? "Sending…" : "Attach & send"}
                </button>
                <button
                  onClick={() => { declineLoop(loop.id); onClose(); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-base-800 px-3 py-1.5 text-[13px] font-medium text-base-300 transition-colors hover:bg-base-700"
                >
                  Decline
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Legacy plain-text proposed action (orders, calendar tasks) */}
        {!schema && loop.context.proposedAction && (
          <Section icon={Sparkles} label="Proposed action" accent>
            <p className="text-[13px] leading-relaxed text-base-100">
              {loop.context.proposedAction}
            </p>
            {loop.status === "needs_approval" && (
              <ApproveDeclineRow loopId={loop.id} className="mt-3.5" />
            )}
          </Section>
        )}

        <p className="text-right text-[11px] text-base-500">
          Expected state: {loop.expectedState}
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
  accent,
}: {
  icon: typeof FileText;
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3.5",
        accent ? "border-base-700 bg-base-800/50" : "border-base-800 bg-base-850/60",
      )}
    >
      <div
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide",
          accent ? "text-accent-violet" : "text-base-400",
        )}
      >
        <Icon size={12} />
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-base-500">{label}</p>
      {children}
    </div>
  );
}

// Makes explicit which mailbox will actually send this — always the account
// connected on the Connections tab, never whatever Google account was used
// to sign into Otto itself. Those are deliberately separate connections.
function SendingAsNote({ googleConnection }: { googleConnection: { connected: boolean; email?: string | null } | null }) {
  if (!googleConnection?.connected) {
    return (
      <p className="mb-2.5 text-[12px] text-accent-rose">
        No Google account connected — connect one on the Connections tab before approving.
      </p>
    );
  }
  return (
    <p className="mb-2.5 text-[12px] text-base-500">
      Sending as <span className="font-medium text-base-300">{googleConnection.email}</span>
    </p>
  );
}
"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AiProvider, AiProviderKind } from "@/types/gym";

interface PresetOption {
  id: string;
  kind: AiProviderKind;
  label: string;
  base_url: string;
}

const PRESETS: PresetOption[] = [
  {
    id: "gemini",
    kind: "gemini",
    label: "Google Gemini",
    base_url: "https://generativelanguage.googleapis.com/v1beta",
  },
  {
    id: "groq",
    kind: "openai_compat",
    label: "Groq",
    base_url: "https://api.groq.com/openai/v1",
  },
  {
    id: "xai",
    kind: "openai_compat",
    label: "xAI Grok",
    base_url: "https://api.x.ai/v1",
  },
  {
    id: "openrouter",
    kind: "openai_compat",
    label: "OpenRouter",
    base_url: "https://openrouter.ai/api/v1",
  },
  {
    id: "deepseek",
    kind: "openai_compat",
    label: "DeepSeek",
    base_url: "https://api.deepseek.com/v1",
  },
  {
    id: "openai",
    kind: "openai_compat",
    label: "OpenAI",
    base_url: "https://api.openai.com/v1",
  },
  {
    id: "custom",
    kind: "openai_compat",
    label: "Custom (OpenAI-compatible)",
    base_url: "",
  },
];

export interface AiProvidersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gymId: string;
  providers: AiProvider[];
  onReload: () => Promise<void>;
}

async function extractAdminError(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body && typeof body.error === "string") return body.error;
    } catch {
      // fall through
    }
  }
  return error instanceof Error ? error.message : "Request failed";
}

function providerStatus(p: AiProvider): {
  label: string;
  variant: "secondary" | "outline" | "destructive";
} {
  if (!p.enabled) return { label: "Disabled", variant: "outline" };
  const cd = p.cooldown_until ? Date.parse(p.cooldown_until) : 0;
  if (cd > Date.now()) {
    return { label: "Cooling down", variant: "outline" };
  }
  if (p.last_error) {
    return { label: "Error", variant: "destructive" };
  }
  return { label: "Active", variant: "secondary" };
}

/**
 * Owner modal for managing encrypted AI providers (Google Gemini & OpenAI-compatible),
 * testing connections, auto-selecting or overriding models, reordering failover priority,
 * and viewing setup instructions for free keys.
 */
export function AiProvidersDialog({
  open,
  onOpenChange,
  gymId,
  providers,
  onReload,
}: AiProvidersDialogProps) {
  const supabase = createClient();
  const addHeadingId = useId();
  const keyErrorId = useId();
  const baseUrlInputRef = useRef<HTMLInputElement>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const testButtonRef = useRef<HTMLButtonElement>(null);

  const [presetId, setPresetId] = useState("gemini");
  const [label, setLabel] = useState("Google Gemini");
  const [baseUrl, setBaseUrl] = useState(
    "https://generativelanguage.googleapis.com/v1beta",
  );
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testedModels, setTestedModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const activePreset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  function handlePresetChange(nextId: string) {
    setPresetId(nextId);
    const next = PRESETS.find((p) => p.id === nextId) ?? PRESETS[0];
    setLabel(next.id === "custom" ? "Custom AI" : next.label);
    setBaseUrl(next.base_url);
    setTestedModels([]);
    setSelectedModel("");
    setTestError(null);
  }

  async function handleTest() {
    if (testing) return;
    if (presetId === "custom" && !baseUrl.trim()) {
      setTestError("Enter the HTTPS base URL first.");
      baseUrlInputRef.current?.focus();
      return;
    }
    if (!apiKey.trim()) {
      setTestError("Paste an API key first.");
      apiKeyInputRef.current?.focus();
      return;
    }

    setTesting(true);
    setTestError(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-admin", {
        body: {
          action: "test",
          gym_id: gymId,
          kind: activePreset.kind,
          base_url: activePreset.kind === "gemini" ? undefined : baseUrl.trim(),
          api_key: apiKey.trim(),
        },
      });
      if (error || !data?.ok) {
        const msg = await extractAdminError(error, data);
        setTestError(msg);
        setTestedModels([]);
        setSelectedModel("");
        return;
      }
      const models = Array.isArray(data.models) ? (data.models as string[]) : [];
      setTestedModels(models);
      setSelectedModel(typeof data.model === "string" ? data.model : models[0] ?? "");
      toast.success(`Connected! Selected ${data.model}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    if (presetId === "custom" && !baseUrl.trim()) {
      setTestError("Enter the HTTPS base URL first.");
      baseUrlInputRef.current?.focus();
      return;
    }
    if (!apiKey.trim()) {
      setTestError("Paste an API key first.");
      apiKeyInputRef.current?.focus();
      return;
    }
    if (!selectedModel.trim()) {
      setTestError("Click Test first to fetch and select a model.");
      testButtonRef.current?.focus();
      return;
    }

    setSaving(true);
    setTestError(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-admin", {
        body: {
          action: "save",
          gym_id: gymId,
          kind: activePreset.kind,
          label: label.trim() || activePreset.label,
          base_url: activePreset.kind === "gemini" ? null : baseUrl.trim(),
          model: selectedModel.trim(),
          api_key: apiKey.trim(),
          enabled: true,
        },
      });
      if (error || !data?.ok) {
        const msg = await extractAdminError(error, data);
        setTestError(msg);
        return;
      }
      setApiKey("");
      setShowKey(false);
      setTestedModels([]);
      setSelectedModel("");
      await onReload();
      toast.success("AI provider saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(p: AiProvider, nextEnabled: boolean) {
    setBusyId(p.id);
    try {
      const { error } = await supabase.rpc("set_ai_provider", {
        p_id: p.id,
        p_enabled: nextEnabled,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await onReload();
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(idx: number, dir: -1 | 1) {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= providers.length) return;
    const current = providers[idx];
    const swap = providers[targetIdx];
    setBusyId(current.id);
    try {
      const curPri = current.priority;
      const swapPri = swap.priority === curPri ? (dir > 0 ? curPri + 1 : curPri - 1) : swap.priority;
      const [r1, r2] = await Promise.all([
        supabase.rpc("set_ai_provider", { p_id: current.id, p_priority: swapPri }),
        supabase.rpc("set_ai_provider", { p_id: swap.id, p_priority: curPri }),
      ]);
      if (r1.error || r2.error) {
        toast.error(r1.error?.message ?? r2.error?.message ?? "Failed to reorder");
        return;
      }
      await onReload();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(p: AiProvider) {
    setBusyId(p.id);
    try {
      const { error } = await supabase.rpc("delete_ai_provider", { p_id: p.id });
      if (error) {
        toast.error(error.message);
        return;
      }
      await onReload();
      toast.success(`${p.label} removed`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto overscroll-contain data-[side=right]:w-full sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="gap-1.5 border-b p-5 pe-12">
          <SheetTitle>AI providers</SheetTitle>
          <SheetDescription className="text-pretty">
            Keys are stored encrypted on the server and tried in priority order. Members never see your keys.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 p-5">
          {/* Configured providers list */}
          <section className="flex flex-col gap-2.5">
            <h3 className="text-sm font-medium text-foreground text-balance">
              Configured providers ({providers.length})
            </h3>
            {providers.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {providers.map((p, idx) => {
                  const st = providerStatus(p);
                  const isBusy = busyId === p.id;
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 rounded-2xl border bg-secondary/40 p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <Checkbox
                            id={`prov-en-${p.id}`}
                            aria-label={`Enable ${p.label}`}
                            checked={p.enabled}
                            disabled={isBusy}
                            className="mt-0.5"
                            onCheckedChange={(checked) =>
                              void handleToggle(p, checked === true)
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Label
                                htmlFor={`prov-en-${p.id}`}
                                className="text-sm font-medium text-foreground break-words"
                              >
                                {p.label}
                              </Label>
                              <Badge variant={st.variant}>{st.label}</Badge>
                              <span className="font-mono text-xs text-muted-foreground">
                                ...{p.key_hint}
                              </span>
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
                              {p.model}
                            </p>
                            {p.last_error ? (
                              <p className="mt-1 text-xs text-destructive break-words">
                                {p.last_error}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Move ${p.label} up`}
                            disabled={isBusy || idx === 0}
                            className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 touch-manipulation"
                            onClick={() => void handleMove(idx, -1)}
                          >
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Move ${p.label} down`}
                            disabled={isBusy || idx === providers.length - 1}
                            className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 touch-manipulation"
                            onClick={() => void handleMove(idx, 1)}
                          >
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${p.label}`}
                            disabled={isBusy}
                            className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 touch-manipulation"
                            onClick={() => void handleDelete(p)}
                          >
                            <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed bg-secondary/30 p-4 text-xs text-muted-foreground text-pretty">
                No AI providers added yet. Add Google Gemini or Groq below to enable AI workout and diet plans for members.
              </div>
            )}
          </section>

          <Separator />

          {/* Add provider flow */}
          <form
            aria-labelledby={addHeadingId}
            noValidate
            className="flex flex-col gap-3.5"
            onSubmit={(e) => void handleSave(e)}
          >
            <h3 id={addHeadingId} className="text-sm font-medium text-foreground text-balance">
              Add a provider
            </h3>

            {testError ? (
              <div
                id={keyErrorId}
                role="alert"
                className="rounded-xl bg-status-rose-bg px-3 py-2 text-xs font-medium text-status-rose-fg break-words"
              >
                {testError}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-preset">Provider preset</Label>
                <Select name="preset" value={presetId} onValueChange={handlePresetChange}>
                  <SelectTrigger id="ai-preset" className="min-h-11 w-full sm:min-h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-label">Display label</Label>
                <Input
                  id="ai-label"
                  name="label"
                  maxLength={80}
                  enterKeyHint="next"
                  className="min-h-11 sm:min-h-9"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>

            {presetId === "custom" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-base-url">Base URL (HTTPS) *</Label>
                <Input
                  ref={baseUrlInputRef}
                  id="ai-base-url"
                  name="base_url"
                  type="url"
                  dir="ltr"
                  required
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="https://api.example.com/v1"
                  aria-invalid={testError && !baseUrl.trim() ? true : false}
                  aria-describedby={testError && !baseUrl.trim() ? keyErrorId : undefined}
                  className="min-h-11 sm:min-h-9"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    setTestedModels([]);
                    setSelectedModel("");
                    setTestError(null);
                  }}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-key">API key *</Label>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-44 flex-1">
                  <Input
                    ref={apiKeyInputRef}
                    id="ai-key"
                    name="api_key"
                    type={showKey ? "text" : "password"}
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    placeholder="Paste API key…"
                    aria-invalid={testError ? true : false}
                    aria-describedby={testError ? keyErrorId : undefined}
                    className="min-h-11 pe-11 sm:min-h-9"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestError(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-pressed={showKey}
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    className="absolute top-1/2 right-1 -translate-y-1/2 [@media(pointer:coarse)]:min-h-10 [@media(pointer:coarse)]:min-w-10"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
                <Button
                  ref={testButtonRef}
                  type="button"
                  variant="outline"
                  disabled={testing}
                  className="min-h-11 shrink-0 touch-manipulation sm:min-h-9"
                  onClick={() => void handleTest()}
                >
                  <KeyRound className="size-4" aria-hidden="true" />
                  <span>{testing ? "Testing…" : "Test"}</span>
                </Button>
              </div>
            </div>

            {testedModels.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-xl border bg-secondary/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
                  <span>Connection verified ({testedModels.length} models found)</span>
                </div>
                <Label htmlFor="ai-model" className="mt-1 text-xs">
                  Model (auto-selected, override if needed)
                </Label>
                <Select name="model" value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger id="ai-model" className="min-h-11 w-full font-mono text-xs sm:min-h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {testedModels.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={saving}
              className="min-h-11 touch-manipulation sm:min-h-9"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>{saving ? "Saving…" : "Save provider"}</span>
            </Button>
          </form>

          <Separator />

          {/* Native <details> disclosure keeps guide searchable via Find-in-page */}
          <details className="group/guide rounded-2xl border bg-secondary/30 p-3.5">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span>How to get a free key</span>
              <ChevronDown
                className="size-4 shrink-0 transition-transform group-open/guide:rotate-180"
                aria-hidden="true"
              />
            </summary>

            <div className="mt-3 flex flex-col gap-3 text-xs text-muted-foreground text-pretty">
              <div>
                <p className="font-medium text-foreground">Google AI Studio (free):</p>
                <p>
                  Open{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline [overflow-wrap:anywhere]"
                  >
                    aistudio.google.com
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                  , sign in with a Google account → &ldquo;Get API key&rdquo; → &ldquo;Create API key&rdquo; → copy → in the app choose Google Gemini, paste, Test, Save.
                </p>
              </div>

              <div>
                <p className="font-medium text-foreground">Groq (free):</p>
                <p>
                  Open{" "}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline [overflow-wrap:anywhere]"
                  >
                    console.groq.com
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                  , sign up → API Keys → &ldquo;Create API Key&rdquo; → copy → choose Groq, paste, Test, Save.
                </p>
              </div>

              <div>
                <p className="font-medium text-foreground">xAI Grok (paid credits):</p>
                <p>
                  Open{" "}
                  <a
                    href="https://console.x.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline [overflow-wrap:anywhere]"
                  >
                    console.x.ai
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>{" "}
                  → API Keys → create → choose xAI Grok.
                </p>
              </div>

              <p className="rounded-xl bg-background/70 p-2.5 text-foreground">
                Tip: add two providers; the second takes over automatically when the first hits its free limit. Check current rate limits:{" "}
                <a
                  href="https://ai.google.dev/gemini-api/docs/rate-limits"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Gemini limits
                </a>
                {" · "}
                <a
                  href="https://console.groq.com/docs/rate-limits"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Groq limits
                </a>
                {" · "}
                <a
                  href="https://docs.x.ai/docs/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  xAI models
                </a>
                .
              </p>
            </div>
          </details>
        </div>

        <SheetFooter className="border-t p-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 touch-manipulation sm:min-h-9"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

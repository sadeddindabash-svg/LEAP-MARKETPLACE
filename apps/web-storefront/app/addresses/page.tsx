"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/LocLink";
import AddressForm from "@/components/AddressFields";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { createAddress, deleteAddress, fetchMyAddresses, updateAddress, type SavedAddress } from "@/lib/api";
import { MAX_ADDRESSES, EMPTY_ADDRESS, addressPayload, addressProblem, fieldsOf, type AddressFields } from "@/lib/address";
import { countryName } from "@/lib/countries";
import type { DictKey } from "@/lib/i18n";

const button = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";
const PROBLEM_TEXT: Record<string, DictKey> = { fill_every_field: "fill_every_field", country_not_served: "country_not_served", national_address_format: "national_address_format_error" };

// The address book: up to three saved addresses (the server refuses a fourth), one of them the default, added, edited and deleted here exactly as in the mobile app.
export default function AddressesPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [editing, setEditing] = useState<"new" | SavedAddress | null>(null);
  const [fields, setFields] = useState<AddressFields>(EMPTY_ADDRESS);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setAddresses(await fetchMyAddresses(token));
  }, []);
  useEffect(() => {
    if (!user) return;
    let current = true;
    const token = getAuthToken();
    if (token) fetchMyAddresses(token).then((list) => { if (current) setAddresses(list); }).catch(() => { if (current) setAddresses([]); });
    return () => { current = false; };
  }, [user]);

  const run = async (action: () => Promise<void>, ok: string) => {
    setBusy(true); setMessage(null);
    try { await action(); await reload(); setMessage({ kind: "ok", text: ok }); } catch (e) { setMessage({ kind: "error", text: e instanceof Error ? e.message : t("generic_error") }); } finally { setBusy(false); }
  };

  const save = async () => {
    const problem = addressProblem(fields, { needLabel: true });
    if (problem) return setMessage({ kind: "error", text: t(PROBLEM_TEXT[problem]) });
    const token = getAuthToken();
    if (!token) return;
    await run(async () => {
      if (editing && editing !== "new") await updateAddress(token, editing.id, addressPayload(fields));
      else await createAddress(token, addressPayload(fields));
      setEditing(null);
    }, t("address_saved"));
  };

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("addresses")}</h1>
        <p className="mb-5 mt-2 text-lg text-muted">{t("addresses_login_needed")}</p>
        <Link href="/login" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("sign_in")}</Link>
      </div>
    );
  }

  const full = (addresses?.length ?? 0) >= MAX_ADDRESSES;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("addresses")}</h1>
        {!editing && <button type="button" className="inline-flex min-h-11 items-center rounded-[10px] bg-signal px-5 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50" disabled={full} onClick={() => { setFields(EMPTY_ADDRESS); setMessage(null); setEditing("new"); }}>{t("add_address")}</button>}
      </div>
      {full && !editing && <p className="mb-4 text-sm font-semibold text-muted">{t("address_limit_reached")}</p>}
      <p aria-live="polite" role={message?.kind === "error" ? "alert" : "status"} className={`mb-4 text-sm font-semibold ${message?.kind === "error" ? "text-[#a12a21]" : "text-[#0f6b49]"}`}>{message?.text}</p>

      {editing ? (
        <form className="rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <AddressForm idPrefix="ab" value={fields} onChange={setFields} withLabel disabled={busy} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark disabled:opacity-50">{busy ? t("saving") : t("save")}</button>
            <button type="button" className={button} disabled={busy} onClick={() => { setEditing(null); setMessage(null); }}>{t("cancel")}</button>
          </div>
        </form>
      ) : addresses === null ? (
        <p className="text-muted" aria-busy="true">{t("search_loading")}</p>
      ) : addresses.length === 0 ? (
        <p className="text-muted">{t("no_addresses_yet")}</p>
      ) : (
        <ul className="grid gap-3">
          {addresses.map((a) => (
            <li key={a.id} className={`rounded-[14px] border-[1.5px] bg-white p-4 ${a.isDefault ? "border-navy" : "border-line"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-56 flex-1">
                  <p className="flex items-center gap-2 font-bold">{a.label}{a.isDefault && <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-white">{t("default_label")}</span>}</p>
                  <p className="mt-1">{a.recipientName}</p>
                  <p className="text-muted">{a.streetAddress}, {a.city}, {countryName(lang, a.country)}</p>
                  <p className="text-sm text-muted" dir="ltr">{a.phone}</p>
                </div>
                {confirmDelete === a.id ? (
                  <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={t("delete_address_confirm")}>
                    <span className="text-sm font-semibold">{t("delete_address_confirm")}</span>
                    <button type="button" className={button} onClick={() => setConfirmDelete(null)}>{t("cancel")}</button>
                    <button type="button" disabled={busy} className={`${button} !border-[#a12a21] !text-[#a12a21]`} onClick={() => { const token = getAuthToken(); setConfirmDelete(null); if (token) run(() => deleteAddress(token, a.id), t("address_deleted")); }}>{t("delete")}</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={button} disabled={busy} onClick={() => { setFields(fieldsOf(a)); setMessage(null); setEditing(a); }}>{t("edit")}</button>
                    {!a.isDefault && <button type="button" className={button} disabled={busy} onClick={() => { const token = getAuthToken(); if (token) run(async () => { await updateAddress(token, a.id, { isDefault: true }); }, t("address_set_as_default_message")); }}>{t("set_as_default")}</button>}
                    <button type="button" className={`${button} !border-[#a12a21] !text-[#a12a21]`} disabled={busy} onClick={() => setConfirmDelete(a.id)}>{t("delete")}</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

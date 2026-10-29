'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchListingById, searchListings } from '@/services/listingsService';
import { sellerApiErrorMessage } from '@/services/sellerService';
import {
  approvePublicListingVisibility,
  attestPublicListingProperty,
  fetchPublicListingOwnership,
  fetchPublicListingPropertyMapping,
  linkPublicListing,
  reassignPublicListing,
  revokePublicListingVisibility,
  unlinkPublicListing,
  type PropertyMapping,
  type PublicListingOwnershipDetail,
} from '@/services/sellerListingOwnershipService';
import type { ApiListing, PaginatedItems, SellerTransaction } from '@/types/api';

const PAGE_SIZE = 20;
const inputClass = 'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primarycolor focus:ring-1 focus:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-200';
const buttonClass = 'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
const primaryButtonClass = 'rounded-lg bg-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:cursor-not-allowed disabled:opacity-50';

function detailMessage(error: unknown): string {
  const message = sellerApiErrorMessage(error);
  if (/stale/i.test(message)) return `${message} Current revisions were refreshed. Review and confirm the action again.`;
  if (/mapped|mapping|property.*agree|property.*differ|property.*mismatch/i.test(message)) {
    return `${message} Compare the exact canonical property IDs and review the attestation evidence.`;
  }
  if (/belongs to another|conflicting/i.test(message)) return `${message} Use atomic reassignment if the same canonical property is represented by another transaction.`;
  if (/active|off.market|displayable|ineligible/i.test(message)) return `${message} Check the listing and representation status before trying again.`;
  return message;
}

function listingLabel(listing: ApiListing): string {
  const address = [listing.address, listing.unit, listing.city, listing.state, listing.zip]
    .filter(Boolean).join(', ');
  return `${listing.title || 'Untitled listing'} — ${address || listing.id}`;
}

function visibleState(detail: PublicListingOwnershipDetail): string {
  const item = detail.ownership;
  if (!item.listing_id) return 'No public listing is associated.';
  if (item.seller_url_visible) return 'Seller portal URL approved and currently visible.';
  if (item.seller_visibility_approved_at) {
    return `Previously approved, now suspended (${item.suspension_reason ?? 'approval no longer effective'}). A new approval is required after eligibility is restored.`;
  }
  return `Seller portal URL not approved${item.suspension_reason ? ` (${item.suspension_reason})` : ''}.`;
}

function eligibilityState(detail: PublicListingOwnershipDetail): string {
  const item = detail.ownership;
  if (!item.listing_id) return 'No listing association to approve.';
  switch (item.suspension_reason) {
    case 'approval_required': return 'Eligible association; seller URL approval is required.';
    case 'representation_inactive': return 'Ineligible: representation is inactive.';
    case 'listing_missing': return 'Ineligible: the linked listing is missing.';
    case 'listing_ineligible': return 'Ineligible: the listing is off-market, deleted, or not displayable.';
    case 'property_mismatch': return 'Ineligible: the listing and transaction property IDs differ.';
    default: return item.seller_url_visible ? 'Eligible and currently visible.' : 'Eligibility will be checked by the backend at approval.';
  }
}

function auditText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export default function PublicListingAssociation({
  transaction,
  onChanged,
  onClose,
}: {
  transaction: SellerTransaction;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PublicListingOwnershipDetail | null>(null);
  const [currentListing, setCurrentListing] = useState<ApiListing | null>(null);
  const [inventory, setInventory] = useState<PaginatedItems<ApiListing> | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [cityDraft, setCityDraft] = useState('');
  const [city, setCity] = useState('');
  const [selected, setSelected] = useState<ApiListing | null>(null);
  const [mapping, setMapping] = useState<PropertyMapping | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [sourceDetail, setSourceDetail] = useState<PublicListingOwnershipDetail | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const selectionRequest = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [basis, setBasis] = useState('');
  const [evidence, setEvidence] = useState('');
  const [attestReason, setAttestReason] = useState('');
  const [attestConfirmed, setAttestConfirmed] = useState(false);
  const [linkReason, setLinkReason] = useState('');
  const [linkConfirmed, setLinkConfirmed] = useState(false);
  const [unlinkReason, setUnlinkReason] = useState('');
  const [unlinkConfirmed, setUnlinkConfirmed] = useState(false);
  const [moveReason, setMoveReason] = useState('');
  const [moveConfirmed, setMoveConfirmed] = useState(false);
  const [approveReason, setApproveReason] = useState('');
  const [approveConfirmed, setApproveConfirmed] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeConfirmed, setRevokeConfirmed] = useState(false);

  const loadOwnership = useCallback(async () => {
    const result = await fetchPublicListingOwnership(transaction.id);
    setDetail(result);
    setCurrentListing(null);
    if (result.ownership.listing_id) {
      // Ordinary listing reads intentionally omit retired or deleted records.
      // The ownership response still supplies their exact ID and status.
      try {
        const listing = await fetchListingById(result.ownership.listing_id);
        setCurrentListing(listing);
      } catch {
        setCurrentListing(null);
      }
    }
    return result;
  }, [transaction.id]);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const result = await searchListings({
        status: 'active', page: inventoryPage, size: PAGE_SIZE,
        ...(city ? { city } : {}),
      });
      setInventory(result);
    } catch (loadError) {
      setError(detailMessage(loadError));
    } finally {
      setInventoryLoading(false);
    }
  }, [city, inventoryPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOwnership().catch((loadError) => setError(detailMessage(loadError)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOwnership]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  async function chooseListing(listing: ApiListing) {
    const request = ++selectionRequest.current;
    setSelected(listing);
    setMapping(null);
    setMappingLoading(true);
    setError(null);
    setLinkConfirmed(false);
    setAttestConfirmed(false);
    setBasis('');
    setEvidence('');
    setAttestReason('');
    try {
      const result = await fetchPublicListingPropertyMapping(listing.id);
      if (request === selectionRequest.current) setMapping(result);
    } catch (lookupError) {
      if (request === selectionRequest.current) setError(detailMessage(lookupError));
    } finally {
      if (request === selectionRequest.current) setMappingLoading(false);
    }
  }

  async function refreshSelectedMapping() {
    if (!selected) return;
    const result = await fetchPublicListingPropertyMapping(selected.id);
    setMapping(result);
  }

  function clearConfirmations() {
    setAttestConfirmed(false);
    setLinkConfirmed(false);
    setUnlinkConfirmed(false);
    setMoveConfirmed(false);
    setApproveConfirmed(false);
    setRevokeConfirmed(false);
  }

  async function runAction(name: string, action: () => Promise<unknown>, message: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(name);
    setError(null);
    setSuccess(null);
    try {
      await action();
      clearConfirmations();
      setSuccess(message);
      try {
        await loadOwnership();
        if (selected) await refreshSelectedMapping();
        if (sourceDetail) {
          const refreshed = await fetchPublicListingOwnership(sourceDetail.ownership.transaction_id);
          setSourceDetail(refreshed);
        }
        await onChanged();
      } catch (refreshError) {
        setDetail(null);
        setSelected(null);
        setMapping(null);
        setSourceDetail(null);
        setError(`The action completed, but current details could not be refreshed: ${detailMessage(refreshError)} Refresh the page before another action.`);
      }
    } catch (actionError) {
      const response = (actionError as { response?: { status?: number } })?.response;
      if (response?.status === 409) {
        // A stale decision is never retried. Re-read the revision and require
        // another explicit confirmation from the Super Admin.
        clearConfirmations();
        try {
          await loadOwnership();
          if (selected) await refreshSelectedMapping();
          if (sourceDetail) {
            setSourceDetail(await fetchPublicListingOwnership(sourceDetail.ownership.transaction_id));
          }
        } catch {
          // Keep the original backend conflict visible.
        }
      }
      setError(detailMessage(actionError));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function loadSource() {
    if (!sourceId.trim() || sourceId.trim() === transaction.id) {
      setError('Enter a different source transaction ID.');
      return;
    }
    setSourceLoading(true);
    setError(null);
    setSourceDetail(null);
    setMoveConfirmed(false);
    try {
      setSourceDetail(await fetchPublicListingOwnership(sourceId.trim()));
    } catch (lookupError) {
      setError(detailMessage(lookupError));
    } finally {
      setSourceLoading(false);
    }
  }

  const ownership = detail?.ownership;
  const eligibleForApproval = Boolean(
    ownership?.listing_id && ownership.listing_status === 'active' &&
    !ownership.seller_url_visible &&
    (ownership.suspension_reason === 'approval_required' || ownership.suspension_reason === null),
  );
  const mappingMatches = Boolean(
    selected && mapping?.listing_id === selected.id &&
    mapping.property_id === transaction.property_id && mapping.attested_at,
  );

  return (
    <section aria-label="Public listing association" className="space-y-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Public listing association</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Associate an existing public listing with this represented transaction. This does not create or publish a listing, share showings, or approve a seller portal URL.
          </p>
        </div>
        <button type="button" onClick={onClose} className={buttonClass}>Close</button>
      </div>

      <div className="grid gap-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950 sm:grid-cols-2">
        <div><span className="font-semibold">Transaction ID</span><p className="break-all font-mono text-xs">{transaction.id}</p></div>
        <div><span className="font-semibold">Canonical internal property ID</span><p className="break-all font-mono text-xs">{transaction.property_id}</p></div>
        <div><span className="font-semibold">Representation</span><p>{transaction.representation_type ?? 'Not set'} · {transaction.representation_status}</p></div>
        <div><span className="font-semibold">Transaction state</span><p>{transaction.status} · {transaction.stage}</p></div>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        The transaction API supplies the canonical property ID, but not its address. Compare this exact ID with approved brokerage evidence before attesting; listing address text alone is not proof of the mapping.
      </p>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{success}</p>}

      {loading ? <p role="status" className="text-sm text-zinc-500">Loading association…</p> : detail ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <h4 className="font-semibold">Current ownership</h4>
          <p>{ownership?.listing_id ? (currentListing ? listingLabel(currentListing) : 'Listing details are unavailable through the public listing API.') : 'No public listing linked.'}</p>
          {ownership?.listing_id && <p className="break-all font-mono text-xs">Listing ID: {ownership.listing_id}</p>}
          <p>Status: {ownership?.listing_status ?? 'None'} · Ownership revision: {ownership?.revision ?? 0}</p>
          <p>Stored seller URL approval: {ownership?.seller_visibility_approved_at ? 'Approved' : 'None'}</p>
          <p>Effective seller URL visibility: {ownership?.seller_url_visible ? 'Visible' : 'Hidden'}</p>
          <p>Association eligibility: {eligibilityState(detail)}</p>
          <p>{visibleState(detail)}</p>
          {ownership?.seller_visibility_approved_at && <p>Last seller URL approval: {new Date(ownership.seller_visibility_approved_at).toLocaleString()}</p>}
        </div>
      ) : <p className="text-sm text-zinc-500">Association details are unavailable. Refresh before taking action.</p>}

      <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <h4 className="font-semibold">1. Select an existing active public listing</h4>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); setInventoryPage(1); setCity(cityDraft.trim()); }}>
          <label className={labelClass}>Filter by city
            <input className={inputClass} value={cityDraft} onChange={(event) => setCityDraft(event.target.value)} />
          </label>
          <button type="submit" className={buttonClass}>Find listings</button>
        </form>
        {inventoryLoading ? <p className="text-sm text-zinc-500">Loading active listings…</p> : inventory?.items.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">No active public listings match this search. No listing is created here.</p>
        ) : (
          <div className="space-y-2">
            <div role="group" aria-label="Active public listings" className="max-h-64 space-y-1 overflow-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {inventory?.items.map((listing) => (
                <button key={listing.id} type="button" aria-pressed={selected?.id === listing.id}
                  onClick={() => void chooseListing(listing)}
                  className="block w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm hover:bg-zinc-50 aria-pressed:border-primarycolor aria-pressed:bg-pink-50 dark:hover:bg-zinc-800 dark:aria-pressed:bg-zinc-800">
                  <span className="block font-semibold">{listingLabel(listing)}</span>
                  <span className="block break-all font-mono text-xs text-zinc-500">{listing.id}{listing.mls_number ? ` · MLS ${listing.mls_number}` : ''}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <button type="button" className={buttonClass} disabled={inventoryPage <= 1 || inventoryLoading} onClick={() => setInventoryPage((page) => page - 1)}>Previous</button>
              <span>Page {inventoryPage} · {inventory?.total ?? 0} active listings</span>
              <button type="button" className={buttonClass} disabled={!inventory || inventoryPage * PAGE_SIZE >= inventory.total || inventoryLoading} onClick={() => setInventoryPage((page) => page + 1)}>Next</button>
            </div>
          </div>
        )}
        {selected && <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
          <p className="font-semibold">Selected: {listingLabel(selected)}</p>
          <p className="break-all font-mono text-xs">Listing ID: {selected.id}</p>
          {mappingLoading ? <p>Loading property mapping…</p> : mapping ? (
            <p>Attested property: <span className="font-mono text-xs">{mapping.property_id ?? 'None'}</span> · Mapping revision: {mapping.mapping_revision}{mapping.attested_at ? ` · Attested ${new Date(mapping.attested_at).toLocaleString()}` : ''}</p>
          ) : <p>Property mapping could not be loaded. Actions are unavailable.</p>}
          {mapping?.verification_basis && <p>Verification basis: {mapping.verification_basis}</p>}
          {mapping?.evidence_reference && <p>Evidence reference: {mapping.evidence_reference}</p>}
          {mapping && !mappingMatches && <p className="text-amber-800 dark:text-amber-300">This listing is not attested to the transaction’s canonical property. A new Super Admin attestation is required before linking.</p>}
        </div>}
      </div>

      {detail && selected && mapping && <details className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700" open={!mappingMatches}>
        <summary className="cursor-pointer font-semibold">2. Attest exact property mapping</summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">This records your administrative decision after reviewing evidence. The application has not independently authenticated the evidence. Attestation alone does not link the listing or make it visible to the seller.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Verification basis<input className={inputClass} value={basis} onChange={(event) => setBasis(event.target.value)} maxLength={255} /></label>
          <label className={labelClass}>Evidence reference<input className={inputClass} value={evidence} onChange={(event) => setEvidence(event.target.value)} maxLength={1000} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Attestation reason<input className={inputClass} value={attestReason} onChange={(event) => setAttestReason(event.target.value)} maxLength={1000} /></label>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={attestConfirmed} onChange={(event) => setAttestConfirmed(event.target.checked)} />I reviewed evidence for this exact listing and canonical property ID.</label>
        <button type="button" className={`${primaryButtonClass} mt-3`} disabled={Boolean(busy) || mappingLoading}
          onClick={() => {
            if (!basis.trim() || !evidence.trim() || !attestReason.trim() || !attestConfirmed) {
              setError('Enter the verification basis, evidence reference, and reason, then confirm the attestation.');
              return;
            }
            void runAction('attest', () => attestPublicListingProperty(transaction.id, {
              listing_id: selected.id, expected_mapping_revision: mapping.mapping_revision,
              verification_basis: basis.trim(), evidence_reference: evidence.trim(), reason: attestReason.trim(),
            }), 'Property mapping attested. Linking and seller URL approval remain separate actions.');
          }}> {busy === 'attest' ? 'Attesting…' : 'Record property attestation'}</button>
      </details>}

      {detail && selected && <details className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <summary className="cursor-pointer font-semibold">3. Link or replace current public listing</summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Links the selected public listing to this transaction. Seller portal URL visibility still requires separate approval.</p>
        <label className={`${labelClass} mt-3`}>Link or replacement reason<input className={inputClass} value={linkReason} onChange={(event) => setLinkReason(event.target.value)} maxLength={1000} /></label>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={linkConfirmed} onChange={(event) => setLinkConfirmed(event.target.checked)} />I confirm the selected listing ID and transaction property ID. This will replace the current link, if any.</label>
        <button type="button" className={`${primaryButtonClass} mt-3`} disabled={Boolean(busy) || !mappingMatches}
          onClick={() => {
            if (!linkReason.trim() || !linkConfirmed) { setError('Enter a link reason and confirm the exact association.'); return; }
            void runAction('link', () => linkPublicListing(transaction.id, {
              listing_id: selected.id, expected_revision: detail.ownership.revision,
              reason: linkReason.trim(),
            }), 'Public listing linked. The seller portal URL remains unapproved.');
          }}>{busy === 'link' ? 'Linking…' : ownership?.listing_id ? 'Replace public listing' : 'Link public listing'}</button>
      </details>}

      {detail && ownership?.listing_id && <details className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <summary className="cursor-pointer font-semibold">Unlink current public listing</summary>
        <label className={`${labelClass} mt-3`}>Unlink reason<input className={inputClass} value={unlinkReason} onChange={(event) => setUnlinkReason(event.target.value)} maxLength={1000} /></label>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={unlinkConfirmed} onChange={(event) => setUnlinkConfirmed(event.target.checked)} />I confirm removal of this transaction’s current listing association and seller portal URL approval.</label>
        <button type="button" className={`${buttonClass} mt-3`} disabled={Boolean(busy)} onClick={() => {
          if (!unlinkReason.trim() || !unlinkConfirmed) { setError('Enter an unlink reason and confirm removal.'); return; }
          void runAction('unlink', () => unlinkPublicListing(transaction.id, {
            expected_revision: detail.ownership.revision, reason: unlinkReason.trim(),
          }), 'Public listing unlinked. Audit history remains available.');
        }}>{busy === 'unlink' ? 'Unlinking…' : 'Unlink public listing'}</button>
      </details>}

      {detail && <details className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <summary className="cursor-pointer font-semibold">Atomic reassignment from another transaction</summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Use this when another transaction currently owns the listing and both transactions use the same canonical property ID. The backend moves ownership in one transaction and clears the previous seller URL approval.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className={`${labelClass} min-w-64 flex-1`}>Source transaction ID<input className={inputClass} value={sourceId} onChange={(event) => { setSourceId(event.target.value); setSourceDetail(null); setMoveConfirmed(false); }} /></label>
          <button type="button" className={buttonClass} disabled={sourceLoading || Boolean(busy)} onClick={() => void loadSource()}>{sourceLoading ? 'Loading…' : 'Review source ownership'}</button>
        </div>
        {sourceDetail && <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
          <p>Source property ID: <span className="break-all font-mono text-xs">{sourceDetail.ownership.property_id}</span></p>
          <p>Source listing ID: <span className="break-all font-mono text-xs">{sourceDetail.ownership.listing_id ?? 'None'}</span></p>
          <p>Source revision: {sourceDetail.ownership.revision}</p>
          {sourceDetail.ownership.property_id !== transaction.property_id && <p className="text-amber-800 dark:text-amber-300">Canonical property IDs differ. Atomic reassignment is not permitted.</p>}
        </div>}
        {sourceDetail?.ownership.listing_id && <>
          <label className={`${labelClass} mt-3`}>Reassignment reason<input className={inputClass} value={moveReason} onChange={(event) => setMoveReason(event.target.value)} maxLength={1000} /></label>
          <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={moveConfirmed} onChange={(event) => setMoveConfirmed(event.target.checked)} />I confirm the exact source, destination, listing, and canonical property IDs.</label>
          <button type="button" className={`${primaryButtonClass} mt-3`} disabled={Boolean(busy) || sourceDetail.ownership.property_id !== transaction.property_id || Boolean(ownership?.listing_id)} onClick={() => {
            if (!moveReason.trim() || !moveConfirmed) { setError('Enter a reassignment reason and confirm both transactions.'); return; }
            void runAction('reassign', () => reassignPublicListing(transaction.id, {
              listing_id: sourceDetail.ownership.listing_id!, from_transaction_id: sourceDetail.ownership.transaction_id,
              expected_from_revision: sourceDetail.ownership.revision,
              expected_revision: detail.ownership.revision, reason: moveReason.trim(),
            }), 'Ownership reassigned atomically. Seller URL approval must be given separately.');
          }}>{busy === 'reassign' ? 'Reassigning…' : 'Reassign public listing'}</button>
          {ownership?.listing_id && <p className="mt-2 text-xs text-zinc-500">Unlink this transaction’s current listing before accepting an atomic reassignment.</p>}
        </>}
      </details>}

      {detail && <section aria-label="Seller portal URL visibility" className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <h4 className="font-semibold">Seller portal URL visibility</h4>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">This approval controls only whether the represented seller sees a link to an already public listing. It does not publish the listing itself or share buyer showings.</p>
        <p className="text-sm">{visibleState(detail)}</p>
        {ownership?.listing_id && <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <h5 className="font-semibold">Approve seller URL</h5>
            <label className={labelClass}>Approval reason<input className={inputClass} value={approveReason} onChange={(event) => setApproveReason(event.target.value)} maxLength={1000} /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={approveConfirmed} onChange={(event) => setApproveConfirmed(event.target.checked)} />I reviewed this eligible association and approve showing its URL in the seller portal.</label>
            <button type="button" className={primaryButtonClass} disabled={Boolean(busy) || !eligibleForApproval} onClick={() => {
              if (!approveReason.trim() || !approveConfirmed) { setError('Enter an approval reason and confirm seller URL visibility.'); return; }
              void runAction('approve', () => approvePublicListingVisibility(transaction.id, {
                expected_revision: detail.ownership.revision, reason: approveReason.trim(),
              }), 'Seller portal URL approved.');
            }}>{busy === 'approve' ? 'Approving…' : 'Approve seller URL'}</button>
            {!eligibleForApproval && !ownership.seller_url_visible && <p className="text-xs text-amber-800 dark:text-amber-300">The backend must confirm that the listing and representation are eligible before approval.</p>}
          </div>
          <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <h5 className="font-semibold">Revoke seller URL</h5>
            <label className={labelClass}>Revocation reason<input className={inputClass} value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} maxLength={1000} /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={revokeConfirmed} onChange={(event) => setRevokeConfirmed(event.target.checked)} />I confirm immediate revocation of this portal link approval.</label>
            <button type="button" className={buttonClass} disabled={Boolean(busy) || !ownership.seller_visibility_approved_at} onClick={() => {
              if (!revokeReason.trim() || !revokeConfirmed) { setError('Enter a revocation reason and confirm removal of the portal link.'); return; }
              void runAction('revoke', () => revokePublicListingVisibility(transaction.id, {
                expected_revision: detail.ownership.revision, reason: revokeReason.trim(),
              }), 'Seller portal URL approval revoked.');
            }}>{busy === 'revoke' ? 'Revoking…' : 'Revoke seller URL'}</button>
            <p className="text-xs text-zinc-500">Revocation removes the portal link. It cannot erase a public URL someone previously copied.</p>
          </div>
        </div>}
      </section>}

      {detail && <details className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <summary className="cursor-pointer font-semibold">Ownership audit history ({detail.history.length})</summary>
        {detail.history.length === 0 ? <p className="mt-2 text-sm text-zinc-500">No ownership events recorded.</p> : (
          <ol className="mt-3 max-h-64 space-y-2 overflow-auto text-xs">
            {detail.history.map((event, index) => <li key={`${event.occurred_at}-${index}`} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950">
              <span className="font-semibold">{event.action.replace('seller_listing_ownership.', '').replaceAll('_', ' ')}</span>
              <span> · {new Date(event.occurred_at).toLocaleString()}</span>
              {auditText(event.event_metadata?.reason) && <span> · Reason: {auditText(event.event_metadata?.reason)}</span>}
              {auditText(event.new_value?.public_listing_id) && <span> · Listing: {auditText(event.new_value?.public_listing_id)}</span>}
            </li>)}
          </ol>
        )}
      </details>}
    </section>
  );
}

/**
 * What the BUYER is told about a part the hub found a problem with (patch-buyer-fault-tracking): plain steps for the tracking timeline and one
 * outcome for the order page. Never the supplier, the hub's notes, the return to the supplier or who pays.
 *   checking     the hub flagged it; Leap is deciding
 *   problem      Leap confirmed the fault; a refund or a replacement is being arranged
 *   replaced     a free replacement order was created (replacementOrderId)
 *   refunding / refunded   the refund (refundAmount, USD)
 *   closed       the case was closed by hand
 * A flag that turned out to be nothing ("continue processing") gives "no problem found" and no outcome: the normal steps carry on.
 */
const L = {
  checking: { en: 'Our inspection team is checking this part', ar: 'يقوم فريق الفحص لدينا بفحص هذه القطعة' },
  noProblem: { en: 'Inspection complete: no problem found. Your part continues on its way', ar: 'اكتمل الفحص: لا توجد أي مشكلة، وتواصل قطعتك طريقها إليك' },
  problem: { en: 'Our inspection found a problem with this part. We will replace it or refund you', ar: 'وجد الفحص مشكلة في هذه القطعة. سنستبدلها أو نعيد لك المبلغ' },
  replaced: (id) => ({ en: `We are sending you a new part at no charge: order ${id}`, ar: `سنرسل لك قطعة جديدة مجانًا: الطلب ${id}` }),
  refunding: (a) => ({ en: `Your refund of $${a} is being processed`, ar: `جارٍ معالجة استرداد ${a}$` }),
  refunded: (a) => ({ en: `Refunded $${a}`, ar: `تم استرداد ${a}$` }),
  closed: { en: 'This case is closed', ar: 'تم إغلاق هذه الحالة' },
};
const money = (n) => Number(n || 0).toFixed(2);

async function faultStory(q, subOrderId, shipment, lang = 'en') {
  const language = lang === 'ar' ? 'ar' : 'en';
  const milestones = [];
  if (!shipment) return { milestones, outcome: null };
  const { rows: flags } = await q.query("SELECT created_at FROM hub_shipment_events WHERE shipment_id = $1 AND step = 'flagged' ORDER BY created_at ASC LIMIT 1", [shipment.id]);
  const { rows: [fc] } = await q.query('SELECT * FROM fault_cases WHERE sub_order_id = $1 ORDER BY created_at DESC LIMIT 1', [subOrderId]);
  if (!flags.length && !fc) return { milestones, outcome: null };
  const push = (time, text, kind) => { if (time) milestones.push({ time, description: text[language], kind, location: null, source: 'leap' }); };
  if (flags.length) push(flags[0].created_at, L.checking, 'inspection_check');
  if (!fc) {
    if (shipment.resolution === 'continue_processing') { push(shipment.resolved_at, L.noProblem, 'inspection_ok'); return { milestones, outcome: null }; }
    if (shipment.resolved_at) { push(shipment.resolved_at, L.closed, 'case_closed'); return { milestones, outcome: { state: 'closed' } }; }
    return { milestones, outcome: { state: 'checking' } };
  }
  push(fc.created_at, L.problem, 'problem_found');
  const after = (t) => { const base = new Date(fc.created_at).getTime() + 1000; const v = t ? new Date(t).getTime() : base; return new Date(Math.max(v, base)).toISOString(); };      // always after "problem found"
  if (fc.outcome === 'replacement' && fc.replacement_order_id) {
    push(after(fc.replacement_created_at || fc.updated_at), L.replaced(fc.replacement_order_id), 'replaced');
    return { milestones, outcome: { state: 'replaced', replacementOrderId: fc.replacement_order_id } };
  }
  if (fc.outcome === 'refund') {
    const amount = money(fc.refund_amount);
    if (fc.refunded_at || fc.refund_status === 'issued') {
      push(after(fc.refunded_at || fc.updated_at), L.refunded(amount), 'refunded');
      return { milestones, outcome: { state: 'refunded', refundAmount: Number(amount) } };
    }
    push(after(fc.updated_at), L.refunding(amount), 'refunding');
    return { milestones, outcome: { state: 'refunding', refundAmount: Number(amount) } };
  }
  if (fc.status === 'completed') { push(after(fc.completed_at || fc.updated_at), L.closed, 'case_closed'); return { milestones, outcome: { state: 'closed' } }; }
  return { milestones, outcome: { state: 'problem' } };
}

module.exports = { faultStory };

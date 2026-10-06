/**
 * Every notification a BUYER can receive, as { title, body, titleAr, bodyAr } (migration 093).
 *
 * Each builder returns the English and the Arabic text together, so a call site cannot add a notification and forget the Arabic,
 * and the whole set can be tested without triggering each event. Call sites spread the result into createNotification():
 *
 *     await createNotification({ userId, type: 'order_status', ...messages.orderDelivered(orderId), linkType: 'order', linkId: orderId });
 *
 * The English wording is exactly what these notifications said before they had an Arabic version. The Arabic uses the same words the mobile app
 * already uses for statuses ("المفضلة" for the wishlist, the return statuses, and so on). Text a person typed (a support reply, a saved search's
 * label) is passed through unchanged, because it cannot be translated.
 *
 * NOT here: notifications sent to SUPPLIERS (low stock, a cancelled order, messages from Leap, verification, "can you replace?"). Suppliers use the
 * Chinese / English portal, so they stay English until that portal gets its own language support.
 */
const { arabicYearsDuration, arabicNewResults, arabicReturnStatus } = require('./i18n');

const plural = (n) => (n === 1 ? '' : 's');

// ---- orders ----

function orderShipped(orderId, trackingNumber) {
  return {
    title: 'Your order has shipped',
    body: `Order ${orderId} is on its way to you. Tracking number: ${trackingNumber}`,
    titleAr: 'تم شحن طلبك',
    bodyAr: `طلبك ${orderId} في طريقه إليك. رقم التتبع: ${trackingNumber}`,
  };
}

function orderDelivered(orderId) {
  return {
    title: 'Your order has been delivered',
    body: `Order ${orderId} is now delivered.`,
    titleAr: 'تم تسليم طلبك',
    bodyAr: `تم تسليم الطلب ${orderId}.`,
  };
}

// The SUPPLIER has sent the order to Leap's inspection hub (not yet to the buyer).
function orderToInspectionHub(orderId) {
  return {
    title: 'Your order is on its way to our inspection hub',
    body: `Order ${orderId} has been sent by the supplier to our inspection hub. We will tell you when it ships to you.`,
    titleAr: 'طلبك في طريقه إلى مركز الفحص لدينا',
    bodyAr: `قام المورّد بإرسال الطلب ${orderId} إلى مركز الفحص لدينا. سنخبرك عند شحنه إليك.`,
  };
}

function orderDelayed(orderId) {
  return {
    title: 'Your order is taking longer than expected',
    body: `Order ${orderId} hasn't had an update in a while. We're keeping an eye on it.`,
    titleAr: 'طلبك يستغرق وقتًا أطول من المتوقع',
    bodyAr: `لم يطرأ أي تحديث على الطلب ${orderId} منذ فترة. نحن نتابعه عن كثب.`,
  };
}

// ---- returns ----

// `status` is the return case's new status, or null when only something about the case changed.
// (The English body keeps printing the raw status, exactly as it always has.)
function returnUpdated(caseId, status) {
  return {
    title: 'Your return request was updated',
    body: status ? `Return ${caseId} is now ${status}.` : `There is an update on return ${caseId}.`,
    titleAr: 'تم تحديث طلب الإرجاع الخاص بك',
    bodyAr: status ? `أصبحت حالة الإرجاع ${caseId}: ${arabicReturnStatus(status)}.` : `هناك تحديث بشأن الإرجاع ${caseId}.`,
  };
}

// A message the fault-case flow also posts into the buyer's return-case thread: { en, ar } becomes a notification
// carrying each language separately (the thread itself shows both languages together).
function returnCaseMessage({ en, ar }) {
  return {
    title: 'Your return request was updated',
    body: en,
    titleAr: 'تم تحديث طلب الإرجاع الخاص بك',
    bodyAr: ar,
  };
}

// ---- account, wishlist, searches, rewards, support ----

function accountAnniversary(years) {
  const titleAr = years === 1 ? 'مرّ عام على انضمامك إلى ليب!'
    : years === 2 ? 'مرّ عامان على انضمامك إلى ليب!'
    : years <= 10 ? `مرّت ${years} أعوام على انضمامك إلى ليب!`
    : `مرّ ${years} عامًا على انضمامك إلى ليب!`;
  return {
    title: `Happy ${years} year${plural(years)} with LEAP!`,
    body: `Thanks for being with us for ${years} year${plural(years)}. We appreciate you.`,
    titleAr,
    bodyAr: `شكرًا لبقائك معنا لمدة ${arabicYearsDuration(years)}. نقدّر ثقتك بنا.`,
  };
}

// `nameAr` is the product's Arabic name when it has one; otherwise the Arabic text carries the English name.
function priceDrop({ name, nameAr, price, was }) {
  return {
    title: 'Price drop on a wishlist item',
    body: `${name} dropped to $${price.toFixed(2)} (was $${was.toFixed(2)}).`,
    titleAr: 'انخفاض سعر منتج في المفضلة',
    bodyAr: `انخفض سعر ${nameAr || name} إلى $${price.toFixed(2)} (كان $${was.toFixed(2)}).`,
  };
}

function backInStock({ name, nameAr }) {
  return {
    title: 'Back in stock',
    body: `${name} is back in stock.`,
    titleAr: 'عاد للتوفر',
    bodyAr: `${nameAr || name} متوفر الآن مرة أخرى.`,
  };
}

// `matchNames` is the first few matching product names (already cut to 3); `total` is how many matched in all.
function savedSearchMatch({ label, total, matchNames }) {
  const more = total > matchNames.length ? '…' : '';
  const list = matchNames.join(', ');
  return {
    title: 'New results for a saved search',
    body: `"${label}" has ${total} new match${total === 1 ? '' : 'es'}: ${list}${more}`,
    titleAr: 'نتائج جديدة لبحثك المحفوظ',
    bodyAr: `يوجد ${arabicNewResults(total)} في "${label}": ${list}${more}`,
  };
}

function referralReward(code, percent) {
  return {
    title: 'You earned a referral reward!',
    body: `Someone you referred placed their first order. Use code ${code} for ${percent}% off your next order.`,
    titleAr: 'حصلت على مكافأة إحالة!',
    bodyAr: `قام شخص دعوته بتقديم أول طلب له. استخدم الرمز ${code} للحصول على خصم ${percent}% على طلبك القادم.`,
  };
}

// The reply itself is whatever the admin wrote, so only the title is translated.
function ticketReply(subject, message) {
  const body = `"${subject}": ${message}`;
  return { title: 'New reply on your support ticket', body, titleAr: 'رد جديد على تذكرة الدعم الخاصة بك', bodyAr: body };
}

module.exports = {
  orderShipped, orderDelivered, orderToInspectionHub, orderDelayed,
  returnUpdated, returnCaseMessage,
  accountAnniversary, priceDrop, backInStock, savedSearchMatch, referralReward, ticketReply,
};

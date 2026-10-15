// The server writes every error in English. This puts the ones a buyer can really meet into Arabic, with the SAME list the mobile app uses (generated from
// apps/mobile/lib/core/server_messages.dart; a test compares the two, so they cannot drift apart). A message that is not in the list stays English (never blank).
import type { Lang } from "./i18n";

export const SERVER_MESSAGES_AR: Record<string, string> = {
  "Invalid email or password": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  "Invalid login attempt": "محاولة تسجيل دخول غير صالحة",
  "email and password are required": "البريد الإلكتروني وكلمة المرور مطلوبان",
  "password is required": "كلمة المرور مطلوبة",
  "password is required to confirm deletion": "كلمة المرور مطلوبة لتأكيد الحذف",
  "currentPassword is required": "كلمة المرور الحالية مطلوبة",
  "Current password is incorrect": "كلمة المرور الحالية غير صحيحة",
  "The current password is not right": "كلمة المرور الحالية غير صحيحة",
  "Incorrect password": "كلمة المرور غير صحيحة",
  "Password must be at least 8 characters": "يجب ألا تقل كلمة المرور عن 8 أحرف",
  "newPassword must be at least 8 characters": "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف",
  "newPassword is too long": "كلمة المرور الجديدة طويلة جدًا",
  "Choose a new password that is different from the current one": "اختر كلمة مرور جديدة مختلفة عن الحالية",
  "An account with this email already exists": "يوجد حساب بهذا البريد الإلكتروني بالفعل",
  "That email is already in use by another account": "هذا البريد الإلكتروني مستخدم في حساب آخر",
  "That is already your current email": "هذا هو بريدك الإلكتروني الحالي بالفعل",
  "A valid email is required": "يلزم إدخال بريد إلكتروني صحيح",
  "A valid newEmail is required": "يلزم إدخال بريد إلكتروني جديد صحيح",
  "This account has no password set yet. Use the account-setup link sent after your order, or sign up.": "لم يتم تعيين كلمة مرور لهذا الحساب بعد. استخدم رابط إعداد الحساب المرسل بعد طلبك، أو أنشئ حسابًا.",
  "Invalid or expired reset link": "رابط إعادة التعيين غير صالح أو منتهي الصلاحية",
  "This reset link has already been used": "تم استخدام رابط إعادة التعيين هذا من قبل",
  "This reset link has expired": "انتهت صلاحية رابط إعادة التعيين هذا",
  "User not found": "المستخدم غير موجود",
  "You can only view your own profile": "يمكنك فقط عرض ملفك الشخصي",
  "code is required": "الرمز مطلوب",
  "Incorrect authenticator code. Please try again.": "رمز المصادقة غير صحيح. يرجى المحاولة مرة أخرى.",
  "Incorrect code. Please check your authenticator app and try again.": "الرمز غير صحيح. تحقق من تطبيق المصادقة وحاول مرة أخرى.",
  "No real 2FA setup is currently in progress. Start setup again.": "لا يوجد إعداد للمصادقة الثنائية قيد التنفيذ حاليًا. ابدأ الإعداد من جديد.",
  "Order not found": "الطلب غير موجود",
  "Sub-order not found": "جزء الطلب غير موجود",
  "Sub-order not found on this order": "جزء الطلب غير موجود في هذا الطلب",
  "This order is already cancelled.": "تم إلغاء هذا الطلب بالفعل.",
  "This order can no longer be cancelled — at least one part has already shipped. Contact support for help instead.": "لا يمكن إلغاء هذا الطلب بعد الآن — تم شحن جزء واحد على الأقل. تواصل مع الدعم للمساعدة.",
  "This part has already shipped and can no longer be cancelled. Contact support for help instead.": "تم شحن هذا الجزء ولم يعد بالإمكان إلغاؤه. تواصل مع الدعم للمساعدة.",
  "A replacement order is free of charge and cannot be cancelled. Contact support if you no longer need it.": "طلب الاستبدال مجاني ولا يمكن إلغاؤه. تواصل مع الدعم إن لم تعد بحاجة إليه.",
  "This order has no delivery address yet.": "لا يوجد عنوان توصيل لهذا الطلب بعد.",
  "This order was not placed with that email": "لم يتم إجراء هذا الطلب بهذا البريد الإلكتروني",
  "A shipping address (or a saved addressId) is required to place an order.": "عنوان الشحن (أو عنوان محفوظ) مطلوب لإتمام الطلب.",
  "That saved address was not found on your account.": "لم يتم العثور على هذا العنوان المحفوظ في حسابك.",
  "address is required": "العنوان مطلوب",
  "items is required and must be non-empty": "يجب أن تحتوي السلة على منتج واحد على الأقل",
  "Address not found": "العنوان غير موجود",
  "Amazon Payment Services is not configured. Set it up in the admin portal's Payment Providers page.": "خدمة الدفع هذه غير متاحة حاليًا. يرجى اختيار طريقة دفع أخرى.",
  "PayPal is not configured.": "خدمة الدفع هذه غير متاحة حاليًا. يرجى اختيار طريقة دفع أخرى.",
  "PayPal is not configured. Set it up in the admin portal's Payment Providers page.": "خدمة الدفع هذه غير متاحة حاليًا. يرجى اختيار طريقة دفع أخرى.",
  "Stripe is not configured. Set it up in the admin portal's Payment Providers page.": "خدمة الدفع هذه غير متاحة حاليًا. يرجى اختيار طريقة دفع أخرى.",
  "Request not found": "الطلب غير موجود",
  "Item not found": "المنتج غير موجود",
  "This quote has expired": "انتهت صلاحية هذا العرض",
  "Add at least one item before submitting": "أضف منتجًا واحدًا على الأقل قبل الإرسال",
  "A request can only be cancelled before it has been quoted": "لا يمكن إلغاء الطلب إلا قبل تسعيره",
  "Only a draft request can be submitted": "لا يمكن إرسال إلا الطلب الذي هو مسودة",
  "Only a quoted request can be ordered": "لا يمكن طلب إلا ما تم تسعيره",
  "Only a submitted request can be quoted": "لا يمكن تسعير إلا الطلب المُرسل",
  "Items can only be added while the request is still a draft": "لا يمكن إضافة منتجات إلا والطلب لا يزال مسودة",
  "Items can only be edited while the request is a draft or already quoted": "لا يمكن تعديل المنتجات إلا والطلب مسودة أو تم تسعيره",
  "Items can only be removed while the request is a draft or already quoted": "لا يمكن حذف المنتجات إلا والطلب مسودة أو تم تسعيره",
  "Only quantity can be changed once a request has been quoted": "لا يمكن تغيير سوى الكمية بعد تسعير الطلب",
  "No items are ready to order yet -- they may still be pending review": "لا توجد منتجات جاهزة للطلب بعد — قد تكون لا تزال قيد المراجعة",
  "name is required": "الاسم مطلوب",
  "year is required": "السنة مطلوبة",
  "Ticket not found": "التذكرة غير موجودة",
  "Return case not found": "حالة الإرجاع غير موجودة",
  "Feedback can only be given once this ticket is resolved.": "لا يمكن إرسال التقييم إلا بعد حل هذه التذكرة.",
  "helpful (true or false) is required": "يرجى تحديد ما إذا كان الرد مفيدًا",
  "subject and message are required": "الموضوع والرسالة مطلوبان",
  "message is required": "الرسالة مطلوبة",
  "description is required": "الوصف مطلوب",
  "subOrderId, reason, and message are required": "السبب والرسالة مطلوبان",
  "guestEmail is required when not logged in": "البريد الإلكتروني مطلوب عند عدم تسجيل الدخول",
  "Review not found": "التقييم غير موجود",
  "Only buyers who have received this product can leave a review.": "يمكن فقط للمشترين الذين استلموا هذا المنتج كتابة تقييم.",
  "productId and an integer rating (1-5) are required": "يلزم اختيار تقييم من 1 إلى 5",
  "A short reason is required to report a review.": "يلزم ذكر سبب مختصر للإبلاغ عن التقييم.",
  "Product not found": "المنتج غير موجود",
  "Saved vehicle not found": "السيارة المحفوظة غير موجودة",
  "Vehicle generation not found in the reference catalog": "لم يتم العثور على هذه السيارة في الكتالوج",
  "Saved search not found": "البحث المحفوظ غير موجود",
  "A real label is required (e.g. what this search means to you).": "الاسم مطلوب (مثلًا: ماذا يعني هذا البحث لك).",
  "Provide at least one of searchTerm or category to save a real search.": "أدخل كلمة بحث أو اختر فئة على الأقل لحفظ البحث.",
  "Notification not found": "الإشعار غير موجود",
  "No internet connection. Check your network and try again.": "لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.",
  "The request took too long to respond. Check your connection and try again.": "استغرق الطلب وقتًا طويلًا. تحقق من اتصالك وحاول مرة أخرى.",
  "A VIN is always 17 characters — please check and try again.": "رقم الهيكل (VIN) مكوّن من 17 حرفًا دائمًا — يرجى التحقق والمحاولة مرة أخرى.",
  "This VIN could not be recognized. Try entering your vehicle manually instead.": "تعذّر التعرّف على رقم الهيكل هذا. جرّب إدخال سيارتك يدويًا.",
};

/** The Arabic for a message, or the message itself when it has none: the exact messages first, then the generic "Failed to load orders (500)" family. */
export function localizeServerMessage(message: string): string {
  const text = message.trim();
  const exact = SERVER_MESSAGES_AR[text];
  if (exact !== undefined) return exact;
  const reach = /^Could not reach the server: ([\s\S]*)$/.exec(text);
  if (reach) return `تعذّر الوصول إلى الخادم: ${reach[1]}`;
  const failed = /^(?:Failed to|Could not|Search failed|Session expired)[^(]*\((\d{3})\)$/.exec(text);
  if (failed) return `حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى. (${failed[1]})`;
  return message;
}

// The language errors are written in. Set by the page (LangProvider) because an error is made deep inside an API call, where no component is in reach: the same idea as
// the mobile app's LanguageState.arabicNow.
let errorLang: Lang = "en";
export const setErrorLanguage = (lang: Lang): void => { errorLang = lang; };

/** A server message in the page's language (English is returned untouched). Used wherever an API call turns a failed reply into an error. */
export function apiMessage(message: string | null | undefined): string {
  if (!message) return "";
  return errorLang === "ar" ? localizeServerMessage(message) : message;
}

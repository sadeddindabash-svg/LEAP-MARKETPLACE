import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import 'language_state.dart';

/// Full app-wide bilingual string lookup, extending the product page's
/// localization (see LanguageState's header comment on the original,
/// narrower scope) to every screen's static UI chrome — nav titles,
/// buttons, empty/error states, form labels.
///
/// DELIBERATE ARCHITECTURE CHOICE: hand-written lookup rather than
/// Flutter's official `intl`/.arb + `flutter gen-l10n` pipeline. That's
/// the more "correct" production approach, but `flutter gen-l10n` needs
/// the real Flutter SDK to generate the delegate class — unavailable in
/// this sandbox (see the mobile README's "Status" section on why this
/// codebase's compile/run verification happens outside this
/// environment). This lookup is 100% real, hand-maintained Dart —
/// nothing here is a stub — just a pragmatic substitute for tooling this
/// environment can't run, matching the same reasoning behind other
/// pragmatic choices in this project (e.g. the pricing engine's manual
/// FX rate instead of a live provider).
///
/// Usage: `tr(context, 'key')`. A missing key returns the key itself
/// (visibly wrong, not silently blank) so a missed translation is easy
/// to spot rather than easy to miss.
class AppStrings {
  AppStrings._();

  static const Map<String, Map<String, String>> _strings = {
    // ---- Home ----
    'search_hint': {'en': 'Search part, brand, or number', 'ar': 'ابحث عن قطعة أو ماركة أو رقم'},
    'shopping_for': {'en': 'Shopping for', 'ar': 'التسوق لأجل'},
    'shop_by_category': {'en': 'Shop by category', 'ar': 'تسوق حسب الفئة'},
    'cat_brake': {'en': 'Brake System', 'ar': 'نظام الفرامل'},
    'cat_engine': {'en': 'Engine', 'ar': 'المحرك'},
    'cat_electrical': {'en': 'Electrical', 'ar': 'كهرباء'},
    'cat_filters': {'en': 'Filters', 'ar': 'الفلاتر'},
    'cat_suspension': {'en': 'Suspension', 'ar': 'نظام التعليق'},
    'cat_lighting': {'en': 'Lighting', 'ar': 'الإضاءة'},

    // ---- Bottom nav (RootShell) ----
    'nav_home': {'en': 'Home', 'ar': 'الرئيسية'},
    'nav_shop': {'en': 'Shop', 'ar': 'تسوق'},
    'nav_cart': {'en': 'Cart', 'ar': 'السلة'},
    'nav_orders': {'en': 'Orders', 'ar': 'الطلبات'},
    'nav_account': {'en': 'Account', 'ar': 'الحساب'},

    // ---- Order/shipment statuses -- shown wherever a raw status string
    // from the backend is displayed (orders list, order detail). The
    // backend's actual values (to_ship, shipped, delivered, etc.) are
    // stable identifiers, not display text -- these map each one to a
    // real bilingual label rather than showing the raw snake_case value.
    'status_to_ship': {'en': 'To ship', 'ar': 'قيد الشحن'},
    'status_pending': {'en': 'Pending', 'ar': 'قيد الانتظار'},
    'status_preparing': {'en': 'Preparing', 'ar': 'قيد التحضير'},
    'status_shipped': {'en': 'Shipped', 'ar': 'تم الشحن'},
    'status_delivered': {'en': 'Delivered', 'ar': 'تم التسليم'},
    'status_dispute': {'en': 'Dispute', 'ar': 'نزاع'},
    'status_cancelled': {'en': 'Cancelled', 'ar': 'ملغى'},
    'status_open': {'en': 'Open', 'ar': 'مفتوحة'},
    'status_in_progress': {'en': 'In progress', 'ar': 'قيد التنفيذ'},
    'status_resolved': {'en': 'Resolved', 'ar': 'تم الحل'},
    'status_closed': {'en': 'Closed', 'ar': 'مغلقة'},

    // ---- Return case statuses (return_cases.status — see
    // services/api/src/modules/returns/routes.js's PATCH /:id for the
    // full real set: awaiting, in_progress, approved, rejected,
    // completed. 'in_progress' reuses the key already defined above for
    // support tickets, same real status word either way.)
    'status_awaiting': {'en': 'Awaiting review', 'ar': 'قيد المراجعة'},
    'status_approved': {'en': 'Approved', 'ar': 'موافق عليه'},
    'status_rejected': {'en': 'Rejected', 'ar': 'مرفوض'},
    'status_completed': {'en': 'Completed', 'ar': 'مكتمل'},

    'status_returns': {'en': 'Returns', 'ar': 'المرتجعات'},
    'tab_all': {'en': 'All', 'ar': 'الكل'},

    // ---- Category ----
    'could_not_load_products': {'en': 'Could not load products.', 'ar': 'تعذر تحميل المنتجات.'},
    'no_products_in_category': {'en': 'No products in this category yet.', 'ar': 'لا توجد منتجات في هذه الفئة بعد.'},
    'all_categories': {'en': 'All categories', 'ar': 'جميع الفئات'},
    'no_parts_in_category': {'en': 'No parts in this category yet.', 'ar': 'لا توجد قطع في هذه الفئة بعد.'},

    // ---- Home feed filter + product card (new) ----
    'filter_newest': {'en': 'Newest', 'ar': 'الأحدث'},
    'filter_my_car': {'en': 'My car', 'ar': 'سيارتي'},
    'in_stock': {'en': 'In stock', 'ar': 'متوفر'},
    'no_reviews_yet': {'en': 'No reviews yet', 'ar': 'لا توجد تقييمات بعد'},

    // ---- Notifications (new) ----
    'notifications': {'en': 'Notifications', 'ar': 'الإشعارات'},
    'no_notifications_yet': {'en': "You're all caught up.", 'ar': 'أنت على اطلاع بكل شيء.'},
    'mark_all_read': {'en': 'Mark all read', 'ar': 'وضع علامة على الكل كمقروء'},

    // ---- Promo codes at checkout (new) ----
    'promo_code_field': {'en': 'Promo code', 'ar': 'رمز الخصم'},
    'apply': {'en': 'Apply', 'ar': 'تطبيق'},
    'remove': {'en': 'Remove', 'ar': 'إزالة'},
    'promo_applied': {'en': 'Applied!', 'ar': 'تم التطبيق!'},
    'subtotal': {'en': 'Subtotal', 'ar': 'المجموع الفرعي'},
    'discount': {'en': 'Discount', 'ar': 'الخصم'},

    // ---- Referrals (new) ----
    'referrals': {'en': 'Refer a friend', 'ar': 'ادعُ صديقًا'},
    'your_referral_code': {'en': 'Your referral code', 'ar': 'رمز الإحالة الخاص بك'},
    'referral_explainer': {'en': 'Share your code. When someone you refer places their first order, you get a real 10% off coupon.', 'ar': 'شارك رمزك. عندما يقوم شخص أحلته بإجراء طلبه الأول، تحصل على كوبون خصم حقيقي بنسبة 10%.'},
    'people_referred': {'en': 'People referred', 'ar': 'الأشخاص المُحالون'},
    'rewards_earned': {'en': 'Rewards earned', 'ar': 'المكافآت المكتسبة'},
    'referral_cap_reached': {'en': "You've reached the maximum number of referral rewards.", 'ar': 'لقد وصلت إلى الحد الأقصى لمكافآت الإحالة.'},
    'copy_code': {'en': 'Copy code', 'ar': 'نسخ الرمز'},
    'code_copied': {'en': 'Code copied!', 'ar': 'تم نسخ الرمز!'},
    'referral_code_optional': {'en': 'Referral code (optional)', 'ar': 'رمز الإحالة (اختياري)'},
    'out_of_stock': {'en': 'Out of stock', 'ar': 'غير متوفر'},
    'add_a_vehicle_for_my_car_filter': {'en': 'Add a vehicle to see products for your car', 'ar': 'أضف مركبة لرؤية المنتجات المناسبة لسيارتك'},
    'no_products_yet': {'en': 'No products yet.', 'ar': 'لا توجد منتجات بعد.'},
    'added_to_cart': {'en': 'Added to cart', 'ar': 'أضيف إلى السلة'},

    // ---- Shared ----
    'log_in': {'en': 'Log in', 'ar': 'تسجيل الدخول'},
    'sign_up': {'en': 'Sign up', 'ar': 'إنشاء حساب'},
    'retry': {'en': 'Retry', 'ar': 'إعادة المحاولة'},
    'something_went_wrong': {'en': 'Something went wrong. Please try again.', 'ar': 'حدث خطأ ما. يرجى المحاولة مرة أخرى.'},
    'please_fill_both_fields': {'en': 'Please fill in both fields.', 'ar': 'يرجى تعبئة كلا الحقلين.'},

    // ---- Garage ----
    'my_garage': {'en': 'My Garage', 'ar': 'مركبتي'},
    'garage_login_prompt': {'en': 'Log in to save vehicles and get fitment-confirmed parts.', 'ar': 'سجّل الدخول لحفظ مركباتك والحصول على قطع مؤكدة التوافق.'},
    'could_not_load_garage': {'en': 'Could not load your garage:', 'ar': 'تعذر تحميل مركباتك:'},
    'add_a_vehicle': {'en': 'Add a vehicle', 'ar': 'أضف مركبة'},

    // ---- Add vehicle ----
    'choose_a_make': {'en': 'Choose a make', 'ar': 'اختر الماركة'},
    'could_not_load_makes': {'en': 'Could not load makes:', 'ar': 'تعذر تحميل الماركات:'},
    'could_not_load_vehicles': {'en': 'Could not load vehicles:', 'ar': 'تعذر تحميل المركبات:'},
    'no_vehicles_for_make': {'en': 'No vehicles found for this make.', 'ar': 'لم يتم العثور على مركبات لهذه الماركة.'},

    // ---- Cart ----
    'basket': {'en': 'Basket', 'ar': 'السلة'},
    'total': {'en': 'Total', 'ar': 'الإجمالي'},
    'checkout': {'en': 'Checkout', 'ar': 'إتمام الشراء'},
    'basket_empty': {'en': 'Your basket is empty. Browse categories to add fitment-confirmed parts.', 'ar': 'سلتك فارغة. تصفح الفئات لإضافة قطع مؤكدة التوافق.'},
    'cart_at_stock_limit': {'en': "You've reached the available stock", 'ar': 'لقد وصلت إلى الحد الأقصى من المخزون المتاح'},
    'cart_only': {'en': 'Only', 'ar': 'فقط'},
    'cart_left_in_stock': {'en': 'left in stock', 'ar': 'متبقٍ في المخزون'},
    'ships_from': {'en': 'Ships from', 'ar': 'يُشحن من'},

    // ---- Checkout ----
    'ordering_as': {'en': 'Ordering as', 'ar': 'الطلب باسم'},
    'guest_checkout_note': {'en': "Checking out as a guest — we'll email your confirmation. You can create an account after payment to track this order.", 'ar': 'الدفع كضيف — سنرسل التأكيد عبر البريد الإلكتروني. يمكنك إنشاء حساب بعد الدفع لتتبع هذا الطلب.'},
    'email_for_confirmation': {'en': 'Email for order confirmation', 'ar': 'البريد الإلكتروني لتأكيد الطلب'},
    'have_account_login_instead': {'en': 'Have an account? Log in instead', 'ar': 'لديك حساب؟ سجّل الدخول بدلاً من ذلك'},
    'payment_method': {'en': 'Payment method', 'ar': 'طريقة الدفع'},
    'order_summary': {'en': 'Order summary', 'ar': 'ملخص الطلب'},
    'place_order': {'en': 'Place order', 'ar': 'إتمام الطلب'},
    'please_enter_email_order': {'en': 'Please enter an email for your order confirmation.', 'ar': 'يرجى إدخال بريد إلكتروني لتأكيد طلبك.'},
    'please_complete_address': {'en': 'Please fill in every field of your delivery address.', 'ar': 'يرجى تعبئة جميع حقول عنوان التسليم.'},
    'please_select_address': {'en': 'Please select a delivery address.', 'ar': 'يرجى اختيار عنوان التسليم.'},
    'order_placed_success': {'en': 'placed successfully', 'ar': 'تم الطلب بنجاح'},
    'order_placement_error': {'en': 'Something went wrong placing your order. Please try again.', 'ar': 'حدث خطأ أثناء تقديم طلبك. يرجى المحاولة مرة أخرى.'},

    // ---- Orders list ----
    'my_orders': {'en': 'My orders', 'ar': 'طلباتي'},
    'login_to_see_orders': {'en': "Log in to see your order history.\n(Guest checkout orders are confirmed by email, but aren't listed here unless you have an account.)", 'ar': 'سجّل الدخول لرؤية سجل طلباتك.\n(يتم تأكيد طلبات الضيف عبر البريد الإلكتروني، لكنها لا تظهر هنا إلا إذا كان لديك حساب.)'},
    'could_not_load_orders': {'en': 'Could not load orders:', 'ar': 'تعذر تحميل الطلبات:'},
    'no_orders_yet': {'en': 'No orders yet.', 'ar': 'لا توجد طلبات بعد.'},

    // ---- Order detail ----
    'order': {'en': 'Order', 'ar': 'الطلب'},
    'not_found': {'en': 'Not found', 'ar': 'غير موجود'},
    'could_not_load_order': {'en': 'Could not load this order.', 'ar': 'تعذر تحميل هذا الطلب.'},
    'shipped_by': {'en': 'Shipped by', 'ar': 'تم الشحن بواسطة'},
    'tracking_label': {'en': 'Tracking:', 'ar': 'رقم التتبع:'},
    'request_a_return': {'en': 'Request a return', 'ar': 'طلب إرجاع'},
    'return_goes_to_leap': {'en': "This goes to the Leap team, who will coordinate with the supplier — you won't be contacting them directly.", 'ar': 'يذهب هذا إلى فريق Leap، الذي سينسق مع المورد — لن تتواصل معه مباشرة.'},
    'reason_label': {'en': 'Reason (e.g. wrong item, damaged)', 'ar': 'السبب (مثال: منتج خاطئ، تالف)'},
    'details_label': {'en': 'Details', 'ar': 'التفاصيل'},
    'submit_request': {'en': 'Submit request', 'ar': 'إرسال الطلب'},
    'attach_photos_optional': {'en': 'Attach photos (optional)', 'ar': 'إرفاق صور (اختياري)'},
    'return_request_sent': {'en': 'Return request sent to the Leap team.', 'ar': 'تم إرسال طلب الإرجاع إلى فريق Leap.'},
    'view': {'en': 'View', 'ar': 'عرض'},

    // ---- My Returns (list + detail thread — GET/POST /returns/my-cases,
    // same real backend the return-request sheet above already posts to;
    // this is the missing "check on it afterward" half of that flow) ----
    'my_returns': {'en': 'My returns', 'ar': 'مرتجعاتي'},
    'login_to_see_returns': {'en': "Log in to see your return requests.\n(Guest return requests are handled by email — you won't be able to track them here unless you have an account.)", 'ar': 'سجّل الدخول لرؤية طلبات الإرجاع الخاصة بك.\n(تتم معالجة طلبات إرجاع الضيف عبر البريد الإلكتروني — لن تتمكن من تتبعها هنا إلا إذا كان لديك حساب.)'},
    'could_not_load_returns': {'en': 'Could not load return requests:', 'ar': 'تعذر تحميل طلبات الإرجاع:'},
    'no_returns_yet': {'en': 'No return requests yet.', 'ar': 'لا توجد طلبات إرجاع بعد.'},
    'could_not_load_return': {'en': 'Could not load this return request.', 'ar': 'تعذر تحميل طلب الإرجاع هذا.'},
    'return_case_order_label': {'en': 'For order', 'ar': 'للطلب'},

    // ---- Account ----
    'account': {'en': 'Account', 'ar': 'الحساب'},
    'addresses': {'en': 'Addresses', 'ar': 'العناوين'},

    // ---- Addresses screen (new) ----
    'add_address': {'en': 'Add address', 'ar': 'إضافة عنوان'},
    'edit_address': {'en': 'Edit address', 'ar': 'تعديل العنوان'},
    'default_label': {'en': 'Default', 'ar': 'افتراضي'},
    'set_as_default': {'en': 'Set as default', 'ar': 'تعيين كافتراضي'},
    'delete_address_confirm': {'en': 'Delete this address?', 'ar': 'حذف هذا العنوان؟'},
    'label_field': {'en': 'Label (e.g. Home, Work)', 'ar': 'التسمية (مثال: المنزل، العمل)'},
    'recipient_name_field': {'en': 'Recipient name', 'ar': 'اسم المستلم'},
    'phone_field': {'en': 'Phone', 'ar': 'الهاتف'},
    'country_field': {'en': 'Country', 'ar': 'الدولة'},
    'city_field': {'en': 'City', 'ar': 'المدينة'},
    'street_address_field': {'en': 'Street address', 'ar': 'عنوان الشارع'},
    'postal_code_field': {'en': 'Postal code (optional)', 'ar': 'الرمز البريدي (اختياري)'},
    'no_addresses_yet': {'en': 'No saved addresses yet.', 'ar': 'لا توجد عناوين محفوظة بعد.'},
    'address_limit_reached': {'en': 'You can save up to 3 addresses. Delete one before adding another.', 'ar': 'يمكنك حفظ ما يصل إلى 3 عناوين. احذف عنوانًا قبل إضافة آخر.'},
    'save': {'en': 'Save', 'ar': 'حفظ'},
    'delete': {'en': 'Delete', 'ar': 'حذف'},
    'edit': {'en': 'Edit', 'ar': 'تعديل'},
    'cancel': {'en': 'Cancel', 'ar': 'إلغاء'},

    // ---- Wishlist (new) ----
    'wishlist': {'en': 'Wishlist', 'ar': 'المفضلة'},
    'saved_searches': {'en': 'Saved Searches', 'ar': 'عمليات البحث المحفوظة'},
    'no_wishlist_items_yet': {'en': 'Nothing saved yet. Tap the heart on a product to save it here.', 'ar': 'لا شيء محفوظ بعد. اضغط على القلب في أي منتج لحفظه هنا.'},
    'added_to_wishlist': {'en': 'Added to wishlist', 'ar': 'أُضيف إلى المفضلة'},
    'removed_from_wishlist': {'en': 'Removed from wishlist', 'ar': 'أُزيل من المفضلة'},
    'orders_and_returns': {'en': 'Orders & returns', 'ar': 'الطلبات والإرجاعات'},
    'leap_support': {'en': 'Leap Support', 'ar': 'دعم Leap'},
    'log_out': {'en': 'Log out', 'ar': 'تسجيل الخروج'},
    'guest_browsing': {'en': "You're browsing as a guest", 'ar': 'أنت تتصفح كضيف'},
    'guest_prompt': {'en': 'Log in to save vehicles, see order history across devices, and check out faster.', 'ar': 'سجّل الدخول لحفظ مركباتك، ورؤية سجل الطلبات عبر الأجهزة، وإتمام الشراء بشكل أسرع.'},
    'language': {'en': 'Language', 'ar': 'اللغة'},

    // ---- Support ----
    'login_to_message': {'en': "Log in to message the Leap team about an order.\n(You're always talking to the Platform — never the supplier directly.)", 'ar': 'سجّل الدخول لمراسلة فريق Leap بخصوص طلب.\n(أنت تتحدث دائمًا مع المنصة — وليس مع المورد مباشرة.)'},
    'messaging_leap_note': {'en': "You're messaging the Leap team, not the supplier directly.", 'ar': 'أنت تراسل فريق Leap، وليس المورد مباشرة.'},
    'could_not_load_tickets': {'en': 'Could not load tickets:', 'ar': 'تعذر تحميل التذاكر:'},
    'no_tickets_yet': {'en': 'No support tickets yet. Tap + to start one.', 'ar': 'لا توجد تذاكر دعم بعد. اضغط + لبدء واحدة.'},
    'new_support_ticket': {'en': 'New support ticket', 'ar': 'تذكرة دعم جديدة'},
    'subject_label': {'en': 'Subject', 'ar': 'الموضوع'},
    'how_can_we_help': {'en': 'How can we help?', 'ar': 'كيف يمكننا المساعدة؟'},
    'send': {'en': 'Send', 'ar': 'إرسال'},
    'ticket': {'en': 'Ticket', 'ar': 'التذكرة'},
    'could_not_load_ticket': {'en': 'Could not load this ticket.', 'ar': 'تعذر تحميل هذه التذكرة.'},
    'enter_email_to_view_ticket': {'en': 'Enter the email this ticket was filed under to view it.', 'ar': 'أدخل البريد الإلكتروني الذي قُدمت به هذه التذكرة لعرضها.'},
    'track_a_ticket': {'en': 'Track a ticket', 'ar': 'تتبع تذكرة'},
    'track_ticket_hint': {'en': 'Enter your ticket ID (from your confirmation) and the email you used to file it.', 'ar': 'أدخل رقم التذكرة (من رسالة التأكيد) والبريد الإلكتروني الذي استخدمته لتقديمها.'},
    'ticket_id_label': {'en': 'Ticket ID', 'ar': 'رقم التذكرة'},
    'track': {'en': 'Track', 'ar': 'تتبع'},
    'log_in_to_see_all_tickets': {'en': 'Log in to see all your tickets', 'ar': 'سجّل الدخول لرؤية جميع تذاكرك'},
    'email_required_for_guest': {'en': 'Please provide an email so we can reach you.', 'ar': 'يرجى تقديم بريد إلكتروني حتى نتمكن من التواصل معك.'},
    'type_a_message': {'en': 'Type a message…', 'ar': 'اكتب رسالة…'},

    // ---- Auth: login ----
    'login_subtitle': {'en': 'Log in to view your order history and saved vehicles.', 'ar': 'سجّل الدخول لعرض سجل طلباتك ومركباتك المحفوظة.'},
    'email_label': {'en': 'Email', 'ar': 'البريد الإلكتروني'},
    'password_label': {'en': 'Password', 'ar': 'كلمة المرور'},
    'forgot_password_q': {'en': 'Forgot password?', 'ar': 'نسيت كلمة المرور؟'},
    'no_account_signup': {'en': "Don't have an account? Sign up", 'ar': 'ليس لديك حساب؟ أنشئ حسابًا'},

    // ---- Auth: signup ----
    'create_account': {'en': 'Create account', 'ar': 'إنشاء حساب'},
    'signup_subtitle': {'en': 'Save your vehicles and track orders across devices.', 'ar': 'احفظ مركباتك وتتبع طلباتك عبر الأجهزة.'},
    'name_optional': {'en': 'Name (optional)', 'ar': 'الاسم (اختياري)'},
    'at_least_8_chars': {'en': 'At least 8 characters', 'ar': '8 أحرف على الأقل'},
    'already_have_account': {'en': 'Already have an account? Log in', 'ar': 'لديك حساب بالفعل؟ سجّل الدخول'},
    'password_too_short': {'en': 'Password must be at least 8 characters', 'ar': 'يجب ألا تقل كلمة المرور عن 8 أحرف'},

    // ---- Auth: forgot password ----
    'reset_password_title': {'en': 'Reset password', 'ar': 'إعادة تعيين كلمة المرور'},
    'enter_email_for_reset': {'en': "Enter your account email and we'll send a reset link.", 'ar': 'أدخل بريد حسابك الإلكتروني وسنرسل رابط إعادة التعيين.'},
    'send_reset_link': {'en': 'Send reset link', 'ar': 'إرسال رابط إعادة التعيين'},
    'if_email_registered': {'en': 'If that email is registered, a reset link has been sent.', 'ar': 'إذا كان هذا البريد الإلكتروني مسجلاً، فقد تم إرسال رابط إعادة التعيين.'},
    'dev_note_email': {'en': "Dev note: email sending isn't connected in this build yet — the reset link is printed to the backend server's console output instead. Copy the token from there.", 'ar': 'ملاحظة للمطورين: إرسال البريد الإلكتروني غير متصل بعد في هذا الإصدار — يتم طباعة رابط إعادة التعيين في سجل الخادم بدلاً من ذلك. انسخ الرمز من هناك.'},
    'have_reset_code': {'en': 'I have a reset code', 'ar': 'لدي رمز إعادة تعيين'},

    // ---- Auth: reset password ----
    'enter_reset_code': {'en': 'Enter reset code', 'ar': 'أدخل رمز إعادة التعيين'},
    'paste_reset_code': {'en': 'Paste the reset code from your email (or, for now, from the backend server console) and choose a new password.', 'ar': 'الصق رمز إعادة التعيين من بريدك الإلكتروني (أو، في الوقت الحالي، من سجل الخادم) واختر كلمة مرور جديدة.'},
    'reset_code_label': {'en': 'Reset code', 'ar': 'رمز إعادة التعيين'},
    'new_password_label': {'en': 'New password', 'ar': 'كلمة المرور الجديدة'},
    'password_reset_success': {'en': 'Password reset. Please log in with your new password.', 'ar': 'تمت إعادة تعيين كلمة المرور. يرجى تسجيل الدخول بكلمة المرور الجديدة.'},
  };

  static String get(String key) {
    final entry = _strings[key];
    return entry?['en'] ?? key;
  }
}

/// Shorthand — `tr(context, 'key')` — used throughout every screen's
/// build() method. Reads the current language from LanguageState via
/// context.watch, so a screen re-renders in the new language the
/// instant the setting changes, same as the product page.
String tr(BuildContext context, String key) {
  final isAr = context.watch<LanguageState>().isArabic;
  final entry = AppStrings._strings[key];
  if (entry == null) return key;
  return (isAr ? entry['ar'] : entry['en']) ?? entry['en'] ?? key;
}

/// `read`-based variant for use OUTSIDE build() — event handlers, async
/// submit callbacks setting an error-message string, etc. `context.watch`
/// is only valid during build(); calling it from a button's onPressed
/// callback throws a real Flutter framework assertion. Use this instead
/// anywhere a string is needed one-off outside the widget tree's build
/// method (e.g. `setState(() => _errorMessage = trRead(context, 'key'))`).
String trRead(BuildContext context, String key) {
  final isAr = context.read<LanguageState>().isArabic;
  final entry = AppStrings._strings[key];
  if (entry == null) return key;
  return (isAr ? entry['ar'] : entry['en']) ?? entry['en'] ?? key;
}

/// Translates a RAW backend status value (e.g. 'to_ship', 'shipped',
/// 'in_progress') into a real bilingual label — used wherever an order,
/// sub-order, ticket, or return case's status is displayed. Falls back
/// to a formatted version of the raw value (underscores -> spaces,
/// capitalized) for any status this lookup doesn't yet know about,
/// rather than silently showing nothing.
String trStatus(BuildContext context, String rawStatus) {
  final key = 'status_${rawStatus.toLowerCase()}';
  final entry = AppStrings._strings[key];
  if (entry == null) {
    // Unrecognized status — safe fallback, not a silent blank.
    final words = rawStatus.split('_').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}');
    return words.join(' ');
  }
  final isAr = context.watch<LanguageState>().isArabic;
  return (isAr ? entry['ar'] : entry['en']) ?? entry['en'] ?? rawStatus;
}

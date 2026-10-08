/// Exact transcription of apps/hub-portal/src/App.jsx's own proven
/// `STRINGS` constant (lines 27-114) -- reused directly rather than
/// re-written, per the rebuild spec's own explicit instruction. Every
/// Chinese and English string below matches the web app's own real,
/// already-shipped copy verbatim.
library;

class StepText {
  final String label;
  final String? actionLabel;
  final String? promptTitle;
  final String? promptHint;
  const StepText({required this.label, this.actionLabel, this.promptTitle, this.promptHint});
}

class LoginText {
  final String subtitle, email, password, signIn, signingIn, restricted, noAccess;
  const LoginText({
    required this.subtitle, required this.email, required this.password,
    required this.signIn, required this.signingIn, required this.restricted, required this.noAccess,
  });
}

class QueueText {
  final String title, loading, empty, searchPlaceholder;
  final String Function(int shown, int total) shownCount;
  const QueueText({required this.title, required this.shownCount, required this.loading, required this.empty, required this.searchPlaceholder});
}

class DetailText {
  final String items, evidencePhotos, notes, trackingNumber, saving;
  final String flagInstead, flagTitle, flagDesc, whatsWrong, submitFlag, cancel;
  final String confirmDeliveredTitle, confirmDeliveredHint, deliveryNotePlaceholder, confirming, confirmDelivered;
  final String flaggedBanner, completedBanner, history, noSteps;
  final String Function(String trackingNumber) tracking;
  final String Function(String name) by;
  final String errPhotoRequired, errTrackingRequired, errDeliveryNoteRequired;
  // The faulty-unit panel, closed flags and replacements (ported from the web hub portal's own strings).
  final String faultTitle, faultDesc, faultItems, returnOption, discardOption, returnTracking, submitReturn, submitDiscard;
  final String returnedBanner, discardedBanner, waitingOnHub, sendTo, noReturnAddress, errReturnTrackingRequired;
  final String replacementTag, replacementFor, replacementHint;
  final Map<String, String> stage;
  final Map<String, String> resolvedBanners;
  const DetailText({
    required this.items, required this.evidencePhotos, required this.notes, required this.trackingNumber, required this.saving,
    required this.flagInstead, required this.flagTitle, required this.flagDesc, required this.whatsWrong, required this.submitFlag, required this.cancel,
    required this.confirmDeliveredTitle, required this.confirmDeliveredHint, required this.deliveryNotePlaceholder, required this.confirming, required this.confirmDelivered,
    required this.flaggedBanner, required this.completedBanner, required this.history, required this.noSteps,
    required this.tracking, required this.by,
    required this.errPhotoRequired, required this.errTrackingRequired, required this.errDeliveryNoteRequired,
    required this.faultTitle, required this.faultDesc, required this.faultItems, required this.returnOption, required this.discardOption,
    required this.returnTracking, required this.submitReturn, required this.submitDiscard,
    required this.returnedBanner, required this.discardedBanner, required this.waitingOnHub, required this.sendTo, required this.noReturnAddress,
    required this.errReturnTrackingRequired, required this.replacementTag, required this.replacementFor, required this.replacementHint,
    required this.stage, required this.resolvedBanners,
  });
}

/// The "choose your own password" screen (a temporary password from an admin must be replaced at the first sign-in).
class PasswordText {
  final String title, intro, current, newPassword, confirm, submit, saving, tooShort, mismatch, same;
  const PasswordText({
    required this.title, required this.intro, required this.current, required this.newPassword, required this.confirm,
    required this.submit, required this.saving, required this.tooShort, required this.mismatch, required this.same,
  });
}

class HubText {
  final String appName, logout, checkingSession, addPhoto, scanButtonLabel;
  final LoginText login;
  final Map<String, StepText> steps;
  final Map<String, String> filters;
  final QueueText queue;
  final DetailText detail;
  final PasswordText changePassword;
  const HubText({
    required this.appName, required this.logout, required this.checkingSession, required this.addPhoto, required this.scanButtonLabel,
    required this.login, required this.steps, required this.filters, required this.queue, required this.detail, required this.changePassword,
  });
}

const Map<String, HubText> kHubStrings = {
  'zh': HubText(
    appName: 'LEAP 质检中心', logout: '退出登录', checkingSession: '正在检查登录状态…', addPhoto: '添加照片', scanButtonLabel: '扫描',
    login: LoginText(
      subtitle: '质检中心员工登录', email: '邮箱', password: '密码',
      signIn: '登录', signingIn: '登录中…',
      restricted: '仅限 Leap 质检中心员工访问。',
      noAccess: '该账号没有质检中心访问权限。',
    ),
    steps: {
      'awaiting_receipt': StepText(label: '待接收', actionLabel: '确认已接收', promptTitle: '接收此包裹', promptHint: '请在拆封前拍摄包裹外观照片。'),
      'received': StepText(label: '已接收', actionLabel: '确认已拆封', promptTitle: '拆封包裹', promptHint: '请拍摄拆封后的内容物照片。'),
      'opened': StepText(label: '已拆封', actionLabel: '确认已质检', promptTitle: '检查商品', promptHint: '请清晰拍摄商品照片——朝向、侧面及任何 OEM 标识。'),
      'inspected': StepText(label: '已质检', actionLabel: '确认已打包', promptTitle: '为买家打包', promptHint: '请拍摄重新打包完毕、准备发货的商品照片。'),
      'packed': StepText(label: '已打包', actionLabel: '确认已发货', promptTitle: '发货给买家', promptHint: '请拍摄最终包裹面单照片，并填写运单号。'),
      'shipped_to_buyer': StepText(label: '已发货给买家'),
      'delivered': StepText(label: '已送达'),
      'flagged': StepText(label: '已标记问题'),
      'returned_to_supplier': StepText(label: '已退回供应商'),
      'discarded_at_hub': StepText(label: '已销毁'),
      'closed': StepText(label: '已关闭'),
    },
    filters: {'all': '全部', 'awaiting_receipt': '待接收', 'in_progress': '处理中', 'shipped_to_buyer': '已发货', 'delivered': '已送达', 'flagged': '已标记'},
    queue: QueueText(
      title: '入库包裹', loading: '加载中…', empty: '暂无内容。', searchPlaceholder: '按订单号或供应商搜索…',
      shownCount: _shownCountZh,
    ),
    changePassword: PasswordText(
      title: '设置您的新密码', intro: '您使用的是管理员提供的临时密码。请先设置自己的密码，之后才能继续使用。',
      current: '临时密码', newPassword: '新密码（至少 8 位）', confirm: '再次输入新密码',
      submit: '保存并继续', saving: '保存中…',
      tooShort: '新密码至少需要 8 位。', mismatch: '两次输入的新密码不一致。', same: '新密码不能与临时密码相同。',
    ),
    detail: DetailText(
      items: '商品清单', evidencePhotos: '凭证照片（至少 1 张）', notes: '备注（可选）',
      trackingNumber: '寄给买家的运单号', saving: '保存中…',
      flagInstead: '改为标记质量问题', flagTitle: '标记质量问题',
      flagDesc: '商品错发、损坏、车型不符——请描述问题并拍照。此信息将直接发送给 Leap 平台团队。',
      whatsWrong: '问题描述', submitFlag: '提交标记', cancel: '取消',
      confirmDeliveredTitle: '确认已送达',
      confirmDeliveredHint: '优先使用真实物流轨迹确认——物流商确认后系统会自动标记为已送达。仅当轨迹未更新且你有确切、独立的证据证明买家已收货时，才手动在此确认。',
      deliveryNotePlaceholder: '例如：物流轨迹未更新，买家已通过聊天确认收货',
      confirming: '确认中…', confirmDelivered: '确认已送达',
      flaggedBanner: '此包裹已标记问题，等待平台审核。',
      completedBanner: '此包裹已完成送达买家的全部流程。',
      history: '历史记录', noSteps: '暂无记录步骤。',
      tracking: _trackingZh, by: _byZh,
      errPhotoRequired: '此步骤至少需要 1 张凭证照片。',
      errTrackingRequired: '最后的发货步骤需要填写运单号。',
      errDeliveryNoteRequired: '需填写简短说明（例如为何真实物流轨迹未确认送达）。',
      faultTitle: '平台已确认存在质量问题——请处理问题商品',
      faultDesc: '平台已确认下列商品确有质量问题。请将其退回供应商（填写运单号并拍照），或在仓库销毁（拍照留证）。',
      faultItems: '问题商品', returnOption: '退回供应商', discardOption: '在仓库销毁',
      returnTracking: '退回运单号', submitReturn: '确认已退回供应商', submitDiscard: '确认已销毁',
      returnedBanner: '此包裹已退回供应商。仓库无需再做任何操作。', discardedBanner: '此包裹已在仓库销毁。仓库无需再做任何操作。',
      waitingOnHub: '平台正在等待仓库处理问题商品。',
      sendTo: '寄往（供应商退货地址）',
      noReturnAddress: '该供应商尚未填写退货地址。请先联系平台，再寄回问题商品。',
      errReturnTrackingRequired: '退回供应商需要填写退回运单号。',
      replacementTag: '补发', replacementFor: '这是订单', replacementHint: '的补发件，请按普通包裹处理（接收、检查、发出）。',
      stage: {'reviewing': '平台仍在决定如何处理此案例。', 'finalising': '平台正在办理收尾事项。', 'closed': '此案例已结案。'},
      resolvedBanners: {
        'continue_processing': '平台已审核：未发现问题，请继续处理此包裹。',
        'return_to_supplier': '平台已处理：此包裹将退回供应商。',
        'discard': '平台已处理：此包裹已作废，不会寄给买家。',
        'replacement_requested': '平台已处理：已向供应商申请换货。',
        'fault_closed_manually': '平台已关闭此问题案件：此包裹无需再处理。',
        'fault_refund': '平台已处理此问题案件：无需再处理。',
        'fault_replacement': '平台已处理此问题案件（已安排补发）：无需再处理。',
      },
    ),
  ),
  'en': HubText(
    appName: 'LEAP HUB', logout: 'Log out', checkingSession: 'Checking session…', addPhoto: 'Add photo', scanButtonLabel: 'Scan',
    login: LoginText(
      subtitle: 'Inspection hub sign-in', email: 'Email', password: 'Password',
      signIn: 'Sign in', signingIn: 'Signing in…',
      restricted: 'Access is restricted to Leap inspection hub staff.',
      noAccess: "This account doesn't have inspection hub access.",
    ),
    steps: {
      'awaiting_receipt': StepText(label: 'Awaiting receipt', actionLabel: 'Confirm Received', promptTitle: 'Receiving this shipment', promptHint: 'Photograph the package as it arrives, before opening it.'),
      'received': StepText(label: 'Received', actionLabel: 'Confirm Opened', promptTitle: 'Opening the package', promptHint: 'Photograph the contents once opened.'),
      'opened': StepText(label: 'Opened', actionLabel: 'Confirm Inspected', promptTitle: 'Inspecting the item', promptHint: 'Photograph the part clearly — orientation, side, and any OEM markings.'),
      'inspected': StepText(label: 'Inspected', actionLabel: 'Confirm Packed', promptTitle: 'Packing for the buyer', promptHint: 'Photograph the item repackaged and ready to ship.'),
      'packed': StepText(label: 'Packed', actionLabel: 'Confirm Shipped', promptTitle: 'Shipping to the buyer', promptHint: 'Photograph the final package label, and enter the tracking number.'),
      'shipped_to_buyer': StepText(label: 'Shipped to buyer'),
      'delivered': StepText(label: 'Delivered'),
      'flagged': StepText(label: 'Flagged'),
      'returned_to_supplier': StepText(label: 'Returned to supplier'),
      'discarded_at_hub': StepText(label: 'Discarded'),
      'closed': StepText(label: 'Closed'),
    },
    filters: {'all': 'All', 'awaiting_receipt': 'Awaiting receipt', 'in_progress': 'In progress', 'shipped_to_buyer': 'Shipped', 'delivered': 'Delivered', 'flagged': 'Flagged'},
    queue: QueueText(
      title: 'Inbound shipments', loading: 'Loading…', empty: 'Nothing here right now.', searchPlaceholder: 'Search by order ID or supplier…',
      shownCount: _shownCountEn,
    ),
    changePassword: PasswordText(
      title: 'Choose your own password', intro: 'You signed in with a temporary password an admin gave you. Choose your own password to continue.',
      current: 'Temporary password', newPassword: 'New password (at least 8 characters)', confirm: 'Repeat the new password',
      submit: 'Save and continue', saving: 'Saving…',
      tooShort: 'The new password must be at least 8 characters.', mismatch: 'The two new passwords do not match.', same: 'The new password must be different from the temporary one.',
    ),
    detail: DetailText(
      items: 'Items', evidencePhotos: 'Evidence photos (at least 1)', notes: 'Notes (optional)',
      trackingNumber: 'Tracking number to buyer', saving: 'Saving…',
      flagInstead: 'Flag a quality issue instead', flagTitle: 'Flag a quality issue',
      flagDesc: "Wrong item, damage, mismatched fitment — describe what's wrong and photograph it. This goes straight to the Leap platform team.",
      whatsWrong: "What's wrong", submitFlag: 'Submit flag', cancel: 'Cancel',
      confirmDeliveredTitle: 'Confirm delivered',
      confirmDeliveredHint: "Real carrier tracking is the preferred way to confirm this — a real webhook will mark this delivered automatically once the carrier confirms it. Only confirm here yourself if that hasn't happened and you have real, independent confirmation the buyer received it.",
      deliveryNotePlaceholder: 'e.g. tracking never updated, buyer confirmed receipt via chat',
      confirming: 'Confirming…', confirmDelivered: 'Confirm delivered',
      flaggedBanner: 'This shipment is flagged and awaiting platform review.',
      completedBanner: 'This shipment has completed its journey to the buyer.',
      history: 'History', noSteps: 'No steps recorded yet.',
      tracking: _trackingEn, by: _byEn,
      errPhotoRequired: 'At least 1 evidence photo is required for this step.',
      errTrackingRequired: 'A tracking number is required for the final shipping step.',
      errDeliveryNoteRequired: "A short note is required (e.g. why real carrier tracking didn't confirm it).",
      faultTitle: 'A real fault was confirmed — deal with the faulty unit',
      faultDesc: 'The platform confirmed a real quality problem with the items below. Send them back to the supplier (enter the tracking number and photograph the parcel), or discard them at the hub (photograph them as evidence).',
      faultItems: 'Faulty items', returnOption: 'Return to supplier', discardOption: 'Discard at the hub',
      returnTracking: 'Return tracking number', submitReturn: 'Confirm returned to supplier', submitDiscard: 'Confirm discarded',
      returnedBanner: 'This shipment was returned to the supplier. Nothing more is needed from the hub.',
      discardedBanner: 'This shipment was discarded at the hub. Nothing more is needed from the hub.',
      waitingOnHub: 'The platform is waiting for the hub to deal with the faulty unit.',
      sendTo: "Send it to (the supplier's return address)",
      noReturnAddress: 'This supplier has not entered a return address. Please contact the platform before sending the unit back.',
      errReturnTrackingRequired: 'A tracking number is required to return the unit to the supplier.',
      replacementTag: 'Replacement', replacementFor: 'This is a replacement for order', replacementHint: '— handle it like any other shipment (receive, inspect, ship).',
      stage: {'reviewing': 'The platform is still deciding how to handle this case.', 'finalising': 'The platform is finishing this case.', 'closed': 'This case is closed.'},
      resolvedBanners: {
        'continue_processing': 'Platform review: no problem found — please carry on processing this shipment.',
        'return_to_supplier': 'Resolved by the platform: this shipment is being returned to the supplier.',
        'discard': 'Resolved by the platform: this shipment was discarded and will not go to the buyer.',
        'replacement_requested': 'Resolved by the platform: a replacement has been requested from the supplier.',
        'fault_closed_manually': 'The platform has closed this case: nothing more is needed from the hub for this shipment.',
        'fault_refund': 'Resolved by the platform: nothing more is needed from the hub.',
        'fault_replacement': 'Resolved by the platform: a replacement was arranged, nothing more is needed from the hub.',
      },
    ),
  ),
};

String _shownCountZh(int n, int m) => '共 $m 个，显示 $n 个';
String _shownCountEn(int n, int m) => '$n of $m shown';
String _trackingZh(String tn) => '运单号：$tn';
String _trackingEn(String tn) => 'Tracking: $tn';
String _byZh(String name) => '操作人：$name';
String _byEn(String name) => 'by $name';

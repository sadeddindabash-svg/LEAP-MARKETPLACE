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
  const DetailText({
    required this.items, required this.evidencePhotos, required this.notes, required this.trackingNumber, required this.saving,
    required this.flagInstead, required this.flagTitle, required this.flagDesc, required this.whatsWrong, required this.submitFlag, required this.cancel,
    required this.confirmDeliveredTitle, required this.confirmDeliveredHint, required this.deliveryNotePlaceholder, required this.confirming, required this.confirmDelivered,
    required this.flaggedBanner, required this.completedBanner, required this.history, required this.noSteps,
    required this.tracking, required this.by,
    required this.errPhotoRequired, required this.errTrackingRequired, required this.errDeliveryNoteRequired,
  });
}

class HubText {
  final String appName, logout, checkingSession, addPhoto, scanButtonLabel;
  final LoginText login;
  final Map<String, StepText> steps;
  final Map<String, String> filters;
  final QueueText queue;
  final DetailText detail;
  const HubText({
    required this.appName, required this.logout, required this.checkingSession, required this.addPhoto, required this.scanButtonLabel,
    required this.login, required this.steps, required this.filters, required this.queue, required this.detail,
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
    },
    filters: {'all': '全部', 'awaiting_receipt': '待接收', 'in_progress': '处理中', 'shipped_to_buyer': '已发货', 'delivered': '已送达', 'flagged': '已标记'},
    queue: QueueText(
      title: '入库包裹', loading: '加载中…', empty: '暂无内容。', searchPlaceholder: '按订单号或供应商搜索…',
      shownCount: _shownCountZh,
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
    },
    filters: {'all': 'All', 'awaiting_receipt': 'Awaiting receipt', 'in_progress': 'In progress', 'shipped_to_buyer': 'Shipped', 'delivered': 'Delivered', 'flagged': 'Flagged'},
    queue: QueueText(
      title: 'Inbound shipments', loading: 'Loading…', empty: 'Nothing here right now.', searchPlaceholder: 'Search by order ID or supplier…',
      shownCount: _shownCountEn,
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
    ),
  ),
};

String _shownCountZh(int n, int m) => '共 $m 个，显示 $n 个';
String _shownCountEn(int n, int m) => '$n of $m shown';
String _trackingZh(String tn) => '运单号：$tn';
String _trackingEn(String tn) => 'Tracking: $tn';
String _byZh(String name) => '操作人：$name';
String _byEn(String name) => 'by $name';

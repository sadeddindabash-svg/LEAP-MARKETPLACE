import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// The parcel screen as a guided job, one step per screen (design C, confirmed with the person via mockup): a dark header with
/// "Step n of 7", the step's big title and a 7-part bar; only what this step needs; one big button at the bottom.
/// The 7 steps: Receive · Open · Inspect · Pack · Shipping cost · Ship · Delivered. Chinese and English.
class StepFlowText {
  final String stepOf, details, history, items, flag, backToList, photosTitle, photosHint, nextPhotos, nextShip, costApproved;
  final String needPhoto, needLabel, needTracking, needCost, flaggedTitle, flagTitle, expectedInside, from;
  final List<String> titles, hints;
  final String Function(int left) checksLeft;
  const StepFlowText({
    required this.stepOf, required this.details, required this.history, required this.items, required this.flag, required this.backToList,
    required this.photosTitle, required this.photosHint, required this.nextPhotos, required this.nextShip, required this.costApproved,
    required this.needPhoto, required this.needLabel, required this.needTracking, required this.needCost, required this.flaggedTitle,
    required this.flagTitle, required this.expectedInside, required this.from, required this.titles, required this.hints, required this.checksLeft,
  });
}

final Map<String, StepFlowText> kStepFlowText = {
  'zh': StepFlowText(
    stepOf: '第 {n} / 7 步', details: '详情与记录', history: '历史记录', items: '商品', flag: '⚑ 标记质量问题', backToList: '返回列表',
    photosTitle: '质检照片', photosHint: '至少 1 张：朝向、侧面及 OEM 标识', nextPhotos: '下一步：拍照', nextShip: '下一步：发货', costApproved: '运费已确认',
    needPhoto: '请先添加照片', needLabel: '请先勾选供应商标签', needTracking: '请填写运单号', needCost: '等待运费确认',
    flaggedTitle: '已标记问题', flagTitle: '标记问题', expectedInside: '应有内容', from: '发件方',
    titles: ['接收', '拆封', '质检', '打包', '运费', '发货', '送达'],
    hints: ['包裹从供应商到达：拆封前拍摄外观照片', '拆开包裹，拍摄里面的内容', '对照实物逐项勾选，填写实收数量', '打包并撕除或覆盖供应商标签', '称重并填写物流价格', '交给物流并填写运单号', '只有买家验证码才能确认送达'],
    checksLeft: _leftZh,
  ),
  'en': StepFlowText(
    stepOf: 'Step {n} of 7', details: 'Details & history', history: 'History', items: 'Items', flag: '⚑ Flag a quality issue', backToList: 'Back to list',
    photosTitle: 'Photos', photosHint: 'At least 1 · orientation, side, OEM marks', nextPhotos: 'Next: photos', nextShip: 'Next: ship', costApproved: 'Shipping cost cleared',
    needPhoto: 'Add a photo first', needLabel: 'Tick the supplier label first', needTracking: 'Enter the tracking number', needCost: 'Waiting for the shipping cost',
    flaggedTitle: 'Flagged', flagTitle: 'Flag an issue', expectedInside: 'Expected inside', from: 'From',
    titles: ['Receive', 'Open', 'Inspect', 'Pack', 'Shipping cost', 'Ship', 'Delivered'],
    hints: ['Arrived from the supplier: photo the box before opening', 'Open the box and photo what is inside', 'Tick each line against the real part, enter the quantity', 'Pack it and remove or cover the supplier label', 'Weigh the box and enter the carrier price', 'Hand it to the carrier and enter tracking', "Only the buyer's code confirms delivery"],
    checksLeft: _leftEn,
  ),
};

String _leftZh(int n) => '还差 $n 项';
String _leftEn(int n) => '$n ${n == 1 ? 'thing' : 'things'} left';

/// Which of the 7 steps a parcel is at (0 = Receive … 6 = Delivered). At "packed" the parcel is at Shipping cost, then (once the cost is
/// cleared and the worker goes on) at Ship.
int stepIndexFor(String status, {bool shipPage = false}) {
  switch (status) {
    case 'awaiting_receipt':
      return 0;
    case 'received':
      return 1;
    case 'opened':
      return 2;
    case 'inspected':
      return 3;
    case 'packed':
      return shipPage ? 5 : 4;
    default:      // shipped_to_buyer and delivered: the last step
      return 6;
  }
}

/// The dark header: ✕ / ‹, the order, "Step n of 7", the big title, its hint and the 7-part bar (done green, now gold).
class StepHeader extends StatelessWidget {
  final String orderId;
  final String? subtitle;
  final int step;            // 0..6
  final bool allDone;        // delivered: every part green
  final bool red;            // flagged: a red bar instead
  final String title, hint, stepOf;
  final bool back;           // ‹ (go back a page) instead of ✕ (close)
  final VoidCallback onLeading;
  final VoidCallback? onDetails;
  final String? badge;       // "1 / 2" when the order has more than one parcel
  const StepHeader({
    super.key, required this.orderId, this.subtitle, required this.step, this.allDone = false, this.red = false, required this.title, required this.hint,
    required this.stepOf, this.back = false, required this.onLeading, this.onDetails, this.badge,
  });

  @override
  Widget build(BuildContext context) {
    Color part(int i) {
      if (red) return HubColors.red;
      if (allDone || i < step) return HubColors.gauge;
      if (i == step) return const Color(0xFFF2A71B);
      return const Color(0xFF3A3F48);
    }

    return Container(
      color: HubColors.ink,
      padding: EdgeInsets.fromLTRB(8, MediaQuery.of(context).padding.top + 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                key: const Key('step-leading'),
                onPressed: onLeading,
                icon: Icon(back ? Icons.chevron_left : Icons.close, color: Colors.white, size: back ? 26 : 22),
              ),
              Flexible(child: Text(orderId, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700))),
              if (badge != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(border: Border.all(color: const Color(0xFF3A3F48)), borderRadius: BorderRadius.circular(999)),
                  child: Text(badge!, style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w700)),
                ),
              ],
              const Spacer(),
              Text(stepOf, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12.5)),
              if (onDetails != null)
                IconButton(
                  key: const Key('step-details'),
                  onPressed: onDetails,
                  icon: const Icon(Icons.history, color: Colors.white, size: 21),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (subtitle != null) Text(subtitle!, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11.5)),
                const SizedBox(height: 6),
                Text(title, style: const TextStyle(color: Colors.white, fontSize: 27, fontWeight: FontWeight.w900, height: 1.1)),
                const SizedBox(height: 4),
                Text(hint, style: const TextStyle(color: Color(0xFFC5D3DC), fontSize: 12.5)),
                const SizedBox(height: 12),
                Row(
                  children: List.generate(
                    7,
                    (i) => Expanded(
                      child: Container(
                        height: 5,
                        margin: EdgeInsets.only(right: i == 6 ? 0 : 4),
                        decoration: BoxDecoration(color: part(i), borderRadius: BorderRadius.circular(3)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The one big button at the bottom (grey and showing what is missing while it cannot be pressed), with an optional red "Flag" link.
class StepBottomBar extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;      // null: grey
  final Color color;
  final String? flagLabel;
  final VoidCallback? onFlag;
  const StepBottomBar({super.key, required this.label, required this.onPressed, this.color = HubColors.signal, this.flagLabel, this.onFlag});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: HubColors.card, border: Border(top: BorderSide(color: HubColors.line))),
      padding: EdgeInsets.fromLTRB(14, 10, 14, 10 + MediaQuery.of(context).padding.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              key: const Key('step-main-button'),
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: color,
                disabledBackgroundColor: const Color(0xFFD1D5DB),
                foregroundColor: Colors.white,
                disabledForegroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                textStyle: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
              ),
              child: Text(label, textAlign: TextAlign.center),
            ),
          ),
          if (flagLabel != null && onFlag != null)
            TextButton(
              key: const Key('step-flag'),
              onPressed: onFlag,
              style: TextButton.styleFrom(foregroundColor: HubColors.red, padding: const EdgeInsets.only(top: 6)),
              child: Text(flagLabel!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }
}

/// A white rounded card, as in the mockup.
class StepCard extends StatelessWidget {
  final Widget child;
  final Color? color, border;
  const StepCard({super.key, required this.child, this.color, this.border});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: color ?? HubColors.card, border: Border.all(color: border ?? HubColors.line), borderRadius: BorderRadius.circular(14)),
      child: child,
    );
  }
}

/// A small grey section title ("PHOTOS", "TRACKING NO.").
Widget stepSection(String text) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: HubColors.muted, letterSpacing: 0.4)),
    );

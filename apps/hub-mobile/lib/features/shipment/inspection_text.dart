/// The inspection list's words (migration 129), in Chinese and English: the same as the hub portal's src/InspectionList.jsx.
library;

class InspectionText {
  final String title, checkAll, enterQuantity, stillNeeded, allDone, ordered, received, mismatchHint, saveFailed;
  final String Function(int done, int total) checksDone;
  final String Function(String name, int n) needChecks;
  final String Function(String name) needQuantity;
  final String Function(String name, int received, int ordered) needFlag;
  const InspectionText({
    required this.title, required this.checkAll, required this.enterQuantity, required this.stillNeeded, required this.allDone,
    required this.ordered, required this.received, required this.mismatchHint, required this.saveFailed,
    required this.checksDone, required this.needChecks, required this.needQuantity, required this.needFlag,
  });
}

final Map<String, InspectionText> kInspectionText = {
  'zh': InspectionText(
    title: '质检清单', checkAll: '全部勾选', enterQuantity: '请填写实收数量', stillNeeded: '确认已质检前还需完成：', allDone: '清单与实收数量已全部确认',
    ordered: '订购', received: '实收', mismatchHint: '实收数量与订单不符：请标记此包裹，由 Leap 决定。', saveFailed: '未能保存，请重试。',
    checksDone: (d, t) => '已确认 $d / $t 项',
    needChecks: (name, n) => '$name：还有 $n 项未勾选',
    needQuantity: (name) => '$name：实收数量',
    needFlag: (name, r, o) => '$name：实收 $r / 订购 $o，请标记此包裹',
  ),
  'en': InspectionText(
    title: 'Inspection list', checkAll: 'Check all', enterQuantity: 'Enter the quantity received', stillNeeded: 'Still needed before "Confirm Inspected":',
    allDone: 'List and quantities all confirmed', ordered: 'Ordered', received: 'Received',
    mismatchHint: 'The quantity received does not match the order: flag this shipment so Leap can decide.', saveFailed: 'Could not save. Try again.',
    checksDone: (d, t) => '$d of $t checks confirmed',
    needChecks: (name, n) => '$name: $n ${n == 1 ? 'check' : 'checks'}',
    needQuantity: (name) => '$name: quantity received',
    needFlag: (name, r, o) => '$name: received $r of $o, flag this shipment',
  ),
};

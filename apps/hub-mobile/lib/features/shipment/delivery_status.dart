import 'package:flutter/material.dart';
import '../../core/theme.dart';
import '../../models/shipment.dart';

/// After "Shipped to buyer" the hub has nothing more to do: the parcel becomes Delivered by itself when the driver scans its QR code and enters
/// the code the buyer gives him face to face. While it is on its way this card says so; once delivered it shows how it was confirmed. The same
/// as the hub portal's src/DeliveryStatusCard.jsx.
const Map<String, Map<String, String>> _text = {
  'zh': {
    'onWay': '运往买家途中', 'onWayHint': '无需操作。司机扫描包裹二维码并输入买家当面提供的验证码后，将自动变为“已送达”。',
    'shipped': '已发货给买家', 'waiting': '等待买家验证码', 'waitingHint': '司机在门口确认', 'delivered': '已送达',
    'verified': '司机已凭买家验证码确认', 'unverified': '未经买家验证码确认', 'receivedBy': '签收人', 'driver': '司机',
    'buyer': '买家本人', 'family': '家人', 'reception': '门卫 / 前台', 'door': '放在门口',
  },
  'en': {
    'onWay': 'On its way to the buyer', 'onWayHint': "Nothing to do here. It becomes Delivered by itself when the driver scans the parcel's QR code and enters the code the buyer gives him face to face.",
    'shipped': 'Shipped to the buyer', 'waiting': "Waiting for the buyer's code", 'waitingHint': 'the driver confirms at the door', 'delivered': 'Delivered',
    'verified': "Confirmed with the buyer's code", 'unverified': "Not confirmed with the buyer's code", 'receivedBy': 'Received by', 'driver': 'Driver',
    'buyer': 'Buyer', 'family': 'Family member', 'reception': 'Guard / reception', 'door': 'Left at the door',
  },
};

String _two(int n) => n.toString().padLeft(2, '0');
String _when(DateTime? d) {
  if (d == null) return '';
  final l = d.toLocal();
  return '${l.year}-${_two(l.month)}-${_two(l.day)} ${_two(l.hour)}:${_two(l.minute)}';
}

Widget _dot(String kind) {
  if (kind == 'done') {
    return Container(width: 18, height: 18, decoration: const BoxDecoration(color: HubColors.gauge, shape: BoxShape.circle), child: const Icon(Icons.check, size: 12, color: Colors.white));
  }
  return Container(width: 18, height: 18, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: kind == 'now' ? HubColors.signal : const Color(0xFFD1D5DB), width: 2)));
}

class DeliveryStatusCard extends StatelessWidget {
  final ShipmentDetail shipment;
  final String language;
  const DeliveryStatusCard({super.key, required this.shipment, required this.language});

  @override
  Widget build(BuildContext context) {
    final x = _text[language] ?? _text['en']!;
    if (shipment.status == 'delivered') {
      final d = shipment.delivery;
      final verified = d?.verified ?? false;
      final lines = <String>[
        [_when(shipment.deliveredAt ?? d?.deliveredAt), if (d?.receivedBy != null) '${x['receivedBy']}: ${x[d!.receivedBy!] ?? d.receivedBy!}'].where((s) => s.isNotEmpty).join(' · '),
        if (d?.driverName != null) '${x['driver']}: ${d!.driverName!}',
      ].where((s) => s.isNotEmpty).toList();
      return Container(
        key: const Key('delivered-card'),
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: HubColors.gaugeBg, border: Border.all(color: HubColors.gauge), borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('✓ ${x['delivered']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: HubColors.gauge)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
              child: Text(verified ? x['verified']! : x['unverified']!, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: verified ? HubColors.gauge : HubColors.amber)),
            ),
            ...lines.map((l) => Padding(padding: const EdgeInsets.only(top: 6), child: Text(l, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)))),
          ],
        ),
      );
    }
    ShipmentEvent? shipped;
    for (final e in shipment.events) {
      if (e.step == 'shipped_to_buyer') shipped = e;
    }
    final shippedInfo = shipped == null ? '' : [shipped.trackingNumber ?? '', _when(shipped.createdAt)].where((s) => s.isNotEmpty).join(' · ');
    Widget row(String kind, Widget text) => Padding(padding: const EdgeInsets.only(top: 8), child: Row(children: [_dot(kind), const SizedBox(width: 10), Expanded(child: text)]));
    return Container(
      key: const Key('on-its-way-card'),
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: HubColors.card, border: Border.all(color: HubColors.line), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('🚚 ${x['onWay']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: HubColors.ink)),
          const SizedBox(height: 6),
          Text(x['onWayHint']!, style: const TextStyle(fontSize: 12.5, color: HubColors.muted)),
          const SizedBox(height: 4),
          row('done', Text(shippedInfo.isEmpty ? x['shipped']! : '${x['shipped']} · $shippedInfo', style: const TextStyle(fontSize: 12.5, color: HubColors.ink))),
          row('now', Text('${x['waiting']} · ${x['waitingHint']}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: HubColors.ink))),
          row('next', Text(x['delivered']!, style: const TextStyle(fontSize: 12.5, color: HubColors.muted))),
        ],
      ),
    );
  }
}

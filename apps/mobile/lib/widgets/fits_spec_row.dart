import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_strings.dart';
import '../core/language_state.dart';
import '../core/theme.dart';
import '../models/fit_group.dart';

/// The "Fits" row of the product screen's Technical Specifications (it replaces the single Brand / Model / Year rows): every model the part fits with its years, three lines to start with, then "+2 more models · 11 vehicles in all",
/// which opens the whole list ("Show fewer" closes it). A part with no fitment at all says it is universal. Same look as the other rows (alternating fill by [index], a 110 px label).
class FitsSpecRow extends StatefulWidget {
  final int index;
  final List<FitGroup> groups;
  final int? groupCount;
  final int? vehicleCount;
  const FitsSpecRow({super.key, required this.index, required this.groups, this.groupCount, this.vehicleCount});

  @override
  State<FitsSpecRow> createState() => _FitsSpecRowState();
}

class _FitsSpecRowState extends State<FitsSpecRow> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final palette = LeapPalette.of(context);
    final isAr = context.watch<LanguageState>().isArabic;
    final view = fitsView(widget.groups, widget.groupCount, expanded: _open);
    final more = view.hiddenModels == 1 ? tr(context, 'fits_more_model_one') : tr(context, 'fits_more_models').replaceAll('{n}', '${view.hiddenModels}');
    final vehicles = (widget.vehicleCount ?? 0) > 0 ? ' · ${tr(context, 'fits_vehicles_in_all').replaceAll('{n}', '${widget.vehicleCount}')}' : '';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      decoration: BoxDecoration(color: widget.index.isOdd ? palette.chalk : null, border: Border(bottom: BorderSide(color: palette.line))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text('${tr(context, 'fits_label_row')}:', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: palette.muted))),
          Expanded(
            child: widget.groups.isEmpty
                ? Text(tr(context, 'fits_universal'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: palette.ink))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final g in view.shown)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(child: Text(g.name(isAr), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: palette.ink))),
                              const SizedBox(width: 8),
                              Text(g.years, style: TextStyle(fontSize: 13, color: palette.muted)),
                            ],
                          ),
                        ),
                      if (_open && view.unlisted > 0) Text(tr(context, 'fits_more_models').replaceAll('{n}', '${view.unlisted}'), style: TextStyle(fontSize: 13, color: palette.muted)),
                      if (view.collapsible)
                        InkWell(
                          onTap: () => setState(() => _open = !_open),
                          child: Padding(
                            padding: const EdgeInsets.only(top: 4, bottom: 2),
                            child: Text(_open ? tr(context, 'fits_show_fewer') : '$more$vehicles', style: TextStyle(fontSize: 13, color: palette.signal, fontWeight: FontWeight.w600, decoration: TextDecoration.underline)),
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

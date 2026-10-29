import 'package:flutter/widgets.dart';
import 'periodic_refresh.dart';

/// Connects a [PeriodicRefresh] (every 5 seconds) to the app's lifecycle: it runs only while the app is in the foreground and loads at once when the app comes back. `start()` in initState, `dispose()` in dispose.
class AutoRefresher with WidgetsBindingObserver {
  AutoRefresher(Future<void> Function() onTick, {Duration interval = PeriodicRefresh.defaultInterval}) : _refresh = PeriodicRefresh(onTick, interval: interval);

  final PeriodicRefresh _refresh;
  bool _observing = false;

  void start() {
    if (!_observing) {
      WidgetsBinding.instance.addObserver(this);
      _observing = true;
    }
    final state = WidgetsBinding.instance.lifecycleState;
    _refresh.setVisible(state == null || state == AppLifecycleState.resumed);
    _refresh.start();
  }

  void dispose() {
    _refresh.stop();
    if (_observing) {
      WidgetsBinding.instance.removeObserver(this);
      _observing = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _refresh.setVisible(state == AppLifecycleState.resumed);
  }
}

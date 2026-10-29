import 'dart:async';

/// The quiet refresh of a screen or of the cart: [onTick] runs every [interval] (5 seconds) while the app is VISIBLE, and at once when it becomes visible again; never two at a time (a slow server is not piled up);
/// an error is ignored (the screen keeps what it has). Plain Dart (no Flutter), so it is tested without a device; [AutoRefresher] connects it to the app's lifecycle.
class PeriodicRefresh {
  static const Duration defaultInterval = Duration(seconds: 5);

  PeriodicRefresh(this.onTick, {this.interval = defaultInterval});

  final Future<void> Function() onTick;
  final Duration interval;
  Timer? _timer;
  bool _running = false;
  bool _visible = true;

  bool get isStarted => _timer != null;

  void start() {
    if (_timer != null) return;
    _timer = Timer.periodic(interval, (_) => tick());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  /// The app went to the background (false) or came back (true: loads at once).
  void setVisible(bool visible) {
    if (_visible == visible) return;
    _visible = visible;
    if (visible) tick();
  }

  Future<void> tick() async {
    if (_timer == null || !_visible || _running) return;
    _running = true;
    try {
      await onTick();
    } catch (_) {
      // quiet: the screen keeps what it has
    } finally {
      _running = false;
    }
  }
}

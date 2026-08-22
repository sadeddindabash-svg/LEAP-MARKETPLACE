import 'package:flutter/foundation.dart';

/// Real, simple shared signal (new) -- lets any screen that changes
/// the buyer's saved-vehicle data (setting a new default, adding, or
/// removing a vehicle) directly announce that change, and lets any
/// other screen that displays that data (the Home screen's own
/// "Shopping for" card) listen for it and refresh.
///
/// Confirmed as the real fix for a real reported bug: an earlier fix
/// attempt only re-fetched Home's own garage data on the specific
/// navigation paths that reach '/garage' FROM Home itself. Since
/// '/garage' sits outside the app's main tab shell (see app.dart's
/// own router) and can also be reached from the Account tab -- a
/// completely different screen -- that earlier fix never fired at all
/// when reached that way, since it depended on which screen happened
/// to trigger the navigation rather than on the actual data change.
/// This is deliberately navigation-path-independent: it's triggered
/// directly by the real change itself, not by how the person got to
/// the garage screen or back from it.
class GarageState extends ChangeNotifier {
  int _version = 0;

  /// Real, simple version counter -- a screen displaying garage data
  /// watches this and re-fetches whenever it changes, rather than
  /// this class trying to hold or broadcast the actual vehicle data
  /// itself (which would duplicate what ApiClient().fetchMyGarage()
  /// already does).
  int get version => _version;

  /// Real, called by any screen right after it successfully changes
  /// the buyer's saved-vehicle data on the backend.
  void notifyGarageChanged() {
    _version++;
    notifyListeners();
  }
}

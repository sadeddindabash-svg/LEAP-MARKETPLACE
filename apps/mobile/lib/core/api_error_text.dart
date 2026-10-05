import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import '../services/api_client.dart';
import 'app_strings.dart';
import 'language_state.dart';

/// The sentence to show for an [ApiException].
///
/// The backend sends English text in `message`, plus -- for errors the app knows how to
/// translate -- a stable `code` (e.g. 'insufficient_stock') and the numbers/names the
/// sentence needs. In Arabic mode this looks the code up in the app's own string table and
/// fills in the blanks; in English mode it returns the backend's message untouched, so
/// English users see exactly what they always did.
///
/// Safe to call from event handlers and async callbacks (it uses [trRead]'s non-listening
/// lookup, not the build-only [tr]). Falls back to the backend's message for any error that
/// has no code or no registered translation, so an untranslated error is never blank.
String apiErrorText(BuildContext context, ApiException e) {
  final code = e.code;
  if (code == null) return e.message;
  if (!context.read<LanguageState>().isArabic) return e.message;
  final template = trRead(context, code);
  if (template == code) return e.message; // trRead returns the key itself when unknown
  var text = template;
  e.details?.forEach((key, value) {
    text = text.replaceAll('{$key}', '$value');
  });
  return text;
}

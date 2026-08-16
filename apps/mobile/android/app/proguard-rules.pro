# Real, confirmed fix -- google_mlkit_text_recognition's own plugin
# code references these optional per-language recognizer classes
# (Chinese, Japanese, Korean, Devanagari) regardless of which ones an
# app actually uses. This app only uses the default Latin-script
# recognizer for VIN scanning, so these are genuinely absent from the
# build and R8 can't resolve them. Confirmed via the exact real R8
# error text naming these specific missing classes.
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**

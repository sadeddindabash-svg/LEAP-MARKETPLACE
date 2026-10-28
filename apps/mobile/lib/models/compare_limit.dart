/// How many items the app compares at a time: 2. The compare table has 140 px columns beside a 110 px label column, so two items (110 + 2 x 140 = 390 px) fit a phone screen exactly, while four would scroll sideways.
/// (The website compares up to 4 on a tablet or a computer and 2 on a phone.) Plain Dart (no Flutter), so it is tested without a device.
const int compareMaxItems = 2;

/// Whether one more item can be ticked for the comparison, given how many are already ticked.
bool canSelectForCompare(int alreadySelected) => alreadySelected < compareMaxItems;

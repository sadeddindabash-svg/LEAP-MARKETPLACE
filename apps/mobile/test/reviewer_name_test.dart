import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import '../lib/core/reviewer_name.dart';

// A reviewer's name is hidden on the product screen (the same rule as the website).
void main() {
  test('the first 2 letters in capitals, ***, and the last 2', () {
    expect(maskReviewerName('micheal'), 'MI***al');
    expect(maskReviewerName('michael'), 'MI***el');
    expect(maskReviewerName('Sarah'), 'SA***ah');
  });
  test('a full name is treated as one (spaces ignored)', () {
    expect(maskReviewerName('Mohammed Alharbi'), 'MO***bi');
    expect(maskReviewerName('  Ahmed  Ali '), 'AH***li');
  });
  test('a short name (4 letters or fewer) is hidden almost completely', () {
    expect(maskReviewerName('Ali'), 'A***');
    expect(maskReviewerName('omar'), 'O***');
  });
  test('Arabic names', () {
    expect(maskReviewerName('محمد العتيبي'), 'مح***بي');
    expect(maskReviewerName('علي'), 'ع***');
  });
  test('no name -> null, so the screen shows "Buyer"', () {
    expect(maskReviewerName(null), isNull);
    expect(maskReviewerName(''), isNull);
    expect(maskReviewerName('   '), isNull);
  });
  test('the reviews list shows the hidden name, never the full one', () {
    final src = File('lib/widgets/reviews_section.dart').readAsStringSync();
    expect(src.contains("import '../core/reviewer_name.dart';"), isTrue);
    expect(src.contains('Text(maskReviewerName(r.buyerName) ??'), isTrue);
    expect(src.contains('Text(r.buyerName ??'), isFalse);
  });
}

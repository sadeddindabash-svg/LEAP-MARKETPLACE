import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:leap_mobile/models/wishlist_model.dart';

// The shared wishlist: loaded once for the signed-in buyer, changed at once by a heart, put back if the save fails. Plain Dart: no device needed.
class _Clock {
  DateTime now = DateTime(2026, 10, 28, 12);
  DateTime call() => now;
}

void main() {
  late int changes;
  late _Clock clock;
  late WishlistModel model;
  late int fetches;
  Future<Set<String>> Function(String) fetcher(Set<String> ids) => (t) async {
        fetches++;
        return ids;
      };
  setUp(() {
    changes = 0;
    fetches = 0;
    clock = _Clock();
    model = WishlistModel(onChanged: () => changes++, clock: clock.call);
  });

  group('loading', () {
    test('signed out: empty and ready at once, nothing asked for, and the change is announced once', () async {
      await model.ensureLoaded(null, fetcher({'a'}));
      expect(model.ready, isTrue);
      expect(model.isSaved('a'), isFalse);
      expect(fetches, equals(0));
      expect(changes, equals(1));
      await model.ensureLoaded(null, fetcher({'a'}));
      expect(changes, equals(1), reason: 'nothing changed the second time');
    });
    test('signed in: the list is loaded, and it is ready only after', () async {
      final c = Completer<Set<String>>();
      final f = model.ensureLoaded('tok', (t) => c.future);
      expect(model.ready, isFalse);
      expect(model.isSaved('a'), isFalse);
      c.complete({'a', 'b'});
      await f;
      expect(model.ready, isTrue);
      expect(model.isSaved('a'), isTrue);
      expect(model.isSaved('c'), isFalse);
      expect(model.count, equals(2));
    });
    test('many hearts asking at once make ONE request', () async {
      final c = Completer<Set<String>>();
      var n = 0;
      Future<Set<String>> slow(String t) {
        n++;
        return c.future;
      }

      final all = [model.ensureLoaded('tok', slow), model.ensureLoaded('tok', slow), model.ensureLoaded('tok', slow)];
      c.complete({'a'});
      await Future.wait(all);
      expect(n, equals(1));
      expect(model.isSaved('a'), isTrue);
    });
    test('a list younger than a minute is not asked for again; an older one is reloaded quietly; force reloads at once', () async {
      await model.ensureLoaded('tok', fetcher({'a'}));
      await model.ensureLoaded('tok', fetcher({'a'}));
      expect(fetches, equals(1));
      clock.now = clock.now.add(const Duration(seconds: 59));
      await model.ensureLoaded('tok', fetcher({'a'}));
      expect(fetches, equals(1));
      clock.now = clock.now.add(const Duration(seconds: 2));
      final c = Completer<Set<String>>();
      final f = model.ensureLoaded('tok', (t) => c.future);
      expect(model.ready, isTrue, reason: 'the hearts keep their state while it reloads');
      expect(model.isSaved('a'), isTrue);
      c.complete({'b'});
      await f;
      expect(model.isSaved('a'), isFalse);
      expect(model.isSaved('b'), isTrue);
      await model.ensureLoaded('tok', fetcher({'c'}), force: true);
      expect(model.isSaved('c'), isTrue);
    });
    test('another buyer (a new token) empties the list at once and loads THEIR list', () async {
      await model.ensureLoaded('tokA', fetcher({'a'}));
      final c = Completer<Set<String>>();
      final f = model.ensureLoaded('tokB', (t) => c.future);
      expect(model.isSaved('a'), isFalse);
      expect(model.ready, isFalse);
      c.complete({'b'});
      await f;
      expect(model.isSaved('b'), isTrue);
    });
    test('signing out empties it', () async {
      await model.ensureLoaded('tok', fetcher({'a'}));
      await model.ensureLoaded(null, fetcher({}));
      expect(model.isSaved('a'), isFalse);
      expect(model.ready, isTrue);
    });
    test('a list that arrives after the buyer signed out is ignored', () async {
      final c = Completer<Set<String>>();
      final f = model.ensureLoaded('tok', (t) => c.future);
      await model.ensureLoaded(null, fetcher({}));
      c.complete({'a'});
      await f;
      expect(model.isSaved('a'), isFalse);
    });
    test('a failed load: ready, nothing wrongly saved; a failed reload keeps what was known', () async {
      await model.ensureLoaded('tok', (t) async => throw Exception('down'));
      expect(model.ready, isTrue);
      expect(model.count, equals(0));
      final other = WishlistModel(onChanged: () {}, clock: clock.call);
      await other.ensureLoaded('tok', fetcher({'a'}));
      clock.now = clock.now.add(const Duration(minutes: 5));
      await other.ensureLoaded('tok', (t) async => throw Exception('down'));
      expect(other.isSaved('a'), isTrue);
    });
  });

  group('pressing a heart', () {
    test('saving: saved AT ONCE (before the answer), the server is told, and it stuck', () async {
      await model.ensureLoaded('tok', fetcher({}));
      final c = Completer<void>();
      final told = <String>[];
      final f = model.toggle('a', add: (id) {
        told.add('add $id');
        return c.future;
      }, remove: (id) async => told.add('remove $id'));
      expect(model.isSaved('a'), isTrue);
      expect(told, equals(['add a']));
      c.complete();
      expect(await f, isTrue);
      expect(model.isSaved('a'), isTrue);
    });
    test('removing: unsaved at once, and the server is told to remove', () async {
      await model.ensureLoaded('tok', fetcher({'a'}));
      final told = <String>[];
      final f = model.toggle('a', add: (id) async => told.add('add $id'), remove: (id) async => told.add('remove $id'));
      expect(model.isSaved('a'), isFalse);
      expect(await f, isTrue);
      expect(told, equals(['remove a']));
    });
    test('a save that FAILS goes back (and so does a failed removal)', () async {
      await model.ensureLoaded('tok', fetcher({'b'}));
      expect(await model.toggle('a', add: (id) async => throw Exception('no'), remove: (id) async {}), isFalse);
      expect(model.isSaved('a'), isFalse);
      expect(await model.toggle('b', add: (id) async {}, remove: (id) async => throw Exception('no')), isFalse);
      expect(model.isSaved('b'), isTrue);
    });
    test('a second press on the same part while the first is on its way is ignored; another part is not', () async {
      await model.ensureLoaded('tok', fetcher({}));
      final c = Completer<void>();
      var adds = 0;
      Future<void> add(String id) {
        adds++;
        return c.future;
      }

      final first = model.toggle('a', add: add, remove: (id) async {});
      expect(await model.toggle('a', add: add, remove: (id) async {}), isFalse);
      model.toggle('b', add: add, remove: (id) async {});
      expect(adds, equals(2), reason: 'one for a (not two), one for b');
      c.complete();
      await first;
      expect(model.isSaved('a'), isTrue);
    });
    test('every change is announced (so the hearts redraw): the press, and the answer', () async {
      await model.ensureLoaded('tok', fetcher({}));
      final before = changes;
      await model.toggle('a', add: (id) async {}, remove: (id) async {});
      expect(changes - before, greaterThanOrEqualTo(2));
    });
    test('a heart pressed while the list is still coming keeps its new state when the list arrives', () async {
      final c = Completer<Set<String>>();
      final f = model.ensureLoaded('tok', (t) => c.future);
      final add = Completer<void>();
      final t = model.toggle('x', add: (id) => add.future, remove: (id) async {});
      c.complete({'a'});
      await f;
      expect(model.isSaved('x'), isTrue);
      expect(model.isSaved('a'), isTrue);
      add.complete();
      await t;
    });
  });
}

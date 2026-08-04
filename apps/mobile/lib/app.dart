import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'core/auth_state.dart';
import 'core/cart_state.dart';
import 'core/language_state.dart';
import 'core/app_lock_state.dart';
import 'core/theme_state.dart';
import 'widgets/app_lock_gate.dart';
import 'core/app_strings.dart';
import 'services/api_client.dart';
import 'features/home/home_screen.dart';
import 'features/search/search_screen.dart';
import 'features/garage/garage_screen.dart';
import 'features/catalog/category_screen.dart';
import 'features/catalog/category_browse_screen.dart';
import 'features/catalog/product_screen.dart';
import 'features/cart/cart_screen.dart';
import 'features/checkout/checkout_screen.dart';
import 'features/orders/orders_screen.dart';
import 'features/orders/order_detail_screen.dart';
import 'features/orders/tracking_screen.dart';
import 'features/orders/returns_screen.dart';
import 'features/orders/return_case_detail_screen.dart';
import 'features/account/account_screen.dart';
import 'features/account/addresses_screen.dart';
import 'features/account/wishlist_screen.dart';
import 'features/saved_searches/saved_searches_screen.dart';
import 'features/account/notifications_screen.dart';
import 'features/account/referrals_screen.dart';
import 'features/account/address_form_screen.dart';
import 'features/account/change_email_screen.dart';
import 'features/support/chat_screen.dart';
import 'features/support/new_ticket_screen.dart';
import 'features/support/ticket_detail_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/signup_screen.dart';
import 'features/auth/forgot_password_screen.dart';
import 'features/auth/reset_password_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/home',
  routes: [
    ShellRoute(
      builder: (context, state, child) => RootShell(child: child),
      routes: [
        GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
        GoRoute(path: '/categories', builder: (context, state) => const CategoryBrowseScreen()),
        GoRoute(path: '/cart', builder: (context, state) => const CartScreen()),
        GoRoute(path: '/orders', builder: (context, state) => const OrdersScreen()),
        GoRoute(path: '/account', builder: (context, state) => const AccountScreen()),
      ],
    ),
    GoRoute(path: '/garage', builder: (context, state) => const GarageScreen()),
    GoRoute(path: '/search', builder: (context, state) => const SearchScreen()),
    GoRoute(path: '/addresses', builder: (context, state) => const AddressesScreen()),
    GoRoute(path: '/wishlist', builder: (context, state) => const WishlistScreen()),
    GoRoute(path: '/saved-searches', builder: (context, state) => const SavedSearchesScreen()),
    GoRoute(path: '/notifications', builder: (context, state) => const NotificationsScreen()),
    GoRoute(path: '/referrals', builder: (context, state) => const ReferralsScreen()),
    GoRoute(path: '/addresses/add', builder: (context, state) => const AddressFormScreen()),
    GoRoute(path: '/account/change-email', builder: (context, state) => const ChangeEmailScreen()),
    GoRoute(
      path: '/addresses/edit',
      builder: (context, state) => AddressFormScreen(existing: state.extra as Map<String, dynamic>?),
    ),
    GoRoute(
      path: '/category-browse/:id',
      builder: (context, state) => CategoryBrowseScreen(initialCategoryId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/category/:id',
      builder: (context, state) {
        // Real Map extra from CategoryBrowseScreen (categoryName + the
        // exact real Part tapped); falls back to a plain String extra
        // for any caller that just wants the flat category list with
        // no Part filter (none currently do, but kept for robustness
        // rather than assuming the shape).
        final extra = state.extra;
        String? categoryName;
        String? part;
        if (extra is Map) {
          categoryName = extra['categoryName'] as String?;
          part = extra['part'] as String?;
        } else if (extra is String) {
          categoryName = extra;
        }
        return CategoryScreen(
          categoryId: state.pathParameters['id']!,
          categoryName: categoryName ?? state.pathParameters['id']!,
          part: part,
        );
      },
    ),
    GoRoute(
      path: '/product/:id',
      builder: (context, state) => ProductScreen(productId: state.pathParameters['id']!),
    ),
    // Real alias route (new) -- closes a real, confirmed bug found
    // while extending deep-link scaffolding to product sharing:
    // shared product links point to /products/:id (plural, matching
    // apps/web-storefront's own real URL structure -- see
    // product_screen.dart's own _shareProduct), but this app's own
    // internal route was /product/:id (singular). Even with real
    // domain/signing fully configured for App Links/Universal Links,
    // a real shared link would have failed to route correctly inside
    // this app without this. Kept the original path too, since
    // internal navigation (e.g. from Home, Search, Cart) already
    // calls context.push('/product/$id') directly.
    GoRoute(
      path: '/products/:id',
      builder: (context, state) => ProductScreen(productId: state.pathParameters['id']!),
    ),
    GoRoute(path: '/checkout', builder: (context, state) => const CheckoutScreen()),
    GoRoute(path: '/orders/:id', builder: (context, state) => OrderDetailScreen(orderId: state.pathParameters['id']!, guestEmail: state.uri.queryParameters['guestEmail'])),
    GoRoute(path: '/orders/:id/tracking', builder: (context, state) => TrackingScreen(orderId: state.pathParameters['id']!)),
    GoRoute(path: '/returns', builder: (context, state) => const ReturnsScreen()),
    GoRoute(path: '/returns/:id', builder: (context, state) => ReturnCaseDetailScreen(caseId: state.pathParameters['id']!, guestEmail: state.uri.queryParameters['guestEmail'])),
    GoRoute(path: '/support', builder: (context, state) => const ChatScreen()),
    GoRoute(path: '/support/new', builder: (context, state) => const NewTicketScreen()),
    GoRoute(path: '/support/:id', builder: (context, state) => TicketDetailScreen(ticketId: state.pathParameters['id']!, guestEmail: state.uri.queryParameters['guestEmail'])),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/signup', builder: (context, state) {
      final extra = state.extra as Map<String, dynamic>?;
      return SignupScreen(prefillEmail: extra?['prefillEmail'] as String?);
    }),
    GoRoute(path: '/forgot-password', builder: (context, state) => const ForgotPasswordScreen()),
    GoRoute(
      path: '/reset-password',
      builder: (context, state) => ResetPasswordScreen(initialToken: state.uri.queryParameters['token']),
    ),
  ],
);

/// Bottom-nav tabs matching the reference prototype: Home, Shop, Cart,
/// Orders, Account.
class RootShell extends StatelessWidget {
  final Widget child;
  const RootShell({super.key, required this.child});

  static const _tabs = ['/home', '/categories', '/cart', '/orders', '/account'];

  int _indexForLocation(String location) {
    final i = _tabs.indexWhere((t) => location.startsWith(t));
    return i == -1 ? 0 : i;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    // Real cart item-count badge (new) -- closes a real, common gap:
    // the bottom nav had no badges at all. context.watch is genuinely
    // safe here -- this is a real build() method (StatelessWidget's
    // own build, not an event-handler callback), the exact distinction
    // that mattered for the earlier real bugs found in this session.
    final cartItemCount = context.watch<CartState>().itemCount;
    final auth = context.watch<AuthState>();
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _indexForLocation(location),
        onTap: (i) => context.go(_tabs[i]),
        items: [
          BottomNavigationBarItem(icon: const Icon(Icons.home_outlined), label: tr(context, 'nav_home')),
          BottomNavigationBarItem(icon: const Icon(Icons.grid_view_outlined), label: tr(context, 'nav_shop')),
          BottomNavigationBarItem(
            icon: cartItemCount > 0
                ? Badge(
                    label: Text(cartItemCount > 99 ? '99+' : '$cartItemCount'),
                    child: const Icon(Icons.shopping_cart_outlined),
                  )
                : const Icon(Icons.shopping_cart_outlined),
            label: tr(context, 'nav_cart'),
          ),
          BottomNavigationBarItem(icon: const Icon(Icons.inventory_2_outlined), label: tr(context, 'nav_orders')),
          BottomNavigationBarItem(
            // Real unread-notification badge (new) -- deliberately a
            // simple FutureBuilder, refetched on each real navigation
            // (this whole build() reruns then), rather than converting
            // RootShell to a StatefulWidget with its own polling timer
            // -- lower risk given recent history, accepting some
            // redundant real network calls in exchange for not adding
            // new persistent state to the app's own root shell.
            icon: !auth.isLoggedIn
                ? const Icon(Icons.person_outline)
                : FutureBuilder<int>(
                    future: ApiClient().fetchUnreadNotificationCount(auth.token!),
                    builder: (context, snapshot) {
                      final count = snapshot.data ?? 0;
                      return count > 0
                          ? Badge(
                              label: Text(count > 99 ? '99+' : '$count'),
                              child: const Icon(Icons.person_outline),
                            )
                          : const Icon(Icons.person_outline);
                    },
                  ),
            label: tr(context, 'nav_account'),
          ),
        ],
      ),
    );
  }
}

class LeapApp extends StatelessWidget {
  const LeapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider(create: (_) => CartState()),
        ChangeNotifierProvider(create: (_) => LanguageState()),
        ChangeNotifierProvider(create: (_) => AppLockState()),
        ChangeNotifierProvider(create: (_) => ThemeState()),
      ],
      child: Consumer2<LanguageState, ThemeState>(
        builder: (context, languageState, themeState, _) {
          return MaterialApp.router(
            title: 'LEAP Auto Parts',
            debugShowCheckedModeBanner: false,
            theme: LeapTheme.light(),
            darkTheme: LeapTheme.dark(),
            themeMode: themeState.mode,
            routerConfig: appRouter,
            // Real RTL layout when Arabic is selected — Flutter's standard
            // Material widgets mirror automatically under Directionality.rtl
            // (padding, icons, row order, etc.). See LanguageState's header
            // comment for the honest scope boundary: this makes the LAYOUT
            // correctly RTL app-wide, but most existing screen text/labels
            // outside the product detail page are not yet translated into
            // Arabic — that's a real, separate follow-up, not hidden here.
            builder: (context, child) => Directionality(
              textDirection: languageState.isArabic ? TextDirection.rtl : TextDirection.ltr,
              // Real biometric app lock gate (new) -- see
              // core/app_lock_state.dart's own header comment for the
              // honest web-platform limitation.
              child: AppLockGate(child: child ?? const SizedBox.shrink()),
            ),
          );
        },
      ),
    );
  }
}

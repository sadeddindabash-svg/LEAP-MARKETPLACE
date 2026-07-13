import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'core/auth_state.dart';
import 'core/cart_state.dart';
import 'features/home/home_screen.dart';
import 'features/garage/garage_screen.dart';
import 'features/catalog/category_screen.dart';
import 'features/catalog/product_screen.dart';
import 'features/cart/cart_screen.dart';
import 'features/checkout/checkout_screen.dart';
import 'features/orders/orders_screen.dart';
import 'features/account/account_screen.dart';
import 'features/support/chat_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/signup_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/home',
  routes: [
    ShellRoute(
      builder: (context, state, child) => RootShell(child: child),
      routes: [
        GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
        GoRoute(path: '/categories', builder: (context, state) => const _CategoriesPlaceholder()),
        GoRoute(path: '/cart', builder: (context, state) => const CartScreen()),
        GoRoute(path: '/orders', builder: (context, state) => const OrdersScreen()),
        GoRoute(path: '/account', builder: (context, state) => const AccountScreen()),
      ],
    ),
    GoRoute(path: '/garage', builder: (context, state) => const GarageScreen()),
    GoRoute(
      path: '/category/:id',
      builder: (context, state) => CategoryScreen(
        categoryId: state.pathParameters['id']!,
        categoryName: (state.extra as String?) ?? state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      path: '/product/:id',
      builder: (context, state) => ProductScreen(productId: state.pathParameters['id']!),
    ),
    GoRoute(path: '/checkout', builder: (context, state) => const CheckoutScreen()),
    GoRoute(path: '/support', builder: (context, state) => const ChatScreen()),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/signup', builder: (context, state) => const SignupScreen()),
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
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _indexForLocation(location),
        onTap: (i) => context.go(_tabs[i]),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_outlined), label: 'Shop'),
          BottomNavigationBarItem(icon: Icon(Icons.shopping_cart_outlined), label: 'Cart'),
          BottomNavigationBarItem(icon: Icon(Icons.inventory_2_outlined), label: 'Orders'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Account'),
        ],
      ),
    );
  }
}

class _CategoriesPlaceholder extends StatelessWidget {
  const _CategoriesPlaceholder();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shop by category')),
      body: const Center(child: Text('Reuses the category grid from HomeScreen — extract into a shared widget.')),
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
      ],
      child: MaterialApp.router(
        title: 'Leap',
        debugShowCheckedModeBanner: false,
        theme: LeapTheme.light(),
        routerConfig: appRouter,
      ),
    );
  }
}

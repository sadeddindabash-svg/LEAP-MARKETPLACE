import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// BUY-060: buyer support is Platform-only. There is no supplier contact
/// path in this app, by explicit business requirement — don't add one when
/// wiring this up to real chat infrastructure later.
class ChatScreen extends StatelessWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leap Support')),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: const Color(0xFFE9EFFC),
            padding: const EdgeInsets.all(12),
            child: const Text(
              "You're chatting with the Leap team, not the supplier directly.",
              style: TextStyle(color: LeapColors.torque, fontSize: 12),
            ),
          ),
          const Expanded(
            child: Center(child: Text('Chat messages render here.', style: TextStyle(color: LeapColors.muted))),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Expanded(
                  child: TextField(decoration: InputDecoration(hintText: 'Type a message…')),
                ),
                const SizedBox(width: 8),
                IconButton.filled(onPressed: () {}, icon: const Icon(Icons.send)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
